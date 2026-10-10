"""Render and encode the three native-resolution Blender orbit videos."""

import json
from pathlib import Path
import shutil
import subprocess
import os
import argparse
from concurrent.futures import ThreadPoolExecutor

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
BLENDER = "/apdcephfs/private_momogazhang/blender-4.5.1-linux-x64/blender"
FFMPEG = os.environ.get("FFMPEG_PATH", "/tmp/worldrecon-video-tools/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2")


SCENES = ("synthetic", "real", "generated")


def render_part(scene, start, end, gpu):
    work = ROOT / "website/render-work" / scene
    work.mkdir(parents=True, exist_ok=True)
    env = dict(os.environ, CUDA_VISIBLE_DEVICES=str(gpu))
    with (work / f"render-{start:04d}.log").open("a") as log:
        subprocess.run([
            BLENDER, "-b", "-t", "4", "--python",
            str(ROOT / "website/scripts/blender_orbit_hd.py"), "--", "--scene", scene,
            "--start", str(start), "--end", str(end),
        ], stdout=log, stderr=subprocess.STDOUT, check=True, env=env)
    print(f"HD_PART_COMPLETE {scene} {start}:{end} GPU {gpu}", flush=True)


def render_worker(gpu, tasks):
    for scene, start, end in tasks:
        render_part(scene, start, end, gpu)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--gpus", default="0")
    parser.add_argument("--encode-only", action="store_true")
    args = parser.parse_args()
    gpus = [int(gpu) for gpu in args.gpus.split(",")]
    if not args.encode_only:
        tasks = [(scene, start, min(192, start + 24)) for scene in SCENES for start in range(0, 192, 24)]
        with ThreadPoolExecutor(max_workers=len(gpus)) as pool:
            futures = [pool.submit(render_worker, gpu, tasks[index::len(gpus)]) for index, gpu in enumerate(gpus)]
            for future in futures:
                future.result()
    for scene in SCENES:
        work = ROOT / "website/render-work" / scene
        work.mkdir(parents=True, exist_ok=True)
        frames = list(work.glob("frame_*.png"))
        if len(frames) != 192:
            raise RuntimeError(f"{scene}: incomplete render ({len(frames)}/192)")
        output = ROOT / "website/assets/scenes" / scene
        subprocess.run([
            FFMPEG, "-hide_banner", "-loglevel", "warning", "-y",
            "-f", "lavfi", "-i", "color=c=white:s=2048x2048:r=24",
            "-framerate", "24", "-i", str(work / "frame_%04d.png"),
            "-filter_complex", "[0:v][1:v]overlay=shortest=1:format=auto,format=yuv420p",
            "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "18",
            "-movflags", "+faststart", str(output / "orbit-hd.mp4"),
        ], check=True)
        with Image.open(work / "frame_0000.png") as im:
            bg = Image.new("RGB", im.size, "white")
            bg.paste(im, mask=im.getchannel("A"))
            bg.save(output / "orbit-hd-poster.webp", quality=95)
        manifest = json.loads((work / "orbit-0000.json").read_text())
        manifest["bytes"] = (output / "orbit-hd.mp4").stat().st_size
        (output / "orbit-hd.json").write_text(json.dumps(manifest, indent=2))
        print(f"HD_COMPLETE {scene}: {manifest['bytes']} bytes", flush=True)


if __name__ == "__main__":
    main()
