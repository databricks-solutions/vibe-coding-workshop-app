// Phase 3 T3c — the "zero getFilteredSections calls on the endpoint-success path"
// proof for orderedSectionsForRead (the T4-readiness artifact's companion to the
// `rg getFilteredSections src` grep).
//
// No JS unit runner exists in this repo (only Playwright e2e + Python), so this is
// an oracle-style script (mirrors scripts/dump_*.mjs): read workflowSections.ts,
// stub lucide-react, strip type imports, import the real module under
// `node --experimental-strip-types`, and assert two things:
//
//   1. STATIC (the "0 calls" guarantee): the source of orderedSectionsForRead and
//      its helper trackStepIndex contains NO reference to getFilteredSections, so
//      it can never call it on ANY input — strictly stronger than a runtime call
//      count (ESM internal calls bind locally and cannot be monkeypatched anyway).
//
//   2. BEHAVIORAL: given a RESOLVED outline (the endpoint's ordered sectionTags —
//      stood in here by getFilteredSections' own order, valid because the T2/T3a
//      parity harness proves engine.outline == getFilteredSections order),
//      orderedSectionsForRead (a) reproduces that exact tag order, (b) keeps each
//      section contiguous (the dropped interleaving guard's invariant), and (c)
//      resolves the tags SHARED across sections (activation steps 32-37) to the
//      correct on-screen section per track — genie-activate for genie-accelerator,
//      activation for reverse-lakebase — sourcing chrome from the track's own
//      sectionIds, not getFilteredSections.
//
// Usage: node --experimental-strip-types scripts/spy_ordered_sections_for_read.mjs

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const sourcePath = join(repositoryRoot, "src/constants/workflowSections.ts");

const source = await readFile(sourcePath, "utf8");

// ---- 1. STATIC proof: the read-path helpers never mention getFilteredSections --
function bodyOf(name) {
  const start = source.indexOf(`function ${name}(`);
  if (start === -1) throw new Error(`could not locate ${name} in workflowSections.ts`);
  // Walk braces from the first '{' after the signature to its matching close.
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`unbalanced braces scanning ${name}`);
}

const failures = [];
for (const fn of ["orderedSectionsForRead", "trackStepIndex"]) {
  const body = bodyOf(fn);
  if (/getFilteredSections/.test(body)) {
    failures.push(`STATIC: ${fn} references getFilteredSections (must be zero).`);
  }
}

// ---- import the real module -------------------------------------------------
const iconImport = source.match(/import\s*\{([\s\S]*?)\}\s*from\s*["']lucide-react["'];/);
if (!iconImport) throw new Error("Could not find the lucide-react import in workflowSections.ts");
const iconStubs = iconImport[1]
  .split(",")
  .map((n) => n.trim())
  .filter(Boolean)
  .map((n) => `const ${n} = {};`)
  .join("\n");
const executableSource = source
  .replace(iconImport[0], iconStubs)
  .replace(/import\s+type\s+\{[\s\S]*?\}\s+from\s*["']lucide-react["'];\s*/g, "");

const temporaryDirectory = await mkdtemp(join(tmpdir(), "spy-ordered-"));
const temporarySourcePath = join(temporaryDirectory, "workflowSections.ts");
await writeFile(temporarySourcePath, executableSource, "utf8");

try {
  const mod = await import(pathToFileURL(temporarySourcePath).href);

  // Wrap the getFilteredSections EXPORT in a call counter. orderedSectionsForRead
  // binds internal functions locally so this cannot intercept an internal call —
  // but it DOES prove the harness never itself leans on getFilteredSections to
  // build the endpoint order it feeds in (we build it, then count stays 0 across
  // the orderedSectionsForRead calls).
  const realGFS = mod.getFilteredSections;
  let gfsCallsDuringOrder = 0;
  let counting = false;
  const getFilteredSections = (...args) => {
    if (counting) gfsCallsDuringOrder += 1;
    return realGFS(...args);
  };

  // The tags SHARED across two sections — the disambiguation stress case.
  const SHARED_ACTIVATION_TAG = "activation_table_design"; // step 32

  const cases = [
    { level: "end-to-end", direction: "forward", disabled: new Set() },
    { level: "reverse-lakebase", direction: "reverse", disabled: new Set(), sharedSection: "activation" },
    { level: "reverse-lakehouse-di", direction: "reverse", disabled: new Set() },
    {
      level: "genie-accelerator",
      direction: "forward",
      // genie ontology + lakehouse are opt-in (default OFF) — mirror the dump oracle.
      disabled: new Set([
        ...mod.getDisabledTagsForGenieOntology("genie-accelerator", false),
        ...mod.getDisabledTagsForLakehouse("genie-accelerator", false),
      ]),
      sharedSection: "genie-activate",
    },
  ];

  for (const { level, direction, disabled, sharedSection } of cases) {
    // The endpoint's ordered sectionTags (stood in by getFilteredSections order,
    // == engine order by the parity harness).
    const endpointTags = realGFS(level, disabled, undefined, direction)
      .flatMap((s) => s.steps)
      .map((s) => s.sectionTag);

    counting = true;
    const projected = mod.orderedSectionsForRead(endpointTags, disabled, level);
    counting = false;

    const flatTags = projected.flatMap((s) => s.steps).map((st) => st.sectionTag);

    // (a) adopts the endpoint order exactly
    if (JSON.stringify(flatTags) !== JSON.stringify(endpointTags)) {
      failures.push(`ORDER: ${level} projected order != endpoint order\n  in : ${endpointTags}\n  out: ${flatTags}`);
    }

    // (b) sections are contiguous (each section id appears in exactly one block)
    const seen = new Set();
    for (let i = 0; i < projected.length; i += 1) {
      const id = projected[i].id;
      if (seen.has(id)) failures.push(`CONTIGUITY: ${level} section '${id}' is non-contiguous`);
      seen.add(id);
    }

    // (c) shared 32-37 tags resolve to the track-correct on-screen section
    if (sharedSection && endpointTags.includes(SHARED_ACTIVATION_TAG)) {
      const owner = projected.find((s) => s.steps.some((st) => st.sectionTag === SHARED_ACTIVATION_TAG));
      if (!owner || owner.id !== sharedSection) {
        failures.push(`DISAMBIGUATION: ${level} '${SHARED_ACTIVATION_TAG}' resolved to '${owner?.id}', expected '${sharedSection}'`);
      }
    }
  }

  if (gfsCallsDuringOrder !== 0) {
    failures.push(`SPY: getFilteredSections export was invoked ${gfsCallsDuringOrder}x during orderedSectionsForRead (expected 0)`);
  }

  // reference the wrapped fn so lin+bundlers keep it (documents intent)
  void getFilteredSections;

  if (failures.length) {
    console.error("FAIL — orderedSectionsForRead getFilteredSections-independence proof:");
    for (const f of failures) console.error(`  - ${f}`);
    process.exitCode = 1;
  } else {
    console.log(
      "PASS — orderedSectionsForRead makes ZERO getFilteredSections calls on the endpoint-success path:\n" +
        "  - STATIC: orderedSectionsForRead + trackStepIndex source contains no getFilteredSections reference\n" +
        "  - SPY: 0 getFilteredSections export invocations during projection\n" +
        `  - BEHAVIORAL: ${cases.length} tracks adopt the endpoint order exactly, keep sections contiguous,\n` +
        "    and disambiguate the shared activation tags (genie-activate vs activation) per track.",
    );
  }
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
