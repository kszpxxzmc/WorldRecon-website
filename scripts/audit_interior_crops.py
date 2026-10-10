"""Recover the paper's square crop from the embedded PPT image and raw render."""

from io import BytesIO
from pathlib import Path
import json
import zipfile

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
REAL = ROOT / "vis/cases/output/Scannet_iphone_n32/bde1e479ad_complete_seed50"


def thumbnail(image):
    return np.asarray(image.convert("RGB").resize((48, 48)), dtype=float)


def main():
    candidates = {
        23: [REAL / "mesh/view_0022.png"],
        24: [REAL / "rendering/view_0044_normal.png"],
        25: list((REAL / "adjusted_view_0000").glob("*_depth.png")) + [REAL / "rendering/view_0000_depth.png"],
        26: [REAL / "relighting/view_0006.png"],
    }
    results = {}
    with zipfile.ZipFile(ROOT / "paper/Figures/teaser_refined_v6_rgb2048.pptx") as archive:
        for number, files in candidates.items():
            target = thumbnail(Image.open(BytesIO(archive.read(f"ppt/media/image{number}.png"))))
            best = None
            for path in files:
                with Image.open(path) as source:
                    width, height = source.size
                    side = min(width, height)
                    for x in range(width - side + 1):
                        box = (x, 0, x + side, side)
                        mse = float(np.square(thumbnail(source.crop(box)) - target).mean())
                        if best is None or mse < best["mse"]:
                            best = {"path": str(path.relative_to(ROOT)), "crop": box, "mse": mse,
                                    "source_size": source.size}
            results[str(number)] = best
            print(number, best, flush=True)
    destination = ROOT / "website/render-work/interior-crops.json"
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
