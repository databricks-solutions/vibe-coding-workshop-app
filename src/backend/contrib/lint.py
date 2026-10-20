"""Content-safety checks for contributed briefs (``description.md``).

Briefs are pasted into coding agents that can run commands, so a contributed
brief is untrusted input. Errors block the use case from loading; warnings are
reported for maintainer review.
"""

from __future__ import annotations

import re
from typing import List, Tuple

MAX_BRIEF_CHARS = 20_000
LONG_BRIEF_CHARS = 12_000

_FENCE = re.compile(r"```.*?```|~~~.*?~~~", re.DOTALL)
_INLINE_CODE = re.compile(r"`[^`\n]*`")

_ERRORS: List[Tuple[re.Pattern, str]] = [
    (re.compile(r"\b(curl|wget)\b[^\n|]*\|\s*(sudo\s+)?(ba|z|da)?sh\b", re.I), "pipes a download straight into a shell"),
    (re.compile(r"\b(iwr|invoke-webrequest)\b[^\n|]*\|\s*(iex|invoke-expression)\b", re.I), "pipes a download straight into PowerShell"),
    (re.compile(r"AKIA[0-9A-Z]{16}"), "contains what looks like an AWS access key"),
    (re.compile(r"\bdapi[0-9a-f]{32}\b"), "contains what looks like a Databricks token"),
    (re.compile(r"\bgh[pousr]_[A-Za-z0-9]{36,}\b"), "contains what looks like a GitHub token"),
    (re.compile(r"\bxox[abprs]-[A-Za-z0-9-]{10,}"), "contains what looks like a Slack token"),
    (re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"), "contains a private key"),
    (re.compile(r"\b(ignore|disregard|forget)\b[^.\n]{0,40}\b(previous|prior|above|earlier|system)\b[^.\n]{0,20}\b(instructions?|prompts?|rules)\b", re.I),
     "tries to override the assistant's instructions"),
    (re.compile(r"\byou are no longer\b", re.I), "tries to override the assistant's instructions"),
    (re.compile(r"\]\(\s*http://", re.I), "links over plain http (use https)"),
    (re.compile(r"(?<![\w/])http://(?!localhost|127\.0\.0\.1)", re.I), "links over plain http (use https)"),
    (re.compile(r"\]\(\s*(javascript|data|vbscript):", re.I), "uses a script or data link"),
    (re.compile(r"[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]"), "contains hidden Unicode characters"),
]

_PROSE_ERRORS: List[Tuple[re.Pattern, str]] = [
    (re.compile(r"<\s*/?\s*[a-zA-Z][a-zA-Z0-9-]*(\s[^>]*)?>"), "contains raw HTML (use Markdown)"),
    (re.compile(r"!\[[^\]]*\]\("), "embeds an image (declare images under media in usecase.yaml)"),
]

_WARNINGS: List[Tuple[re.Pattern, str]] = [
    (re.compile(r"\brm\s+-rf\b|\bsudo\b|\bchmod\s+777\b", re.I), "contains shell commands that need a careful look"),
]


def lint_brief(text: str) -> Tuple[List[str], List[str]]:
    """Return (errors, warnings) for a brief."""
    errors: List[str] = []
    warnings: List[str] = []
    if not text.strip():
        return ["is empty"], warnings
    if len(text) > MAX_BRIEF_CHARS:
        errors.append(f"is {len(text):,} characters; the limit is {MAX_BRIEF_CHARS:,}")
    elif len(text) > LONG_BRIEF_CHARS:
        warnings.append(f"is long ({len(text):,} characters); shorter briefs work better")

    prose = _INLINE_CODE.sub("", _FENCE.sub("", text))
    for pattern, message in _ERRORS:
        if pattern.search(text) and message not in errors:
            errors.append(message)
    for pattern, message in _PROSE_ERRORS:
        if pattern.search(prose) and message not in errors:
            errors.append(message)
    for pattern, message in _WARNINGS:
        if pattern.search(text) and message not in warnings:
            warnings.append(message)
    return errors, warnings
