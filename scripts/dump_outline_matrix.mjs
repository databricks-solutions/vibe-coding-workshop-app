// Golden parity-matrix oracle (Phase 3 T2).
//
// Emits the full `engine.outline()` vs `getFilteredSections()` parity matrix for
// all 14 WORKSHOP_LEVELS across every legal flag/axis combo, into
// tests/workshop/fixtures/golden_outline_matrix.json (+ a human-readable
// PARITY_MATRIX.md). The Python test suite (tests/workshop/test_outline_parity.py)
// re-verifies the engine column against the REAL engine and locks the matrix.
//
// The TS ("ts") column is the non-hollow oracle: it runs the REAL
// getFilteredSections / getDisabledTags* / getCumulativeOverrides from
// src/constants/workflowSections.ts, loaded offline via the identical scaffold
// as scripts/dump_getfilteredsections.mjs (read text -> stub lucide-react ->
// strip `import type` -> temp .ts -> import()). It NEVER derives the TS truth
// from generate_manifest.py or manifest.json (the hollow side under test).
//
// The engine ("engine") column mirrors manifest.outline_order (manifest.py):
// strict manifest declaration order (section order -> step order) minus
// flag-filtered steps. It is read from the committed manifest.json — which is
// exactly what engine.outline() loads — and is INDEPENDENTLY re-checked in
// Python against the real engine.outline(), so it is not hollow.
//
// status = 'parity' when ts and engine are byte-equal ordered sequences,
// otherwise 'gap'. As of Phase 3 T3a the engine composes ALL four former gap
// axes — direction=reverse (baked into the four reverse-* tracks; a runtime
// variant on end-to-end), additive-chain climb (a chainContext variant on
// lakehouse / lakehouse-di), and the AI-module + medallion sub-toggles (six
// default-true session flags) — so every enumerated cell is expressible and MUST
// be parity. Each cell records the ENGINE inputs (flags + direction/chainContext)
// that reproduce its REAL getFilteredSections order; nothing is forced to parity
// by bending the engine or the TS oracle.
//
// Run: node --experimental-strip-types scripts/dump_outline_matrix.mjs
// Node >= 22 (native TS strip). No tsx/vitest. package.json is type:module.

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const sourcePath = join(repositoryRoot, "src/constants/workflowSections.ts");
const manifestPath = join(repositoryRoot, "src/backend/workshop/manifest.json");
const fixturesPath = join(repositoryRoot, "tests/workshop/fixtures");

// --- Load the REAL workflowSections.ts offline (identical scaffold to the
// existing dump_getfilteredsections.mjs oracle). ---------------------------
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

const temporaryDirectory = await mkdtemp(join(tmpdir(), "outline-matrix-"));
const temporarySourcePath = join(temporaryDirectory, "workflowSections.ts");
await writeFile(temporarySourcePath, executableSource, "utf8");

// --- Engine model: mirror manifest.outline_order over the committed manifest. --
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

/**
 * Select the active section list for a track given the composition `inputs`
 * (direction / chainContext), mirroring manifest.py Track.sections_for: the first
 * variant whose `when` conditions all match wins, else the default sections.
 */
function selectSections(track, inputs) {
  for (const variant of track.variants ?? []) {
    const when = variant.when ?? {};
    if (Object.entries(when).every(([k, v]) => String((inputs ?? {})[k]) === String(v))) {
      return variant.sections;
    }
  }
  return track.sections;
}

/**
 * Reproduce engine.outline()'s ordered sectionTag sequence: pick the active
 * sections for `inputs`, then take manifest declaration order minus steps whose
 * flag is off. `flags` overrides each flag's manifest default. This mirrors
 * manifest.py Manifest.outline_order and is re-verified against the real Python
 * engine in test_outline_parity.py.
 */
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

