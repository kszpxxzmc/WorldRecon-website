"""Create contact sheets for checking every generated input frame."""

import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageOps

ROOT = Path(__file__).resolve().parents[2]


def main():
    manifest = json.loads((ROOT / "website/assets/scenes/generated/inputs-32.json").read_text())
    output = ROOT / "website/render-work/watermark-audit"
    output.mkdir(parents=True, exist_ok=True)
    corners = Image.new("RGB", (8 * 240, 4 * 120), "white")
    full = Image.new("RGB", (8 * 180, 4 * 205), "white")
    for index, path in enumerate(manifest["images"]):
        with Image.open(path) as source:
            image = ImageOps.exif_transpose(source).convert("RGB")
            corner = image.crop((0, 0, 360, 135)).resize((240, 90))
            x, y = index % 8 * 240, index // 8 * 120
            corners.paste(corner, (x, y))
            ImageDraw.Draw(corners).text((x + 5, y + 94), f"{index}: {Path(path).name}", fill="black")
            frame = image.resize((180, 180))
            x, y = index % 8 * 180, index // 8 * 205
            full.paste(frame, (x, y))
            ImageDraw.Draw(full).text((x + 5, y + 184), str(index), fill="black")
    corners.save(output / "top-left.jpg", quality=95)
    full.save(output / "all-frames.jpg", quality=95)
    cropped = Image.new("RGB", (8 * 180, 4 * 205), "white")
    with Image.open(ROOT / "website/assets/scenes/generated/inputs-32.gif") as gif:
        for index in range(gif.n_frames):
            gif.seek(index)
            x, y = index % 8 * 180, index // 8 * 205
            cropped.paste(gif.convert("RGB").resize((180, 180)), (x, y))
            ImageDraw.Draw(cropped).text((x + 5, y + 184), str(index), fill="black")
    cropped.save(output / "cropped-all-frames.jpg", quality=95)


if __name__ == "__main__":
    main()
