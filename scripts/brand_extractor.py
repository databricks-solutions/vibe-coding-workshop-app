"""
Brand asset extractor — pure Python, stdlib only.

Fetches a customer website and extracts logo URL, brand colors, and company
name from HTML meta tags, link elements, and inline CSS.  Falls back to
Google's favicon API for the logo when scraping yields nothing.

Every public function is safe to call with arbitrary input — failures are
caught internally and result in empty strings.
"""

import colorsys
import re
import ssl
from html.parser import HTMLParser
from urllib.parse import urlparse, urljoin
from urllib.request import urlopen, Request

_TIMEOUT = 5  # seconds — keeps the install step snappy


# ---------------------------------------------------------------------------
# Colour helpers
# ---------------------------------------------------------------------------

_HEX_RE = re.compile(r'^#(?:[0-9a-fA-F]{3}){1,2}$')


def hex_to_hsl(hex_color: str) -> str:
    """Convert '#RRGGBB' or '#RGB' to the 'H S% L%' format used by CSS vars."""
    if not hex_color or not _HEX_RE.match(hex_color):
        return ""
    h = hex_color.lstrip('#')
    if len(h) == 3:
        h = ''.join(c * 2 for c in h)
    r, g, b = int(h[0:2], 16) / 255, int(h[2:4], 16) / 255, int(h[4:6], 16) / 255
    hue, light, sat = colorsys.rgb_to_hls(r, g, b)
    return f"{round(hue * 360)} {round(sat * 100)}% {round(light * 100)}%"


def _normalise_color(raw: str) -> str:
    """Return a '#RRGGBB' string if *raw* looks like a valid hex colour."""
    raw = raw.strip().lower()
    if _HEX_RE.match(raw):
        if len(raw) == 4:
            return '#' + ''.join(c * 2 for c in raw[1:])
        return raw.upper()
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
        self._header_imgs: list[str] = []
        self._in_header_or_nav = False
        self._depth = 0

    def handle_starttag(self, tag: str, attrs: list):
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

    def handle_endtag(self, tag: str):
        if tag == "title":
            self._in_title = False
        if self._in_header_or_nav:
            self._depth -= 1
            if self._depth <= 0:
                self._in_header_or_nav = False

    def handle_data(self, data: str):
        if self._in_title:
            self.title_text += data


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def _fetch(url: str) -> str:
    """GET *url* and return the decoded body, or '' on any error."""
    try:
        ctx = ssl.create_default_context()
        req = Request(url, headers={"User-Agent": "Mozilla/5.0 (brand-extractor)"})
        with urlopen(req, timeout=_TIMEOUT, context=ctx) as resp:
            return resp.read(512_000).decode("utf-8", errors="replace")
    except Exception:
        return ""


def _clean_title(raw: str) -> str:
    """Strip common separators and boilerplate from <title> text."""
    for sep in (" | ", " - ", " — ", " – ", " :: ", " : "):
        if sep in raw:
            raw = raw.split(sep)[0]
    return raw.strip()


def extract_brand_assets(url: str) -> dict:
    """Fetch *url* and return extracted brand assets.

    Returns a dict with keys: company_name, logo_url, primary_color,
    secondary_color, accent_color.  All values are strings; missing data
    is represented by empty strings.
    """
    result = {
        "company_name": "",
        "logo_url": "",
        "primary_color": "",
        "secondary_color": "",
        "accent_color": "",
    }

    try:
        if not url.startswith("http"):
            url = "https://" + url
        parsed = urlparse(url)
        domain = parsed.hostname or ""

        html = _fetch(url)
        if not html:
            return result

        parser = _BrandHTMLParser()
        parser.feed(html)

        # --- Company name ---
        if parser.og_site_name:
            result["company_name"] = parser.og_site_name.strip()
        elif parser.title_text:
            result["company_name"] = _clean_title(parser.title_text)

        if not result["company_name"] and domain:
            # Humanise the domain: 'www.alaskaair.com' → 'Alaskaair'
            name = domain.replace("www.", "").split(".")[0]
            result["company_name"] = name.title()

        # --- Logo URL ---
        # Convention: try /favicon.ico from the site root
        favicon_convention = f"{parsed.scheme}://{parsed.netloc}/favicon.ico"

        logo_candidates = [
            parser.og_image,
            parser.apple_touch_icon,
            parser.png_icon,
            parser.favicon_href,
        ] + parser._header_imgs + [favicon_convention]

        for candidate in logo_candidates:
            if candidate:
                result["logo_url"] = urljoin(url, candidate)
                break

        if not result["logo_url"] and domain:
            clean = domain.replace("www.", "") if domain.startswith("www.") else domain
            result["logo_url"] = f"https://www.google.com/s2/favicons?domain={clean}&sz=128"

        # --- Brand colours ---
        color_candidates = [
            parser.theme_color,
            parser.tile_color,
        ]

        colors_found: list[str] = []
        for raw in color_candidates:
            c = _normalise_color(raw)
            if c and c not in colors_found:
                colors_found.append(c)

        # Also scan for CSS custom-property colour definitions
        for m in re.finditer(
            r'--(?:brand|primary|main|accent)[^:]*:\s*(#[0-9a-fA-F]{3,8})',
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

    return result
