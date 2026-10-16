# Prompt tooling

Scripts that turn the prompt seed into one markdown file per prompt row
(`sections/`), lint those files, and check that they round-trip to the seed. The
template repo's Genie Code gate (`scripts/genie_gate.py` there) and the forge's
`genie_gate_diff.py` run these scripts against a copy of this folder.

Copied byte for byte from the template checkout's `apps_lakebase/prompts/`
(git-ignored there) on 2026-10-15, except for the changes listed below
(plan: `docs/superpowers/plans/2026-10-15-prompt-tooling-tracked.md`).

## Source of truth

The app seed `db/lakebase/dml_seed/02_seed_section_input_prompts.sql` is the only
source of truth for the prompt bodies. Everything these scripts generate is a
throwaway view of it and is git-ignored: `sections/`, a seed snapshot copied
into this folder (`02_seed_section_input_prompts.sql`, `seed.sql`), and the
`NN-*.md` / `NN-*.sql` standalone files. Seed edits go through builders (e.g.
`scripts/insights_prompts/build_rows.py`) and reviewed PRs.

## Regenerate the sections

From this folder:

    python3 extract_to_markdown.py

It reads the seed snapshot in this folder if there is one, else the app seed
(read only), and fills `sections/` here. Options: `--seed PATH` reads another
seed file; `--out DIR` puts the section files in another directory.
`sections/README.md` is the manifest: one row per seed INSERT block. Rows that
share an order number, tag and coding assistant (older versions of a prompt)
share a file name, so the file holds the last of them in the seed.

The other readers (`extract_sql_blocks.py`, `generate_standalone_md.py`) need a
seed snapshot in this folder: copy the app seed here first.

## Scripts that write

| Script | Writes | Guarded |
|---|---|---|
| `replace_inserts.py` | the seed snapshot in this folder | yes |
| `sync_markdown_to_seed.py` | the seed snapshot in this folder | yes (`--dry-run` is not) |
| `splice_genie_to_app_seed.py` | the seed in `--app-seed-dir` | yes (`--dry-run` is not) |
| `extract_to_markdown.py` | `sections/` here, or `--out` | no |
| `extract_sql_blocks.py` | the `NN-*.sql` files here | no |
| `generate_standalone_md.py` | the `NN-*.md` files here | no |
| `extract_contract_baseline.py` | `_templates/contract_baseline.json` (tracked) | no |
| `gen_fork_contract_baseline.py` | `_templates/contract_baseline.json` (tracked; `--dry-run` writes nothing) | no |

The guarded scripts refuse a real seed write (exit 2, nothing written) unless
given `--i-know-this-overwrites-the-seed`. There is no environment variable that
bypasses the guard. A `--dry-run` prints the diff and is always allowed:

    python3 sync_markdown_to_seed.py --dry-run

`splice_genie_to_app_seed.py` has no usable default seed directory here (its
default assumes the template checkout's layout); pass `--app-seed-dir`.

The round trip is not clean on the current app seed: the extract does not carry
`user_trigger_prompt`, the Insights builder's rows use another column layout,
and older versions of a prompt share one section file. So a dry run against the
app seed reports differences, and a real write would rewrite rows nobody edited.

## Changes from the template copy

- `_seed_guard.py` (new): the guard's flag and message.
- `replace_inserts.py`, `sync_markdown_to_seed.py`, `splice_genie_to_app_seed.py`:
  the guard in `main()`; usage text in the docstring. No other function changed.
- `extract_to_markdown.py`: `--seed` and `--out`; when there is no seed snapshot
  in this folder, it reads the app seed instead of failing. With a snapshot here
  and no options, it behaves as before (the copy-and-run mode the gates use).

## Backup

The template folder this was copied from is backed up in the human's home
directory as `Backups/template-apps_lakebase-prompts-2026-10-15.tgz`.

## Tests

- `tests/test_lint_section_prompts.py` (copied with the scripts) tests the lint.
- `tests/workshop/test_prompt_tooling.py` (canonical suite) tests the extract,
  the round trip and the guards.
