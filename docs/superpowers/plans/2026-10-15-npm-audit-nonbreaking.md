# Plan: npm-audit-nonbreaking (app) — non-breaking dependency fixes only

Commit at docs/superpowers/plans/2026-10-15-npm-audit-nonbreaking.md. Slot: after genie-default-error-path merges (human ruling 2026-10-15); base = integration head at dispatch. Merge only.

## Change
- C1 `npm audit fix` WITHOUT `--force`, from a clean `npm ci`. Only package-lock.json (and package.json only if npm itself rewrites a range, which non-force fix should not) change. Expected (human): react-router / react-router-dom (runtime, high), dompurify, vite, rollup and other build-only tooling.
- C2 NOT taken: every major-version suggestion (e.g. mermaid → 10.8.0, @tailwindcss/typography). List each in the PR body with package, current → suggested, advisory IDs, and "not taken: major".
- C3 PR body: before/after `npm audit --omit=dev` and full `npm audit` summaries (counts by severity, package list), and the lockfile's changed top-level versions.

## Acceptance (gatekeeper re-runs all)
- A1 diff = package-lock.json (+ package.json only if npm rewrote it; explain) + plan file. No source change.
- A2 `npm ci`, `tsc -b`, `vite build`, frontend node tests (77+ pass), ESLint: only the 16 known library errors.
- A3 backend suite 2049+/0 (unaffected; run anyway).
- A4 D12 web byte-identity: the web-path outputs for every step are byte-identical to base (the existing WEB_GOLDEN test + a direct base/head render of the web route content). Mermaid rendering in the web UI is unchanged (mermaid not upgraded).
- A5 `npm audit --omit=dev` after ≤ before for every severity; no new advisory introduced; AND (r1, critic finding 4) the high count strictly drops and the react-router / react-router-dom advisory IDs listed in the PR body as fixed are absent after (so X2 turns A5 red, not just a sum check). Critic facts: react-router-dom direct `^7.13.0` (`package.json:21`), react-router transitive; vite direct dev (`:41`); dompurify, rollup transitive; mermaid `11.17.2` (`:18`) is used at runtime (`src/components/MermaidDiagram.tsx:18`), so the audit's mermaid suggestion is a major DOWNGRADE to 10.8.0 and is not taken.
- A6 no major version bump of any direct dependency in the lockfile.

## Tampers
- X1 add `--force` (or bump mermaid to 10.8.0) → A6 check red.
- X2 revert react-router to the pre-fix version → A5 shows the runtime high back.

## Questions for plan_critic
1. Do react-router(-dom) fixed versions stay within the current major (no API change for App.tsx routing)?
2. Does any vite/rollup bump change the built asset names or output in a way a test pins?
