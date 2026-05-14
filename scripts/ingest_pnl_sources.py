"""Validate Blob-delivered PnL CSV/XLSX sources and materialize JSON cache."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd


REQUIRED_RECOMMENDATION_COLUMNS = {
    "site",
    "metric",
    "current_value",
    "benchmark_value",
    "opportunity",
}


def normalize_columns(frame: pd.DataFrame) -> pd.DataFrame:
    copy = frame.copy()
    copy.columns = [str(c).strip().lower().replace(" ", "_") for c in copy.columns]
    return copy


def read_table(path: Path) -> pd.DataFrame:
    if path.suffix.lower() == ".csv":
        return pd.read_csv(path)
    if path.suffix.lower() in {".xlsx", ".xlsm"}:
        return pd.read_excel(path)
    raise ValueError(f"Unsupported PnL source: {path}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", type=Path, required=True)
    parser.add_argument("--out-dir", type=Path, required=True)
    parser.add_argument("--write-parquet-cache", action="store_true")
    args = parser.parse_args()

    candidates = sorted(args.source_dir.glob("recommendations.*"))
    if not candidates:
        raise SystemExit("Expected recommendations.csv or recommendations.xlsx in --source-dir")

    recommendations = normalize_columns(read_table(candidates[0]))
    missing = REQUIRED_RECOMMENDATION_COLUMNS - set(recommendations.columns)
    if missing:
        raise SystemExit(f"{candidates[0]} missing required columns: {sorted(missing)}")

    recommendations.insert(0, "id", [f"pnl-rec-{i:05d}" for i in range(len(recommendations))])
    args.out_dir.mkdir(parents=True, exist_ok=True)

    bundle = {
        "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "recommendations": recommendations.to_dict(orient="records"),
        "peerSummary": [],
        "benchmarking": [],
    }
    (args.out_dir / "pnl_bundle.json").write_text(json.dumps(bundle, indent=2, default=str), encoding="utf-8")
    if args.write_parquet_cache:
        recommendations.to_parquet(args.out_dir / "pnl_recommendations.parquet", compression="snappy", index=False)

    print(f"Ingested {len(recommendations)} PnL recommendation rows")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
