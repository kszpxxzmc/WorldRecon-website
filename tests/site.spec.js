import { test, expect } from '@playwright/test';

test('academic page loads without errors and all local assets exist', async ({ page, request }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('WorldRecon');
  await expect(page.locator('h1')).toContainText('Mesh Reconstruction for Large-Scale 3D World');
  await expect(page.locator('#benchmark-body tr')).toHaveCount(6);
  await expect(page.getByRole('button', { name: /Code and pretrained models/ })).toBeDisabled();
  await expect(page.locator('.mobile-menu-toggle')).toHaveCount(0);
  await expect(page.locator('h2')).toHaveText([
    'Abstract', 'Method Overview', 'Qualitative Comparison', 'Quantitative Results',
    'Large-Scale Scene Reconstruction', 'Comparison with Agentic Baseline',
    'Scene Reconstruction Results', 'Citation',
  ]);
  expect(await page.locator('#large-scale').evaluate((element) => element.nextElementSibling.id)).toBe('agent-comparison');
  expect(await page.locator('#results').evaluate((element) => element.nextElementSibling.id)).toBe('citation');
  await expect(page.locator('#citation').locator('h2')).toHaveText('Citation');
  await expect(page.locator('#citation-code')).toContainText('@misc{zhang2026worldrecon');
  await expect(page.getByRole('button', { name: 'Copy citation', exact: true })).toBeVisible();
  await expect(page.locator('#benchmark-panel thead tr').first().locator('th')).toHaveText([
    'Method', '3D Geometry', 'Coverage', 'Depth', 'Normal',
  ]);
  await expect(page.locator('#benchmark-panel thead tr').nth(1).locator('th')).toHaveCount(11);
  await expect(page.locator('#benchmark-body tr').first().locator('td')).toHaveCount(12);
  await expect(page.locator('#ablation, a[href="#ablation"]')).toHaveCount(0);
  await expect(page.locator('#overview video')).toHaveCount(0);
  await expect(page.locator('#method > .paper-figure + #video #demo-video')).toHaveCount(1);
  expect(await page.locator('#overview').evaluate((element) =>
    element.nextElementSibling.id,
  )).toBe('abstract');
  await page.locator('#citation').scrollIntoViewIfNeeded();
  await expect(page.locator('#agent-comparison img')).toHaveAttribute('src', /agent\.webp$/);
  await page.locator('#agent-comparison img').scrollIntoViewIfNeeded();
  await expect.poll(() => page.locator('#agent-comparison img').evaluate((image) =>
    image.complete && image.naturalWidth > 0,
  )).toBeTruthy();
  const images = await page.locator('img[src]').evaluateAll((elements) => elements.map((image) => image.src));
  for (const src of images) {
    const response = await request.get(src);
    expect(response.ok(), src).toBeTruthy();
    expect(response.headers()['content-type'], src).toMatch(/^image\//);
  }
  const paper = await request.head('/WorldRecon.pdf');
  expect(paper.ok()).toBeTruthy();
  expect(paper.headers()['content-type']).toContain('application/pdf');
  expect(Number(paper.headers()['content-length'])).toBeGreaterThan(40_000_000);
  expect(errors).toEqual([]);
});

test('method copy distinguishes single-block generation from the world pipeline', async ({ page }) => {
  await page.goto('/');
  const block = page.locator('#method > .paper-figure');
  const world = page.locator('#method > #video');
  await expect(block.getByRole('heading', { name: 'Reconstruction-Based Generation', exact: true })).toBeVisible();
  await expect(block.locator('figcaption')).toContainText('For each block');
  await expect(block.locator('figcaption')).toContainText('point-cloud encoder extracts geometric tokens');
  await expect(block.locator('figcaption')).toContainText('robust to noisy point clouds and inaccurate camera poses');
  await expect(world.getByRole('heading', { name: 'World Generation Pipeline', exact: true })).toBeVisible();
  await expect(world.locator('figcaption')).toContainText('completes sparse structure across overlapping blocks');
  await expect(world.locator('figcaption')).toContainText('then generates geometry and PBR materials in the same causal order');
  await expect(world.locator('figcaption')).toContainText('Neighbour-aware latent inpainting and overlap blending');
  await expect(page.locator('#method .method-explanation')).toHaveCount(0);
  await expect(page.locator('#method')).not.toContainText('Within each block.');
  await expect(page.locator('#method')).not.toContainText('Across the world.');
  await expect(page.locator('#demo-video')).toHaveAttribute('aria-label', /world generation pipeline/);
});

test('authors and affiliations follow the provided order without internal employment details', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.publication-authors .author')).toHaveText([
    'Mengchen Zhang1,2', 'Yang Li2', 'Chunshi Wang1,2', 'Tong Wu3', 'Dahua Lin4', 'Chunchao Guo2',
  ]);
  await expect(page.locator('.publication-affiliations > span')).toHaveText([
    '1 Zhejiang University', '2 Tencent', '3 Fudan University',
    '4 The Chinese University of Hong Kong',
  ]);
  await expect(page.locator('body')).not.toContainText('Anonymous Authors');
  await expect(page.locator('body')).not.toContainText('Anonymous manuscript');
  await expect(page.locator('body')).not.toContainText('公司内部');
  await expect(page.locator('body')).not.toContainText('实习生');
  await expect(page.locator('.publication-authors')).not.toContainText(/[\u3400-\u9fff]/);
});

