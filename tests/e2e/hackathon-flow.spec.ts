import { test, expect, actingAs, docShot, newRecordingContext, PERSONAS } from './helpers';

/**
 * End-to-end UI tests for the Hackathon flow, driven through the dev persona
 * switcher. Each test opens persona-scoped browser contexts so the realistic
 * multi-actor journey (organizer / participant / judge / voter) is exercised in
 * the real UI. Screenshots are saved to public/hackathon-docs for the docs page.
 *
 * Note: the backend uses a shared in-memory store, so tests run serially
 * (workers: 1) and each creates its own uniquely-titled hackathon.
 */

function uniqueTitle(prefix: string) {
  return `${prefix} ${Date.now().toString().slice(-6)}`;
}

test.describe('Hackathon entry points & list', () => {
  test('front page shows the Hackathons entry card and navigates', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await actingAs(context, PERSONAS.organizer);
    await page.goto('/');
    // The entry card lives at the bottom of the workflow page.
    const entry = page.getByRole('link', { name: /Explore Hackathons/i });
    await entry.scrollIntoViewIfNeeded();
    await expect(entry).toBeVisible();
    await docShot(page, '01-front-page-entry');
    await entry.click();
    await expect(page).toHaveURL(/\/hackathons/);
    await context.close();
  });

  test('hackathons list renders hero + seeded demo card', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await actingAs(context, PERSONAS.organizer);
    await page.goto('/hackathons');
    await expect(page.getByRole('heading', { name: /Build\. Compete\. Win/i })).toBeVisible();
    await expect(page.getByText('V2V Build-Off 2026')).toBeVisible();
    await docShot(page, '02-hackathons-list');
    await context.close();
  });

  test('dev persona picker is visible in local mode', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await actingAs(context, PERSONAS.organizer);
    await page.goto('/hackathons');
    await expect(page.getByTestId('dev-persona-trigger')).toBeVisible();
    await page.getByTestId('dev-persona-trigger').click();
    await docShot(page, '03-persona-picker');
    await context.close();
  });
});

test.describe('Organizer flow', () => {
  test('organizer creates a hackathon and manages it', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await actingAs(context, PERSONAS.organizer);
    const title = uniqueTitle('PW Organizer Cup');

    await page.goto('/hackathons');
    await page.getByTestId('create-hackathon-btn').click();

    // Create form
    await expect(page.getByRole('heading', { name: 'Create a Hackathon' })).toBeVisible();
    await page.getByTestId('hk-title').fill(title);
    await docShot(page, '04-create-form');
    await page.getByTestId('hk-create-submit').click();

    // Lands on detail as organizer
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await expect(page.getByText('Organizer', { exact: true }).first()).toBeVisible();
    await docShot(page, '05-detail-overview');

    // Manage tab is visible to the organizer
    await expect(page.getByTestId('tab-manage')).toBeVisible();
    await page.getByTestId('tab-manage').click();
    await expect(page.getByRole('heading', { name: 'Lifecycle' })).toBeVisible();
    await docShot(page, '06-manage-tab');

    // Advance status
    await page.getByRole('button', { name: /Advance to/i }).click();
    await expect(page.getByText('Registration Open').first()).toBeVisible();

    await context.close();
  });

  test('organizer assigns and removes a judge via the selector', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await actingAs(context, PERSONAS.organizer);
    const title = uniqueTitle('PW Judge Cup');

    // Create
    await page.goto('/hackathons');
    await page.getByTestId('create-hackathon-btn').click();
    await page.getByTestId('hk-title').fill(title);
    await page.getByTestId('hk-create-submit').click();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();

    // Manage -> Judges: invite by email (judge not in the directory in local mode)
    await page.getByTestId('tab-manage').click();
    await page.getByTestId('judge-search').fill(PERSONAS.judge);
    // The "Invite <email>" row appears for a typed email; click it, then Assign.
    await page.getByTestId('judge-invite-row').click();
    await docShot(page, '07-judge-selector');
    await page.getByTestId('judge-assign-btn').click();

    // Judge chip appears under "Current judges" (shows display name 'Jordan Judge')
    await expect(page.getByText('Jordan Judge').first()).toBeVisible();
    await docShot(page, '08-judge-assigned');

    await context.close();
  });
});

test.describe('Participant flow', () => {
  test('participant creates a team and submits a project', async ({ browser }) => {
    // Organizer sets up a hackathon first.
    const orgCtx = await browser.newContext();
    const orgPage = await actingAs(orgCtx, PERSONAS.organizer);
    const title = uniqueTitle('PW Participant Cup');
    await orgPage.goto('/hackathons');
    await orgPage.getByTestId('create-hackathon-btn').click();
    await orgPage.getByTestId('hk-title').fill(title);
    await orgPage.getByTestId('hk-create-submit').click();
    await expect(orgPage.getByRole('heading', { name: title })).toBeVisible();
    const url = orgPage.url();
    await orgCtx.close();

    // Participant joins via the same hackathon URL.
    const partCtx = await browser.newContext();
    const page = await actingAs(partCtx, PERSONAS.participantLeader);
    await page.goto(url);
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    // No Manage tab for participants.
    await expect(page.getByTestId('tab-manage')).toHaveCount(0);

    // Teams tab -> create a team
    await page.getByTestId('tab-teams').click();
    await page.getByRole('button', { name: /Create a team/i }).click();
    await page.getByPlaceholder(/Team name|The Data Wranglers/i).first().fill('PW Rockets');
    await page.getByRole('button', { name: /Create team/i }).click();
    await expect(page.getByText('PW Rockets')).toBeVisible();
    await docShot(page, '09-team-created');

    // Submissions tab -> submit
    await page.getByTestId('tab-submissions').click();
    await page.getByRole('button', { name: /Submit for|Submit/i }).first().click();
    await page.getByPlaceholder(/ChurnSense|project title/i).first().fill('PW Rocket App');
    await page.getByRole('button', { name: /Submit project/i }).click();
    await expect(page.getByText('PW Rocket App')).toBeVisible();
    await docShot(page, '10-submission');

    await partCtx.close();
  });
});

