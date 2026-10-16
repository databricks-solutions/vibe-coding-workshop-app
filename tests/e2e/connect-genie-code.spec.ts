import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import {
  GENERIC_TRACK_START_PROMPT,
  GENIE_CODE_MCP_CONNECTION_STEPS,
} from '../../src/constants/genieCodeMcpConnection';

/**
 * D4 §1.1 — SPA "Connect to Genie Code" self-serve on-ramp.
 * Step copy must stay aligned with D10 §2 (facilitator guide).
 */

test.describe('Connect to Genie Code on-ramp', () => {
  test('the panel shows only with Genie Code selected: MCP URL, copy, three steps, start line', async ({
    page,
  }) => {
    await page.goto('/');

    // Not shown for every assistant any more: it lives in the Genie Code detail panel.
    await expect(page.getByTestId('connect-to-genie-code')).toHaveCount(0);

    await page.getByRole('button', { name: /get started/i }).click();
    const assistants = page.locator('#coding-assistant-section');
    await assistants.getByRole('button', { name: /Genie Code/ }).first().click();

    const panel = page.getByTestId('connect-to-genie-code');
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('heading', { name: 'Connect to Genie Code' })).toBeVisible();

    const mcpUrl = panel.getByTestId('mcp-url');
    await expect(mcpUrl).toBeVisible();
    const urlText = (await mcpUrl.textContent())?.trim() ?? '';
    expect(urlText).toMatch(/^https?:\/\/.+\/mcp$/);

    await expect(panel.getByRole('button', { name: /copy/i }).first()).toBeVisible();

    for (const step of GENIE_CODE_MCP_CONNECTION_STEPS) {
      await expect(panel.getByText(step, { exact: true })).toBeVisible();
    }

    // Session linking: the line names the session's track and id, so Genie Code
    // continues this session.
    const startLine = panel.getByTestId('start-line');
    await expect(startLine).toContainText(`${GENERIC_TRACK_START_PROMPT}: `);
    await expect(startLine).toHaveText(/Start a workshop track: .+ \(session [0-9a-f-]{36}\)/);
    await expect(panel.getByText('Start the Genie Accelerator')).toHaveCount(0);
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
