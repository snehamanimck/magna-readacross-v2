#!/usr/bin/env python3
"""
Sync slide and video static assets into Angular's `web/src/assets`.
"""
from __future__ import annotations

import argparse
import shutil
from pathlib import Path


def sync_dir(src: Path, dst: Path) -> int:
    if not src.exists():
        print(f"[skip] source missing: {src}")
        return 0
    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(src, dst)
    count = sum(1 for p in dst.rglob("*") if p.is_file())
    print(f"[ok] copied {count} files: {src} -> {dst}")
    return count


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--slides-src",
        default="/Users/Sneha_Mani/Development/Magna/gms-dashboard-main/magna-dashboard/public/slides",
    )
    parser.add_argument(
        "--videos-src",
        default="/Users/Sneha_Mani/Development/Magna/magna-readacross/public/videos",
    )
    parser.add_argument(
        "--assets-root",
        default="/Users/Sneha_Mani/Development/Magna/magna-readacross-v2/web/src/assets",
    )
    args = parser.parse_args()

    assets_root = Path(args.assets_root)
    assets_root.mkdir(parents=True, exist_ok=True)

    slide_count = sync_dir(Path(args.slides_src), assets_root / "slides")
    video_count = sync_dir(Path(args.videos_src), assets_root / "videos")
    print(f"synced assets => slides:{slide_count} videos:{video_count}")


if __name__ == "__main__":
    main()