test.describe('Full multi-persona journey', () => {
  test('organizer -> participant -> judge -> voter -> results', async ({ browser }) => {
    const title = uniqueTitle('PW Journey Cup');

    // 1. Organizer creates + assigns judge
    const orgCtx = await browser.newContext();
    const org = await actingAs(orgCtx, PERSONAS.organizer);
    await org.goto('/hackathons');
    await org.getByTestId('create-hackathon-btn').click();
    await org.getByTestId('hk-title').fill(title);
    await org.getByTestId('hk-create-submit').click();
    await expect(org.getByRole('heading', { name: title })).toBeVisible();
    const url = org.url();
    await org.getByTestId('tab-manage').click();
    await org.getByTestId('judge-search').fill(PERSONAS.judge);
    await org.getByTestId('judge-invite-row').click();
    await org.getByTestId('judge-assign-btn').click();
    // Wait for the judge chip (display name) to confirm assignment landed.
    await expect(org.getByText('Jordan Judge').first()).toBeVisible();
    await orgCtx.close();

    // 2. Participant submits
    const partCtx = await browser.newContext();
    const part = await actingAs(partCtx, PERSONAS.participantLeader);
    await part.goto(url);
    await part.getByTestId('tab-teams').click();
    await part.getByRole('button', { name: /Create a team/i }).click();
    await part.getByPlaceholder(/Team name|The Data Wranglers/i).first().fill('Journey Team');
    await part.getByRole('button', { name: /Create team/i }).click();
    await part.getByTestId('tab-submissions').click();
    await part.getByRole('button', { name: /Submit for|Submit/i }).first().click();
    await part.getByPlaceholder(/ChurnSense|project title/i).first().fill('Journey Project');
    await part.getByRole('button', { name: /Submit project/i }).click();
    await expect(part.getByText('Journey Project')).toBeVisible();
    await partCtx.close();

    // 3. Judge scores
    const judgeCtx = await browser.newContext();
    const judge = await actingAs(judgeCtx, PERSONAS.judge);
    await judge.goto(url);
    await expect(judge.getByText('Judge', { exact: true }).first()).toBeVisible();
    await judge.getByTestId('tab-judging').click();
    await docShot(judge, '11-judging');
    // Open the submission panel if collapsed, then submit a score.
    const scoreBtn = judge.getByRole('button', { name: /Submit score|Update score/i }).first();
    await scoreBtn.scrollIntoViewIfNeeded();
    await scoreBtn.click();
    await judgeCtx.close();

    // 4. Voter votes + sees results
    const voterCtx = await browser.newContext();
    const voter = await actingAs(voterCtx, PERSONAS.voter);
    await voter.goto(url);
    await voter.getByTestId('tab-submissions').click();
    // Click the heart/vote control on the submission card.
    await voter.getByRole('button', { name: /^\d+$/ }).first().click().catch(() => {});
    await voter.getByTestId('tab-results').click();
    // "Journey Project" appears twice on Results (winner banner + leaderboard row).
    await expect(voter.getByText('Journey Project').first()).toBeVisible();
    await docShot(voter, '12-results');
    await voterCtx.close();
  });
});

test.describe('Recorded walkthrough (for docs)', () => {
  test('organizer walkthrough video: create -> manage -> assign judge', async ({ browser }) => {
    // Single recording context => one clean video to embed in the docs page.
    const ctx = await newRecordingContext(browser);
    const page = await actingAs(ctx, PERSONAS.organizer);
    const title = uniqueTitle('Walkthrough Cup');

    await page.goto('/hackathons');
    await page.waitForTimeout(400);
    await page.getByTestId('create-hackathon-btn').click();
    await page.getByTestId('hk-title').fill(title);
    await page.waitForTimeout(300);
    await page.getByTestId('hk-create-submit').click();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await page.waitForTimeout(400);

    // Walk the tabs so the video shows the whole detail surface.
    for (const tab of ['teams', 'submissions', 'results', 'manage']) {
      await page.getByTestId(`tab-${tab}`).click();
      await page.waitForTimeout(500);
    }

    // Assign a judge on camera.
    await page.getByTestId('judge-search').fill(PERSONAS.judge);
    await page.waitForTimeout(300);
    await page.getByTestId('judge-invite-row').click();
    await page.getByTestId('judge-assign-btn').click();
    await expect(page.getByText('Jordan Judge').first()).toBeVisible();
    await page.waitForTimeout(600);

    // Capture the video handle, close the context (finalizes the .webm), THEN
    // save it under a stable name. saveAs() before close() deadlocks because it
    // waits for the recording to finish.
    const video = page.video();
    await ctx.close();
    if (video) {
      const { VIDEO_DIR } = await import('./helpers');
      const pathMod = await import('path');
      await video.saveAs(pathMod.join(VIDEO_DIR, 'organizer-walkthrough.webm'));
    }
  });
});