try {
  const ws = await import(pathToFileURL(temporarySourcePath).href);

  const tracks = Object.keys(ws.WORKSHOP_LEVELS);

  const flatten = (trackId, disabledTags, overrides, direction) =>
    ws
      .getFilteredSections(trackId, disabledTags, overrides, direction)
      .flatMap((section) => section.steps)
      .map((step) => step.sectionTag);

  const GENIE = "genie-accelerator";
  const genieDisabled = (includeLakehouse, includeOntology) =>
    new Set([
      ...ws.getDisabledTagsForGenieOntology(GENIE, includeOntology),
      ...ws.getDisabledTagsForLakehouse(GENIE, includeLakehouse),
    ]);

  // Reverse is legally offered only for the reverse-ETL column levels plus the
  // direction-agnostic end-to-end (LevelSelector.getHighlightedButtons + the
  // App handleDirectionChange guard that hides accelerator levels in reverse).
  const REVERSE_OFFERED = new Set([
    "reverse-lakehouse",
    "reverse-lakehouse-di",
    "reverse-lakebase",
    "reverse-app",
    "end-to-end",
  ]);
  // The four reverse-* levels render ONLY in reverse direction, so reverse is
  // their intrinsic baseline (the engine bakes it into the manifest track). Their
  // default / sub-toggle / direction cells are therefore computed at direction
  // "reverse"; end-to-end stays forward-baseline with a reverse VARIANT.
  const REVERSE_INTRINSIC = new Set([
    "reverse-lakehouse",
    "reverse-lakehouse-di",
    "reverse-lakebase",
    "reverse-app",
  ]);
  const baselineDirection = (trackId) =>
    REVERSE_INTRINSIC.has(trackId) ? "reverse" : "forward";
  // Additive-chain climb: getCumulativeOverrides returns overrides only for
  // APP_CHAIN positions past index 1 (lakehouse, lakehouse-di).
  const CLIMB_TRACKS = new Set(["lakehouse", "lakehouse-di"]);

  // Sub-toggle flag names (Phase 3 T3a) — the session flags the engine reads to
  // express an AI-module / medallion-layer deselection. Mirrors the flag stamping
  // in generate_manifest.py and the tag maps in getDisabledTagsFor*.
  const aiFlag = (module) => `ai.${module}`;
  const medallionFlag = (layer) => `medallion.${layer}`;

  /**
   * Build the ordered cells for a track. Every cell carries the ENGINE inputs
   * that reproduce its TS order: `flags` (sub-toggle / genie booleans), plus the
   * composition inputs `direction` / `chainContext` the engine reads from
   * session_parameters to pick a variant. All four former gap axes are now
   * engine-expressible (Phase 3 T3a), so `expressible` is true throughout.
   */
  function cellsForTrack(trackId) {
    const cells = [];
    const isGenie = trackId === GENIE;
    const baseDir = baselineDirection(trackId);

    // 1) Default combo — the hard-assert safety net. For reverse-* tracks the
    //    baseline (and thus this cell) is reverse; the engine bakes it into the
    //    default track, so no explicit input is needed.
    const defaultDisabled = isGenie ? genieDisabled(false, false) : new Set();
    cells.push({
      combo: "default",
      axis: "default",
      expressible: true,
      flags: {},
      ts: flatten(trackId, defaultDisabled, undefined, baseDir),
    });

    // 2) Genie flag matrix (expressible via session_parameters.flags).
    if (isGenie) {
      cells.push({
        combo: "flags:includeLakehouse",
        axis: "genie-flags",
        expressible: true,
        flags: { includeLakehouse: true },
        ts: flatten(trackId, genieDisabled(true, false), undefined, "forward"),
      });
      cells.push({
        combo: "flags:includeGenieOntology",
        axis: "genie-flags",
        expressible: true,
        flags: { includeGenieOntology: true },
        ts: flatten(trackId, genieDisabled(false, true), undefined, "forward"),
      });
      cells.push({
        combo: "flags:includeLakehouse+includeGenieOntology",
        axis: "genie-flags",
        expressible: true,
        flags: { includeLakehouse: true, includeGenieOntology: true },
        ts: flatten(trackId, genieDisabled(true, true), undefined, "forward"),
      });
    }

    // 3) Additive-chain climb — engine reads chainContext='app' -> climb variant.
    if (CLIMB_TRACKS.has(trackId)) {
      const overrides = ws.getCumulativeOverrides(trackId, new Set(), "app");
      cells.push({
        combo: "climb:app",
        axis: "climb",
        expressible: true,
        flags: {},
        chainContext: "app",
        ts: flatten(trackId, new Set(), overrides ?? undefined, "forward"),
      });
    }

    // 4) direction = reverse. For the four reverse-* tracks this equals the baked
    //    default (the input is a no-op the engine ignores); for end-to-end the
    //    engine selects the reverse variant.
    if (REVERSE_OFFERED.has(trackId)) {
      cells.push({
        combo: "direction:reverse",
        axis: "direction",
        expressible: true,
        flags: {},
        direction: "reverse",
        ts: flatten(trackId, new Set(), undefined, "reverse"),
      });
    }

    // 5) AI-module sub-toggles — engine expresses each via a default-true ai.*
    //    flag turned off. Computed at the track's baseline direction, so reverse-*
    //    cells are genuine reverse x sub-toggle COMPOUND cells.
    if (ws.LEVELS_WITH_AI_MODULES.has(trackId)) {
      const applicable = ws.getApplicableAIModules(trackId);
      for (const module of ws.ALL_AI_MODULES) {
        if (!applicable.has(module)) continue;
        const selected = new Set(
          ws.ALL_AI_MODULES.filter((m) => applicable.has(m) && m !== module),
        );
        cells.push({
          combo: `ai-off:${module}`,
          axis: "ai-modules",
          expressible: true,
          flags: { [aiFlag(module)]: false },
          ts: flatten(
            trackId,
            new Set(ws.getDisabledTagsForAIModules(trackId, selected)),
            undefined,
            baseDir,
          ),
        });
      }
      // All applicable AI modules off.
      const allOffFlags = {};
      for (const module of ws.ALL_AI_MODULES) {
        if (applicable.has(module)) allOffFlags[aiFlag(module)] = false;
      }
      cells.push({
        combo: "ai-off:all",
        axis: "ai-modules",
        expressible: true,
        flags: allOffFlags,
        ts: flatten(
          trackId,
          new Set(ws.getDisabledTagsForAIModules(trackId, new Set())),
          undefined,
          baseDir,
        ),
      });
    }

    // 6) Medallion sub-toggles — cascade-legal selections that differ from all-on
    //    ({bronze,silver} => gold off; {bronze} => silver+gold off). Engine
    //    expresses via default-true medallion.* flags turned off, at baseline dir.
    if (ws.LEVELS_WITH_MEDALLION_TOGGLES.has(trackId)) {
      const medallionCombos = [
        ["medallion:gold-off", new Set(["bronze", "silver"]), { [medallionFlag("gold")]: false }],
        [
          "medallion:silver+gold-off",
          new Set(["bronze"]),
          { [medallionFlag("silver")]: false, [medallionFlag("gold")]: false },
        ],
      ];
      for (const [combo, selected, flags] of medallionCombos) {
        cells.push({
          combo,
          axis: "medallion",
          expressible: true,
          flags,
          ts: flatten(
            trackId,
            new Set(ws.getDisabledTagsForMedallionLayers(trackId, selected)),
            undefined,
            baseDir,
          ),
        });
      }
    }

    return cells;
  }

  const cells = [];
  for (const trackId of tracks) {
    for (const cell of cellsForTrack(trackId)) {
      const inputs = {};
      if (cell.direction != null) inputs.direction = cell.direction;
      if (cell.chainContext != null) inputs.chainContext = cell.chainContext;
      const engine = engineOutline(trackId, cell.flags, inputs);
      const status = arraysEqual(cell.ts, engine) ? "parity" : "gap";
      cells.push({
        track: trackId,
        combo: cell.combo,
        axis: cell.axis,
        expressible: cell.expressible,
        flags: cell.flags,
        direction: cell.direction ?? null,
        chainContext: cell.chainContext ?? null,
        ts: cell.ts,
        engine,
        status,
      });
    }
  }

  const matrix = {
    generated_by: "node --experimental-strip-types scripts/dump_outline_matrix.mjs",
    doc: "engine.outline() vs getFilteredSections() parity matrix. ts=REAL getFilteredSections; engine=manifest.outline_order (re-verified in Python). status=parity when equal else gap. Phase 3 T3a: the engine composes all four axes (direction=reverse, additive-chain climb, AI-module + medallion sub-toggles), so every cell is expressible and MUST be parity; each cell records the engine inputs (flags + direction/chainContext) that reproduce its TS order.",
    manifest_version: manifest.version,
    tracks,
    cells,
  };

  await writeFile(
    join(fixturesPath, "golden_outline_matrix.json"),
    `${JSON.stringify(matrix, null, 2)}\n`,
    "utf8",
  );

  // --- Human-readable PARITY_MATRIX.md ---------------------------------------
  const axisLabels = {
    default: "default",
    "genie-flags": "genie flags",
    climb: "additive-chain climb",
    direction: "direction=reverse",
    "ai-modules": "AI-module sub-toggle",
    medallion: "medallion sub-toggle",
  };
  const parityCells = cells.filter((c) => c.status === "parity");
  const gapCells = cells.filter((c) => c.status === "gap");
  const engineInput = (c) => {
    const parts = [];
    if (c.direction) parts.push(`direction=${c.direction}`);
    if (c.chainContext) parts.push(`chainContext=${c.chainContext}`);
    for (const [k, v] of Object.entries(c.flags ?? {})) parts.push(`${k}=${v}`);
    return parts.join(", ") || "—";
  };

  const lines = [];
  lines.push("# Outline parity matrix (Phase 3 T3a)");
  lines.push("");
  lines.push(
    "Generated by `node --experimental-strip-types scripts/dump_outline_matrix.mjs`. Do not hand-edit — regenerate.",
  );
  lines.push("");
  lines.push(
    "`ts` = the REAL `getFilteredSections()` ordered `sectionTag` sequence. " +
      "`engine` = `engine.outline()` (manifest declaration order minus flag-filtered steps, over the variant the engine selects). " +
      "**parity** = the engine reproduces the TS order. As of T3a the engine composes all four axes " +
      "(direction=reverse, additive-chain climb, AI-module + medallion sub-toggles), so every cell is expressible and parity; " +
      "the `Engine input` column shows the flags + direction/chainContext the engine reads to reproduce each TS order.",
  );
  lines.push("");
  lines.push(
    `Totals: ${cells.length} cells across ${tracks.length} tracks — ${parityCells.length} parity, ${gapCells.length} gap.`,
  );
  lines.push("");
  lines.push("## Matrix (14 tracks x combos)");
  lines.push("");
  lines.push("| Track | Combo | Axis | Engine input | Expressible | Status | TS len | Engine len |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const c of cells) {
    lines.push(
      `| ${c.track} | ${c.combo} | ${axisLabels[c.axis] ?? c.axis} | ${engineInput(c)} | ${
        c.expressible ? "yes" : "no"
      } | ${c.status === "parity" ? "✅ parity" : "⚠️ gap"} | ${c.ts.length} | ${
        c.engine.length
      } |`,
    );
  }
  lines.push("");
  lines.push("## Expressible cells (hard-asserted parity — the safety net)");
  lines.push("");
  lines.push(
    "Every cell the engine reproduces exactly. Any drift here is a real finding, not a gap.",
  );
  lines.push("");
  for (const c of cells.filter((x) => x.expressible)) {
    lines.push(`- \`${c.track}\` / \`${c.combo}\` — ${c.status.toUpperCase()}`);
  }
  lines.push("");
  lines.push("## Composition axes (Phase 3 T3a — all reconciled)");
  lines.push("");
  lines.push(
    "The four axes that were Phase 3 T3 gaps are now engine-composed. Any cell that regresses to a gap " +
      "is listed below with its concrete TS-vs-engine diff (empty in a healthy tree).",
  );
  lines.push("");
  const byAxis = {};
  for (const c of gapCells) {
    (byAxis[c.axis] ??= []).push(c);
  }
  for (const axis of ["direction", "climb", "ai-modules", "medallion"]) {
    const group = byAxis[axis] ?? [];
    lines.push(`### ${axisLabels[axis] ?? axis} (${group.length} gap cells)`);
    lines.push("");
    if (group.length === 0) {
      lines.push("_Reconciled: every cell on this axis is engine-composed and at parity._");
      lines.push("");
      continue;
    }
    for (const c of group) {
      const onlyTs = c.ts.filter((t) => !c.engine.includes(t));
      const onlyEngine = c.engine.filter((t) => !c.ts.includes(t));
      const reordered =
        onlyTs.length === 0 && onlyEngine.length === 0 && !arraysEqual(c.ts, c.engine);
      const diffParts = [];
      if (onlyTs.length) diffParts.push(`TS-only: [${onlyTs.join(", ")}]`);
      if (onlyEngine.length) diffParts.push(`engine-only: [${onlyEngine.join(", ")}]`);
      if (reordered) diffParts.push("same set, reordered");
      lines.push(`- \`${c.track}\` / \`${c.combo}\` — ${diffParts.join("; ") || "differs"}`);
    }
    lines.push("");
  }
  // Any gap axes not in the fixed list above (defensive).
  for (const axis of Object.keys(byAxis)) {
    if (["direction", "climb", "ai-modules", "medallion"].includes(axis)) continue;
    lines.push(`### ${axisLabels[axis] ?? axis} (${byAxis[axis].length} gap cells)`);
    lines.push("");
    for (const c of byAxis[axis]) {
      lines.push(`- \`${c.track}\` / \`${c.combo}\``);
    }
    lines.push("");
  }
  // Non-expressible cells: none should remain after T3a (every axis composes).
  const notExpressible = cells.filter((c) => !c.expressible);
  lines.push("## Non-expressible cells (should be empty after T3a)");
  lines.push("");
  if (notExpressible.length === 0) {
    lines.push("_None — every enumerated cell is engine-expressible._");
  } else {
    for (const c of notExpressible) {
      lines.push(`- \`${c.track}\` / \`${c.combo}\` (\`${axisLabels[c.axis] ?? c.axis}\`) — status ${c.status}`);
    }
  }
  lines.push("");

  await writeFile(
    join(fixturesPath, "PARITY_MATRIX.md"),
    `${lines.join("\n")}\n`,
    "utf8",
  );
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
