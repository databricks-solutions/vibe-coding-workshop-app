import { test, expect, type Page } from '@playwright/test';

/**
 * Track picker tabs (Mock B): [★ Genie Accelerator · Recommended] [Other tracks].
 * Served from the production build with no backend, so the session falls back to
 * a local one on the default track (the Genie Accelerator).
 */

async function openPathSection(page: Page) {
  await page.goto('/');
  const section = page.locator('#path-architecture-section');
  await section.getByRole('button', { name: /Workshop Path & Architecture/ }).click();
  await expect(section.getByTestId('track-tab-genie')).toBeVisible();
  return section;
}

test.describe('Track picker tabs', () => {
  test('in and out of the Genie Accelerator in one click each way', async ({ page }) => {
    const section = await openPathSection(page);
    const genieTab = section.getByTestId('track-tab-genie');
    const otherTab = section.getByTestId('track-tab-other');

    // Default: the Genie tab, its card selected, no direction toggle.
    await expect(genieTab).toHaveAttribute('aria-selected', 'true');
    await expect(section.getByTestId('genie-recommended-card')).toHaveAttribute('data-selected', 'true');
    await expect(section.getByRole('button', { name: /Reverse ETL/ })).toHaveCount(0);

    // Other tracks only changes the view, and says Genie is still the track.
    await otherTab.click();
    await expect(otherTab).toHaveAttribute('aria-selected', 'true');
    await expect(section.getByTestId('current-track-note')).toContainText('Genie Accelerator');
    await expect(section.getByTestId('other-paths')).toBeVisible();
    await expect(section.getByTestId('genie-recommended-card')).toHaveCount(0);
    await expect(section.getByRole('button', { name: /Reverse ETL/ })).toBeVisible();

    // Picking a track there switches it; the tab stays on Other tracks.
    await section.getByTestId('other-paths').getByRole('button', { name: /^Lakehouse$/ }).first().click();
    await expect(section.getByTestId('current-track-note')).toHaveCount(0);
    await expect(otherTab).toHaveAttribute('aria-selected', 'true');

    // One click back.
    await genieTab.click();
    await expect(genieTab).toHaveAttribute('aria-selected', 'true');
    await expect(section.getByTestId('genie-recommended-card')).toHaveAttribute('data-selected', 'true');
  });

  test('Reverse ETL disables the Genie tab until Build Forward', async ({ page }) => {
    const section = await openPathSection(page);
    const genieTab = section.getByTestId('track-tab-genie');

    await section.getByTestId('track-tab-other').click();
    await section.getByRole('button', { name: /Reverse ETL/ }).click();
    await expect(genieTab).toHaveAttribute('aria-disabled', 'true');
    await genieTab.click({ force: true });
    await expect(section.getByTestId('track-tab-other')).toHaveAttribute('aria-selected', 'true');

    await section.getByRole('button', { name: /Build Forward/ }).first().click();
    await expect(genieTab).toHaveAttribute('aria-disabled', 'false');
  });
});
