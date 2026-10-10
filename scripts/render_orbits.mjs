import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
const baseURL = process.env.SITE_URL || 'http://127.0.0.1:4173';
const fps = 24;
const frames = 192;
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

try {
  for (const id of ['synthetic', 'real', 'generated']) {
    const output = path.join(root, 'assets/scenes', id);
    await mkdir(output, { recursive: true });
    const page = await browser.newPage({ viewport: { width: 720, height: 720 }, deviceScaleFactor: 1 });
    await page.goto(`${baseURL}/src/mesh-viewer.js`);
    const cameraMetadata = await page.evaluate(async ({ id, frames }) => {
      document.body.replaceChildren();
      document.body.style.cssText = 'margin:0;width:720px;height:720px;overflow:hidden';
      const host = document.createElement('div');
      host.style.cssText = 'width:720px;height:720px';
      document.body.append(host);
      const { MeshViewer } = await import('/src/mesh-viewer.js');
      const viewer = new MeshViewer(host);
      await viewer.load(`/scenes/${id}/${id === 'synthetic' ? 'orbit-source.glb' : 'scene.glb'}`, id, { navigation: false });
      if (host.dataset.state !== 'ready') throw new Error(`Failed to load ${id}`);
      viewer.renderer.setAnimationLoop(null);
      viewer.controls.enabled = false;
      viewer.controls.enableDamping = false;
      viewer.resizeObserver.disconnect();
      viewer.visibilityObserver.disconnect();
      viewer.camera.fov = 60;
      viewer.camera.updateProjectionMatrix();
      // Use the maximum required distance over a densely sampled full orbit.
      // The small fixed margin also covers angles between sampled frames.
      const margin = 1.03;
      let radius = 0;
      for (let step = 0; step < 4096; step++) {
        const angle = Math.PI * 2 * step / 4096;
        const direction = viewer.camera.position.clone().set(
          0.5 * Math.cos(angle), Math.sqrt(3) / 2, -0.5 * Math.sin(angle));
        const right = direction.clone().set(0, 1, 0).cross(direction).normalize();
        const up = direction.clone().cross(right);
        for (const x of [viewer.bounds.min.x, viewer.bounds.max.x]) {
          for (const y of [viewer.bounds.min.y, viewer.bounds.max.y]) {
            for (const z of [viewer.bounds.min.z, viewer.bounds.max.z]) {
              const point = direction.clone().set(x, y, z);
              radius = Math.max(radius, point.dot(direction)
                + Math.max(Math.abs(point.dot(right)), Math.abs(point.dot(up))) / Math.tan(Math.PI / 6));
            }
          }
        }
      }
      window.orbitRadius = radius * margin;
      window.orbitViewer = viewer;
      let maxProjectedExtent = 0;
      for (let frame = 0; frame < frames; frame++) {
        const angle = Math.PI * 2 * frame / frames;
        viewer.camera.position.set(
          window.orbitRadius * 0.5 * Math.cos(angle),
          window.orbitRadius * Math.sqrt(3) / 2,
          -window.orbitRadius * 0.5 * Math.sin(angle));
        viewer.camera.lookAt(0, 0, 0);
        viewer.camera.updateMatrixWorld();
        for (const x of [viewer.bounds.min.x, viewer.bounds.max.x]) {
          for (const y of [viewer.bounds.min.y, viewer.bounds.max.y]) {
            for (const z of [viewer.bounds.min.z, viewer.bounds.max.z]) {
              const p = viewer.camera.position.clone().set(x, y, z).project(viewer.camera);
              maxProjectedExtent = Math.max(maxProjectedExtent, Math.abs(p.x), Math.abs(p.y));
            }
          }
        }
      }
      if (maxProjectedExtent >= 1) throw new Error('Orbit framing clips the scene');
      return { radius: window.orbitRadius, fit_margin: margin, center: [0, 0, 0],
        max_projected_extent: maxProjectedExtent, frame_radii: Array(frames).fill(window.orbitRadius) };
    }, { id, frames });
    const encoder = spawn(ffmpeg, [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'image2pipe', '-framerate', String(fps), '-vcodec', 'png', '-i', 'pipe:0',
      '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(output, 'orbit.mp4'),
    ], { stdio: ['pipe', 'inherit', 'inherit'] });
    const completion = once(encoder, 'close');
    try {
      for (let frame = 0; frame < frames; frame++) {
        const data = await page.evaluate(({ frame, frames }) => {
          const viewer = window.orbitViewer;
          const angle = Math.PI * 2 * frame / frames;
          const elevation = Math.PI / 3;
          // Blender (X,Y,Z) -> glTF (X,Z,-Y), matching the original orbit path.
          const direction = viewer.camera.position.clone().set(
            Math.cos(elevation) * Math.cos(angle), Math.sin(elevation),
            -Math.cos(elevation) * Math.sin(angle));
          viewer.camera.position.copy(direction.multiplyScalar(window.orbitRadius));
          viewer.camera.lookAt(0, 0, 0);
          viewer.renderer.render(viewer.scene, viewer.camera);
          return viewer.renderer.domElement.toDataURL('image/png').split(',')[1];
        }, { frame, frames });
        const buffer = Buffer.from(data, 'base64');
        if (frame === 0) await writeFile(path.join(output, 'orbit-poster.png'), buffer);
        if (!encoder.stdin.write(buffer)) await once(encoder.stdin, 'drain');
        if (frame % 48 === 0) console.log(`${id}: ${frame}/${frames} frames`);
      }
      encoder.stdin.end();
      const [code] = await completion;
      if (code !== 0) throw new Error(`FFmpeg exited with ${code}`);
    } catch (error) {
      encoder.kill('SIGTERM');
      throw error;
    }
    await writeFile(path.join(output, 'orbit.json'), JSON.stringify({
      source: `scenes/${id}/${id === 'synthetic' ? 'orbit-source.glb' : 'scene.glb'}`,
      ceil_keep: 0.8, width: 720, height: 720, fps,
      frames, duration_seconds: frames / fps,
      orbit_degrees: 360, elevation_degrees: 60, fov_degrees: 60,
      azimuth_start_degrees: 0, ...cameraMetadata,
      radius_policy: 'Fixed maximum full-orbit fit distance; no per-frame zoom.',
      camera_reference: id === 'generated'
        ? 'vis/cases/SeedDance2_1s_8s_orbit_z45_keep80_elev60_rgb_fit/metadata.json'
        : `vis/cases/output/${id === 'synthetic' ? 'RoomBlock_n32' : 'Scannet_iphone_n32'}; elev_60`,
      loop: 'Uniform angular steps, without a duplicate endpoint frame.',
    }, null, 2));
    await page.close();
    console.log(`${id}: complete`);
  }
} finally {
  await browser.close();
}
