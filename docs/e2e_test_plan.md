# End-to-End Test Plan — the new developments

Written to be executed by one person in a single sitting against a real workspace, in the
order given. It concentrates on what has actually changed and is therefore least proven:
**bring-your-own use case → data pre-work (connect or generate) → the committed story
flowing into every downstream chapter.**

Everything before this has been unit-tested, replayed against a throwaway Postgres, and
verified through the API. What has **never** been done is a human walking the whole thing in
a browser with an agent doing the work. That is what this plan is for.

**Time:** about 3 hours for the full pass. Section 1 is 15 minutes and gates the rest.

---

## 0. Two blockers to clear first

Both were found on this machine while writing this plan, and both silently break the
generate branch rather than erroring usefully.

**Both are now done on this machine** — recorded here because anyone else running this plan
has to repeat them, and each fails in a way that does not point at the cause.

**A. The synthetic-data environment.** It cannot share the app's venv: the app is on Python
3.11 and `databricks-connect` UDFs require the client's minor version to match serverless
(3.12). Plain SQL works on 3.11, so a naive smoke test passes and tells you nothing.

```bash
uv venv .venv-datagen --python 3.12
VIRTUAL_ENV=.venv-datagen uv pip install "databricks-connect>=16.4,<17.4" faker numpy pandas holidays
```

The pin matters — unpinned resolves to 19.0.0, which rejects serverless outright. There is a
third trap (serverless executors cannot see your local `faker`); the working fix is in
[docs/synthetic_data_setup.md](synthetic_data_setup.md). **Read that before §5.**

**B. `serverless_compute_id = auto`** in the `genie-workbench` block of `~/.databrickscfg`.
Without it `databricks-connect` cannot acquire compute and dies on connect.

Verified working end to end: 15,000 rows with real Faker city names on serverless DBR 18.x.

Then confirm readiness:

```bash
./vibe2value doctor        # workspace readiness block must be all green
```

> If you would rather not install local Python deps at all, that is a legitimate choice —
> run **§4 (connect branch)** and skip §5. Say so up front rather than discovering it
> mid-test.

---

## 1. Baseline: is the deployment actually healthy? (15 min, gates everything)

The failure mode this catches is specific and recent: `deploy --code-only` ships
`app.yaml` with an empty `LAKEBASE_HOST`, because endpoint discovery only runs on a full
deploy (`scripts/deploy.sh:716`). The app then falls back to YAML and serves **empty
prompts with `step_kind: instant_prompt` for every step** — it looks alive and is useless.

```bash
APP=$(databricks apps get vibe-coding-workshop-app --profile genie-workbench -o json | python3 -c "import json,sys;print(json.load(sys.stdin)['url'])")
TOKEN=$(databricks auth token --profile genie-workbench | python3 -c "import json,sys;print(json.load(sys.stdin)['access_token'])")

# A DB-backed app returns step_kind=verify here. 'instant_prompt' means the DB is not connected.
curl -s -H "Authorization: Bearer $TOKEN" "$APP/api/step/data_provision/content" \
  | python3 -c "import json,sys;d=json.load(sys.stdin);print('step_kind:',d.get('step_kind'),'| content chars:',len(d.get('content') or ''))"
```

| Result | Meaning | Action |
|---|---|---|
| `step_kind: verify`, content > 3000 chars | Healthy | Continue |
| `step_kind: instant_prompt`, content 0 | Lost the Lakebase host | `./vibe2value deploy --full`, wait 60s, retest |

**Pass criteria:** `verify`, non-empty content, and `./vibe2value doctor` all green.

---

## 2. The new decision fields render and gate correctly (20 min, browser)

Open the app and start a session. **Pick the `Sample` or `Travel & Hospitality` industry** —
only those two are active (`/api/industries` returns exactly `sample` and `travel`; retail
and CPG ship inactive). If you want retail, activate it first in **Configuration → Prompts**,
and note that as a finding.

Walk to **step 3 (PRD Generation)** and check, in the browser:

- [ ] Four fields render: the two feature/metric fields **plus `protagonist` and
      `dollar_impact`**.
- [ ] **Commit stays disabled** until all four are satisfied. Try committing with
      `protagonist` under 40 characters and with `dollar_impact` under 25 — both must block.
