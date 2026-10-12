import { test, expect } from '@playwright/test';

test('all scenes have verified 32-input GIFs and four square component sets', async ({ page, request }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  for (const [name, id] of [['Synthetic scene', 'synthetic'], ['Real-world capture', 'real'], ['Generated video', 'generated']]) {
    const inputs = await (await request.get(`/scenes/${id}/inputs-32.json`)).json();
    expect(inputs.count).toBe(32);
    expect(new Set(inputs.images).size).toBe(32);
    expect(inputs.loop_duration_ms).toBe(5120);
    if (id === 'generated') {
      expect(inputs.display_crops).toHaveLength(32);
      for (const crop of inputs.display_crops) expect(crop).toEqual([56, 56, 664, 664]);
    }
    const gif = await request.get(`/scenes/${id}/inputs-32.gif`);
    expect(gif.headers()['content-type']).toContain('image/gif');
    expect((await gif.body()).subarray(0, 6).toString()).toBe('GIF89a');
    const interior = await (await request.get(`/scenes/${id}/interior.json`)).json();
    expect(interior.views).toHaveLength(4);
    await page.getByRole('tab', { name, exact: true }).click();
    const grid = page.locator('.interior-grid');
    await expect(grid).toHaveAttribute('data-scene', id);
    for (let i = 0; i < 4; i++) {
      await expect(grid).toHaveAttribute('data-view', String(i));
      for (const modality of ['geometry', 'normal', 'depth', 'relighting']) {
        const component = interior.views[i].components[modality];
        expect(component.size).toEqual([512, 512]);
        const [x1, y1, x2, y2] = component.crop;
        expect(x2 - x1).toBe(y2 - y1);
        const image = page.locator(`[data-interior="${modality}"] img`);
        await image.evaluate((el) => el.decode());
        expect(await image.evaluate((el) => [el.naturalWidth, el.naturalHeight])).toEqual([512, 512]);
        await expect(image).toHaveAttribute('src', new RegExp(`/${i}-${modality}\\.webp$`));
      }
      if (id === 'real') {
        const crops = Object.values(interior.views[i].components).map((component) => component.crop.join(','));
        expect(new Set(crops).size).toBe(1);
        expect(crops[0]).toBe(i === 2 ? '34,0,418,384' : '0,0,384,384');
      }
      await page.locator('#results').screenshot({ path: `test-results/sequence-${id}-${i}.png` });
      await page.locator('#interior-next').click();
    }
    await expect(grid).toHaveAttribute('data-view', '0');
  }
});

test('interior autoplay updates all four components together and can pause', async ({ page }) => {
  await page.goto('/');
  await page.locator('#results').scrollIntoViewIfNeeded();
  await expect(page.locator('#input-animation')).toHaveAttribute('src', /inputs-32\.gif$/);
  const grid = page.locator('.interior-grid');
  await expect(grid).toHaveAttribute('data-state', 'ready');
  const initial = await grid.getAttribute('data-view');
  await expect.poll(() => grid.getAttribute('data-view'), { timeout: 6000 }).not.toBe(initial);
  await page.locator('#interior-motion').click();
  const paused = await grid.getAttribute('data-view');
  await page.waitForTimeout(2100);
  await expect(grid).toHaveAttribute('data-view', paused);
  expect(await page.locator('[data-interior]').evaluateAll((items) => new Set(items.map((item) => item.dataset.view)).size)).toBe(1);
  await page.locator('#input-motion').click();
  await expect(page.locator('#input-animation')).toHaveAttribute('src', /inputs-poster\.webp$/);
  await page.getByRole('tab', { name: 'Real-world capture', exact: true }).click();
  await expect(grid).toHaveAttribute('data-scene', 'real');
  await expect(grid).toHaveAttribute('data-view', '0');
  await page.locator('[data-interior="geometry"]').click();
  await expect(page.locator('#dialog-image')).toHaveAttribute('src', /real\/interior\/0-geometry\.webp$/);
  await page.keyboard.press('Escape');
});

for (const width of [1024, 1280, 1440, 1920]) {
  test(`sequences remain square and aligned at desktop width ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.locator('#results').scrollIntoViewIfNeeded();
    await expect(page.locator('#scene-caption')).toHaveCount(0);
    await expect(page.locator('#results')).not.toContainText('Generated video · Indoor scene');
    await expect(page.locator('.interior-grid')).toHaveAttribute('data-state', 'ready');
    for (const image of await page.locator('#input-animation, [data-interior] img').all()) {
      await expect.poll(() => image.evaluate((element) => element.complete && element.naturalWidth > 0)).toBeTruthy();
      const bounds = await image.boundingBox();
      expect(Math.abs(bounds.width - bounds.height)).toBeLessThan(1);
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    }
    const centers = await page.locator('.reconstruction-layout > div').evaluateAll((elements) =>
      elements.map((element) => {
        const { y, height } = element.getBoundingClientRect();
        return y + height / 2;
      }));
    expect(Math.max(...centers) - Math.min(...centers)).toBeLessThan(1);
    const mesh = await page.locator('.orbit-panel').boundingBox();
    expect(mesh.width).toBeLessThanOrEqual(480);
    if (width >= 1280) expect(mesh.width).toBeGreaterThan(380);
    await page.locator('#results').screenshot({ path: `test-results/sequences-desktop-${width}.png` });
  });
}
