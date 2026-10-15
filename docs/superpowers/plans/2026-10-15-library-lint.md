# Plan: library-lint (app) — PLAN ONLY, for human sign-off (D-162 queue, D-179)

Base: feature/genie-code-mcp-integration @ 72e9bf0. Commit path (if built): docs/superpowers/plans/2026-10-15-library-lint.md. main's code (Release 2.6.0 Library), behaviour-preserving; frontend only.

## The 16 errors (from the #152 gate's ESLint comparison, work/gate-b41fdc2-evidence/eslint-comparison.json; identical on main)
- `react-hooks/set-state-in-effect` (7): CollectionDialog.tsx:36; CollectionPage.tsx:44, :80; UseCaseDrawer.tsx:40, :194, :352. (6 listed + recount at build; the gate reports 7 sites total with the line numbers above.)
- `react-hooks/static-components` (8): UseCaseCard.tsx:77; UseCaseDrawer.tsx:106; UseCaseTable.tsx:73-78 (6 sites); ui.tsx:84.
- `react-refresh/only-export-components` (1): ui.tsx:9.

## Fix patterns (no behaviour change)
- **set-state-in-effect** (reset-on-open / derive-from-props): replace "effect that copies props into state when `open` flips" with one of: (a) a `key` on the dialog/drawer so React remounts with fresh initial state (CollectionDialog, UseCaseDrawer reset paths); (b) derive the value during render (`useMemo`) when the state is pure derivation; (c) the React-documented "store previous prop in state and compare during render" pattern when (a)/(b) would change focus or animation. Each site's choice named in the PR with the reason.
- **static-components** (a component defined inside another component's render): hoist the inner component to module scope (props for what it closed over) or turn it into a plain render helper called as a function. UseCaseTable's six column cells are one shared hoist.
- **only-export-components** (ui.tsx exports a non-component next to components): move the constant/helper to a sibling module (e.g. `ui-constants.ts`) and update imports.
- No eslint-disable comments; no rule config change.

## Acceptance
- A1 files: only `src/components/library/*` (+ one new sibling module) and their importers if an export moves; plan; decision-log. No App.tsx unless an import moves (then trunk exception, imports only).
- A2 ESLint: 0 errors repo-wide (was 16); warnings not increased.
- A3 tsc -b, vite build, frontend node tests (≥ 79 pass) green; backend suites unaffected (≥ 2087/0 + 10/0).
- A4 behaviour: existing Library node tests pass unchanged; add a node test per fixed reset path that opening the dialog/drawer with a new `initial` shows the new values (the behaviour the effect provided). If the Library has no node-test harness for these components, say so and use source-level tests as for genieDefaultSession.
- A5 D12 web byte-identity and WEB_GOLDEN unchanged (no backend change).

## Tampers
- X1 reintroduce one setState-in-effect → ESLint error count 1 (A2 red).
- X2 drop the `key` (or equivalent) on a reset path → the reset node test red.
- X3 re-inline a hoisted UseCaseTable cell → A2 red.

## Live check (after the human deploys)
Library page loads; open/close a collection dialog and a use-case drawer twice with different items: fields show the new item each time; table renders all columns.

## r1 — critic round-1 BLOCK findings folded in (D-180)
- **Counts:** 6 `set-state-in-effect`, 9 `static-components`, 1 `only-export-components` = 16 (r0's 7/8 split was wrong).
- **set-state-in-effect: pattern (c) at all six sites** ("store the previous prop in state and compare during render"), never a `key` remount: CollectionDialog (:36, Modal) and UseCaseDrawer (:40, `motion.div` in `AnimatePresence`, :60) run exit animations that a key change or unmount would skip. Sites: CollectionDialog :36 (reset on open), CollectionPage :44 (InlineText draft from prop) and :80 (reset on collection change, four setters), UseCaseDrawer :40 (reset on open), :194 (TitleEditor draft), :352 (PlacementTab list). Pattern (b) only where a value is a pure derivation — the critic found none, so (c) everywhere.
- **static-components:** the `Icon` components (UseCaseCard :33, UseCaseDrawer :54, ui.tsx :79) close over no state → hoist to module scope. UseCaseTable's `Th` (:48) closes over `sort`/`setSort` → turn it into a plain render helper called as a function (no prop plumbing, no new component identity).
- **only-export-components:** move ui.tsx's non-component export to a sibling module; its 14 importers are all in `src/components/library/` (AllUseCases, AttendeePreview, BulkBar, CollectionDialog, CollectionNavigator, CollectionPage, LibraryHome, LibraryPage, LibrarySearch, NewUseCaseOverlay, ReviewQueue, UseCaseCard, UseCaseDrawer, UseCaseTable); update only the import lines that use the moved name. No App.tsx change expected.
- **A4:** there is no node-test harness for Library components, so A4 uses source-level tests (as for genieDefaultSession): each of the six sites keeps a reset path keyed on the same prop, has no `useEffect` that calls a setter, and the exit-animation wrappers (`AnimatePresence` / Modal `exit`) are unchanged.
- **X1** note: reverting CollectionPage :80 gives 4 errors (four setters); X1 targets a single-setter site (CollectionDialog :36) → exactly 1 error. New **X4:** add a `key` to the UseCaseDrawer motion wrapper → the exit-animation source test red.

## SIGNED (D-183)
- r1 as written. Live check ADDED: in CollectionPage's InlineText and UseCaseDrawer's TitleEditor, type a partial draft, cause an unrelated re-render (e.g. change placement or select another field) without changing the source prop → the draft survives; the CollectionDialog and UseCaseDrawer closing animations still play.
- Build after coach-length merges (decision-log.md).

## Questions for plan_critic
1. Recount: exactly which 16 sites, and for each set-state-in-effect site, is it a reset-on-open (key works) or a pure derivation (useMemo works)? file:line.
2. Do any hoisted inner components close over state/handlers that would need prop plumbing that changes render identity in a way a test or animation depends on?
3. Which modules import from `ui.tsx`, so the moved export's importers are known?
4. Is there an existing node-test harness for the Library components?
