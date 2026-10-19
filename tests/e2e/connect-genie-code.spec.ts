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
  test('Copy & Paste is the default; Interactive shows MCP URL, copy, four numbered steps, start line', async ({
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

    const copyPaste = panel.getByRole('radio', { name: /Copy & Paste Prompts Mode/ });
    const interactive = panel.getByRole('radio', { name: /Interactive Mode \(MCP Server\)/ });
    await expect(copyPaste).toHaveAttribute('aria-checked', 'true');
    await expect(panel.getByTestId('mcp-url')).toHaveCount(0);
    await expect(panel.getByTestId('interactive-mode-badge')).toContainText(/Recommended.*Beta/);

    await interactive.click();
    await expect(interactive).toHaveAttribute('aria-checked', 'true');

    const mcpUrl = panel.getByTestId('mcp-url');
    await expect(mcpUrl).toBeVisible();
    const urlText = (await mcpUrl.textContent())?.trim() ?? '';
    expect(urlText).toMatch(/^https?:\/\/.+\/mcp$/);

    await expect(panel.getByRole('button', { name: /copy/i }).first()).toBeVisible();

    for (const [index, step] of GENIE_CODE_MCP_CONNECTION_STEPS.entries()) {
      const item = panel.getByTestId(`mcp-step-${index + 1}`);
      await expect(item).toContainText(`Step ${index + 1}`);
      await expect(item.getByText(step.title, { exact: true })).toBeVisible();
      await expect(item.getByText(step.detail, { exact: true })).toBeVisible();
    }
    await expect(panel.getByTestId('mcp-step-1').getByTestId('mcp-url')).toBeVisible();
    await expect(panel.getByTestId('mcp-step-4').getByTestId('start-line')).toBeVisible();

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
      expect(normalizedSection).toContain(normalize(step.title));
      expect(normalizedSection).toContain(normalize(step.detail));
    }
  });
});
