"""Run inside Blender: export a ceiling-cut, browser-sized copy of a scene."""

import argparse
import json
from pathlib import Path
import sys

import bmesh
import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--metadata", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--faces", type=int, default=350000)
    parser.add_argument("--selection", type=Path)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
    metadata = json.loads(args.metadata.read_text())
    source = Path(metadata["source_glb"])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(source))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    coords = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
    low = min(point.z for point in coords)
    high = max(point.z for point in coords)
    cut = low + (high - low) * 0.8
    before = sum(len(obj.data.polygons) for obj in meshes)
    for obj in meshes:
        inverse = obj.matrix_world.inverted()
        normal = obj.matrix_world.to_3x3().transposed() @ Vector((0, 0, 1))
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.bisect_plane(
            bm, geom=[*bm.verts, *bm.edges, *bm.faces],
            plane_co=inverse @ Vector((0, 0, cut)), plane_no=normal.normalized(),
            clear_outer=True, clear_inner=False,
        )
        bm.to_mesh(obj.data)
        bm.free()
    wall_cuts = {}
    if args.selection:
        selection = json.loads(args.selection.read_text())
        wall_cuts = selection["selected_preview_settings"]["wall_cuts"]
        target_name = "block_x2_y1_geometry_0"
        if not any(obj.name == target_name for obj in meshes):
            raise ValueError(f"Selected wall-cut object missing: {target_name}")
        for obj in meshes:
            planes = [
                ((0, wall_cuts["world_y_min"], 0), (0, 1, 0), False, True),
                ((0, wall_cuts["world_y_max"], 0), (0, 1, 0), True, False),
            ]
            if obj.name == target_name:
                planes.append(((wall_cuts[f"{target_name}_world_x_max"], 0, 0), (1, 0, 0), True, False))
            bm = bmesh.new()
            bm.from_mesh(obj.data)
            for point, normal, outer, inner in planes:
                bmesh.ops.bisect_plane(
                    bm, geom=[*bm.verts, *bm.edges, *bm.faces],
                    plane_co=obj.matrix_world.inverted() @ Vector(point),
                    plane_no=(obj.matrix_world.to_3x3().transposed() @ Vector(normal)).normalized(),
                    clear_outer=outer, clear_inner=inner,
                )
            bm.to_mesh(obj.data)
            bm.free()
    remaining = sum(len(obj.data.polygons) for obj in meshes)
    ratio = min(1, args.faces / max(1, remaining))
    for obj in meshes:
        if not obj.data.polygons:
            bpy.data.objects.remove(obj, do_unlink=True)
            continue
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        modifier = obj.modifiers.new("Web preview simplification", "DECIMATE")
        modifier.ratio = ratio
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        obj.select_set(False)
    for image in bpy.data.images:
        if image.size[0] and max(image.size) > 1024:
            factor = 1024 / max(image.size)
            image.scale(round(image.size[0] * factor), round(image.size[1] * factor))
            image.pack()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(args.output), export_format="GLB", export_yup=True,
        export_image_format="JPEG", export_jpeg_quality=86,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
        export_cameras=False, export_lights=False,
    )
    final_meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    result = {
        "source_glb": str(source), "source_metadata": str(args.metadata),
        "ceil_keep": 0.8, "cut_height_blender_z": cut,
        "faces_before": before,
        "faces_after": sum(len(obj.data.polygons) for obj in final_meshes),
        "texture_max_size": 1024,
        "wall_cuts": wall_cuts,
        "bytes": args.output.stat().st_size,
    }
    args.output.with_suffix(".json").write_text(json.dumps(result, indent=2))
    print("WEB_MESH_COMPLETE", json.dumps(result), flush=True)


if __name__ == "__main__":
    main()
