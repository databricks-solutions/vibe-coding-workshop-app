import { test as base, expect, type Page, type BrowserContext, type Browser } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * Shared helpers for the Hackathon e2e suite.
 *
 * Identity: each browser context sets `x-dev-persona` so the backend resolves the
 * acting user (dev gate is open under USE_LAKEBASE=false). `actingAs()` opens a
 * fresh context bound to one persona — the realistic way to drive multi-persona
 * flows (organizer in one context, judge in another).
 */

export const PERSONAS = {
  organizer: 'alex.organizer@databricks.com',
  participantLeader: 'sam.participant@databricks.com',
  participantMember: 'riley.participant@databricks.com',
  judge: 'jordan.judge@databricks.com',
  voter: 'casey.voter@databricks.com',
};

/** Directory where docs screenshots are saved (consumed by the in-app docs page). */
export const SHOTS_DIR = path.join(process.cwd(), 'public', 'hackathon-docs');
/** Directory where flow videos are saved for the docs page. */
export const VIDEO_DIR = path.join(SHOTS_DIR, 'video');

export function ensureShotsDir() {
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
  fs.mkdirSync(VIDEO_DIR, { recursive: true });
}

/**
 * Persist the video recorded for `page`'s context into the docs video dir under
 * a stable name. Call right before closing the context.
 */
export async function saveFlowVideo(page: Page, name: string) {
  const video = page.video();
  if (!video) return;
  ensureShotsDir();
  try {
    await video.saveAs(path.join(VIDEO_DIR, `${name}.webm`));
  } catch {
    /* video may not be ready if the context errored; ignore */
  }
}

/**
 * Save a screenshot under public/hackathon-docs/<name>.png for the docs.
 *
 * Captures the VIEWPORT (not fullPage) so the images don't carry the large
 * empty vertical space that the app's `flex-1 overflow-auto` scroll containers
 * produce in full-page captures. Pass `clipMain` to tightly crop to the main
 * content column when a modal/panel is the subject.
 */
export async function docShot(page: Page, name: string) {
  ensureShotsDir();
  await page.screenshot({ path: path.join(SHOTS_DIR, `${name}.png`), fullPage: false });
}

/** A browser context that records video into the docs video dir. */
export async function newRecordingContext(browser: Browser): Promise<BrowserContext> {
  ensureShotsDir();
  return browser.newContext({
    recordVideo: { dir: VIDEO_DIR, size: { width: 1280, height: 800 } },
    viewport: { width: 1280, height: 800 },
  });
}

/**
 * Open a new browser context that acts as `email` for ALL its API calls, plus
 * primes localStorage so the in-app persona picker reflects it. Returns the page.
 */
export async function actingAs(
  context: BrowserContext,
  email: string,
): Promise<Page> {
  await context.setExtraHTTPHeaders({ 'x-dev-persona': email });
  // Reuse an existing page if the context already opened one with video recording
  // (contexts created via newContextWithVideo), else open a fresh page.
  const page = context.pages()[0] ?? (await context.newPage());
  // Prime localStorage before any app code runs.
  await page.addInitScript((e) => {
    try {
      localStorage.setItem('v2v.devPersona', e as string);
    } catch {
      /* ignore */
    }
  }, email);
  return page;
}

export { base as test, expect };
