// Loads a src/ React module (TSX, extensionless imports) into a node:test
// process via Vite's in-process module runner: no dev server, no port.
import { fileURLToPath } from 'node:url';
import { runnerImport } from 'vite';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

export async function loadComponentModule<T>(srcPath: string): Promise<T> {
  const { module } = await runnerImport<T>(`${ROOT}${srcPath}`, {
    configFile: false,
    root: ROOT,
    logLevel: 'silent',
    esbuild: { jsx: 'automatic' },
  });
  return module;
}