- [ ] The expert answer is **not** in the page source before you commit (View Source, search
      for any of its text). This is the commit-before-reveal contract.
- [ ] After committing, the reveal streams in and **argues about your money figure** rather
      than generic advice.

Then **step 58 (Data Model)**:

- [ ] The `anomaly_timing` **radio** renders with three options.
- [ ] Commit is blocked until one is picked.
- [ ] **Deliberately choose "Building now, still rising"** — the option the reveal argues
      against. The reveal must explain that it has no "after" and reads as a cliff. This is
      the single most important assertion in this section: it is the lesson, not a validation
      error.

**Record:** anything that made you hesitate. That is the real output of this section.

---

## 3. The story reaches the agent, not just the database (10 min)

The whole point of the change. Substitute your own session id.

```bash
SID=<your session id from the URL>
curl -s -H "Authorization: Bearer $TOKEN" "$APP/api/step/data_provision/content?session_id=$SID" \
  | python3 -c "
import json,sys,re
t=json.load(sys.stdin)['content']
print('raw tokens left:', sorted(set(re.findall(r'\{[a-z_]+\}', t))))
b=t.split('## Make the Data Carry Your Story')[1]
print(b[:1600])"
```

- [ ] Your **protagonist** and **currency figure** appear verbatim in the brief.
- [ ] The **timing you chose** appears, and the surrounding text reads correctly *for that
      choice* — including the "no decay, monotonic climb" branch if you picked still-rising.
- [ ] `SPIKE_PEAK`, `NOW -` and the `max(date)` prohibition are all present.
- [ ] **No raw `{token}` from a step you have committed.** (`{data_source}` is expected
      until you commit step 57.)

---

## 4. Connect branch — the safe default (30 min)

Do this branch **first**, even if you intend to generate. It is the one most attendees will
take, and it needs no local Python.

On **step 57**, commit "I have existing tables". Then point the workshop at real data. Any
schema with a few related tables works; `samples.bakehouse` or `samples.tpch` are fine.

- [ ] Step 10 has an inline editor for the source catalog/schema — set it there.
- [ ] Set the session's dataset either through that editor or by having your agent call
      `report_gate`.

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"session_id":"'$SID'","section_tag":"data_provision","gate":"Dataset provisioned","status":"pass",
       "captured":{"chapter_3_lakehouse_catalog":"samples","chapter_3_lakehouse_schema":"bakehouse"}}' \
  "$APP/api/workshop/gate" | head -c 400
```

Then the assertion that matters — **the tourism-default bug must stay fixed**:

```bash
curl -s -H "Authorization: Bearer $TOKEN" "$APP/api/step/bronze_table_metadata/content?session_id=$SID" \
  | python3 -c "
import json,sys
t=json.load(sys.stdin)['content']
print('names YOUR schema :', 'bakehouse' in t)
print('leaks wanderbricks:', 'wanderbricks' in t)"
```

- [ ] Names your schema; **does not** mention `wanderbricks`.
- [ ] The step 59 verify gate runs and reports `pass`/`fail`/**`unknown`** — and `unknown`
      **does not block Done**. Expect `unknown` for a personal catalog; that is by design.

---

## 5. Generate branch — the headline feature (60–75 min)

Only after §0 is clear. This is the least-proven path: the corrected brief has **not** been
re-executed end to end since it was fixed.

On step 57 commit "Generate a dataset for me", then hand your coding agent the brief from
step 59 **verbatim**, including the "Make the Data Carry Your Story" block.

Watch for four things, in order:

1. [ ] **It presents a plan before generating.** The skill's own rule, and the workshop's
       commit-before-reveal in a different guise. If it starts writing tables immediately,
       that is a finding.
2. [ ] **It resolves a writable catalog read-only** and never runs `CREATE CATALOG`. The
       workshop invariant. It should create a *schema* in `luis_catalog`.
3. [ ] **It prints the dates it chose** for `SPIKE_START` / `SPIKE_PEAK` / decay.
4. [ ] **It computes the cost** of the incident from the data instead of restating your
       figure.

Then verify the data itself — the part no test can do for you:

```bash
databricks experimental aitools tools query \
  "SELECT date_trunc('week', <your_date_col>) wk, count(*) n, sum(<your_measure>) v
   FROM luis_catalog.<your_schema>.<your_fact> GROUP BY 1 ORDER BY 1" \
  --profile genie-workbench
