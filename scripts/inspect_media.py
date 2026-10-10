"""Inspect source images in paper presentations without changing the originals."""

import argparse
from io import BytesIO
import json
from pathlib import Path
import xml.etree.ElementTree as ET
import zipfile

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[2]
NS = {
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "rel": "http://schemas.openxmlformats.org/package/2006/relationships",
}


def inspect_presentation(path, output):
    records = []
    thumbnails = []
    with zipfile.ZipFile(path) as archive:
        for name in archive.namelist():
            if not name.startswith("ppt/media/"):
                continue
            try:
                with Image.open(BytesIO(archive.read(name))) as image:
                    records.append({"file": name, "size": image.size})
                    image.thumbnail((260, 180))
                    thumb = Image.new("RGB", (280, 215), "white")
                    if image.mode == "RGBA":
                        thumb.paste(image, ((280 - image.width) // 2, 5), image)
                    else:
                        thumb.paste(image.convert("RGB"), ((280 - image.width) // 2, 5))
                    ImageDraw.Draw(thumb).text(
                        (10, 190), f"{Path(name).name}  {records[-1]['size']}", fill="black"
                    )
                    thumbnails.append(thumb)
            except (OSError, ValueError):
                continue
        slides = []
        for name in archive.namelist():
            if not name.startswith("ppt/slides/slide") or not name.endswith(".xml"):
                continue
            relations = ET.fromstring(archive.read(
                f"ppt/slides/_rels/{Path(name).name}.rels"
            ))
            targets = {item.attrib["Id"]: item.attrib["Target"] for item in relations}
            slide = ET.fromstring(archive.read(name))
            pictures = []
            for pic in slide.findall(".//p:pic", NS):
                blip = pic.find(".//a:blip", NS)
                if blip is None:
                    continue
                relationship = blip.attrib.get(f"{{{NS['r']}}}embed")
                transform = pic.find(".//a:xfrm", NS)
                crop = pic.find(".//a:srcRect", NS)
                pictures.append({
                    "file": targets.get(relationship),
                    "transform": [
                        {"type": item.tag.rsplit("}", 1)[-1], **item.attrib}
                        for item in transform
                    ] if transform is not None else [],
                    "crop": crop.attrib if crop is not None else {},
                })
            slides.append({"slide": name, "pictures": pictures})
    sheet = Image.new("RGB", (280 * 5, 215 * ((len(thumbnails) + 4) // 5)), "#dddddd")
    for index, thumbnail in enumerate(thumbnails):
        sheet.paste(thumbnail, (index % 5 * 280, index // 5 * 215))
    sheet.save(output / f"{path.stem}.jpg", quality=90)
    (output / f"{path.stem}.json").write_text(
        json.dumps({"images": records, "slides": slides}, indent=2), encoding="utf-8"
    )
    print(path.name, len(records), "images", len(slides), "slides")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path("/tmp/worldrecon-media-audit"))
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    for name in ("teaser_refined_v6_rgb2048", "largescale", "comparison"):
        inspect_presentation(ROOT / "paper/Figures" / f"{name}.pptx", args.output)


if __name__ == "__main__":
    main()
