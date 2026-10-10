"""Trim the opening teaser at a keyframe and remux the method demonstration."""

import argparse
import json
from pathlib import Path
import shutil
import subprocess


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "paper/supplementary/video_demo.mov"
OUTPUT = ROOT / "website/assets/video"
TRIM_START = 91 / 30


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ffmpeg", default=shutil.which("ffmpeg"))
    args = parser.parse_args()
    if not args.ffmpeg:
        parser.error("Pass --ffmpeg with the path to an FFmpeg executable.")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    target = OUTPUT / "worldrecon-method.mp4"
    subprocess.run([
        args.ffmpeg, "-hide_banner", "-loglevel", "warning", "-y",
        "-ss", f"{TRIM_START:.9f}",
        "-i", str(SOURCE), "-map", "0:v:0", "-map", "0:a:0",
        "-c", "copy", "-map_metadata", "-1", "-movflags", "+faststart", str(target),
    ], check=True)
    subprocess.run([
        args.ffmpeg, "-hide_banner", "-loglevel", "warning", "-y",
        "-ss", "40", "-i", str(SOURCE), "-frames:v", "1",
        "-c:v", "libwebp", "-quality", "92", str(OUTPUT / "method-poster.webp"),
    ], check=True)
    (OUTPUT / "manifest.json").write_text(json.dumps({
        "source": "paper/supplementary/video_demo.mov",
        "file": "video/worldrecon-method.mp4",
        "poster": "video/method-poster.webp",
        "width": 1440,
        "height": 1080,
        "fps": 30,
        "source_start_seconds": TRIM_START,
        "duration_seconds": 42.60,
        "video_codec": "H.264",
        "audio_codec": "AAC",
        "processing": "Opening teaser removed at source keyframe 91 (3.033333 seconds); remaining streams copied into faststart MP4 without recompression.",
        "bytes": target.stat().st_size,
    }, indent=2) + "\n", encoding="utf-8")
    print(f"Prepared {target} ({target.stat().st_size / 1_000_000:.1f} MB)", flush=True)


if __name__ == "__main__":
    main()
