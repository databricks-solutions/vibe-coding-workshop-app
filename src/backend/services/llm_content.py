"""
Normalise model-serving response content to plain text.

Different model families on Databricks Model Serving put the assistant's text in
different shapes, even behind the same OpenAI-compatible `/invocations` route.
Verified against a live workspace:

    Claude   choices[0].message.content == "OK."                      (str)
    Gemini   choices[0].message.content == [{"type": "text",
                                             "text": "OK."}]          (list)

Code that does `message.get("content")` and treats the result as a string
therefore silently yields an empty reveal on Gemini — the request succeeds, the
tokens are billed, and the attendee sees a blank panel. That failure mode is why
this lives in one place instead of at each call site: the next family with a new
envelope is a one-function fix.

Streaming deltas are a separate shape again — there, both families send plain
string fragments (`delta.content`), so `text_from_content` is only needed on the
non-streaming path. It is written to cope with either regardless.
"""

from typing import Any, List


def text_from_content(content: Any) -> str:
    """
    Extract the text of an assistant message, whatever shape it arrives in.

    Handles:
      * a plain string (Claude, most OSS models)
      * a list of content parts (Gemini), joining every text-bearing part
      * a single dict content part
      * None / anything else -> "" rather than the repr of an object, since a
        stray "[{'type': 'text'...}]" rendered into the UI is worse than empty.
    """
    if content is None:
        return ""

    if isinstance(content, str):
        return content

    if isinstance(content, dict):
        return _text_from_part(content)

    if isinstance(content, (list, tuple)):
        parts: List[str] = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict):
                parts.append(_text_from_part(item))
            elif hasattr(item, "text"):
                # SDK objects that were not converted to dicts.
                parts.append(str(getattr(item, "text", "") or ""))
        # Join with "" not "\n": these are fragments of one message, and Gemini
        # already carries its own newlines inside each part.
        return "".join(p for p in parts if p)

    if hasattr(content, "text"):
        return str(getattr(content, "text", "") or "")

    return ""


def _text_from_part(part: dict) -> str:
    """
    Text of a single content part.

    Only text parts contribute. A `thinking`/`reasoning` part is deliberately
    dropped: reasoning models emit it alongside the answer, and showing a model's
    scratchpad as the "expert answer" would be actively confusing.
    """
    part_type = part.get("type")
    if part_type in ("thinking", "reasoning", "redacted_thinking"):
        return ""
    for key in ("text", "content", "value"):
        value = part.get(key)
        if isinstance(value, str) and value:
            return value
    return ""
