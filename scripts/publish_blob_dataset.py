"""Publish a versioned Blob dataset for the Angular read-across portal.

The legacy ETL can still author the rich dashboard payload, but production
publishing should fan it out into cacheable shards:

- core.json, thought_starters.json, archetypes.json
- initiatives.<workstream>.parquet (initiatives only)
- slides_index.json plus binary slide/video assets
- pnl/*.csv|xlsx sources
- manifest.json with hash/size/format for every artifact
"""

from __future__ import annotations

import argparse
import hashlib
import json
import mimetypes
import shutil
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd


WORKSTREAMS = ("Cosma", "Powertrain", "Exteriors")


@dataclass(frozen=True)
class ManifestShard:
    id: str
    path: str
    format: str
    sha256: str
    byteLength: int
    mimeType: str | None = None
    role: str | None = None


def file_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fp:
        for chunk in iter(lambda: fp.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def shard_for(path: Path, root: Path, format_: str, role: str | None = None) -> ManifestShard:
    return ManifestShard(
        id=path.relative_to(root).as_posix().replace("/", ".").rsplit(".", 1)[0],
        path=path.relative_to(root).as_posix(),
        format=format_,
        sha256=file_hash(path),
        byteLength=path.stat().st_size,
        mimeType=mimetypes.guess_type(path.name)[0],
        role=role,
    )


def write_json(path: Path, payload: Any, root: Path, role: str | None = None) -> ManifestShard:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
    return shard_for(path, root, "json", role)


def copy_tree(src: Path, dest: Path, root: Path, role: str) -> list[ManifestShard]:
    if not src.exists():
        return []
    shards: list[ManifestShard] = []
    for file in src.rglob("*"):
        if not file.is_file():
            continue
        out = dest / file.relative_to(src)
        out.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(file, out)
        suffix = out.suffix.lower().lstrip(".")
        shards.append(shard_for(out, root, suffix or "binary", role))
    return shards


def build_slides_index(slides_dir: Path, videos_dir: Path) -> dict[str, Any]:
    slides = []
    for order, file in enumerate(sorted(slides_dir.rglob("*")) if slides_dir.exists() else [], start=1):
        if not file.is_file():
            continue
        slides.append(
            {
                "id": f"slide-{order:03d}",
                "title": file.stem.replace("_", " ").replace("-", " ").title(),
                "assetId": f"slides/{file.relative_to(slides_dir).as_posix()}",
                "mimeType": mimetypes.guess_type(file.name)[0] or "application/octet-stream",
                "order": order,
            }
        )

    videos = []
    for order, file in enumerate(sorted(videos_dir.rglob("*")) if videos_dir.exists() else [], start=1):
        if not file.is_file() or file.suffix.lower() not in {".mp4", ".mov", ".webm"}:
            continue
        videos.append(
            {
                "id": f"video-{order:03d}",
                "title": file.stem.replace("_", " ").replace("-", " ").title(),
                "assetId": f"videos/{file.relative_to(videos_dir).as_posix()}",
                "mimeType": mimetypes.guess_type(file.name)[0] or "video/mp4",
                "order": order,
            }
        )
    return {"slides": slides, "videos": videos}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dashboard-json", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--slides-dir", type=Path)
    parser.add_argument("--videos-dir", type=Path)
    parser.add_argument("--pnl-dir", type=Path)
    parser.add_argument("--dataset-id", default=datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ"))
    args = parser.parse_args()

    data = json.loads(args.dashboard_json.read_text(encoding="utf-8"))
    root = args.out / args.dataset_id
    root.mkdir(parents=True, exist_ok=True)

    shards: list[ManifestShard] = []
    shards.append(
        write_json(
            root / "core.json",
            {
                "generated": data.get("generated"),
                "filter_options": data.get("filter_options", {}),
                "wave_base_urls": data.get("wave_base_urls", {}),
                "feedback_email": data.get("feedback_email"),
                "harmonization_notes": data.get("harmonization_notes", []),
                "priority_ids": data.get("priority_ids", []),
            },
            root,
            "core",
        )
    )

    initiatives = pd.DataFrame(data.get("initiatives", []))
    if not initiatives.empty and "workstream" in initiatives.columns:
        for workstream in WORKSTREAMS:
            frame = initiatives[initiatives["workstream"] == workstream]
            if frame.empty:
                continue
            path = root / f"initiatives.{workstream.lower()}.parquet"
            frame.to_parquet(path, compression="snappy", index=False)
            shards.append(shard_for(path, root, "parquet", "initiatives"))

    for key in ("thought_starters", "archetypes"):
        if key in data:
            shards.append(write_json(root / f"{key}.json", data[key], root, key))

    slides_source = args.slides_dir or Path()
    videos_source = args.videos_dir or Path()
    shards.append(write_json(root / "slides_index.json", build_slides_index(slides_source, videos_source), root, "media-index"))
    if args.slides_dir:
        shards.extend(copy_tree(args.slides_dir, root / "slides", root, "slide-binary"))
    if args.videos_dir:
        shards.extend(copy_tree(args.videos_dir, root / "videos", root, "video-binary"))
    if args.pnl_dir:
        shards.extend(copy_tree(args.pnl_dir, root / "pnl", root, "pnl-source"))

    manifest = {
        "schemaVersion": 1,
        "datasetId": args.dataset_id,
        "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "shards": [asdict(s) for s in shards],
    }
    (root / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    (args.out / "latest.json").write_text(json.dumps({"datasetId": args.dataset_id}, indent=2), encoding="utf-8")
    print(f"Published {len(shards)} shards to {root}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
