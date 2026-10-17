import { test, expect, type Page } from '@playwright/test';

/**
 * Unified Workshop Path & Architecture picker:
 * - Single 4-column layout with Build Forward / Reverse ETL at the top
 * - Genie Accelerator sits at the top of the right-hand Accelerators column with New + Recommended badges
 * - Selecting Genie Code as the coding assistant defaults the track to Genie Accelerator
 * - All other coding assistants default to Complete Workshop (end-to-end)
 */

async function openPathSection(page: Page) {
  await page.goto('/');
  const section = page.locator('#path-architecture-section');
  await section.getByRole('button', { name: /Workshop Path & Architecture/ }).click();
  await expect(section.getByTestId('other-paths')).toBeVisible();
  return section;
}

test.describe('Unified Workshop Path selector', () => {
  test('selecting Genie Accelerator in the Accelerators column swaps the left columns to the Genie stage strip', async ({ page }) => {
    const section = await openPathSection(page);
    const genieCard = section.getByTestId('genie-recommended-card');

    // Unified view shows Build Forward / Reverse ETL and the 4-column grid with Genie Accelerator in Column 4
    await expect(section.getByRole('button', { name: /Reverse ETL/ })).toBeVisible();
    await expect(genieCard).toBeVisible();
    await expect(section.getByTestId('genie-recommended-badge')).toContainText('Recommended');

    // Click Genie Accelerator in the Accelerators column
    await genieCard.locator('button[aria-pressed]').click();
    await expect(genieCard).toHaveAttribute('data-selected', 'true');
    await expect(section.getByText('Your Genie Accelerator Path')).toBeVisible();

    // Click See other tracks to return to the persona columns
    await section.getByTestId('see-other-tracks-btn').click();
    await expect(genieCard).toHaveAttribute('data-selected', 'false');
    await expect(section.getByText('For Application Developers')).toBeVisible();
  });

  test('Reverse ETL hides the Accelerators column until Build Forward is clicked', async ({ page }) => {
    const section = await openPathSection(page);

    await section.getByRole('button', { name: /Reverse ETL/ }).click();
    await expect(section.getByTestId('genie-recommended-card')).toHaveCount(0);

    await section.getByRole('button', { name: /Build Forward/ }).first().click();
    await expect(section.getByTestId('genie-recommended-card')).toBeVisible();
  });
});
