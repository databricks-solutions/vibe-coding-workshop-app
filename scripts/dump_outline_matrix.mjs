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
// otherwise 'gap'. Expressible axes (default forward, genie flags) MUST be
// parity; gap axes (direction=reverse, additive-chain climb, AI-module
// sub-toggles, medallion sub-toggles) are the T3 reconciliation scope — recorded
// with their concrete diff, never forced to parity by bending the engine or TS.
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
 * Reproduce engine.outline()'s ordered sectionTag sequence: strict manifest
 * declaration order minus steps whose flag is off. `flags` overrides each
 * flag's manifest default. This mirrors manifest.py Manifest.outline_order and
 * is re-verified against the real Python engine in test_outline_parity.py.
 */
function engineOutline(trackId, flags) {
  const track = manifest.tracks[trackId];
  const active = {};
  for (const [name, def] of Object.entries(track.flags ?? {})) {
    active[name] = Boolean(def.default);
  }
  for (const [name, value] of Object.entries(flags ?? {})) {
    active[name] = Boolean(value);
  }
  const tags = [];
  for (const section of track.sections) {
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
  // Additive-chain climb: getCumulativeOverrides returns overrides only for
  // APP_CHAIN positions past index 1 (lakehouse, lakehouse-di).
  const CLIMB_TRACKS = new Set(["lakehouse", "lakehouse-di"]);

  /** Build the ordered list of {label, axis, expressible, flags, ts} cells for a track. */
  function cellsForTrack(trackId) {
    const cells = [];
    const isGenie = trackId === GENIE;

    // 1) Default forward combo — the hard-assert safety net (expressible).
    const defaultDisabled = isGenie ? genieDisabled(false, false) : new Set();
    cells.push({
      combo: "default",
      axis: "default",
      expressible: true,
      flags: {},
      ts: flatten(trackId, defaultDisabled, undefined, "forward"),
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

    // 3) Additive-chain climb (GAP) — real getCumulativeOverrides input.
    if (CLIMB_TRACKS.has(trackId)) {
      const overrides = ws.getCumulativeOverrides(trackId, new Set(), "app");
      cells.push({
        combo: "climb:app",
        axis: "climb",
        expressible: false,
        flags: {},
        ts: flatten(trackId, new Set(), overrides ?? undefined, "forward"),
      });
    }

    // 4) direction = reverse (GAP).
    if (REVERSE_OFFERED.has(trackId)) {
      cells.push({
        combo: "direction:reverse",
        axis: "direction",
        expressible: false,
        flags: {},
        ts: flatten(trackId, new Set(), undefined, "reverse"),
      });
    }

    // 5) AI-module sub-toggles (GAP) — isolated against the forward baseline.
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
          expressible: false,
          flags: {},
          ts: flatten(
            trackId,
            new Set(ws.getDisabledTagsForAIModules(trackId, selected)),
            undefined,
            "forward",
          ),
        });
      }
      // All applicable AI modules off.
      cells.push({
        combo: "ai-off:all",
        axis: "ai-modules",
        expressible: false,
        flags: {},
        ts: flatten(
          trackId,
          new Set(ws.getDisabledTagsForAIModules(trackId, new Set())),
          undefined,
          "forward",
        ),
      });
    }

    // 6) Medallion sub-toggles (GAP) — cascade-legal selections that differ
    // from all-on (empty / silver-only / gold-only normalize back to all-on).
    if (ws.LEVELS_WITH_MEDALLION_TOGGLES.has(trackId)) {
      const medallionCombos = [
        ["medallion:gold-off", new Set(["bronze", "silver"])],
        ["medallion:silver+gold-off", new Set(["bronze"])],
      ];
      for (const [combo, selected] of medallionCombos) {
        cells.push({
          combo,
          axis: "medallion",
          expressible: false,
          flags: {},
          ts: flatten(
            trackId,
            new Set(ws.getDisabledTagsForMedallionLayers(trackId, selected)),
            undefined,
            "forward",
          ),
        });
      }
    }

    return cells;
  }

  const cells = [];
  for (const trackId of tracks) {
    for (const cell of cellsForTrack(trackId)) {
      const engine = engineOutline(trackId, cell.flags);
      const status = arraysEqual(cell.ts, engine) ? "parity" : "gap";
      cells.push({
        track: trackId,
        combo: cell.combo,
        axis: cell.axis,
        expressible: cell.expressible,
        flags: cell.flags,
        ts: cell.ts,
        engine,
        status,
      });
    }
  }

  const matrix = {
    generated_by: "node --experimental-strip-types scripts/dump_outline_matrix.mjs",
    doc: "engine.outline() vs getFilteredSections() parity matrix. ts=REAL getFilteredSections; engine=manifest.outline_order (re-verified in Python). status=parity when equal else gap. Expressible axes MUST be parity; gap axes scope Phase 3 T3.",
    manifest_version: manifest.version,
    tracks,
    cells,
  };

  await writeFile(
    join(fixturesPath, "golden_outline_matrix.json"),
    `${JSON.stringify(matrix, null, 2)}\n`,
    "utf8",
  );

  // --- Human-readable PARITY_MATRIX.md (the T3 reconciliation list). ---------
  const axisLabels = {
    default: "default (forward)",
    "genie-flags": "genie flags",
    climb: "additive-chain climb",
    direction: "direction=reverse",
    "ai-modules": "AI-module sub-toggle",
    medallion: "medallion sub-toggle",
  };
  const parityCells = cells.filter((c) => c.status === "parity");
  const gapCells = cells.filter((c) => c.status === "gap");

  const lines = [];
  lines.push("# Outline parity matrix (Phase 3 T2)");
  lines.push("");
  lines.push(
    "Generated by `node --experimental-strip-types scripts/dump_outline_matrix.mjs`. Do not hand-edit — regenerate.",
  );
  lines.push("");
  lines.push(
    "`ts` = the REAL `getFilteredSections()` ordered `sectionTag` sequence. " +
      "`engine` = `engine.outline()` (manifest declaration order minus flag-filtered steps). " +
      "**parity** = the engine reproduces the TS order; **gap** = an axis the engine cannot yet express (Phase 3 T3 scope).",
  );
  lines.push("");
  lines.push(
    `Totals: ${cells.length} cells across ${tracks.length} tracks — ${parityCells.length} parity, ${gapCells.length} gap.`,
  );
  lines.push("");
  lines.push("## Matrix (14 tracks x combos)");
  lines.push("");
  lines.push("| Track | Combo | Axis | Expressible | Status | TS len | Engine len |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- |");
  for (const c of cells) {
    lines.push(
      `| ${c.track} | ${c.combo} | ${axisLabels[c.axis] ?? c.axis} | ${
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
    "These are the cells the engine is expected to reproduce exactly. Any drift here is a real finding, not a gap.",
  );
  lines.push("");
  for (const c of cells.filter((x) => x.expressible)) {
    lines.push(`- \`${c.track}\` / \`${c.combo}\` — ${c.status.toUpperCase()}`);
  }
  lines.push("");
  lines.push("## T3 reconciliation gap list");
  lines.push("");
  lines.push(
    "Axes the engine cannot yet express. Each cell below shows how the REAL TS order diverges from the engine's (forward) model. Grouped by axis.",
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
      lines.push("_No gap cells for this axis (axis is either not offered or a no-op on every legal track)._");
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
  // Accidental-parity note: expressibility=false but status=parity (axis is a
  // no-op on that track). Locked so a later real divergence is caught.
  const accidental = cells.filter((c) => !c.expressible && c.status === "parity");
  lines.push("## Accidental-parity gap cells (axis is a no-op on this track)");
  lines.push("");
  if (accidental.length === 0) {
    lines.push("_None._");
  } else {
    for (const c of accidental) {
      lines.push(
        `- \`${c.track}\` / \`${c.combo}\` (\`${axisLabels[c.axis] ?? c.axis}\`) — TS order equals the engine's forward order, so this axis changes nothing for this track. Locked; a later divergence will fail the harness.`,
      );
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
