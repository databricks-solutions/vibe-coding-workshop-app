import type { BlueprintChoice, BlueprintSource } from './types';

const REPO = 'databricks-industry-solutions/lakehouse-industry-data-models';
const REPO_URL = `https://github.com/${REPO}`;

/** Rebuilds the attribution links from what the brief stores, so they work after a reload. */
export function sourceFromChoice(c: BlueprintChoice): BlueprintSource {
  const sha = c.commitSha || 'main';
  const path = `data-models/${c.slug}/${c.version}/${c.flavour}`;
  return {
    repo: REPO,
    repoUrl: REPO_URL,
    commitSha: sha,
    shortSha: sha.slice(0, 7),
    commitUrl: `${REPO_URL}/commit/${sha}`,
    path,
    treeUrl: `${REPO_URL}/tree/${sha}/${path}`,
    licenseUrl: `${REPO_URL}/blob/${sha}/LICENSE.md`,
    noticeUrl: `${REPO_URL}/blob/${sha}/NOTICE.md`,
    noticeText: 'Copyright (2025) Databricks, Inc.',
    galleryUrl: `https://databricks-industry-solutions.github.io/lakehouse-industry-data-models/?industry=${c.slug}&version=${c.version}&flavour=${c.flavour}`,
    agentVersion: '',
    generatedAt: '',
    modelUrl: `${REPO_URL}/blob/${sha}/${path}/model.json`,
    readmeUrl: `${REPO_URL}/blob/${sha}/${path}/readme.md`,
    dictionaryUrl: `${REPO_URL}/blob/${sha}/${path}/docs/${c.slug}_model_${c.version}_${c.flavour}.csv`,
    installerUrl: `${REPO_URL}/blob/${sha}/model-installer/data-model-installer.ipynb`,
  };
}