test('author homepages preserve provided links and leave missing links inactive without envelopes', async ({ page }) => {
  await page.goto('/');
  const authors = page.locator('.publication-authors');
  await expect(authors.locator('a')).toHaveCount(6);
  await expect(authors.locator('a[href]')).toHaveCount(5);
  for (const [name, href] of [
    ['Mengchen Zhang', 'https://kszpxxzmc.github.io'],
    ['Yang Li', 'https://yang-l1.github.io/'],
    ['Chunshi Wang', 'https://chunshi.wang/'],
    ['Tong Wu', 'https://wutong16.github.io'],
    ['Dahua Lin', 'http://dahua.site/'],
  ]) {
    const link = authors.getByRole('link', { name, exact: true });
    await expect(link).toHaveAttribute('href', href);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  }
  await expect(authors.locator('.corresponding-author, svg')).toHaveCount(0);
  for (const name of ['Chunchao Guo']) {
    const placeholder = authors.locator('a:not([href])').filter({ hasText: name });
    await expect(placeholder).toHaveCount(1);
    await placeholder.click();
    await expect(page).toHaveURL(/\/$/);
  }
});

test('high-resolution figures use the new source directory and preserve source dimensions', async ({ page, request }) => {
  const response = await request.get('/image-manifest.json');
  expect(response.ok()).toBeTruthy();
  const manifest = await response.json();
  expect(manifest.teaser_refined.size).toEqual([7796, 4488]);
  expect(manifest['compare-dining-ours'].size).toEqual([2048, 2048]);
  expect(manifest['scene-large'].size[0]).toBeGreaterThan(3800);
  for (const item of Object.values(manifest)) {
    expect(item.source).toMatch(/^paper\/Figures\//);
    const asset = await request.head(`/${item.highres}`);
    expect(asset.ok()).toBeTruthy();
  }
  await page.goto('/');
  await page.getByRole('button', { name: 'Enlarge WorldRecon overview figure', exact: true }).click();
  await page.locator('#dialog-image').evaluate((image) => image.decode());
  expect(await page.locator('#dialog-image').evaluate((image) => image.naturalWidth)).toBe(7796);
  await page.getByRole('button', { name: 'View image at actual size', exact: true }).click();
  await expect(page.locator('#image-dialog')).toHaveClass('actual-size');
  const width = await page.locator('#dialog-image').evaluate((image) => image.getBoundingClientRect().width);
  expect(width).toBe(7796);
  await expect(page.locator('#download-figure')).toHaveAttribute('href', /highres\/teaser_refined\.png$/);
  await page.getByRole('button', { name: 'Fit image to window', exact: true }).click();
  await expect(page.locator('#image-dialog')).not.toHaveClass('actual-size');
  await page.keyboard.press('Escape');
});

test('supplementary video plays, seeks, pauses, and serves byte ranges', async ({ page, request }) => {
  const response = await request.get('/video/worldrecon-method.mp4', { headers: { Range: 'bytes=0-1023' } });
  expect(response.status()).toBe(206);
  expect(response.headers()['content-type']).toContain('video/mp4');
  expect((await response.body()).length).toBe(1024);
  await page.goto('/');
  const video = page.locator('#demo-video');
  await video.scrollIntoViewIfNeeded();
  await expect(video).toHaveJSProperty('controls', true);
  await expect(video).toHaveJSProperty('autoplay', false);
  await expect.poll(() => video.evaluate((element) => element.readyState)).toBeGreaterThanOrEqual(1);
  await expect(video).toHaveJSProperty('videoWidth', 1440);
  await expect(video).toHaveJSProperty('videoHeight', 1080);
  expect(await video.evaluate((element) => element.duration)).toBeCloseTo(42.60, 1);
  await page.getByRole('button', { name: '00:05 Point cloud', exact: true }).click();
  await expect(video).toHaveJSProperty('paused', false);
  await expect.poll(() => video.evaluate((element) => element.currentTime)).toBeGreaterThan(5.1);
  await page.getByRole('button', { name: '00:26 Textured meshes', exact: true }).click();
  await expect.poll(() => video.evaluate((element) => element.currentTime)).toBeGreaterThan(26);
  await video.evaluate((element) => element.pause());
  await expect(video).toHaveJSProperty('paused', true);
  await expect(page.locator('#video-error')).toBeHidden();
  const nonWhite = await video.evaluate((element) => {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 120;
    const context = canvas.getContext('2d');
    context.drawImage(element, 0, 0, 160, 120);
    const pixels = context.getImageData(0, 0, 160, 120).data;
    let count = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (Math.min(pixels[i], pixels[i + 1], pixels[i + 2]) < 210) count++;
    }
    return count;
  });
  expect(nonWhite).toBeGreaterThan(500);
  await page.locator('#video').screenshot({ path: 'test-results/video-playing.png' });
});

