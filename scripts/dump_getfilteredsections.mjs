import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const sourcePath = join(repositoryRoot, "src/constants/workflowSections.ts");
const fixturesPath = join(repositoryRoot, "tests/workshop/fixtures");

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

const temporaryDirectory = await mkdtemp(join(tmpdir(), "workflow-sections-"));
const temporarySourcePath = join(temporaryDirectory, "workflowSections.ts");
await writeFile(temporarySourcePath, executableSource, "utf8");

try {
  const workflowSections = await import(pathToFileURL(temporarySourcePath).href);
  const defaultDisabled = new Set(
    workflowSections.getDisabledTagsForGenieOntology("genie-accelerator", false),
  );
  const ontologyEnabledDisabled = new Set(
    workflowSections.getDisabledTagsForGenieOntology("genie-accelerator", true),
  );
  const flatten = (disabledTags) =>
    workflowSections
      .getFilteredSections("genie-accelerator", disabledTags)
      .flatMap((section) => section.steps)
      .map((step) => step.sectionTag);

  await writeFile(
    join(fixturesPath, "golden_order_genie_default.json"),
    `${JSON.stringify(flatten(defaultDisabled), null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    join(fixturesPath, "golden_order_genie_ontology_on.json"),
    `${JSON.stringify(flatten(ontologyEnabledDisabled), null, 2)}\n`,
    "utf8",
  );

  // Independent per-track oracle for the shared define-usecase section: run the
  // real getFilteredSections for every level and record the section's sectionTag
  // order. Proves use_case_selection lands in genie-accelerator only (D11, 2B).
  const defineUsecaseByTrack = {};
  for (const trackId of Object.keys(workflowSections.WORKSHOP_LEVELS)) {
    const section = workflowSections
      .getFilteredSections(trackId, new Set())
      .find((entry) => entry.id === "define-usecase");
    defineUsecaseByTrack[trackId] = section
      ? section.steps.map((step) => step.sectionTag)
      : [];
  }
  await writeFile(
    join(fixturesPath, "golden_define_usecase_by_track.json"),
    `${JSON.stringify(defineUsecaseByTrack, null, 2)}\n`,
    "utf8",
  );
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
