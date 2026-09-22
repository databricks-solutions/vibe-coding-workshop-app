import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import {
  GENIE_ACCELERATOR_START_PROMPT,
  GENIE_CODE_MCP_CONNECTION_STEPS,
} from '../../src/constants/genieCodeMcpConnection';

/**
 * D4 §1.1 — SPA "Connect to Genie Code" self-serve on-ramp.
 * Step copy must stay aligned with D10 §2 (facilitator guide).
 */

test.describe('Connect to Genie Code on-ramp', () => {
  test('landing page panel shows MCP URL, copy control, three steps, and start prompt', async ({
    page,
  }) => {
    await page.goto('/');

    const panel = page.getByTestId('connect-to-genie-code');
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('heading', { name: 'Connect to Genie Code' })).toBeVisible();

    const mcpUrl = panel.getByTestId('mcp-url');
    await expect(mcpUrl).toBeVisible();
    const urlText = (await mcpUrl.textContent())?.trim() ?? '';
    expect(urlText).toMatch(/^https?:\/\/.+\/mcp$/);
    expect(urlText.endsWith('/mcp')).toBe(true);

    await expect(panel.getByRole('button', { name: /copy/i })).toBeVisible();

    for (const step of GENIE_CODE_MCP_CONNECTION_STEPS) {
      await expect(panel.getByText(step, { exact: true })).toBeVisible();
    }

    await expect(panel.getByText(GENIE_ACCELERATOR_START_PROMPT, { exact: false })).toBeVisible();
    await expect(panel.getByText(/then say/i)).toBeVisible();
  });

  test('connection step copy matches D10 §2 facilitator guide (no drift)', () => {
    const guidePath = path.join(
      process.cwd(),
      'docs/specs/mcp_design/mcp-workshop-facilitator-guide.md',
    );
    const guide = fs.readFileSync(guidePath, 'utf-8');
    const section2 = guide.split(/^## 2\./m)[1]?.split(/^## 3\./m)[0] ?? '';
    expect(section2.length).toBeGreaterThan(0);

    const normalize = (s: string) => s.replace(/\*\*/g, '').replace(/`/g, '');
    const normalizedSection = normalize(section2);
    for (const step of GENIE_CODE_MCP_CONNECTION_STEPS) {
      // D10 uses markdown emphasis + backticks; compare plain prose.
      expect(normalizedSection).toContain(normalize(step));
    }
  });
});