test('scene tabs and arrows switch the mesh and corresponding observations together', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Real-world capture', exact: true }).click();
  await expect(page.locator('#input-animation')).toHaveAttribute('src', /scenes\/real\/inputs-(32\.gif|poster\.webp)$/);
  await expect(page.locator('[data-interior="geometry"] img')).toHaveAttribute('src', /scenes\/real\/interior\/0-geometry\.webp$/);
  await expect(page.locator('#scene-orbit')).toHaveAttribute('poster', /scenes\/real\/orbit-hd-poster\.webp/);
  await page.getByRole('button', { name: 'Next scene', exact: true }).click();
  await expect(page.locator('#input-animation')).toHaveAttribute('src', /scenes\/generated\/inputs-(32\.gif|poster\.webp)\?v=watermark-crop-v2$/);
  await expect(page.locator('[data-interior="depth"] img')).toHaveAttribute('src', /scenes\/generated\/interior\/0-depth\.webp$/);
  await expect(page.getByRole('tab', { name: 'Generated video', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'Next scene', exact: true }).click();
  await expect(page.locator('#scene-orbit')).toHaveAttribute('poster', /scenes\/synthetic\/orbit-hd-poster\.webp/);
  await page.getByRole('button', { name: 'Previous scene', exact: true }).click();
  await expect(page.locator('#scene-panel')).toHaveAttribute('aria-labelledby', 'scene-tab-2');
  await page.getByRole('tab', { name: 'Generated video', exact: true }).press('Home');
  await expect(page.getByRole('tab', { name: 'Synthetic scene', exact: true })).toBeFocused();
  await expect(page.locator('#input-animation')).toHaveAttribute('src', /scenes\/synthetic\/inputs-(32\.gif|poster\.webp)$/);
});

test('dataset tabs display original manuscript values and support keyboard navigation', async ({ page }) => {
  await page.goto('/');
  const ours = page.locator('#benchmark-body tr.ours');
  await expect(ours).toContainText('0.1583');
  await expect(ours).toContainText('0.7271');
  await expect(ours.locator('td')).toHaveText([
    /WorldRecon/, '0.1583', '0.7271', '0.6839', '0.9589', '0.3910',
    '0.1126', '0.1966', '0.9582', '16.4044', '0.2951', '0.9601',
  ]);
  await page.getByRole('tab', { name: 'ScanNet++', exact: true }).click();
  await expect(ours).toContainText('0.0638');
  await expect(ours).toContainText('0.8363');
  await expect(ours.locator('td')).toHaveText([
    /WorldRecon/, '0.0638', '0.8363', '0.7840', '0.9918', '0.3331',
    '0.0992', '0.2139', '0.9522', '20.0429', '0.3631', '0.9320',
  ]);
  await expect(page.locator('#benchmark-caption')).toContainText('30 real-world');
  await page.getByRole('tab', { name: 'ScanNet++', exact: true }).press('ArrowLeft');
  await expect(page.getByRole('tab', { name: '3D-FRONT', exact: true })).toBeFocused();
  await expect(ours).toContainText('0.1583');
});

