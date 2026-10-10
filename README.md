# WorldRecon Project Website

A desktop research project website based on the local WorldRecon manuscript.
Research images come from `../paper/Figures`, including original PNG images,
PDF figures, and original renders embedded in PPTX files. The supplementary
video comes from `../paper/supplementary/video_demo.mov`. Evaluation values
come from `../paper/WorldRecon_paper`.
Website authors and affiliations follow the user-provided list, in that order.
Authors are displayed in English: Mengchen Zhang, Yang Li, Chunshi Wang, Tong Wu,
Dahua Lin, and Chunchao Guo. Mengchen Zhang, Yang Li, Chunshi Wang, Tong Wu, and
Dahua Lin link to the supplied homepages. Chunchao Guo's anchor in `index.html`
has no `href` yet and stays inactive; add `href="..."` to fill in the homepage.
No envelope markers are displayed. Internal employment categories are not published, and no
equal-contribution designation has been inferred. The accompanying PDF remains unchanged.
Code and model releases are marked as pending, matching the manuscript.

## Layout

Centered full paper title, author names and numbered affiliations, resource buttons, an overview
containing the teaser figure, and single-column academic
sections: abstract, method, reconstruction results, qualitative comparisons,
quantitative results, and large-scale reconstruction.
Method Overview distinguishes the **Single-Block Generation** diagram from the
**World Generation Pipeline** video immediately below it. Image/camera conditions
are shared by all three block-generation stages; point-cloud tokens additionally
condition sparse structure. At world scale, sparse structure is completed across
the scene before geometry/material generation in the same causal block order.
Block-level and world-level explanations are integrated into their respective
captions, without a repeated explanation block below the video. A dedicated
`.video-panel` is centered at 94% of the diagram width and reserves a 4:3 frame.
The video fills that panel without affecting its dimensions. The heading and
caption remain outside the panel and use the full diagram width independently.
There is no separate video section or ablation section.

The requested style reference is https://kszpxxzmc.github.io/GenDoP/.
Direct access and attempts to read its public source timed out during this
revision, so this layout is a provisional academic-project-page interpretation,
not a verified reproduction of that site.

Layout and browser tests target desktop widths from 1024 to 1920 pixels.
No dedicated mobile layout or mobile navigation is maintained.

## Scene Results

The results section contains Input Views, a compact fixed-radius orbit video,
and a synchronized 2x2 Interior Views carousel (Geometry, Surface normals, Depth,
Relighting) cycling through four selected camera views per scene.
Scene tabs change all three groups together. Input/interior images can be enlarged.
The central player is at most 480px wide and supports fullscreen, seeking, and
pause. It loops silently and pauses when off-screen. Reduced-motion preferences
disable automatic playback. The website does not load GLB files or a 3D engine.

The scene sources are:

- Synthetic: `vis/cases/output/RoomBlock_n32/1d1d69da-23d2-45e6-a06f-1f5334e70bd5_seed250/metadata.json`.
- Real: `vis/cases/output/Scannet_iphone_n32/bde1e479ad_complete_seed50/metadata.json`.
- Generated video: `vis/cases/SeedDance2_1s_8s_orbit_z45_keep80_elev60_rgb_fit/metadata.json`.

`scripts/blender_orbit_hd.py` reads the original high-resolution GLB from each
metadata file and renders with Blender Cycles, using original geometry and
textures without decimation or texture resizing. Top 20% removal matches
`ceil_keep=0.8`. For the first scene it additionally applies the selected render's
wall cuts: world Y in [-5.48, 4.44] and world X <= 2.57 for
`block_x2_y1_geometry_0`. Original assets remain untouched.

`scripts/prepare_view_sequences.py` creates the current input and interior assets.
Each `inputs-32.gif` contains the exact 32 ordered reconstruction inputs, read from
the synthetic/generated `sampled_images.json` files or the real scene's
`aligned_poses.npz` image paths. Frames are 512x512, preserve the full input image
with padding, and advance every 160 ms (5.12 seconds per loop). A static WebP
poster is used when paused, off-screen, or reduced motion is requested.
`inputs-32.json` records all paths, source SHA-256 hashes, and GIF timing.
Generated-video display inputs crop both top and bottom watermark bands, using the square
`[56, 56, 664, 664]` for 720px source frames. Both the GIF and static poster use
this crop; reconstruction source images remain unchanged. Crop bounds are
recorded per frame in `display_crops`. Scene captions below the three columns
are omitted; scene tabs and component labels remain.

The interior carousel advances every 1.8 seconds and supports pause and previous/
next controls. All four images are decoded before being swapped together.
It stops while off-screen, hidden, or while an image dialog is open.
Each scene has 16 square component images under `interior/` and a provenance
manifest `interior.json`, with one shared crop per camera across all modalities.

