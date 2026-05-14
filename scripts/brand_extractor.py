"""
Brand asset extractor — pure Python, stdlib only.

Fetches a customer website and extracts logo URL, brand colors, and company
name from HTML meta tags, link elements, and inline CSS.  Falls back to the
favicon convention, Google's favicon API, and curated colors from
brandcolorcode.com when scraping yields nothing.

Security model:
- All fetched URLs go through ``_is_safe_url`` which rejects non-http(s)
  schemes (no ``file://``, ``javascript:``, ``data:``, ``ftp://`` …), private
  / loopback / cloud-metadata IPs (SSRF guard), CRLF injection, and oversized
  URLs.  The same validator is applied to the ``logo_url`` we return, so the
  value stored in ``brand-config.json`` and rendered as ``<img src=…>`` in the
  React app can never be a ``javascript:`` XSS payload.
- Redirect targets are re-validated through the same allowlist.
- Response body is capped at 512 KB and we send ``Accept-Encoding: identity``
  to prevent gzip-bomb amplification.

Every public function is safe to call with arbitrary input — failures are
caught internally and result in empty strings or empty lists.  Nothing
escapes.
"""

import colorsys
import re
import ssl
import urllib.request
from collections import Counter
from html.parser import HTMLParser
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse, urljoin
from urllib.request import urlopen, Request

_TIMEOUT = 6  # seconds — slightly higher than before to absorb the retry path

