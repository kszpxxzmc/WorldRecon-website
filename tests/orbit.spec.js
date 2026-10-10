import { test, expect } from '@playwright/test';

test('fixed-radius orbits cover all scenes and use the selected wall cuts', async ({ page, request }) => {
  test.setTimeout(120000);
  const requests = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/');
  await page.locator('#results').scrollIntoViewIfNeeded();
  const video = page.locator('#scene-orbit');
  for (const [label, id] of [['Synthetic scene', 'synthetic'], ['Real-world capture', 'real'], ['Generated video', 'generated']]) {
    const manifest = await (await request.get(`/scenes/${id}/orbit-hd.json`)).json();
    expect(manifest.renderer).toBe('Blender Cycles');
    expect(manifest.mesh_simplified).toBe(false);
    expect(manifest.textures_resized).toBe(false);
    expect(manifest.width).toBe(2048);
    expect(manifest.height).toBe(2048);
    expect(manifest.render_faces).toBeGreaterThan(1_000_000);
    expect(manifest.frame_radii).toHaveLength(192);
    expect(new Set(manifest.frame_radii).size).toBe(1);
    expect(manifest.frame_radii[0]).toBe(manifest.radius);
    expect(manifest.max_projected_extent).toBeLessThan(1);
    expect(manifest.elevation_degrees).toBe(60);
    expect(manifest.orbit_degrees).toBe(360);
    await page.getByRole('tab', { name: label, exact: true }).click();
    await expect(video).toHaveAttribute('src', new RegExp(`scenes/${id}/orbit-hd.mp4`));
    await expect.poll(() => video.evaluate((element) => element.readyState)).toBeGreaterThanOrEqual(2);
    await expect(video).toHaveJSProperty('muted', true);
    await expect(video).toHaveJSProperty('loop', true);
    await expect(video).toHaveJSProperty('videoWidth', 2048);
    await expect(video).toHaveJSProperty('videoHeight', 2048);
    const frames = [];
    for (const time of [0.1, 2, 4, 6]) {
      const result = await video.evaluate(async (element, time) => {
        element.pause();
        await new Promise((resolve) => {
          element.addEventListener('seeked', resolve, { once: true });
          element.currentTime = time;
        });
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 100;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(element, 0, 0, 100, 100);
        const data = ctx.getImageData(0, 0, 100, 100).data;
        let count = 0;
        for (let i = 0; i < data.length; i += 4) if (Math.min(data[i], data[i + 1], data[i + 2]) < 210) count++;
        return { count, image: canvas.toDataURL() };
      }, time);
      expect(result.count).toBeGreaterThan(500);
      frames.push(result.image);
    }
    expect(new Set(frames).size).toBe(4);
    await video.evaluate((element) => { element.currentTime = 0; });
    await page.waitForTimeout(200);
    await page.locator('#results').screenshot({ path: `test-results/orbit-${id}.png` });
  }
  const cut = await (await request.get('/scenes/synthetic/orbit-hd.json')).json();
  expect(cut.wall_cuts).toEqual({
    block_x2_y1_geometry_0_world_x_max: 2.57, world_y_min: -5.48, world_y_max: 4.44,
  });
  expect(requests.some((url) => url.endsWith('.glb') || url.includes('/src/mesh-viewer'))).toBeFalsy();
  await expect(page.locator('#room-walk, #results canvas')).toHaveCount(0);
});
