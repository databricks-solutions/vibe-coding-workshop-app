# Decision log (autonomous run, 2026-10)

`question · choice · evidence (file:line / doc section) · reversal`

- D-1 (2026-10-03) · Template plans must be committed at retrospectives/plans/genie-code-integration/<date>-<slug>.md, but TPL git-ignores that whole tree — how do template PRs carry their plan? · Rule (3), the most reversible option: the implementer force-adds only its own plan file (`git add -f <that path>`). .gitignore stays as it is, and no other retrospectives/ file is committed (the human's local docs stay local). · TPL .gitignore:99 `retrospectives` (on main; `git ls-tree origin/main` has 0 retrospectives/ files); the forge dispatch protocol and the run brief (P4.3 "retrospectives plan") both expect the plan in the PR. · Reverse: `git rm --cached` the plan files in a follow-up TPL PR (the local copies stay).
