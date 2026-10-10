"""Export the selected inputs and four interior modalities for each scene."""

from io import BytesIO
import json
from pathlib import Path
import zipfile

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "website/assets/scenes"
SYNTHETIC = ROOT / "vis/cases/output/RoomBlock_n32/1d1d69da-23d2-45e6-a06f-1f5334e70bd5_seed250"
REAL = ROOT / "vis/cases/output/Scannet_iphone_n32/bde1e479ad_complete_seed50"
GENERATED = ROOT / "vis/cases/SeedDance2_1s_8s_indoor_30views"


def save(image, target):
    if image.mode == "RGBA":
        background = Image.new("RGB", image.size, "white")
        background.paste(image, mask=image.getchannel("A"))
        image = background
    else:
        image = image.convert("RGB")
    image.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
    image.save(target, quality=94, method=6)


def main():
    depth = next((REAL / "adjusted_view_0000").glob(
        "view_0000_down10_back120_yawright90_back200_back200_left200_rollcw20_right090_up040_forward050_pitchdown10_depth.png"
    ))
    config = {
        "synthetic": {
            "input_images": [9, 11, 13, 15],
            "interior": {
                "geometry": SYNTHETIC / "mesh/view_0007.png",
                "normal": SYNTHETIC / "rendering/view_0025_normal.png",
                "depth": SYNTHETIC / "highres_1024_view0056/rendering/view_0056_depth.png",
                "relighting": SYNTHETIC / "relighting/view_0070.png",
            },
        },
        "real": {
            "input_images": [17, 18, 19, 20],
            "interior": {
                "geometry": REAL / "mesh/view_0022.png",
                "normal": REAL / "rendering/view_0044_normal.png",
                "depth": depth,
                "relighting": REAL / "relighting/view_0006.png",
            },
        },
        "generated": {
            "input_images": [27, 28, 29, 30],
            "interior": {
                "geometry": GENERATED / "mesh/view_0000.png",
                "normal": GENERATED / "normal/view_0020.png",
                "depth": GENERATED / "depth/view_0015.png",
                "relighting": GENERATED / "relighting_soft/view_0048.png",
            },
        },
    }
    ppt = ROOT / "paper/Figures/teaser_refined_v6_rgb2048.pptx"
    with zipfile.ZipFile(ppt) as archive:
        for scene, data in config.items():
            output = OUTPUT / scene
            output.mkdir(parents=True, exist_ok=True)
            sources = {}
            for i, number in enumerate(data["input_images"]):
                member = f"ppt/media/image{number}.png"
                with Image.open(BytesIO(archive.read(member))) as image:
                    save(image, output / f"input-{i}.webp")
                sources[f"input-{i}"] = f"{ppt.relative_to(ROOT)}#{member}"
            for modality, path in data["interior"].items():
                with Image.open(path) as image:
                    save(image, output / f"{modality}.webp")
                sources[modality] = str(path.relative_to(ROOT))
            (output / "images.json").write_text(json.dumps(sources, indent=2))
            print(scene, sources, flush=True)


if __name__ == "__main__":
    main()