```

- [ ] **The peak is NOT in the final week.** Chart it or read the numbers. A peak on the last
      row is the exact bug §2 and §3 exist to prevent, and it means the brief did not land.
- [ ] There is a visible **buildup and decay**, not one elevated week.
- [ ] Row count is roughly `synthetic_row_target` (15,000 — live-editable on the
      Configuration page if you want a faster run).
- [ ] **No orphan foreign keys**: children join to parents.
- [ ] Distributions are **not uniform** — some categories dominate.

Finally, the loop must close:

- [ ] The agent calls `report_gate` with the catalog and schema it created.
- [ ] Re-run the §4 assertion: Chapter 3's prompts now name **your generated schema**.

---

## 6. Grain disambiguation (10 min) — regression guard

Recently fixed and worth confirming by hand, because the symptom is silent: step 59 used to
be able to receive step 11's coarser **gold** grain and generate pre-aggregated data.

Commit a grain on **step 58** and a *different* one on **step 11**, then:

```bash
for tag in data_provision gold_layer_design; do
  curl -s -H "Authorization: Bearer $TOKEN" "$APP/api/step/$tag/content?session_id=$SID" \
    | python3 -c "
import json,sys,re
t=json.load(sys.stdin)['content']
print('$tag ->', [l for l in t.splitlines() if 'grain' in l.lower()][:2])
print('  raw tokens:', sorted(set(re.findall(r'\{[a-z_]*fact_grain\}', t))))"
done
```

- [ ] Step 59 shows the **source** grain; step 11 shows the **gold** grain.
- [ ] Neither shows the other's, and there are **no raw tokens**.

---

## 7. Coherence gate and the 5-second test (25 min)

**Step 15.** Write a real trace — the 120-character minimum is deliberate.

- [ ] Commit is blocked by a one-line answer.
- [ ] The reveal **walks Data → Pipeline → Dashboard → Genie** and names *your* columns.
- [ ] It finds a real break if there is one. (When this was tested with a deliberately
      flawed trace, it correctly objected that you cannot record a stockout in a table of
      successful sales. That is the gate working.)
- [ ] **Time how long the room would spend here.** If it stalls you, note it — the minimum
      is tunable to 80 without a redeploy.

**Step 16.** Build the dashboard, then run the test as written:

- [ ] `expected_output` contains the **5-Second Test** block with your currency figure.
- [ ] Look away, look back for five seconds: can you point at the incident without reading a
      label? If not, record whether the fix belongs in the dashboard or in the data.

---

## 8. Agent handoff over MCP (15 min)

The claim is that attendees stop copy-pasting.

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' "$APP/api/mcp" \
  | python3 -c "import json,sys;print([t['name'] for t in json.load(sys.stdin)['result']['tools']])"
```

- [ ] Seven tools listed: `whoami`, `get_current_step`, `list_steps`, `enter_step`,
      `report_gate`, `submit_decision`, `verify_step`.
- [ ] Connect your real agent and have it call `get_current_step` and complete one step
      **without you pasting anything**.
- [ ] A decision submitted over `submit_decision` shows up committed in the browser.

---

## 9. Merged steps (15 min) — the known untested gap

Flagged in the runbook: phase behaviour is verified through the component, but **nobody has
clicked a merged step on a seeded deployment**. Chapter 2 **step 6** is the one to watch.

- [ ] Step 6 shows phases (it absorbs retired steps 7 and 8).
- [ ] Completing phases advances progress **without double-counting points**.
- [ ] **Reset the step**, and confirm the score returns to zero for it rather than retaining
      merged points.

---

## What to record

For each section: pass/fail, and — more useful — **where you hesitated**. A step nobody
pauses at is a step still doing the attendee's thinking for them.

Three findings that would change the pilot plan, so flag them immediately:

1. The generated peak lands in the final week (§5) — the brief is not landing.
2. Chapter 3 names `wanderbricks` instead of your schema (§4) — the dataset chain is broken.
3. Step 15 or step 3's money field stalls you for more than a few minutes — those are the two
   most likely to stall a room, and both are tunable before the pilot.
