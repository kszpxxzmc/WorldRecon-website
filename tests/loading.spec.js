import { test, expect } from '@playwright/test';
import { writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';

test('styles and hero render without waiting for application JavaScript', async ({ page }) => {
  await page.route('**/src/main.js*', (route) => route.abort());
  await page.goto('/');
  await expect(page.locator('head link[rel="stylesheet"]')).toHaveCount(1);
  await expect(page.locator('h1')).toHaveCSS('text-align', 'center');
  await expect.poll(() => page.locator('.teaser-figure img').evaluate((img) =>
    img.complete && img.naturalWidth > 0,
  )).toBeTruthy();
  await page.screenshot({ path: 'test-results/loading-without-js.png' });
});

test('new public assets are discovered without restarting the dev server', async ({ request }) => {
  const name = `loading-probe-${Date.now()}.txt`;
  const filename = path.resolve('assets', name);
  try {
    await writeFile(filename, 'public asset watcher check');
    await expect.poll(async () => {
      const response = await request.get(`/${name}`);
      return response.headers()['content-type']?.startsWith('text/plain')
        && (await response.text()) === 'public asset watcher check';
    }, { timeout: 15000 }).toBeTruthy();
  } finally {
    await unlink(filename);
  }
});

test('below-fold animated media and interior frames are deferred', async ({ page }) => {
  const urls = [];
  page.on('request', (request) => urls.push(request.url()));
  await page.goto('/');
  await expect(page.locator('#benchmark-body tr')).toHaveCount(6);
  await page.waitForTimeout(500);
  expect(urls.some((url) => url.includes('inputs-32.gif') || url.includes('orbit-hd.mp4'))).toBeFalsy();
  expect(urls.some((url) => url.includes('/interior/'))).toBeFalsy();
  await page.locator('#results').scrollIntoViewIfNeeded();
  await expect(page.locator('.interior-grid')).toHaveAttribute('data-state', 'ready');
  await expect(page.locator('#scene-orbit')).toHaveAttribute('src', /orbit-hd\.mp4$/);
});
