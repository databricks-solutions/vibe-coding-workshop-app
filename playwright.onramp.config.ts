import { defineConfig, devices } from '@playwright/test';

/**
 * On-ramp / SPA panel tests — serve the production build only.
 *
 * Guardrail: never start `npm run dev`. Build first (`npm run build`), then
 * this config serves `dist/` via `vite preview`.
 */

const PREVIEW = 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'connect-genie-code.spec.ts',
  fullyParallel: true,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: PREVIEW,
    viewport: { width: 1280, height: 860 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: {
    command: 'npx vite preview --host 127.0.0.1 --port 4173 --strictPort',
    url: PREVIEW,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