_CHROME_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/131.0.0.0 Safari/537.36"
)
_FIREFOX_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:128.0) "
    "Gecko/20100101 Firefox/128.0"
)
_BROWSER_HEADERS = {
    "Accept": (
        "text/html,application/xhtml+xml,application/xml;q=0.9,"
        "image/avif,image/webp,*/*;q=0.8"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    # identity prevents gzip-bomb amplification; we read at most 512 KB anyway
    "Accept-Encoding": "identity",
    "Connection": "close",
}

_MAX_BODY_BYTES = 512_000
_MAX_URL_LEN = 2048
_MAX_COMPANY_NAME = 200


# ---------------------------------------------------------------------------
# URL safety (SSRF + scheme guard)
# ---------------------------------------------------------------------------

_ALLOWED_FETCH_SCHEMES = ("http", "https")

_BLOCKED_HOSTNAMES = frozenset({
    "localhost", "0.0.0.0", "0", "127.0.0.1", "::1",
    "169.254.169.254",                  # AWS / GCP IMDS
    "metadata.google.internal",         # GCP IMDS
    "metadata.azure.com",               # Azure IMDS
    "100.100.100.200",                  # Alibaba Cloud IMDS
})

_BLOCKED_HOST_PREFIXES = (
    "127.", "10.", "192.168.", "169.254.", "0.",
    "fe80:", "fc00:", "fd00:",          # IPv6 link-local + ULA
)


def _is_safe_url(url):
    """Return True iff *url* is safe to fetch AND safe to embed in HTML.

    Closes three real holes audited in the current code:
        * file:// local file disclosure
        * javascript: / data: URLs flowing into <img src=…> as XSS
        * SSRF to RFC1918 / loopback / cloud-metadata hosts

    Returns False on any error or malformed input — never raises.
    """
    try:
        if not url or not isinstance(url, str) or len(url) > _MAX_URL_LEN:
            return False
        # CRLF / control-character injection in URLs
        if any(ord(c) < 0x20 or ord(c) == 0x7F for c in url):
            return False
        p = urlparse(url)
        if p.scheme not in _ALLOWED_FETCH_SCHEMES:
            return False
        host = (p.hostname or "").lower()
        if not host or host in _BLOCKED_HOSTNAMES:
            return False
        for prefix in _BLOCKED_HOST_PREFIXES:
            if host.startswith(prefix):
                return False
        # 172.16.0.0/12 (RFC1918 private range)
        if host.startswith("172."):
            try:
                octet = int(host.split(".")[1])
                if 16 <= octet <= 31:
                    return False
            except (ValueError, IndexError):
                pass
        return True
    except Exception:
        return False


def _redact_url(url):
    """Strip query and fragment from *url* for safe logging (avoids leaking
    credentials carried as query parameters like ``?token=…``)."""
    try:
        p = urlparse(url)
        if p.scheme and p.netloc:
            return f"{p.scheme}://{p.netloc}{p.path}"
        return str(url)[:64]
    except Exception:
        return str(url)[:64] if url else ""


# DNS label: alnum, optional internal hyphens, 1..63 chars, must start+end alnum.
# Full hostname: two or more labels separated by dots ("aa.com", "www.aa.com").
_DNS_HOSTNAME_RE = re.compile(
    r"^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?"
    r"(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$"
)
_IPV4_RE = re.compile(r"^\d{1,3}(\.\d{1,3}){3}$")


def looks_like_valid_url(url):
    """Lightweight syntactic + safety validation for a customer-supplied URL.

    Returns True iff ALL of:
        * ``_is_safe_url(url)`` is True (scheme = http/https, no SSRF target,
          no ``javascript:`` / ``file://`` / ``data:``, no oversized URL, no
          CRLF injection).
        * The URL contains NO userinfo (``user:pass@host``) -- legitimate
          customer URLs never need credentials in them.
        * The hostname is EITHER a valid IPv4 dotted-quad with octets in
          0..255 (e.g. ``93.184.216.34``) OR a syntactically valid DNS name
          with at least one dot AND at least one non-numeric label (so
          ``aa.com`` passes but ``1.2.3`` and ``1.2.3.4.5`` are rejected).
        * ``_is_safe_url`` has already rejected private / loopback / metadata
          IPs, so any IPv4 we accept here is public.

    This is intended as a "quick" sanity check at the install prompt: we want
    to STORE the user's URL verbatim in workshop_parameters.company_brand_url,
    but only if it's a real URL.  Garbage like ``foo`` or ``My Company`` is
    rejected so it never makes it into the runtime config.

    Never raises.  Returns False on any error.
    """
    try:
        if not _is_safe_url(url):
            return False
        p = urlparse(url)
        # Reject userinfo (user:pass@host) -- customer URLs never carry creds
        if p.username or p.password or "@" in (p.netloc or ""):
            return False
        host = (p.hostname or "").lower()
        if not host:
            return False
        if _IPV4_RE.match(host):
            try:
                if all(0 <= int(o) <= 255 for o in host.split(".")):
                    return True
            except ValueError:
                return False
            return False
        if "." not in host:
            return False  # bare hostnames like 'foo' are not valid customer URLs
        if not _DNS_HOSTNAME_RE.match(host):
            return False
        # Reject all-numeric labels that don't form a valid IPv4 (e.g. '1.2.3',
        # '1.2.3.4.5').  At least one label must contain a non-digit.
        labels = host.split(".")
        if all(label.isdigit() for label in labels):
            return False
        return True
    except Exception:
        return False


class _SafeRedirectHandler(urllib.request.HTTPRedirectHandler):
    """Re-validate redirect targets so a 302 cannot bounce us to a blocked
    host (e.g. attacker.com → 169.254.169.254/latest/meta-data/)."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if not _is_safe_url(newurl):
            return None
        return super().redirect_request(req, fp, code, msg, headers, newurl)


# ---------------------------------------------------------------------------
# Colour helpers
# ---------------------------------------------------------------------------

_HEX_RE = re.compile(r"^#(?:[0-9a-fA-F]{3}){1,2}$")


def hex_to_hsl(hex_color):
    """Convert '#RRGGBB' or '#RGB' to the 'H S% L%' format used by CSS vars."""
    if not hex_color or not isinstance(hex_color, str) or not _HEX_RE.match(hex_color):
        return ""
    try:
        h = hex_color.lstrip("#")
        if len(h) == 3:
            h = "".join(c * 2 for c in h)
        r, g, b = int(h[0:2], 16) / 255, int(h[2:4], 16) / 255, int(h[4:6], 16) / 255
        hue, light, sat = colorsys.rgb_to_hls(r, g, b)
        return f"{round(hue * 360)} {round(sat * 100)}% {round(light * 100)}%"
    except Exception:
        return ""


def _normalise_color(raw):
    """Return a '#RRGGBB' string if *raw* looks like a valid hex colour."""
    try:
        if not raw or not isinstance(raw, str):
            return ""
        raw = raw.strip().lower()
        if _HEX_RE.match(raw):
            if len(raw) == 4:
                return ("#" + "".join(c * 2 for c in raw[1:])).upper()
            return raw.upper()
        return ""
    except Exception:
        return ""


# ---------------------------------------------------------------------------
# HTML parser
# ---------------------------------------------------------------------------

class _BrandHTMLParser(HTMLParser):
    """Single-pass parser that collects brand-relevant tags."""

    def __init__(self):
        super().__init__()
        self.og_image = ""
        self.og_site_name = ""
        self.theme_color = ""
        self.tile_color = ""
        self.apple_touch_icon = ""
        self.png_icon = ""
        self.favicon_href = ""
        self.title_text = ""
        self._in_title = False
        self._header_imgs = []
        self._in_header_or_nav = False
        self._depth = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)

        if tag == "meta":
            prop = (a.get("property") or "").lower()
            name = (a.get("name") or "").lower()
            content = a.get("content", "")
            if prop == "og:image" and content:
                self.og_image = self.og_image or content
            if prop == "og:site_name" and content:
                self.og_site_name = self.og_site_name or content
            if name == "theme-color" and content:
                self.theme_color = self.theme_color or content
            if name == "msapplication-tilecolor" and content:
                self.tile_color = self.tile_color or content

        elif tag == "link":
            rel = (a.get("rel") or "").lower()
            href = a.get("href", "")
            if "apple-touch-icon" in rel and href:
                self.apple_touch_icon = self.apple_touch_icon or href
            if "icon" in rel and "png" in (a.get("type") or "").lower() and href:
                self.png_icon = self.png_icon or href
            if "icon" in rel and href:
                self.favicon_href = self.favicon_href or href

        elif tag == "title":
            self._in_title = True

        elif tag in ("header", "nav"):
            self._in_header_or_nav = True
            self._depth = 0

        if self._in_header_or_nav:
            self._depth += 1
            if tag == "img":
                src = a.get("src", "")
                alt = (a.get("alt") or "").lower()
                cls = (a.get("class") or "").lower()
                id_ = (a.get("id") or "").lower()
                if src and any("logo" in s for s in (alt, cls, id_, src.lower())):
                    self._header_imgs.append(src)

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False
        if self._in_header_or_nav:
            self._depth -= 1
            if self._depth <= 0:
                self._in_header_or_nav = False

    def handle_data(self, data):
        if self._in_title:
            self.title_text += data


# ---------------------------------------------------------------------------
# HTTP fetch
# ---------------------------------------------------------------------------

def _build_opener():
    """Build a urllib opener with our safe-redirect handler and an SSL
    context.  Returns ``None`` on failure (caller handles gracefully)."""
    try:
        ctx = ssl.create_default_context()
        return urllib.request.build_opener(
            urllib.request.HTTPSHandler(context=ctx),
            _SafeRedirectHandler(),
        )
    except Exception:
        return None


def _fetch(url):
    """GET *url* and return the decoded body, or '' on any error.

    Hardened behaviour:
        * Rejects unsafe schemes / private IPs / cloud-metadata hosts via
          _is_safe_url (closes file://, javascript:, SSRF).
        * Sends real-browser User-Agent + standard browser headers so WAFs
          with light bot detection (Cloudflare basic, generic UA blocklists)
          let us through.
        * Retries once with a Firefox UA on HTTPError (covers UA-specific
          blocks).  No retry on connection errors / timeouts.
        * Body capped at 512 KB; Accept-Encoding: identity prevents gzip bomb.
        * Redirects re-validated via _SafeRedirectHandler.

    Any other exception is swallowed and we return ''.
    """
    if not _is_safe_url(url):
        return ""
    opener = _build_opener()
    if opener is None:
        return ""
    for ua in (_CHROME_UA, _FIREFOX_UA):
        try:
            headers = {"User-Agent": ua, **_BROWSER_HEADERS}
            req = Request(url, headers=headers)
            with opener.open(req, timeout=_TIMEOUT) as resp:
                # Re-validate the final URL after redirects (belt + suspenders;
                # _SafeRedirectHandler should have already enforced this)
                final_url = getattr(resp, "url", url) or url
                if not _is_safe_url(final_url):
                    return ""
                return resp.read(_MAX_BODY_BYTES).decode("utf-8", errors="replace")
        except HTTPError:
            continue  # retry with next UA only on HTTP-level rejection
        except (URLError, TimeoutError):
            return ""  # connection-level error -- no retry
        except Exception:
            return ""
    return ""


# ---------------------------------------------------------------------------
# brandcolorcode.com — curated colour lookup (colors-only fallback)
# ---------------------------------------------------------------------------

def _try_brandcolorcode(company_name):
    """Look up curated brand colours on brandcolorcode.com.

    Returns up to 3 hex strings (``['#RRGGBB', …]``) or ``[]`` on any miss /
    error.  STRICT INVARIANTS:

        * Used for colours only.  Never returns a URL.  Never overrides
          company_name or logo_url.
        * Page title MUST contain the expected company-name tokens before we
          trust the hex codes (defends against /aa → 'Aajtak' wrong-brand
          collisions).
        * Returns ``[]`` on every failure path.  Never raises.
    """
    try:
        if not company_name or not isinstance(company_name, str):
            return []
        try:
            base = re.sub(r"[^a-z0-9\s-]", "", company_name.lower()).strip()
            base = re.sub(r"\s+", "-", base)
        except Exception:
            return []
        if not base or len(base) < 2:
            return []
        # Expected tokens for title validation -- only words >=3 chars survive
        name_tokens = [t for t in company_name.lower().split() if len(t) > 2]
        if not name_tokens:
            return []
        for slug in (base, f"{base}-group", f"{base}-corporation"):
            try:
                url = f"https://www.brandcolorcode.com/{slug}"
                if not _is_safe_url(url):
                    continue
                html = _fetch(url)
                if not html:
                    continue
                title_m = re.search(
                    r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL
                )
                title = (title_m.group(1) if title_m else "").lower()
                if not all(t in title for t in name_tokens[:2]):
                    continue  # title mismatch -- wrong brand
                hexes = re.findall(r"\b([0-9A-Fa-f]{6})\b", html)
                counts = Counter(
                    c.upper() for c in hexes if c.upper() not in ("FFFFFF", "000000")
                )
                top = [f"#{h}" for h, c in counts.most_common(5) if c >= 3]
                if top:
                    return top[:3]
            except Exception:
                continue
        return []
    except Exception:
        return []


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def _clean_title(raw):
    """Strip common separators and boilerplate from <title> text."""
    try:
        if not raw or not isinstance(raw, str):
            return ""
        for sep in (" | ", " - ", " — ", " – ", " :: ", " : "):
            if sep in raw:
                raw = raw.split(sep)[0]
        return raw.strip()
    except Exception:
        return ""


def extract_brand_assets(url):
    """Fetch *url* and return extracted brand assets.

    Returns a dict with keys: company_name, logo_url, primary_color,
    secondary_color, accent_color.  All values are strings; missing data is
    represented by empty strings.  Never raises.

    Fallback ladder:
        company_name : og:site_name → cleaned <title> → humanised domain
        logo_url     : og:image → apple-touch-icon → png icon → favicon link
                       → header <img class*=logo> → site /favicon.ico
                       → Google favicons API
                       (each candidate must pass _is_safe_url before storage)
        colours      : <meta theme-color> + <meta msapplication-tilecolor>
                       + CSS --brand/--primary/--main/--accent custom props
                       → fallback to curated colours from brandcolorcode.com
                       (matched on the resolved company_name, title-validated)
    """
    result = {
        "company_name": "",
        "logo_url": "",
        "primary_color": "",
        "secondary_color": "",
        "accent_color": "",
    }

    try:
        if not url or not isinstance(url, str):
            return result
        if not url.startswith("http"):
            url = "https://" + url
        parsed = urlparse(url)
        domain = (parsed.hostname or "").lower()

        # Fetch (may return '' if blocked, unsafe, or unreachable -- fine)
        html = _fetch(url)

        parser = _BrandHTMLParser()
        if html:
            try:
                parser.feed(html)
            except Exception:
                # Malformed HTML -- proceed with whatever the parser collected
                pass

        # --- Company name ----------------------------------------------------
        if parser.og_site_name:
            result["company_name"] = parser.og_site_name.strip()[:_MAX_COMPANY_NAME]
        elif parser.title_text:
            result["company_name"] = _clean_title(parser.title_text)[:_MAX_COMPANY_NAME]
        if not result["company_name"] and domain:
            # Humanise: 'www.alaskaair.com' -> 'Alaskaair', 'aa.com' -> 'Aa'
            try:
                name = domain.replace("www.", "").split(".")[0]
                result["company_name"] = name.title()[:_MAX_COMPANY_NAME]
            except Exception:
                pass

        # --- Logo URL --------------------------------------------------------
        favicon_convention = ""
        if parsed.scheme in _ALLOWED_FETCH_SCHEMES and parsed.netloc:
            favicon_convention = f"{parsed.scheme}://{parsed.netloc}/favicon.ico"

        logo_candidates = [
            parser.og_image,
            parser.apple_touch_icon,
            parser.png_icon,
            parser.favicon_href,
        ] + parser._header_imgs + ([favicon_convention] if favicon_convention else [])

        for candidate in logo_candidates:
            if not candidate:
                continue
            try:
                joined = urljoin(url, candidate)
            except Exception:
                continue
            if _is_safe_url(joined):
                result["logo_url"] = joined
                break

        if not result["logo_url"] and domain:
            try:
                clean = domain.replace("www.", "") if domain.startswith("www.") else domain
                google_fallback = f"https://www.google.com/s2/favicons?domain={clean}&sz=128"
                if _is_safe_url(google_fallback):
                    result["logo_url"] = google_fallback
            except Exception:
                pass

        # --- Brand colours (from HTML metadata + CSS custom properties) ------
        if html:
            try:
                color_candidates = [parser.theme_color, parser.tile_color]
                colors_found = []
                for raw in color_candidates:
                    c = _normalise_color(raw or "")
                    if c and c not in colors_found:
                        colors_found.append(c)
                for m in re.finditer(
                    r"--(?:brand|primary|main|accent)[^:]*:\s*(#[0-9a-fA-F]{3,8})",
                    html,
                ):
                    c = _normalise_color(m.group(1))
                    if c and c not in colors_found:
                        colors_found.append(c)
                if len(colors_found) >= 1:
                    result["primary_color"] = colors_found[0]
                if len(colors_found) >= 2:
                    result["secondary_color"] = colors_found[1]
                if len(colors_found) >= 3:
                    result["accent_color"] = colors_found[2]
            except Exception:
                pass

        # --- Colours fallback: curated lookup on brandcolorcode.com ---------
        # Strict invariants:
        #   * Only fires if we still have no primary_color.
        #   * Only fires if we have a non-trivial company name to match against.
        #   * Never overrides company_name or logo_url.
        #   * Validated by title-token containment inside _try_brandcolorcode.
        try:
            if not result["primary_color"] and result["company_name"]:
                colors = _try_brandcolorcode(result["company_name"])
                if colors:
                    result["primary_color"] = colors[0]
                    if len(colors) >= 2 and not result["secondary_color"]:
                        result["secondary_color"] = colors[1]
                    if len(colors) >= 3 and not result["accent_color"]:
                        result["accent_color"] = colors[2]
        except Exception:
            pass

    except Exception:
        # Absolute outer guard -- nothing escapes extract_brand_assets.
        pass

    return result
