// Preview-path parity oracle (Phase 3 T4a).
//
// The /config/test-scenario sandbox no longer calls getFilteredSections for its
// step order. It now fetches engine.outline() from the session-less preview
// endpoint (ORDER + structural variant) and applies its effectiveDisabledTags as a
// CLIENT-SIDE filter, exactly as orderedSectionsForRead does for the production
// read path. This oracle proves that REBUILT path is byte-identical to the OLD
// getFilteredSections path across every engine-expressible sandbox cell, and
// documents the ONE thing the rebuild deliberately drops: getFilteredSections'
// client-side reverse on variant-less tracks (the intentionally-retired branch).
//
// NON-HOLLOW: both sides are LIVE. The `gfs` column runs the REAL getFilteredSections
// from src/constants/workflowSections.ts (loaded offline via the identical scaffold
// as dump_outline_matrix.mjs — read text -> stub lucide-react -> strip `import type`
// -> temp .ts -> import()). The `previewTags` column runs the manifest engine model
// (mirrors manifest.outline_order) and is INDEPENDENTLY re-verified against the real
// Python engine.outline() in tests/workshop/test_preview_parity.py. Nothing here is
// a hand-authored list. getFilteredSections still EXISTS in this PR (it is retired in
// T4b), so both sides are genuinely live and comparable.
//
// The sandbox derivation is mirrored EXACTLY: for a given (track, direction, chip
// selection, tail toggles) the effectiveDisabledTags and the engine `flags` are
// derived the SAME way TestScenarioConfig derives them, so a divergence here is a
// real repoint bug — the oracle throws at generation time rather than baking a
// mismatch into the golden.
//
// Run: node --experimental-strip-types scripts/dump_preview_parity.mjs
// Node >= 22 (native TS strip). No tsx/vitest. package.json is type:module.

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const sourcePath = join(repositoryRoot, "src/constants/workflowSections.ts");
const manifestPath = join(repositoryRoot, "src/backend/workshop/manifest.json");
const fixturesPath = join(repositoryRoot, "tests/workshop/fixtures");