test('comparison scene, baseline, and slider remain synchronized', async ({ page }) => {
  test.setTimeout(120000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const scenes = ['dining', 'classroom', 'library', 'interior-4', 'interior-5'];
  const methods = ['vggt', 'murre', 'monosdf', 'finerecon', 'genrecon', 'ours'];
  const baselines = ['gt', ...methods];
  const tiles = page.locator('.method-comparison');
  await expect(page.locator('#baseline')).toHaveValue('ours');
  await expect(page.locator('#baseline option')).toHaveCount(7);
  await expect(tiles).toHaveCount(methods.length);
  for (const [index, method] of methods.entries()) {
    await expect(tiles.nth(index).locator('.method-comparison-title')).toHaveText(
      ['VGGT-Ω + TSDF', 'Murre', 'MonoSDF', 'FineRecon', 'GenRecon', 'WorldRecon'][index],
    );
  }
  for (const [sceneIndex, scene] of scenes.entries()) {
    if (sceneIndex > 0) await page.getByRole('button', { name: 'Next comparison scene' }).click();
    for (const base of baselines) {
      await page.locator('#baseline').selectOption(base);
      await expect(page.locator('#comparison-scene-position')).toHaveText(`${sceneIndex + 1} / 5`);
      for (const [index, method] of methods.entries()) {
        const tile = tiles.nth(index);
        await tile.scrollIntoViewIfNeeded();
        await expect(tile.locator('.comparison-after')).toHaveAttribute('src', new RegExp(`compare-${scene}-${method}\\.webp$`));
        await expect(tile.locator('.comparison-before img')).toHaveAttribute('src', new RegExp(`compare-${scene}-${base}\\.webp$`));
        await expect.poll(() => tile.locator('.comparison-after').evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
        await expect.poll(() => tile.locator('.comparison-before img').evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
      }
    }
  }
  const range = tiles.first().locator('.comparison-tile-range');
  await range.fill('73');
  for (const tile of await tiles.all()) {
    await expect(tile.locator('.image-comparison')).toHaveAttribute('style', /--split: 73%/);
    await expect(tile.locator('.comparison-tile-range')).toHaveValue('73');
  }
  await page.getByRole('button', { name: 'Next comparison scene' }).click();
  await expect(page.locator('#comparison-scene-position')).toHaveText('1 / 5');
});

test('figure lightbox opens, closes, and restores focus', async ({ page }) => {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Enlarge single-block generation diagram', exact: true });
  await trigger.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('#dialog-image')).toHaveAttribute('src', /highres\/pipeline\.webp$/);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.getByRole('button', { name: 'Close figure', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

for (const viewport of [
  { name: 'compact-desktop', width: 1024, height: 768 },
  { name: 'laptop', width: 1280, height: 800 },
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'wide-desktop', width: 1920, height: 1080 },
]) {
  test(`${viewport.name}: centered academic layout, nonblank figures, and screenshots`, async ({ page }) => {
    test.setTimeout(120000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await page.locator('.teaser-figure img').evaluate((image) => image.decode());
    const title = await page.locator('h1').boundingBox();
    const teaser = await page.locator('.teaser-figure').boundingBox();
    expect(Math.abs(title.x + title.width / 2 - viewport.width / 2)).toBeLessThan(1);
    expect(teaser.y).toBeLessThan(viewport.height - 200);
    await page.screenshot({ path: `test-results/${viewport.name}-top.png` });
    for (const section of ['overview', 'abstract', 'method', 'comparison', 'evaluation', 'large-scale', 'agent-comparison', 'results', 'citation']) {
      await page.locator(`#${section}`).scrollIntoViewIfNeeded();
      await expect.poll(() => page.locator(`#${section} img`).evaluateAll((images) =>
        images.every((image) => image.complete && image.naturalWidth > 0),
      )).toBeTruthy();
      if (section === 'results') {
        await expect.poll(() => page.locator('#scene-orbit').evaluate((video) => video.readyState)).toBeGreaterThanOrEqual(2);
      }
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBeFalsy();
    const methodBounds = await page.locator('#method').evaluate((method) => {
      const bounds = (selector) => {
        const { x, width, height } = method.querySelector(selector).getBoundingClientRect();
        return { x, width, height };
      };
      return {
        figure: bounds('.paper-figure'),
        diagram: bounds('.paper-figure img'),
        imageTitle: bounds('#block-generation-title'),
        videoFigure: bounds('#video'),
        videoPanel: bounds('.video-panel'),
        video: bounds('#demo-video'),
        videoTitle: bounds('#world-generation-title'),
        imageCaption: bounds('.paper-figure figcaption'),
        videoCaption: bounds('#video-caption'),
      };
    });
    for (const item of [
      methodBounds.diagram, methodBounds.imageTitle, methodBounds.imageCaption,
      methodBounds.videoFigure, methodBounds.videoTitle, methodBounds.videoCaption,
    ]) {
      expect(Math.abs(item.x - methodBounds.figure.x)).toBeLessThan(1);
      expect(Math.abs(item.width - methodBounds.figure.width)).toBeLessThan(1);
    }
    expect(methodBounds.video.width / methodBounds.figure.width).toBeCloseTo(0.94, 2);
    expect(Math.abs(
      methodBounds.video.x + methodBounds.video.width / 2
      - methodBounds.figure.x - methodBounds.figure.width / 2,
    )).toBeLessThan(1);
    expect(methodBounds.video.width / methodBounds.video.height).toBeCloseTo(4 / 3, 2);
    await expect(page.locator('#video > .video-panel > #demo-video')).toHaveCount(1);
    await expect(page.locator('#video > #world-generation-title')).toHaveCount(1);
    await expect(page.locator('#video > #video-caption')).toHaveCount(1);
    for (const dimension of ['x', 'width', 'height']) {
      expect(Math.abs(methodBounds.video[dimension] - methodBounds.videoPanel[dimension])).toBeLessThan(1);
    }
    await page.locator('.video-panel').evaluate((panel) => { panel.style.width = '80%'; });
    for (const selector of ['#world-generation-title', '#video-caption']) {
      const bounds = await page.locator(selector).boundingBox();
      expect(Math.abs(bounds.x - methodBounds.figure.x)).toBeLessThan(1);
      expect(Math.abs(bounds.width - methodBounds.figure.width)).toBeLessThan(1);
    }
    await page.locator('.video-panel').evaluate((panel) => { panel.style.removeProperty('width'); });
    const clippedText = await page.locator('h1, h2, h3, .author, .publication-affiliations > span, .publication-button, th, td').evaluateAll((elements) =>
      elements.filter((element) => {
        const bounds = element.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(element);
        const text = range.getBoundingClientRect();
        return text.left < bounds.left - 1 || text.right > bounds.right + 1;
      }).map((element) => element.textContent),
    );
    expect(clippedText).toEqual([]);
    const samples = await page.locator('.teaser-figure img').evaluate((image) => {
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0, 100, 100);
      const pixels = context.getImageData(0, 0, 100, 100).data;
      let nonWhite = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (Math.min(pixels[i], pixels[i + 1], pixels[i + 2]) < 220) nonWhite++;
      }
      return nonWhite;
    });
    expect(samples).toBeGreaterThan(3000);
    const brokenImages = await page.locator('img[src]').evaluateAll((images) =>
      images.filter((image) => image.complete && image.naturalWidth === 0).map((image) => image.src),
    );
    expect(brokenImages).toEqual([]);
    await page.evaluate(() => {
      document.activeElement?.blur();
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
    await page.screenshot({ path: `test-results/${viewport.name}-full.png`, fullPage: true });
    await page.locator('#method').screenshot({ path: `test-results/${viewport.name}-method.png` });
    await page.locator('#results').screenshot({ path: `test-results/${viewport.name}-results.png` });
  });
}
