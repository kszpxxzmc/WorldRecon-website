"""Render original scene assets in Cycles at a constant full-orbit radius."""

import argparse
import json
import math
from pathlib import Path
import sys

import bpy
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from infer_pipeline import blender_turntable_render as orbit


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--scene", choices=["synthetic", "real", "generated"], required=True)
    parser.add_argument("--samples", type=int, default=32)
    parser.add_argument("--start", type=int, default=0)
    parser.add_argument("--end", type=int, default=192)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
    paths = {
        "synthetic": "vis/cases/output/RoomBlock_n32/1d1d69da-23d2-45e6-a06f-1f5334e70bd5_seed250/metadata.json",
        "real": "vis/cases/output/Scannet_iphone_n32/bde1e479ad_complete_seed50/metadata.json",
        "generated": "vis/cases/SeedDance2_1s_8s_orbit_z45_keep80_elev60_rgb_fit/metadata.json",
    }
    metadata_path = ROOT / paths[args.scene]
    metadata = json.loads(metadata_path.read_text())
    source = metadata["source_glb"]
    output = ROOT / "website/render-work" / args.scene
    output.mkdir(parents=True, exist_ok=True)
    orbit.load_glb(source, glb_up="y")
    before = sum(len(o.data.polygons) for o in bpy.context.scene.objects if o.type == "MESH")
    wall_cuts = {}
    if args.scene == "synthetic":
        selection = json.loads((metadata_path.parent / "selection_record.json").read_text())
        wall_cuts = selection["selected_preview_settings"]["wall_cuts"]
        orbit._clip_objects_x_max(f"block_x2_y1_geometry_0:{wall_cuts['block_x2_y1_geometry_0_world_x_max']}")
        orbit._clip_scene_y_range(wall_cuts["world_y_min"], wall_cuts["world_y_max"])
    orbit._cutaway_ceiling(0.8, up_axis=2)
    orbit.setup_renderer(2048, samples=args.samples)
    scene = bpy.context.scene
    scene.render.film_transparent = True
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.compression = 15
    scene.render.use_persistent_data = True
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 4
    scene.cycles.diffuse_bounces = 2
    scene.cycles.glossy_bounces = 2
    scene.cycles.transmission_bounces = 2
    scene.cycles.transparent_max_bounces = 2
    orbit._setup_world_envmap(str(ROOT / "assets/hdri/forest.exr"), strength=1)
    focal = 1024 / math.tan(math.pi / 6)
    camera = orbit.setup_camera(fx=focal, fy=focal, cx=1024, cy=1024, resolution=2048)
    minimum, maximum = orbit._mesh_bounds()
    center, fitted = orbit._fit_orbit_radii(
        (minimum, maximum), 60, 60, 1.03, 4096,
    )
    radius = float(max(fitted))
    camera.data.clip_end = radius * 4 + 10
    corners = np.array([[x, y, z] for x in (minimum[0], maximum[0])
                        for y in (minimum[1], maximum[1]) for z in (minimum[2], maximum[2])])
    max_extent = 0.0
    for i in range(192):
        angle = 2 * math.pi * i / 192
        direction = np.array([0.5 * math.cos(angle), 0.5 * math.sin(angle), math.sqrt(3) / 2])
        right = np.cross(-direction, np.array([0, 0, 1]))
        right /= np.linalg.norm(right)
        up = np.cross(right, -direction)
        for corner in corners:
            offset = corner - center
            extent = max(abs(offset @ right), abs(offset @ up)) / ((radius - offset @ direction) * math.tan(math.pi / 6))
            max_extent = max(max_extent, float(extent))
    assert max_extent < 1, max_extent
    manifest = {
        "renderer": "Blender Cycles", "source_glb": source,
        "source_metadata": str(metadata_path.relative_to(ROOT)),
        "source_faces": before,
        "render_faces": sum(len(o.data.polygons) for o in bpy.context.scene.objects if o.type == "MESH"),
        "mesh_simplified": False, "textures_resized": False,
        "width": 2048, "height": 2048, "fps": 24, "frames": 192,
        "duration_seconds": 8, "samples": args.samples,
        "radius": radius, "frame_radii": [radius] * 192,
        "center": center.tolist(), "bounds": [minimum.tolist(), maximum.tolist()],
        "max_projected_extent": max_extent,
        "orbit_degrees": 360, "elevation_degrees": 60, "fov_degrees": 60,
        "azimuth_start_degrees": 0, "ceil_keep": 0.8, "wall_cuts": wall_cuts,
        "radius_policy": "Maximum full-orbit fit radius, constant across all frames.",
    }
    (output / f"orbit-{args.start:04d}.json").write_text(json.dumps(manifest, indent=2))
    print("HD_ORBIT_SETTINGS", json.dumps(manifest), flush=True)
    for i in range(args.start, args.end):
        target = output / f"frame_{i:04d}.png"
        if target.exists():
            continue
        angle = 2 * math.pi * i / 192
        eye = center + radius * np.array([0.5 * math.cos(angle), 0.5 * math.sin(angle), math.sqrt(3) / 2])
        orbit._set_camera_pose(camera, orbit._look_at_c2w(eye, center, up=[0, 0, 1]).tolist())
        scene.frame_set(i)
        scene.render.filepath = str(target)
        bpy.ops.render.render(write_still=True)
        print(f"HD_FRAME {args.scene} {i+1}/192", flush=True)


if __name__ == "__main__":
    main()
