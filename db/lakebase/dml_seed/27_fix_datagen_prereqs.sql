-- =============================================================================
-- CORRECT THE SYNTHETIC-DATA PREREQUISITES ON STEP 59
-- =============================================================================
-- Step 59 told attendees they need "serverless_compute_id = auto and the local
-- dependencies installed". That is true and insufficient, and the gap costs an hour
-- because each failure mode points somewhere other than its cause. Found by getting
-- the generate branch actually working against a real FEVM workspace (serverless DBR
-- 18.x) rather than by reading the skill:
--
--   1. Python version. databricks-connect UDFs require the CLIENT's minor Python
--      version to match the server's, and serverless is on 3.12. The workshop app runs
--      on 3.11, so the obvious move -- installing into the app's venv -- produces
--      "Python versions in the Spark Connect client and server are different" the
--      moment a Faker UDF runs. Worse, plain SQL over databricks-connect works fine on
--      3.11, so a smoke test of SELECT 1 passes and proves nothing.
--
--   2. Client version. On 3.12 an unpinned install resolves to the newest release
--      (19.0.0), which fails with "Serverless mode is not yet supported in this version
--      of Databricks Connect". The skill's own pin, >=16.4,<17.4, resolves to 17.3.12
--      and works.
--
--   3. faker on the executors. This is the one the skill itself gets wrong -- its
--      troubleshooting table says "Install locally: uv pip install faker, import inside
--      UDF". Necessary but not sufficient: the UDF body runs on the serverless
--      executors, which have their own environment, so the import still raises
--      ModuleNotFoundError. The package has to be shipped to the session with
--      spark.addArtifacts(<zip>, pyfile=True). Note addArtifacts(..., pypi=True) does
--      not exist.
--
-- Verified working after all three: 15,000 rows with real Faker city names.
--
-- The prompt keeps this SHORT and points at docs/synthetic_data_setup.md for the
-- snippet, because step 59's template is already long and the attendee reading it is
-- deciding which branch to take, not debugging an environment yet.
--
-- Idempotency: single guarded replace() on the old sentence. Re-running is a no-op, and
-- an admin who has reworded the paragraph keeps their text.
--
-- Variable: ${schema} - replaced at runtime
-- =============================================================================

UPDATE ${schema}.section_input_prompts
SET input_template = replace(
      input_template,
      '**Prerequisites, worth checking before you start:** the skill runs Spark + Faker on
serverless via `databricks-connect`, so you need `serverless_compute_id = auto` in your
`~/.databrickscfg` and the local dependencies installed. If that is not set up, say so
rather than fighting it — you can connect an existing dataset instead and keep moving.',
      '**Prerequisites — check these BEFORE you start, they take ten minutes and cost an
hour if skipped.** The skill runs Spark + Faker on serverless via `databricks-connect`,
which needs three things that are easy to get subtly wrong:

1. **Its own Python 3.12 environment.** Not the app''s 3.11 one. UDFs require your
   client''s Python minor version to match serverless. Plain SQL works on 3.11, so a
   quick connectivity test passes and tells you nothing.
2. **A pinned client:** `databricks-connect>=16.4,<17.4`. Unpinned resolves to a version
   that rejects serverless outright.
3. **`serverless_compute_id = auto`** in your `~/.databrickscfg` profile.

```bash
uv venv .venv-datagen --python 3.12
VIRTUAL_ENV=.venv-datagen uv pip install "databricks-connect>=16.4,<17.4" faker numpy pandas holidays
```

There is a fourth trap the skill''s own docs get wrong: installing `faker` locally is not
enough, because the UDF body runs on the serverless executors. The package must be
shipped to the session with `spark.addArtifacts(<zip>, pyfile=True)`. The working snippet
is in `docs/synthetic_data_setup.md` — read it before you start.

**If any of that is not set up, use the connect branch instead and keep moving.** It is
not worth burning workshop time on a local Python environment, and real data makes the
later data-quality decisions more interesting anyway.'
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'data_provision'
  AND is_active = TRUE
  AND position('and the local dependencies installed' in input_template) > 0;
