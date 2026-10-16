#!/usr/bin/env python3
"""
Lint section markdown files against the Tier A teaching standard.

Checks:
  1. YAML frontmatter is present and parseable.
  2. The four canonical H2 headings (System Prompt, Input Template,
     How to Apply, Expected Output) appear exactly once each.
  3. Inside `## How to Apply`, the four numbered teaching sub-blocks
     (1️⃣ How To Apply, 2️⃣ What Are We Building?, 3️⃣ Why Are We Building It This Way?,
     4️⃣ What Happens Behind the Scenes?) are present.
  4. No duplicate canonical headings inside the body.
  5. `is_active: false` and `mode_card_anchor: <path>` files are skipped/exempt.

Usage:
    cd apps_lakebase/prompts
    python lint_section_prompts.py                 # lint sections/
    python lint_section_prompts.py path/to/file.md # lint single file
    python lint_section_prompts.py --strict        # exit 1 on any error
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

CANONICAL_HEADINGS = (
    "System Prompt",
    "Input Template",
    "How to Apply",
    "Expected Output",
)

NUMBERED_BLOCKS = (
    "1️⃣ How To Apply",
    "2️⃣ What Are We Building?",
    "3️⃣ Why Are We Building It This Way?",
    "4️⃣ What Happens Behind the Scenes?",
)

# Genie-code / coda forks are bypass_llm prescriptive runbooks: their `## Input
# Template` ships verbatim and `## How to Apply` is intentionally empty (so the
# 1️⃣–4️⃣ teaching blocks do not apply). Instead they must follow the fork
# skeleton documented in _templates/style_guide.md "Genie-Code Fork Pattern":
# a preamble at the top, then the runbook, then State-lock / Gate / Next step,
# in that order. See _templates/fork_template.md for the copy-paste starter.
# EXCEPTION: Tier G genie-family forks (see GENIE_FAMILY_PREFIXES) drop this
# preamble lead-in for a single imperative orientation line, so the preamble
# anchor is not required for them (Gate + ordering are still enforced).
FORK_PREAMBLE_LEADIN = "This will involve the following steps:"

# Ordered skeleton anchors. Only anchors that are PRESENT are order-checked, so
# the rule is robust to optional sections (not every fork has every anchor), but
# the preamble lead-in and the Gate line are REQUIRED for every fork.
FORK_SKELETON_ANCHORS = (
    ("preamble", FORK_PREAMBLE_LEADIN),
    ("non-negotiable rules", "Non-negotiable execution rules"),
    ("Step 0", "Step 0"),
    ("State-lock", "**State-lock:**"),
    ("Gate", "**Gate:**"),
    ("Next step", "Next step"),
)
FORK_REQUIRED_ANCHORS = ("preamble", "Gate")

# Tier G (Genie Accelerator family) Input Template rules. These bypass_llm rows
# ship the ENTIRE `## Input Template` verbatim (it is what "Copy to Clipboard"
# copies), so the inner fenced "copy/paste this prompt" block is redundant framing
# and injects literal backticks into the agent chat. Tier G forbids the fence and
# requires the vibe-state discipline (read/record `.vibecoding-state.md`). Scoped
# to the genie family ONLY — deploy/lakehouse forks keep their fenced runbooks.
GENIE_FAMILY_PREFIXES = ("semlayer_", "gagent_", "ontology_", "gaccel_")

# Shared-workspace job/pipeline naming guardrail. The single canonical prefix for
# every job/pipeline `name:` is "[${bundle.target} ${var.user_prefix}]" (see
# skills/databricks-asset-bundles -> "Shared Workspace Naming"). Any bracketed
# "[${bundle.target} ...]" prefix that omits the ` ${var.user_prefix}]` token
# risks "name is already used" collisions in the shared workshop workspace and is
# a lint error. The negative lookahead matches the bare "[${bundle.target}]" form
# as well as "[${bundle.target} <anything-else>]".
UNPREFIXED_JOB_NAME_RE = re.compile(
    r"\[\$\{bundle\.target\}(?! \$\{var\.user_prefix\}\])"
)


@dataclass
class LintReport:
    path: Path
    errors: list[str] = field(default_factory=list)
    skipped: bool = False

    @property
    def ok(self) -> bool:
        return not self.errors


def _parse_frontmatter(text: str) -> dict:
    if not text.startswith("---"):
        return {}
    end = text.index("---", 3)
    fm = text[3:end]
    out = {}
    for line in fm.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or line.startswith("- "):
            continue
        if ":" not in line:
            continue
        k, _, v = line.partition(":")
        out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def _input_template_body(text: str) -> str | None:
    m = re.search(
        r"^---\s*\n+## Input Template\s*\n(.*?)(?=^---\s*\n+## (?:How to Apply|Expected Output)\s*\n)",
        text,
        re.MULTILINE | re.DOTALL,
    )
    return m.group(1) if m else None


def _system_prompt_body(text: str) -> str:
    m = re.search(
        r"^---\s*\n+## System Prompt\s*\n(.*?)(?=^---\s*\n+## Input Template\s*\n)",
        text,
        re.MULTILINE | re.DOTALL,
    )
    return m.group(1) if m else ""


def _lint_contract_block(text: str, baseline_entry: dict) -> list[str]:
    """Assert every verbatim_substring + every placeholder in the baseline entry
    appears in the file's `## Input Template` body (or `## System Prompt`
    body for Class A OUTPUT FORMAT RULES). Returns a list of error strings."""
    errors: list[str] = []
    input_body = _input_template_body(text) or ""
    system_body = _system_prompt_body(text)
    haystack = input_body + "\n" + system_body  # OUTPUT FORMAT RULES lives in System Prompt

    for needle in baseline_entry.get("verbatim_substrings", []):
        if needle not in haystack:
            preview = needle.splitlines()[0][:80] if needle else ""
            errors.append(
                f"contract token missing: verbatim substring starting "
                f"'{preview}...' not found in Input Template / System Prompt"
            )

    for placeholder in baseline_entry.get("placeholders", []):
        if placeholder not in input_body:
            errors.append(
                f"contract token missing: placeholder '{placeholder}' not found in Input Template"
            )

    return errors


def _is_fork(path: Path, fm: dict) -> bool:
    """A coding-assistant fork: `*.genie-code.md` / `*.coda.md`, or a frontmatter
    `coding_assistant` set to anything other than the default sentinel."""
    if path.name.endswith(".genie-code.md") or path.name.endswith(".coda.md"):
        return True
    ca = fm.get("coding_assistant", "")
    return bool(ca) and ca != "__default__"


def _lint_fork_skeleton(text: str, *, require_preamble: bool = True) -> list[str]:
    """Assert a fork's `## Input Template` follows the documented fork skeleton:
    the preamble lead-in is present near the top, the Gate line is present, and
    every anchor that IS present appears in the canonical order. See
    _templates/style_guide.md "Genie-Code Fork Pattern".

    Tier G genie-family forks (`require_preamble=False`) drop the
    `This will involve the following steps:` lead-in in favour of a single
    imperative orientation line (see the Tier G section of style_guide.md), so the
    preamble anchor is neither required nor order-checked for them; the Gate line
    and canonical ordering of the remaining anchors are still enforced."""
    errors: list[str] = []
    body = _input_template_body(text)
    if body is None:
        errors.append("fork: could not extract `## Input Template` body")
        return errors

    positions: dict[str, int] = {}
    for label, needle in FORK_SKELETON_ANCHORS:
        if label == "preamble" and not require_preamble:
            continue
        idx = body.find(needle)
        if idx != -1:
            positions[label] = idx

    required_anchors = (
        FORK_REQUIRED_ANCHORS
        if require_preamble
        else tuple(a for a in FORK_REQUIRED_ANCHORS if a != "preamble")
    )
    for label in required_anchors:
        if label not in positions:
            if label == "preamble":
                errors.append(
                    f"fork: missing preamble lead-in '{FORK_PREAMBLE_LEADIN}' "
                    "at the top of `## Input Template` (see _templates/fork_template.md)"
                )
            else:
                errors.append(f"fork: missing required '{label}' anchor in `## Input Template`")

    # Order check over the anchors that are present (canonical order = anchor order).
    present = [label for label, _ in FORK_SKELETON_ANCHORS if label in positions]
    last_pos = -1
    last_label = None
    for label in present:
        if positions[label] < last_pos:
            errors.append(
                f"fork: skeleton out of order — '{label}' appears before "
                f"'{last_label}' (expected order: "
                + " -> ".join(lbl for lbl, _ in FORK_SKELETON_ANCHORS)
                + ")"
            )
            break
        last_pos = positions[label]
        last_label = label

    return errors


def _is_genie_family(fm: dict) -> bool:
    """Tier G scope: the Genie Accelerator semantic-layer/agent/ontology/activate
    families. Keyed off section_tag so it covers defaults, forks, and Locate
    method variants (e.g. semlayer_locate_upload)."""
    return fm.get("section_tag", "").startswith(GENIE_FAMILY_PREFIXES)


def _lint_genie_input_template(text: str) -> list[str]:
    """Tier G checks on `## Input Template`: (1) no fenced code block (the whole
    verbatim template is copied, so the inner copy/paste block is redundant),
    (2) the `.vibecoding-state.md` read/record discipline is present."""
    errors: list[str] = []
    body = _input_template_body(text)
    if body is None:
        errors.append("genie-family: could not extract `## Input Template` body")
        return errors
    if re.search(r"^```", body, re.MULTILINE):
        errors.append(
            "genie-family (Tier G): fenced code block found in `## Input Template` "
            "— remove the inner copy/paste block; the whole template is copied "
            "verbatim (see _templates/style_guide.md 'Tier G')"
        )
    if ".vibecoding-state.md" not in body:
        errors.append(
            "genie-family (Tier G): missing `.vibecoding-state.md` read/record "
            "discipline in `## Input Template`"
        )
    return errors


def lint_file(
    path: Path,
    *,
    check_contract: bool = False,
    baseline_path: Path | None = None,
) -> LintReport:
    report = LintReport(path=path)
    text = path.read_text()
    fm = _parse_frontmatter(text)

    if fm.get("is_active", "true").lower() == "false":
        report.skipped = True
        return report

    is_fork = _is_fork(path, fm)

    # Check 1: each canonical heading appears exactly once preceded by ---
    for heading in CANONICAL_HEADINGS:
        pattern = re.compile(
            r"^---\s*\n+## " + re.escape(heading) + r"\s*\n", re.MULTILINE
        )
        matches = pattern.findall(text)
        if len(matches) == 0:
            report.errors.append(f"missing canonical H2 '## {heading}'")
        elif len(matches) > 1:
            report.errors.append(
                f"duplicate canonical heading '## {heading}' "
                f"(found {len(matches)} times — corrupts SQL round-trip)"
            )

    # Check 2a (forks only): the prescriptive fork skeleton (preamble + ordered
    # anchors). Forks are exempt from the 1️⃣–4️⃣ teaching-block check below —
    # `## How to Apply` is intentionally empty for bypass_llm runbooks.
    if is_fork:
        report.errors.extend(
            _lint_fork_skeleton(text, require_preamble=not _is_genie_family(fm))
        )

    # Check 2b (genie family only): Tier G Input Template rules (no fence + state
    # discipline). Applies to defaults and forks alike.
    if _is_genie_family(fm):
        report.errors.extend(_lint_genie_input_template(text))

    # Check 2 (skipped if mode card OR fork): numbered teaching blocks inside How to Apply
    if not fm.get("mode_card_anchor") and not is_fork:
        how_match = re.search(
            r"^---\s*\n+## How to Apply\s*\n(.*?)(?=^---\s*\n+## Expected Output\s*\n|\Z)",
            text,
            re.MULTILINE | re.DOTALL,
        )
        if not how_match:
            report.errors.append("could not extract `## How to Apply` body")
        else:
            how_body = how_match.group(1)
            for block in NUMBERED_BLOCKS:
                if f"## {block}" not in how_body:
                    report.errors.append(f"missing teaching block '## {block}'")

    # Check 3 (opt-in): byte-equality of contract tokens against baseline JSON
    if check_contract:
        if baseline_path is None:
            baseline_path = (
                Path(__file__).parent / "_templates" / "contract_baseline.json"
            )
        if not baseline_path.exists():
            report.errors.append(
                f"--check-contract requested but baseline file missing: {baseline_path}"
            )
        else:
            baseline = json.loads(baseline_path.read_text())
            entry = baseline.get(path.name)
            if entry is not None:  # files outside the baseline are NOT contract-checked
                report.errors.extend(_lint_contract_block(text, entry))

    # Check 4: shared-workspace job/pipeline naming. Any bracketed
    # "[${bundle.target} ...]" name prefix MUST include the per-user token
    # "${var.user_prefix}" so concurrent workshop attendees never collide.
    for m in UNPREFIXED_JOB_NAME_RE.finditer(text):
        snippet = text[m.start() : m.start() + 60].splitlines()[0]
        report.errors.append(
            "job/pipeline name prefix missing `${var.user_prefix}` "
            f"(found `{snippet}...`); use "
            "`[${bundle.target} ${var.user_prefix}]` "
            "(see common/databricks-asset-bundles -> Shared Workspace Naming)"
        )

    return report


def _safe_rel(path: Path) -> str:
    try:
        return str(path.relative_to(Path.cwd()))
    except ValueError:
        return str(path)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("paths", nargs="*", help="files or directories to lint")
    ap.add_argument("--strict", action="store_true", help="exit 1 on any error")
    ap.add_argument(
        "--check-contract",
        action="store_true",
        help="also assert byte-equality of contract tokens against contract_baseline.json",
    )
    ap.add_argument(
        "--baseline",
        type=Path,
        default=None,
        help="path to contract_baseline.json (default: _templates/contract_baseline.json)",
    )
    args = ap.parse_args()

    targets: list[Path] = []
    if args.paths:
        for p in args.paths:
            pp = Path(p)
            if pp.is_dir():
                targets.extend(sorted(pp.glob("*.md")))
            else:
                targets.append(pp)
    else:
        sections = Path(__file__).parent / "sections"
        targets = sorted(sections.glob("*.md"))

    fails = 0
    skipped = 0
    for path in targets:
        if path.name == "README.md" or path.name.startswith("_"):
            continue
        report = lint_file(
            path,
            check_contract=args.check_contract,
            baseline_path=args.baseline,
        )
        if report.skipped:
            skipped += 1
            continue
        if not report.ok:
            fails += 1
            print(f"❌ {_safe_rel(path)}")
            for e in report.errors:
                print(f"   - {e}")
        else:
            print(f"✅ {_safe_rel(path)}")

    print(
        f"\n{len(targets) - skipped} active files; {fails} with errors; "
        f"{skipped} inactive (skipped)."
    )
    if fails and args.strict:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
