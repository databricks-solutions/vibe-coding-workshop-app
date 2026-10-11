import { test, expect } from '@playwright/test';

/**
 * Agent Skills Navigator (/skills). Frontend-only: the page reads static data,
 * so these tests need no backend state.
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
});

test('switches between the four views and keeps the view in the URL', async ({ page }) => {
  await page.goto('/skills');
  const tabs = page.getByRole('tablist', { name: 'Navigator views' });
  await expect(page.getByText('Pick how you want to start')).toBeVisible();

  await tabs.getByRole('tab', { name: 'Tours' }).click();
  await expect(page).toHaveURL(/view=tours/);
  await expect(page.getByRole('heading', { name: 'Choose a tour' })).toBeVisible();

  await tabs.getByRole('tab', { name: 'Skills' }).click();
  await expect(page).toHaveURL(/view=skills/);
  await expect(page.getByRole('textbox', { name: 'Filter skills' })).toBeVisible();

  await tabs.getByRole('tab', { name: 'Learn' }).click();
  await expect(page).toHaveURL(/view=learn/);
  await expect(page.getByText(/lessons completed/)).toBeVisible();

  await tabs.getByRole('tab', { name: 'Map' }).click();
  await expect(page).not.toHaveURL(/view=/);
});

test('deep link opens the skill drawer, and Escape closes it', async ({ page }) => {
  await page.goto('/skills?skill=gold-00');
  const drawer = page.getByRole('dialog', { name: 'Gold Layer Design' });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole('button', { name: /Copy prompt/ })).toBeVisible();

  await drawer.getByRole('button', { name: /^Steps/ }).click();
  await expect(drawer.getByText(/Stage 1/).first()).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page).not.toHaveURL(/skill=/);
});

test('search palette finds a skill and opens it from the keyboard', async ({ page }) => {
  await page.goto('/skills');
  await page.getByRole('button', { name: 'Search skills, tours, and lessons' }).click();
  const palette = page.getByRole('dialog', { name: 'Search' });
  await palette.getByRole('combobox').or(palette.getByRole('textbox')).first().fill('gold layer');
  await expect(palette.getByRole('option').first()).toContainText('Gold Layer Design');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Gold Layer Design' })).toBeVisible();
});

test('filters the skill library and recovers from an empty result', async ({ page }) => {
  await page.goto('/skills?view=skills');
  const filter = page.getByRole('textbox', { name: 'Filter skills' });
  await filter.fill('zzzz-no-such-skill');
  await page.getByRole('button', { name: 'Clear filters' }).last().click();
  await expect(filter).toHaveValue('');
  await expect(page.getByText('108 skills')).toBeVisible();
});

test('steps through a tour with buttons, progress segments, and arrow keys', async ({ page }) => {
  await page.goto('/skills?view=tours');
  await page.getByRole('button', { name: /Data to Genie Agent/ }).click();
  await expect(page.getByText('Step 1 of 13')).toBeVisible();

  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('Step 2 of 13')).toBeVisible();
  await expect(page).toHaveURL(/step=2/);

  await page.getByRole('button', { name: 'Go to step 5' }).click();
  await expect(page.getByText('Step 5 of 13')).toBeVisible();

  await page.keyboard.press('ArrowLeft');
  await expect(page.getByText('Step 4 of 13')).toBeVisible();

  await page.getByRole('button', { name: 'All tours' }).click();
  await expect(page.getByRole('heading', { name: 'Choose a tour' })).toBeVisible();
});

test('completes a lesson quiz', async ({ page }) => {
  await page.goto('/skills?view=learn&module=lakebase');
  await expect(page.getByRole('heading', { name: 'Lakebase', exact: true })).toBeVisible();
  const quiz = page.getByRole('region', { name: 'Quiz' });
  await quiz.scrollIntoViewIfNeeded();

  for (let i = 0; i < 10; i++) {
    if (await quiz.getByText(/correct$/).isVisible()) break;
    await quiz.locator('button:not([disabled])').first().click();
    await quiz.getByRole('button', { name: /Next question|See result/ }).click();
  }
  await expect(quiz.getByText(/of \d+ correct/)).toBeVisible();
});

test('mobile: tour panes toggle between explanation and tree', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/skills?view=tours&tour=a&step=3');
  await expect(page.getByText('Step 3 of 20')).toBeVisible();
  const panes = page.getByRole('tablist', { name: 'Tour panes' });
  await panes.getByRole('tab', { name: 'Skill tree' }).click();
  await expect(page.locator('.ttree')).toBeVisible();
  await panes.getByRole('tab', { name: 'Explanation' }).click();
  await expect(page.locator('.ttree')).toBeHidden();
});
