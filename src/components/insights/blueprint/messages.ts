import { sourceFromChoice } from './links';
import { matchQuestion } from './match';
import type { BlueprintChoice, BlueprintDigest } from './types';

const SAMPLE_ROWS = '100';

function provenance(c: BlueprintChoice): string {
  const src = sourceFromChoice(c);
  return [
    `Source: ${src.repo} (${src.path}, commit ${src.shortSha})`,
    `  ${src.treeUrl}`,
    `  Tables, foreign keys, sensitive-field tags and metric views come from that model; the rows are synthetic sample data. ${src.noticeText}`,
  ].join('\n');
}

/** What Genie Code needs to start the rest of the journey on the installed model. */
export function composeHandoff(c: BlueprintChoice, digest: BlueprintDigest | null, questions: string[], projectPath: string): string {
  const areaLabel = new Map(digest?.areas.map(a => [a.name, a.label]) ?? []);
  const kpis = digest ? c.kpis.map(id => digest.kpis.find(k => k.id === id)).filter(Boolean) : [];
  const recipes = digest ? questions.map(q => matchQuestion(q, digest)) : [];

  const lines = [
    `This project starts from the ${c.label} industry data model, installed in Unity Catalog as \`${c.catalog}\`.`,
    provenance(c),
    '',
    'Focus areas (one schema each):',
    ...c.areas.map(a => `- \`${c.catalog}.${a}\`${areaLabel.get(a) ? ` (${areaLabel.get(a)})` : ''}`),
  ];

  if (kpis.length) {
    lines.push('', 'Ready-made metric views to reuse (query them with MEASURE()):');
    for (const k of kpis) {
      const measures = k!.measures.slice(0, 4).map(m => m.name).join(', ');
      lines.push(`- \`${c.catalog}._metrics.${k!.id}\` on \`${c.catalog}.${k!.table}\`: ${measures}`);
    }
  }

  if (recipes.length) {
    lines.push('', 'How my questions map to the model (first guess, please confirm):');
    for (const r of recipes) {
      lines.push(r.kpi && r.measure
        ? `- "${r.question}" -> MEASURE(\`${r.measure.name}\`)${r.slice ? ` by \`${r.slice.name}\`` : ''} from \`${c.catalog}._metrics.${r.kpi.id}\`${r.confidence === 'strong' ? '' : ' (close match)'}`
        : `- "${r.question}" -> not covered by the model yet`);
    }
  }

  lines.push(
    '',
    'Please, without creating or changing anything:',
    `1. Confirm \`${c.catalog}\` exists and list the tables in the focus schemas with row counts, plus the metric views in \`${c.catalog}._metrics\` (one information_schema query each).`,
    '2. For each of my questions, name the table or metric view that answers it and flag any gaps.',
    `3. Save a one-page data map (tables, the foreign keys that join them, metric views to reuse) to ${projectPath}/docs/data_map.md, with the Source lines above at the top.`,
    '',
    `Rules: \`${c.catalog}\` is shared with the whole workspace, so never alter, drop or write to it. Anything new goes in my own schema. When you describe this data in the brief or the Genie space, cite the Source above.`,
  );
  return lines.join('\n');
}

/** Fallback when the app cannot install: Genie Code runs the same installer with the user's own permissions. */
export function composeGenieInstall(c: BlueprintChoice, projectPath: string): string {
  const src = sourceFromChoice(c);
  const raw = `https://raw.githubusercontent.com/${src.repo}/${src.commitSha}/model-installer/data-model-installer.ipynb`;
  const nbPath = `${projectPath}/idm/data-model-installer`;
  const submit = {
    run_name: `idm_install_${c.slug}_${c.flavour}`,
    timeout_seconds: 7200,
    tasks: [{
      task_key: 'install',
      notebook_task: {
        notebook_path: nbPath,
        base_parameters: {
          operation: 'Install', model: c.slug, model_size: c.flavour, catalog_name: c.catalog,
          cataloging_style: 'One Catalog', catalog_prefix: '', catalog_suffix: '', local_install: '',
          generate_samples: 'Yes', sample_rows: SAMPLE_ROWS, sample_threads: '24', source_ref: src.commitSha,
          session_id: String(Date.now()),
        },
      },
    }],
  };
  return [
    `Install the ${c.label} industry data model into the Unity Catalog catalog \`${c.catalog}\` using its official installer, then share read access.`,
    provenance(c),
    '',
    'Use runDatabricksCli for CLI calls and keep files under my project folder, never /tmp.',
    `0. If \`${c.catalog}\` already exists and has tables, stop and tell me: it is already installed. Never drop or overwrite an existing catalog.`,
    `1. Download the installer pinned to commit ${src.shortSha}: ${raw}`,
    `   Save it as ${projectPath}/idm/data-model-installer.ipynb`,
    `2. databricks workspace import ${nbPath} --file ${projectPath}/idm/data-model-installer.ipynb --format JUPYTER --overwrite`,
    `3. databricks jobs submit --no-wait --json '${JSON.stringify(submit)}'`,
    '4. Poll databricks jobs get-run <run_id> every 60 seconds and give me a one-line update each time. It usually takes 15 to 25 minutes.',
    `5. When it succeeds: databricks grants update catalog ${c.catalog} --json '{"changes":[{"principal":"account users","add":["USE_CATALOG","USE_SCHEMA","SELECT","READ_VOLUME"]}]}'`,
    `6. Set the catalog comment to: "Installed from ${src.repo} (${src.path} @ ${src.shortSha}). Sample values are synthetic."`,
    `7. Verify with one query: table count per schema in ${c.catalog}.information_schema.tables, and the metric views in ${c.catalog}._metrics. Report the numbers.`,
    'If any step fails, stop and show me the error. Do not retry with different settings without asking.',
  ].join('\n');
}
