import { test, expect } from '@playwright/test';

test('citation copies the complete BibTeX and resets its success state', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const button = page.getByRole('button', { name: 'Copy citation', exact: true });
  const expected = (await page.locator('#citation-code').textContent()).trim();
  await button.click();
  await expect(page.locator('#citation-status')).toHaveText('Copied');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(expected);
  await expect(button.locator('.copy-success')).toBeVisible();
  await expect(page.locator('#citation-status')).toBeEmpty({ timeout: 5000 });
  await expect(button.locator('.copy-default')).toBeVisible();
});

test('citation falls back to selection copying when clipboard access is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    document.execCommand = (command) => {
      window.copiedCitation = document.activeElement.value;
      return command === 'copy';
    };
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const button = page.getByRole('button', { name: 'Copy citation', exact: true });
  const expected = (await page.locator('#citation-code').textContent()).trim();
  await button.click();
  await expect(page.locator('#citation-status')).toHaveText('Copied');
  expect(await page.evaluate(() => window.copiedCitation)).toBe(expected);
  await expect(button).toBeFocused();
  await expect(page.locator('.clipboard-fallback')).toHaveCount(0);
});

test('citation reports copy failure and remains retryable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error('Permission denied')) },
    });
    document.execCommand = () => false;
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const button = page.getByRole('button', { name: 'Copy citation', exact: true });
  await button.click();
  await expect(page.locator('#citation-status')).toHaveText('Copy failed');
  await expect(button).toBeEnabled();
  await expect(button.locator('.copy-success')).not.toBeVisible();
  await expect(page.locator('.clipboard-fallback')).toHaveCount(0);
});

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`citation fits at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const block = page.locator('.citation-block');
    await block.scrollIntoViewIfNeeded();
    await expect(page.locator('#copy-citation svg').first()).toBeVisible();
    const bounds = await block.evaluate((element) => {
      const block = element.getBoundingClientRect();
      const copy = element.querySelector('#copy-citation').getBoundingClientRect();
      const pre = element.querySelector('pre');
      return { left: block.left, right: block.right, buttonRight: copy.right,
        buttonBottom: copy.bottom, codeTop: pre.getBoundingClientRect().top,
        overflowing: pre.scrollWidth > pre.clientWidth };
    });
    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(viewport.width);
    expect(bounds.buttonRight).toBeLessThan(bounds.right);
    expect(bounds.buttonBottom).toBeLessThanOrEqual(bounds.codeTop);
    expect(bounds.overflowing).toBeFalsy();
    await block.screenshot({ path: `test-results/citation-${viewport.width}.png` });
  });
}
