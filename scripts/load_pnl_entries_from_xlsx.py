#!/usr/bin/env python3
"""
Phase-2 loader placeholder: ingest Rolling Analyst workbooks directly to readacross.PnlEntries.

Port checklist from legacy prepare_pnl_benchmarking.py:
1) Discover monthly columns from header rows:
   - TYPE_ROW=1, PERIOD_ROW=2, SCENARIO_ROW=3
   - include only Periodic + Actual + YYYYM#
2) Start data scan from HEADER_ROW+1 (legacy uses HEADER_ROW=12)
3) Account code/value extraction:
   - account code in ACCT_COL=2
   - map via readacross.PnlAccountMap (or YAML-equivalent) to internal keys
4) Preserve source cube dimensions:
   Cube, Entity, Parent, Cons, Scenario, Time, View, Account, Origin, IC, UD1..UD8
5) Idempotent load pattern:
   DELETE target scenario slice (Actual*) + INSERT rows
6) Post-load:
   call /api/Pnl/recompute to refresh PnlSiteBenchmarks/PnlRecommendations/PnlRankings
"""

from __future__ import annotations

import argparse
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description="Stub for direct XLSX -> PnlEntries ingest.")
    parser.add_argument("--source-dir", default="/Users/Sneha_Mani/Development/Magna/magna-readacross/.cursor/p_and_l/raw")
    args = parser.parse_args()
    src = Path(args.source_dir)
    if not src.exists():
        print(f"[stub] source dir does not exist: {src}")
        return
    files = sorted(src.glob("*_Rolling Analyst*.xlsx"))
    print(f"[stub] found {len(files)} workbook(s). Implement parser before enabling this path.")


if __name__ == "__main__":
    main()