Selected view IDs: synthetic 7/25/56/70; real 22/44/adjusted-0/6; generated
0/20/15/48. Real 512x384 renders use the paper's left square crop
`[0,0,384,384]`, except adjusted-0, which uses the centered square shifted 30px
left: `[34,0,418,384]`. The adjusted camera's missing geometry and relighting
passes were rendered in Blender from `adjusted_view_0000/aligned.glb` with its
saved camera pose and intrinsics. Those supplemental raw images are retained in
`render-work/interior-real-adjusted/`. Original renders remain unchanged.

`scripts/prepare_scene_images.py` and the earlier `images.json` manifests retain
the prior four-image selection history. Current webpage assets use the sequence
manifests described above.

`scripts/build_hd_orbits.py` runs the Blender render and FFmpeg encoding pipeline.
It outputs 2048 x 2048, 24 fps, 8-second H.264 videos (192 frames) with faststart.
The camera uses 60-degree elevation and FOV, starts at azimuth 0, and keeps the
same radius for the full orbit. Radius is the maximum distance needed to fit
the post-cut bounds over 4096 sampled directions, with a 3% safety margin.
Every output frame is also checked analytically for in-frame bounds.

Intermediate full-resolution RGBA PNGs and logs live in `render-work/<scene>/`.
Final files are `assets/scenes/<scene>/orbit-hd.mp4`, `orbit-hd-poster.webp`,
and `orbit-hd.json` (source geometry, renderer, settings, cuts, fixed camera).
The old Three.js preview modules and render script are retained as development
history; they are not used to generate or display the Blender HD videos.

## Local Development

Requires Node.js 22 and npm.

```bash
cd website
npm ci
npm run dev -- --port 4173
```

## Production

```bash
npm run build
npm run preview -- --port 4173
```

Deploy the contents of `dist/` to any static web host. The build uses relative
asset paths and supports deployment under a subdirectory. No API keys or backend
services are required. The site displays paper results; it does not run model
inference.

## Content

- `index.html`: page content, paper links, figures, and section structure.
- `src/main.js`: synchronized scene/observation gallery, comparison slider,
  manuscript benchmark values, accessible tabs, and figure lightbox.
- `src/styles.css`, `src/tokens.css`: desktop academic layout and visual styles.
- `assets/`: page-sized WebP previews and the paper PDF.
- `assets/highres/`: high-resolution WebP figures, original figure PDFs, and the
  original 7796 x 4488 teaser PNG. The figure dialog supports actual-size viewing,
  panning through scrollbars, and original-file downloads.
- `assets/image-manifest.json`: exact source files and dimensions for each image.
- `assets/video/`: fast-start MP4, a poster from the actual video, chapter markers,
  and a manifest recording the original source and encoding.
- `scripts/prepare_assets.py`: reproducibly extracts original PPTX images and
  renders PDF figures from `paper/Figures`, then creates previews and HD versions.
  Requires PyMuPDF and Pillow, plus DejaVu Sans for the small raster favicon.
- `scripts/inspect_media.py`: optional PPTX contact sheets and source-image audit.
- `scripts/prepare_video.py`: keyframe-aligned teaser removal, MP4 remux, and poster extraction.
  Pass `--ffmpeg /path/to/ffmpeg` if FFmpeg is not on the PATH.

## Video

The original 45.63-second demo is 1440 x 1080 at 30 fps, with H.264 video and AAC
audio. The website uses a separate `worldrecon-method.mp4` starting at source
frame 91 (3.033333 seconds), removing the opening teaser and retaining the
"Our Pipeline" introduction and method demonstration (about 42.6 seconds).
The original MOV is unchanged. The remaining streams are copied without
recompression into MP4, with the index moved to the beginning for progressive
playback. Chapter timestamps are relative to the trimmed video.
The player preserves the 4:3 aspect
ratio, does not autoplay, and uses metadata preloading. It provides native
playback, volume, seeking, fullscreen, a download link, and chapter buttons.

For deployment, the static host should serve `.mp4` as `video/mp4` and support
HTTP byte-range requests (`206 Partial Content`) for efficient seeking. The
included Vite preview supports this. If videos become numerous, upload them to
object storage/CDN and update the `<source>` and download paths.

All assets are local. No external video platform or login is required.

The abstract is transcribed from the paper; reported improvements are relative.
The benchmark shows the original CD, F-score, normal consistency, completeness,
and depth RMSE values for all six methods. Remaining metrics are in the PDF.

## Browser Verification

Run a local server first, then:

```bash
npx playwright install chromium
npm test
```

Set `SITE_URL` to test a different server and `CHROMIUM_PATH` to use a custom
Chromium executable. Screenshots and reports are written to `test-results/`.
Tests cover 1024, 1280, 1440, and 1920-pixel desktop viewports, asset loading,
PDF access, synchronized scene images, benchmark tabs, keyboard controls,
comparison images, HD figure dimensions/zoom, text overflow, nonblank teaser
imagery, actual video playback, seeking, decoded frame pixels, and byte ranges.
