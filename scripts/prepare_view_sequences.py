"""Build actual 32-view input GIFs and four synchronized interior-view sets."""

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[2]
PROJECT = ROOT.parent
OUT = ROOT / "website/assets/scenes"
SYNTHETIC = ROOT / "vis/cases/output/RoomBlock_n32/1d1d69da-23d2-45e6-a06f-1f5334e70bd5_seed250"
REAL = ROOT / "vis/cases/output/Scannet_iphone_n32/bde1e479ad_complete_seed50"
GENERATED = ROOT / "vis/cases/SeedDance2_1s_8s_indoor_30views"
ADJUSTED = REAL / "adjusted_view_0000"
ADJUSTED_NAME = "view_0000_down10_back120_yawright90_back200_back200_left200_rollcw20_right090_up040_forward050_pitchdown10"
MODALITIES = ("geometry", "normal", "depth", "relighting")


def rgb(image):
    image = ImageOps.exif_transpose(image)
    if image.mode == "RGBA":
        result = Image.new("RGB", image.size, "white")
        result.paste(image, mask=image.getchannel("A"))
        return result
    return image.convert("RGB")


def input_manifest(scene):
    if scene == "real":
        source = PROJECT / "Results/vis/bde1e479ad_complete_conds/aligned_poses.npz"
        # This local reconstruction artifact stores the ordered paths as objects.
        with np.load(source, allow_pickle=True) as poses:
            paths = [Path(str(path)) for path in poses["image_paths"]]
    else:
        source = PROJECT / (
            "vggt-omega/results_pc8192_n32/RoomBlock/1d1d69da-23d2-45e6-a06f-1f5334e70bd5/sampled_images.json"
            if scene == "synthetic" else "dataset/Cases/SeedDance2_1s_8s/sampled_images.json"
        )
        paths = [Path(path) for path in json.loads(source.read_text())["images"]]
    if len(paths) != 32 or len(set(paths)) != 32:
        raise ValueError(f"{scene}: expected exactly 32 unique input paths")
    return source, paths


def build_inputs(scene):
    output = OUT / scene
    output.mkdir(parents=True, exist_ok=True)
    source, paths = input_manifest(scene)
    frames, hashes, crops = [], [], []
    for path in paths:
        with Image.open(path) as original:
            image = rgb(original)
            crop = None
            if scene == "generated":
                # Watermarks alternate between the upper-left and lower-right.
                top = round(image.height * 56 / 720)
                side = min(image.width, image.height - 2 * top)
                left = (image.width - side) // 2
                crop = [left, top, left + side, top + side]
                image = image.crop(crop)
            frame = ImageOps.pad(image, (512, 512), method=Image.Resampling.LANCZOS, color="white")
            crops.append(crop)
        hashes.append(hashlib.sha256(path.read_bytes()).hexdigest())
        frames.append(frame)
    gif_path = output / "inputs-32.gif"
    frames[0].save(output / "inputs-poster.webp", quality=94)
    frames[0].save(
        gif_path, save_all=True, append_images=frames[1:],
        duration=160, loop=0, disposal=2, optimize=False,
    )
    with Image.open(gif_path) as result:
        if result.n_frames != 32:
            raise ValueError(f"{scene}: GIF encoder changed frame count")
        duration = 0
        for i in range(result.n_frames):
            result.seek(i)
            duration += result.info["duration"]
    manifest = {
        "source_manifest": str(source), "images": [str(path) for path in paths],
        "source_sha256": hashes, "count": 32, "size": [512, 512],
        "frame_duration_ms": 160, "loop_duration_ms": duration,
        "fit": ("Crop both upper and lower watermark bands to a centered square; no stretching."
                if scene == "generated" else "Preserve complete input frame with square padding; no stretching."),
        "display_crops": crops,
        "bytes": gif_path.stat().st_size,
    }
    (output / "inputs-32.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"{scene}: 32-frame GIF, {gif_path.stat().st_size:,} bytes", flush=True)


def source_paths(scene, view):
    root = {"synthetic": SYNTHETIC, "real": REAL, "generated": GENERATED}[scene]
    if scene == "real" and view == "adjusted":
        return {
            "geometry": ROOT / "website/render-work/interior-real-adjusted/geometry.png",
            "normal": ADJUSTED / f"{ADJUSTED_NAME}_normal.png",
            "depth": ADJUSTED / f"{ADJUSTED_NAME}_depth.png",
            "relighting": ROOT / "website/render-work/interior-real-adjusted/relighting.png",
        }
    return {
        "geometry": root / f"mesh/view_{view:04d}.png",
        "normal": root / f"rendering/view_{view:04d}_normal.png",
        "depth": root / f"rendering/view_{view:04d}_depth.png",
        "relighting": root / ("relighting_soft" if scene == "generated" else "relighting") / f"view_{view:04d}.png",
    }


def crop_for(scene, view, size):
    w, h = size
    if scene == "real":
        # Paper composites: left square, except the centered square shifted
        # 30px left for the manually adjusted camera (512x384 reference).
        x = round((34 / 512) * w) if view == "adjusted" else 0
        return (x, 0, x + h, h)
    if scene == "synthetic" and view == 25:
        return (0, round(h * 0.2), round(w * 0.8), h)
    if scene == "synthetic" and view == 56:
        return (round(w * 0.1), round(h * 0.1), round(w * 0.9), round(h * 0.9))
    if scene == "generated" and view == 48:
        return (round(w * 0.2), round(h * 0.1), w, round(h * 0.9))
    return (0, 0, w, h)


def build_interiors(scene):
    view_ids = {
        "synthetic": [7, 25, 56, 70],
        "real": [22, 44, "adjusted", 6],
        "generated": [0, 20, 15, 48],
    }[scene]
    output = OUT / scene / "interior"
    output.mkdir(parents=True, exist_ok=True)
    views = []
    for index, view in enumerate(view_ids):
        record = {"id": view, "components": {}}
        sizes = set()
        for modality, source in source_paths(scene, view).items():
            with Image.open(source) as original:
                image = rgb(original)
                sizes.add(image.size)
                crop = crop_for(scene, view, image.size)
                image = image.crop(crop)
                if image.width != image.height:
                    raise ValueError(f"{source}: non-square crop {crop}")
                image = image.resize((512, 512), Image.Resampling.LANCZOS)
                filename = f"{index}-{modality}.webp"
                image.save(output / filename, quality=94, method=6)
            record["components"][modality] = {
                "source": str(source.relative_to(ROOT)), "crop": crop,
                "file": f"scenes/{scene}/interior/{filename}",
                "size": [512, 512],
            }
        if len(sizes) != 1:
            raise ValueError(f"{scene}/{view}: mismatched component source sizes {sizes}")
        views.append(record)
    manifest = {"view_count": 4, "interval_ms": 1800, "views": views}
    (OUT / scene / "interior.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"{scene}: four views x four square components", flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--inputs-only", action="store_true")
    parser.add_argument("--interiors-only", action="store_true")
    parser.add_argument("--scene", choices=("synthetic", "real", "generated"))
    args = parser.parse_args()
    for scene in ([args.scene] if args.scene else ("synthetic", "real", "generated")):
        if not args.interiors_only:
            build_inputs(scene)
        if not args.inputs_only:
            build_interiors(scene)


if __name__ == "__main__":
    main()
