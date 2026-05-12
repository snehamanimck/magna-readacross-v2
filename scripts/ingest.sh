#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

python3 "$ROOT_DIR/scripts/sync_media_assets.py"
python3 "$ROOT_DIR/scripts/ingest_from_original_artifacts.py" --apply-to-container
