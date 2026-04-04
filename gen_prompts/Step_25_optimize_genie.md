Optimize your Genie Space for production accuracy using @data_product_accelerator/skills/semantic-layer/05-genie-optimization-orchestrator/SKILL.md

This orchestrator runs a systematic **benchmark → evaluate → optimize → apply → re-evaluate** loop with 4 specialized workers and MLflow experiment tracking.

## Optimization Loop

The orchestrator executes up to **5 iterations**, applying 6 control levers in priority order until all quality targets are met:

### Phase 1: Baseline Evaluation
1. Snapshot current Genie Space metadata (instructions, assets, benchmarks)
2. Create MLflow LoggedModel for the Genie Space
3. Run the **Benchmark Generator** — create/validate benchmark dataset with ≥ 10 questions and ground-truth SQL
4. Run the **Benchmark Evaluator** — evaluate all benchmarks using 8 quality scorers via `mlflow.genai.evaluate()`
5. Record baseline scores as iteration 0

### Phase 2: Per-Lever Optimization (Levers 1→5)
For each control lever in priority order:
1. Run the **Metadata Optimizer** — analyze evaluation results and propose metadata changes for the current lever
2. Run the **Optimization Applier** — apply proposals with **dual persistence** (Genie API + repo files)
3. Wait 30 seconds for Genie to pick up changes
4. Run slice evaluation (affected benchmarks only)
5. If slice passes → run P0 gate (full evaluation)
6. If P0 fails → **rollback** and move to next lever

### Phase 3: GEPA (Lever 6) — Only if Still Below Target
- General-Purpose Architecture changes (add/remove data assets, restructure instructions)
- Applied ONLY after Levers 1-5 have been attempted
- Requires dual persistence verification (`git diff`)

### Phase 4: Deploy and Verify
- Promote best model iteration
- Run held-out evaluation (benchmarks not seen during optimization)
- Post-deploy verification

## 6 Control Levers (Priority Order)

| Lever | Target | What Gets Changed |
|-------|--------|-------------------|
| **1: UC Metadata** | Column/table COMMENTs, tags | Add synonyms, clarify ambiguous columns |
| **2: Metric Views** | YAML definitions, measures | Add missing measures, fix aggregation logic |
| **3: TVFs** | Function signatures, COMMENTs | Fix parameter types, improve BEST FOR guidance |
| **4: Monitoring Tables** | DQ metrics, freshness views | Add monitoring assets to Genie Space |
| **5: ML Tables** | Feature tables, predictions | Add ML outputs as Genie data assets |
| **6: GEPA** | Instructions, data assets | Restructure Genie Space architecture |

## 8 Quality Targets

| Scorer | Target | What It Measures |
|--------|--------|-----------------|
| **Syntax Correctness** | ≥ 98% | Generated SQL parses without errors |
| **Schema Accuracy** | ≥ 95% | All tables/columns exist in the catalog |
| **Logical Correctness** | ≥ 90% | SQL logic matches the question intent |
| **Semantic Equivalence** | ≥ 90% | Results equivalent to ground-truth SQL |
| **Completeness** | ≥ 90% | All requested dimensions/measures present |
| **Result Correctness** | ≥ 85% | Actual query results match expected values |
| **Asset Routing** | ≥ 95% | Genie uses the right table/view/TVF |
| **Repeatability** | ≥ 90% | Same question → same SQL on repeated runs |

Target catalog: `jaiwa_vibe_coding_workshop_catalog`
Gold schema: `jaiwant_j_booking_app_gold`