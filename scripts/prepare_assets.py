"""Prepare web previews and high-resolution figures from paper/Figures."""

from io import BytesIO
import json
from pathlib import Path
import shutil
import zipfile

import pymupdf as fitz
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
FIGURES = ROOT / "paper" / "Figures"
ASSETS = ROOT / "website" / "assets"
MANIFEST = {}


def rgb(image):
    if image.mode == "RGBA":
        background = Image.new("RGB", image.size, "white")
        background.paste(image, mask=image.getchannel("A"))
        return background
    return image.convert("RGB")


def save_image(name, image, source, preview_width=2400):
    image = rgb(image)
    full_path = ASSETS / "highres" / f"{name}.webp"
    image.save(full_path, quality=96, method=6)
    preview = image.copy()
    if preview.width > preview_width:
        preview = preview.resize(
            (preview_width, round(preview.height * preview_width / preview.width)),
            Image.Resampling.LANCZOS,
        )
    preview.save(ASSETS / f"{name}.webp", quality=91, method=6)
    MANIFEST[name] = {
        "source": source,
        "size": image.size,
        "preview_size": preview.size,
        "preview": f"{name}.webp",
        "highres": f"highres/{name}.webp",
        "highres_bytes": full_path.stat().st_size,
    }
    print(f"{name}: {image.size} -> preview {preview.size}", flush=True)


def render_pdf(name, width):
    with fitz.open(FIGURES / f"{name}.pdf") as document:
        page = document[0]
        pixmap = page.get_pixmap(
            matrix=fitz.Matrix(width / page.rect.width, width / page.rect.width),
            alpha=False,
        )
        return Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)


def presentation_image(presentation, number):
    member = f"ppt/media/image{number}.png"
    with zipfile.ZipFile(FIGURES / f"{presentation}.pptx") as archive:
        with Image.open(BytesIO(archive.read(member))) as image:
            return image.copy()


def trim_scene(image):
    if image.mode == "RGBA" and image.getchannel("A").getextrema()[0] == 0:
        return image.crop(image.getchannel("A").getbbox())
    return image


def main():
    (ASSETS / "highres").mkdir(parents=True, exist_ok=True)
    with Image.open(FIGURES / "teaser_refined.png") as image:
        save_image("teaser_refined", image, "paper/Figures/teaser_refined.png", 2600)
    shutil.copyfile(FIGURES / "teaser_refined.png", ASSETS / "highres/teaser_refined.png")

    for output, source, width in (
        ("pipeline", "network", 5000),
        ("largescale", "largescale", 6000),
        ("comparison", "comparison", 6300),
        ("ablation", "ablation", 6000),
    ):
        save_image(output, render_pdf(source, width), f"paper/Figures/{source}.pdf")
        shutil.copyfile(FIGURES / f"{source}.pdf", ASSETS / "highres" / f"{output}.pdf")

    teaser = "teaser_refined_v6_rgb2048"
    for name, number in {
        "scene-real": 22, "scene-video": 31,
        "input-real-1": 17, "input-real-2": 18,
        "input-video-1": 27, "input-video-2": 28,
        "output-geometry": 36, "output-normal": 37,
        "output-depth": 38, "output-relighting": 39,
    }.items():
        image = presentation_image(teaser, number)
        save_image(name, image, f"paper/Figures/{teaser}.pptx#ppt/media/image{number}.png", 1600)
    for name, number in {"scene-large": 7, "input-large-1": 1, "input-large-2": 2}.items():
        image = presentation_image("largescale", number)
        if name == "scene-large":
            image = trim_scene(image)
        save_image(name, image, f"paper/Figures/largescale.pptx#ppt/media/image{number}.png", 2400)

    # Original comparison strips contain seven 2048px views with 32px gutters.
    for scene, number in (("dining", 15), ("classroom", 14), ("library", 13)):
        strip = presentation_image("comparison", number)
        if strip.size != (14528, 2048):
            raise ValueError(f"Unexpected comparison layout: {strip.size}")
        for method, column in (("vggt", 0), ("finerecon", 3), ("genrecon", 4), ("ours", 5)):
            left = column * (2048 + 32)
            image = strip.crop((left, 0, left + 2048, 2048))
            save_image(
                f"compare-{scene}-{method}", image,
                f"paper/Figures/comparison.pptx#ppt/media/image{number}.png;column={column}",
                1600,
            )

    shutil.copyfile(ROOT / "paper/_ICLR_2027__WorldRecon.pdf", ASSETS / "WorldRecon.pdf")
    icon = Image.new("RGB", (64, 64), "#246d51")
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 42)
    ImageDraw.Draw(icon).text((32, 32), "W", font=font, anchor="mm", fill="white")
    icon.save(ASSETS / "favicon.png")
    (ASSETS / "image-manifest.json").write_text(
        json.dumps(MANIFEST, indent=2) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
