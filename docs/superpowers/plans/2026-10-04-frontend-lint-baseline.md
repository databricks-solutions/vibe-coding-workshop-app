# frontend-lint-baseline

## Why
Repo-wide `npm run lint` on the integration branch is red: 96 errors and 29 warnings (measured by the gatekeeper at f97f813 and a157aca, identical at 4d93628 since no frontend file changed). D-7 made the lint gate differential until this lands. Goal: 0 lint errors, so D-7 can be reversed back to an absolute gate.

## Error inventory (per file, per rule, at base)
- VerificationLinks.tsx: react-hooks/rules-of-hooks 4 ← FIRST. The plan critic confirmed the cause: an early `return null` at :31 runs before the useState/useRef hooks from :33. Hoist the hooks above the early return, and keep the render output identical for every prop combination.
- CelebrationOverlay.tsx: react-hooks/purity 7. Same pattern #83 fixed in LeaderboardPage (Math.random() at :94 and :121-125 inside render): move it into a lazy useState initializer or a module-level helper, so render is pure.
- WorkflowStep.tsx: react-hooks/refs 2. ThemeToggle.tsx and TypingText.tsx: react-hooks/immutability 1 each.
- react-hooks/set-state-in-effect 21: ArchitectureDiagram 6, DefineIntentSection 2, ServicePopover 2, plus 1 each in CodingAssistantSelector, GoldTableTargetEditor, PathAndArchitecture, SetUpProjectStep, WorkshopIntro, config/ConfigurationPage, session/FeedbackDialog, session/SaveSessionDialog, skills/PlatformAcademy, skills/SkillDetailDrawer and hooks/useSkillBlueprint. Fix with the React-recommended pattern: derive the value during render, reset via a key, or move the update into the event handler. Where a site legitimately syncs from an external system (fetch result, DOM measurement, subscription), the effect stays, with a one-line `// eslint-disable-next-line react-hooks/set-state-in-effect -- <specific reason>`. At most 8 such justified disables in total; if you need more, STOP and report rather than exceed the budget.
- react-refresh/only-export-components 6 (MarkdownContent 2, TypingText 2, ServicePopover 1, SkillContentModal 1): move the non-component exports to a sibling module (e.g. `<Name>.utils.ts`) and update the imports.
- @typescript-eslint/no-explicit-any 51 (PromptsConfig 21, MarkdownContent 16, UseCaseBuilderPanel 14): replace with concrete types, `unknown` plus narrowing, or the types already in src/types. No type-assertion laundering (`as unknown as X`) unless a comment explains it.
- @typescript-eslint/no-unused-vars 2 (PromptsConfig): remove. no-var 1 (types/speech.d.ts): `declare var` → the TS-idiomatic global declaration (`declare global { interface Window { ... } }`, or keep `var` with a scoped disable if global augmentation requires it; that counts toward the disable budget).
- The 29 warnings are out of scope: report the count, and don't add new ones.

## Fence
Only the frontend files named above, new sibling `*.utils.ts` or `*.utils.tsx` modules, new frontend test files, and the plan file. Not touched: src/App.tsx and src/constants/workflowSections.ts (trunk; none of their errors are in the inventory). No eslint.config change, no rule disabled globally, no package.json or package-lock change. Backend has zero diff.

## Fence amendment (post-implementation)
These paths fall outside the literal fence above. The reviewer accepted each one as justified:
- src/components/MarkdownContent.utils.tsx and src/components/TypingText.utils.tsx: the sibling modules hold JSX, so they need .tsx, not .ts.
- src/components/MermaidDiagram.tsx: a component extracted from MarkdownContent, so that MarkdownContent exports only components (react-refresh/only-export-components).
- src/components/PromptCopyPanel.tsx and src/components/SkillBlueprintTab.tsx: import-path updates only, following the moved exports.

## Behavior contract
Behavior-preserving refactor. The frontend vitest suite (16 tests per the #83 gate) must stay green, and the PR adds focused tests where a fix changes control flow: VerificationLinks (renders the same links for representative props, including the empty-linkDefs branch that previously returned before the hooks) and CelebrationOverlay (particle positions and rotations are stable across re-renders).

## Acceptance contract
- `npm run lint`: 0 errors, and warnings <= 29. `npm run build` green. Frontend tests green, 16 plus the new ones. Backend suite (the invocation PR #85 used): 559, 0 failed, unchanged. MCP tools/list = 7.
- Tampers (FORGE/state/specs/frontend-lint-baseline/tampers.md), each verified and then restored byte-identically: T1 add a conditional early return before the hooks in VerificationLinks → lint red with rules-of-hooks (the spec's `Math.random() < 0` guard is never true at runtime, so only lint can observe it; report whether the new test can also observe a real conditional-hook regression); T2 put Math.random() back in CelebrationOverlay's render → lint red with purity AND the stability test red; T3 re-add one `any` in PromptsConfig → lint red with no-explicit-any.
- List every eslint-disable you added, with its reason, in the PR body.
- Open a PR into feature/genie-code-mcp-integration titled "frontend-lint-baseline: repo-wide lint to 0 errors".