// --- Load the REAL workflowSections.ts offline (identical scaffold to
// dump_outline_matrix.mjs / dump_getfilteredsections.mjs). ---------------------
const source = await readFile(sourcePath, "utf8");
const iconImport = source.match(
  /import\s*\{([\s\S]*?)\}\s*from\s*["']lucide-react["'];/,
);
if (!iconImport) {
  throw new Error("Could not find the lucide-react import in workflowSections.ts");
}
const iconNames = iconImport[1]
  .split(",")
  .map((name) => name.trim())
  .filter(Boolean);
const iconStubs = iconNames.map((name) => `const ${name} = {};`).join("\n");
const executableSource = source
  .replace(iconImport[0], iconStubs)
  .replace(/import\s+type\s+\{[\s\S]*?\}\s+from\s*["']lucide-react["'];\s*/g, "");

const temporaryDirectory = await mkdtemp(join(tmpdir(), "preview-parity-"));
const temporarySourcePath = join(temporaryDirectory, "workflowSections.ts");
await writeFile(temporarySourcePath, executableSource, "utf8");

// --- Engine model: mirror manifest.outline_order (manifest.py) over the committed
// manifest — the exact thing engine.outline() loads. Re-verified in Python. -----
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

function selectSections(track, inputs) {
  for (const variant of track.variants ?? []) {
    const when = variant.when ?? {};
    if (Object.entries(when).every(([k, v]) => String((inputs ?? {})[k]) === String(v))) {
      return variant.sections;
    }
  }
  return track.sections;
}

function engineOutline(trackId, flags, inputs) {
  const track = manifest.tracks[trackId];
  const active = {};
  for (const [name, def] of Object.entries(track.flags ?? {})) {
    active[name] = Boolean(def.default);
  }
  for (const [name, value] of Object.entries(flags ?? {})) {
    active[name] = Boolean(value);
  }
  const tags = [];
  for (const section of selectSections(track, inputs)) {
    for (const step of section.steps) {
      if (step.flag == null || active[step.flag]) {
        tags.push(step.sectionTag);
      }
    }
  }
  return tags;
}

const arraysEqual = (a, b) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

// B1: the four reverse-* tracks bake reverse as their INTRINSIC baseline (the
// engine has no forward variant; the LevelSelector surfaces them only under the
// reverse toggle). end-to-end alone flips between forward and reverse. Mirrors
// REVERSE_INTRINSIC_TRACKS / expressibleDirection in TestScenarioConfig.tsx.
const REVERSE_INTRINSIC_TRACKS = new Set([
  "reverse-lakehouse",
  "reverse-lakehouse-di",
  "reverse-lakebase",
  "reverse-app",
]);
const VARIANT_REVERSE_TRACKS = new Set(["end-to-end", ...REVERSE_INTRINSIC_TRACKS]);

// The reachable directions for a track in the sandbox — exactly the pairs the
// LevelSelector + toggle can produce (reverse-* only under reverse; end-to-end
// both; every other forward-only track only forward).
function reachableDirections(trackId) {
  if (REVERSE_INTRINSIC_TRACKS.has(trackId)) return ["reverse"];
  if (trackId === "end-to-end") return ["forward", "reverse"];
  return ["forward"];
}

// The engine `flags` the sandbox sends (mirrors TestScenarioConfig.previewFlags):
// includeLakehouse / includeGenieOntology pinned ON (the sandbox has no Genie
// opt-in toggles and never adds their tags to effectiveDisabledTags, so it always
// previewed the full Genie composition), ai.*/medallion.* from the chip sets.
function previewFlagsFor(aiSel, medSel) {
  return {
    includeLakehouse: true,
    includeGenieOntology: true,
    "ai.genie": aiSel.has("genie"),
    "ai.agent": aiSel.has("agent"),
    "ai.dashboard": aiSel.has("dashboard"),
    "medallion.bronze": medSel.has("bronze"),
    "medallion.silver": medSel.has("silver"),
    "medallion.gold": medSel.has("gold"),
  };
}

try {
  const ws = await import(pathToFileURL(temporarySourcePath).href);

  const tracks = Object.keys(ws.WORKSHOP_LEVELS);
  const ALL_AI = ws.ALL_AI_MODULES;
  const ALL_MED = ws.ALL_MEDALLION_LAYERS;

  const flattenGfs = (trackId, disabledSet, direction) =>
    ws
      .getFilteredSections(trackId, disabledSet, undefined, direction)
      .flatMap((section) => section.steps)
      .map((step) => step.sectionTag);

  // effectiveDisabledTags EXACTLY as TestScenarioConfig derives it: AI + medallion
  // chip tags, plus the tail-section tags when the opt-in checkboxes are off, plus
  // any arbitrary per-assistant tags. (No Genie opt-in tags, no backend session
  // tags — the sandbox never adds those.)
  const effectiveDisabledTags = (trackId, aiSel, medSel, tails, extra = []) => {
    const set = new Set([
      ...ws.getDisabledTagsForAIModules(trackId, aiSel),
      ...ws.getDisabledTagsForMedallionLayers(trackId, medSel),
      ...extra,
    ]);
    if (!tails.cleanup) set.add("workspace_cleanup");
    if (!tails.iterate) {
      set.add("iterate_enhance");
      set.add("redeploy_test");
    }
    return set;
  };

  // Chip selections to enumerate per track — a representative, cascade-legal set
  // mirroring dump_outline_matrix.mjs: all-on (default), each applicable AI module
  // off, all AI off, and the two cascade-legal medallion deselections.
  function chipCombosFor(trackId) {
    const combos = [{ combo: "default", ai: new Set(ALL_AI), med: new Set(ALL_MED) }];

    if (ws.LEVELS_WITH_AI_MODULES.has(trackId)) {
      const applicable = ws.getApplicableAIModules(trackId);
      for (const module of ALL_AI) {
        if (!applicable.has(module)) continue;
        combos.push({
          combo: `ai-off:${module}`,
          ai: new Set(ALL_AI.filter((m) => m !== module)),
          med: new Set(ALL_MED),
        });
      }
      combos.push({ combo: "ai-off:all", ai: new Set(), med: new Set(ALL_MED) });
    }

    if (ws.LEVELS_WITH_MEDALLION_TOGGLES.has(trackId)) {
      combos.push({
        combo: "medallion:gold-off",
        ai: new Set(ALL_AI),
        med: ws.normalizeMedallionLayers(new Set(["bronze", "silver"])),
      });
      combos.push({
        combo: "medallion:silver+gold-off",
        ai: new Set(ALL_AI),
        med: ws.normalizeMedallionLayers(new Set(["bronze"])),
      });
    }

    return combos;
  }

  // Tail-toggle scenarios: the DEFAULT sandbox has both opt-ins OFF (so the tail
  // sections are filtered); "tails-on" covers the user opting both in.
  const TAIL_SCENARIOS = [
    { tail: "tails-off", cleanup: false, iterate: false },
    { tail: "tails-on", cleanup: true, iterate: true },
  ];

  const parity = [];
  const record = (trackId, direction, combo, tailName, disabledSet, flags, extra) => {
    const previewTags = engineOutline(trackId, flags, { direction });
    const rebuilt = previewTags.filter((t) => !disabledSet.has(t));
    const gfs = flattenGfs(trackId, disabledSet, direction);
    if (!arraysEqual(rebuilt, gfs)) {
      throw new Error(
        `PARITY MISMATCH ${trackId}/${direction}/${combo}/${tailName}\n` +
          `  disabled: [${[...disabledSet].sort().join(", ")}]\n` +
          `  rebuilt : ${JSON.stringify(rebuilt)}\n` +
          `  gfs     : ${JSON.stringify(gfs)}`,
      );
    }
    parity.push({
      track: trackId,
      direction,
      combo,
      tail: tailName,
      extraDisabled: [...extra].sort(),
      disabledTags: [...disabledSet].sort(),
      flags,
      previewTags,
      rebuilt,
      gfs,
      status: "parity",
    });
  };

  for (const trackId of tracks) {
    for (const direction of reachableDirections(trackId)) {
      for (const { combo, ai, med } of chipCombosFor(trackId)) {
        const flags = previewFlagsFor(ai, med);
        for (const scenario of TAIL_SCENARIOS) {
          const disabled = effectiveDisabledTags(trackId, ai, med, scenario);
          record(trackId, direction, combo, scenario.tail, disabled, flags, []);
        }
      }
    }
  }

  // Arbitrary per-assistant disabled tags (GAP A): tags that map to NO engine flag.
  // The engine KEEPS them; the client filter must drop them exactly as
  // getFilteredSections does. Exercise a few real step tags on end-to-end.
  {
    const ai = new Set(ALL_AI);
    const med = new Set(ALL_MED);
    const flags = previewFlagsFor(ai, med);
    const extra = ["prd_generation", "deploy_databricks_app"];
    const disabled = effectiveDisabledTags("end-to-end", ai, med, TAIL_SCENARIOS[1], extra);
    record("end-to-end", "forward", "assistant-hides", "tails-on", disabled, flags, extra);
  }

  // --- DIVERGENCE: the intentionally-retired branch (required by the human gate).
  // On a variant-less track, getFilteredSections applies its CLIENT-SIDE reverse
  // (REVERSE_SECTION_ORDER + reverse-only step edits), but the engine has no reverse
  // variant so engine.outline returns the FORWARD order. The rebuilt sandbox never
  // sends reverse for these tracks (B1), so this branch is dropped on purpose. We
  // assert BOTH sides here so the harness is honest about what changed.
  // app-only (the whole Databricks App section vanishes under GFS reverse) and
  // lakehouse-di (GFS drops step 19 + swaps AI/BI<->Genie) both genuinely diverge.
  // (lakehouse+reverse — the plan's other example — is a NO-OP: its sections sort
  // identically forward/reverse, so it is not a divergence cell.)
  const divergence = [];
  for (const trackId of ["app-only", "lakehouse-di"]) {
    if (VARIANT_REVERSE_TRACKS.has(trackId)) {
      throw new Error(`divergence track ${trackId} unexpectedly has a reverse variant`);
    }
    const flags = previewFlagsFor(new Set(ALL_AI), new Set(ALL_MED));
    const previewReverse = engineOutline(trackId, flags, { direction: "reverse" });
    const previewForward = engineOutline(trackId, flags, { direction: "forward" });
    const gfsReverse = flattenGfs(trackId, new Set(), "reverse");
    if (!arraysEqual(previewReverse, previewForward)) {
      throw new Error(
        `${trackId}: engine.outline(reverse) != engine.outline(forward) — expected a ` +
          `no-op reverse on a variant-less track`,
      );
    }
    if (arraysEqual(previewReverse, gfsReverse)) {
      throw new Error(
        `${trackId}: expected DIVERGENCE but engine reverse == getFilteredSections reverse`,
      );
    }
    divergence.push({
      track: trackId,
      direction: "reverse",
      reason:
        "getFilteredSections client-reverses variant-less tracks; the engine has no " +
        "reverse variant so it returns the FORWARD order. This client-reverse is the " +
        "branch T4a intentionally retires — the rebuilt sandbox never sends reverse here (B1).",
      flags,
      previewReverse,
      previewForward,
      gfsReverse,
      status: "divergence",
    });
  }

  const payload = {
    generated_by: "node --experimental-strip-types scripts/dump_preview_parity.mjs",
    doc:
      "Preview-path parity (Phase 3 T4a). rebuilt = clientFilter(engine.outline(track,{direction,flags}), effectiveDisabledTags); " +
      "gfs = REAL getFilteredSections(track, effectiveDisabledTags, undefined, direction) flattened. status=parity when byte-equal. " +
      "The divergence group documents getFilteredSections' client-reverse on variant-less tracks — the intentionally-retired branch " +
      "(engine returns FORWARD; the rebuilt sandbox never sends reverse there, per B1). previewTags is re-verified against the LIVE " +
      "Python engine.outline() in tests/workshop/test_preview_parity.py.",
    manifest_version: manifest.version,
    variant_reverse_tracks: [...VARIANT_REVERSE_TRACKS].sort(),
    parity,
    divergence,
  };

  await writeFile(
    join(fixturesPath, "golden_preview_parity.json"),
    `${JSON.stringify(payload, null, 2)}\n`,
    "utf8",
  );

  process.stdout.write(
    `dump_preview_parity: ${parity.length} parity cells, ${divergence.length} divergence cells — all consistent.\n`,
  );
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
