import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the Hackathon e2e suite.
 *
 * Starts BOTH servers automatically:
 *   - backend  (FastAPI) on :8000 with the dev persona gate open + dev origin allowed
 *   - frontend (Vite)    on :5174 (proxies /api -> :8000)
 *
 * Tests act as different personas via the `x-dev-persona` header (set per-project
 * / per-test), which the backend honors because USE_LAKEBASE=false opens the dev gate.
 *
 * Screenshots + video are recorded for every test so the docs page can embed them.
 */

const FRONTEND = 'http://localhost:5174';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // shared in-memory backend store — keep deterministic ordering
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'tests/e2e/report', open: 'never' }]],
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: FRONTEND,
    viewport: { width: 1280, height: 860 },
    screenshot: 'on',
    video: 'on',
    trace: 'retain-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  webServer: [
    {
      command:
        'USE_LAKEBASE=false DEV_PERSONA_SWITCH=true PORT=8000 ALLOWED_ORIGINS=http://localhost:5174 python3 app.py',
      url: 'http://localhost:8000/health',
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: 'npm run dev -- --port 5174',
      url: FRONTEND,
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});
