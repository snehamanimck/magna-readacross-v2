#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import subprocess
from pathlib import Path


def sql_string(value: str | None) -> str:
    if value is None:
        return "NULL"
    return "N'" + value.replace("'", "''") + "'"


ACCOUNT_MAP = {
    "labour_benefits": "Direct Labor (DL)",
    "wages": "Indirect Labor (IDL)",
    "production_materials": "Production Materials",
    "fixed_moh": "Fixed Overhead (FOH)",
    "variable_moh": "Variable Overhead (VOH)",
    "scrap": "Scrap (303122)",
}

MAX_INSERT_ROWS = 500


def month_to_hfm(month: str) -> str:
    raw = (month or "").strip()
    # 2025-04
    if re.match(r"^\d{4}-\d{1,2}$", raw):
        y, m = raw.split("-")
        return f"{int(y):04d}M{int(m)}"
    # 2025M4
    mm = re.match(r"^(\d{4})[mM](\d{1,2})$", raw)
    if mm:
        return f"{int(mm.group(1)):04d}M{int(mm.group(2))}"
    # Jan 2025 / January 2025
    for idx, token in enumerate(("jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"), start=1):
        if raw.lower().startswith(token):
            year_match = re.search(r"(20\d{2})", raw)
            if not year_match:
                break
            return f"{int(year_match.group(1)):04d}M{idx}"
    raise ValueError(f"Unsupported month format: {month!r}")


def rows_from_payload(payload: dict) -> list[str]:
    benches = payload.get("benchmarks") or {}
    monthly = payload.get("monthly_pnl") or payload.get("monthlyPnl") or {}
    rows: list[str] = []
    for site, panel in monthly.items():
        bench = benches.get(site, {})
        subgroup = bench.get("subgroup")
        archetype = bench.get("archetype")
        months = panel.get("months") or []
        costs = panel.get("costs") or {}
        revenue = panel.get("revenue") or {}
        prod_rev_arr = revenue.get("production") or []
        total_rev_arr = revenue.get("total") or []
        for idx, month in enumerate(months):
            hfm_time = month_to_hfm(month)
            month_cost_sum = 0.0

            # Revenue rows used by denominator metrics and anchor fallback.
            if idx < len(prod_rev_arr) and prod_rev_arr[idx] is not None:
                prod_rev = float(prod_rev_arr[idx])
                rows.append(
                    "("
                    + ", ".join(
                        [
                            sql_string("Cosma"),
                            sql_string(site),
                            sql_string(subgroup),
                            sql_string("USD"),
                            sql_string("Actual25"),
                            sql_string(hfm_time),
                            sql_string("Periodic"),
                            sql_string("Production Sales"),
                            sql_string("Top"),
                            sql_string("Top"),
                            sql_string("Top"),
                            sql_string("Top"),
                            sql_string("Top"),
                            sql_string("Top"),
                            sql_string(archetype),
                            sql_string("Top"),
                            sql_string("Top"),
                            sql_string("Adjusted_USI"),
                            str(prod_rev),
                            "1",
                        ]
                    )
                    + ")"
                )
            else:
                prod_rev = 0.0

            if idx < len(total_rev_arr) and total_rev_arr[idx] is not None:
                total_rev = float(total_rev_arr[idx])
                rows.append(
                    "("
                    + ", ".join(
                        [
                            sql_string("Cosma"),
                            sql_string(site),
                            sql_string(subgroup),
                            sql_string("USD"),
                            sql_string("Actual25"),
                            sql_string(hfm_time),
                            sql_string("Periodic"),
                            sql_string("Total Sales"),
                            sql_string("Top"),
                            sql_string("Top"),
                            sql_string("Top"),
                            sql_string("Top"),
                            sql_string("Top"),
                            sql_string("Top"),
                            sql_string(archetype),
                            sql_string("Top"),
                            sql_string("Top"),
                            sql_string("Adjusted_USI"),
                            str(total_rev),
                            "1",
                        ]
                    )
                    + ")"
                )
            else:
                total_rev = prod_rev

            for json_key, account in ACCOUNT_MAP.items():
                arr = costs.get(json_key) or []
                if idx >= len(arr):
                    continue
                value = arr[idx]
                if value is None:
                    continue
                v = float(value)
                month_cost_sum += v
                rows.append(
                    "("
                    + ", ".join(
                        [
                            sql_string("Cosma"),
                            sql_string(site),
                            sql_string(subgroup),
                            sql_string("USD"),
                            sql_string("Actual25"),
                            sql_string(hfm_time),
                            sql_string("Periodic"),
                            sql_string(account),
                            sql_string("Top"),
                            sql_string("Top"),
                            sql_string("Top"),
                            sql_string("Top"),
                            sql_string("Top"),
                            sql_string("Top"),
                            sql_string(archetype),
                            sql_string("Top"),
                            sql_string("Top"),
                            sql_string("Adjusted_USI"),
                            str(v),
                            "1",
                        ]
                    )
                    + ")"
                )

            # Synthetic EBITDA from available monthly panel:
            # EBITDA ~= Production Sales - (DL + Wages + Materials + FOH + VOH + Scrap)
            # This is a bootstrap estimate until raw workbook account lines are ingested.
            synthetic_ebitda = prod_rev - month_cost_sum
            rows.append(
                "("
                + ", ".join(
                    [
                        sql_string("Cosma"),
                        sql_string(site),
                        sql_string(subgroup),
                        sql_string("USD"),
                        sql_string("Actual25"),
                        sql_string(hfm_time),
                        sql_string("Periodic"),
                        sql_string("EBITDA"),
                        sql_string("Top"),
                        sql_string("Top"),
                        sql_string("Top"),
                        sql_string("Top"),
                        sql_string("Top"),
                        sql_string("Top"),
                        sql_string(archetype),
                        sql_string("Top"),
                        sql_string("Top"),
                        sql_string("Adjusted_USI"),
                        str(synthetic_ebitda),
                        "1",
                    ]
                )
                + ")"
            )
    return rows


def render_insert_batches(rows: list[str]) -> str:
    chunks: list[str] = []
    for i in range(0, len(rows), MAX_INSERT_ROWS):
        batch = rows[i:i + MAX_INSERT_ROWS]
        chunks.append(
            "INSERT INTO readacross.PnlEntries (\n"
            "    Cube, Entity, Parent, Cons, Scenario, [Time], [View], Account, Origin, IC,\n"
            "    UD1, UD2, UD3, UD4, UD5, UD6, UD7, UD8, Amount, HasData)\nVALUES\n"
            + ",\n".join(batch)
            + ";\n"
        )
    return "\n".join(chunks)


def main() -> None:
    parser = argparse.ArgumentParser(description="Bootstrap readacross.PnlEntries from monthly_pnl JSON.")
    parser.add_argument(
        "--pnl-json",
        default="/Users/Sneha_Mani/Development/Magna/magna-readacross/.cursor/p_and_l/outputs/standalone/pnl_benchmarking.json",
    )
    parser.add_argument("--output-sql", default="/tmp/load_pnl_entries_from_monthly_pnl.sql")
    parser.add_argument("--apply-to-container", action="store_true")
    parser.add_argument("--sql-container", default="magna-readacross-sql")
    parser.add_argument("--sql-db", default="MagnaReadAcross")
    parser.add_argument("--sql-user", default="sa")
    parser.add_argument("--sql-password", default="Magna#Seed2026!")
    args = parser.parse_args()

    payload = json.loads(Path(args.pnl_json).read_text(encoding="utf-8"))
    rows = rows_from_payload(payload)

    out = Path(args.output_sql)
    inserts_sql = render_insert_batches(rows)
    out.write_text(
        "SET NOCOUNT ON;\n"
        "DELETE FROM readacross.PnlEntries WHERE Scenario LIKE 'Actual%';\n"
        + inserts_sql
        + "SELECT COUNT(*) AS pnl_entries_actual_count FROM readacross.PnlEntries WHERE Scenario LIKE 'Actual%';\n",
        encoding="utf-8",
    )
    print(f"Wrote: {out} ({len(rows)} rows)")

    if args.apply_to_container:
        remote_sql = "/tmp/load_pnl_entries_from_monthly_pnl.sql"
        subprocess.run(["docker", "cp", str(out), f"{args.sql_container}:{remote_sql}"], check=True)
        subprocess.run(
            [
                "docker",
                "exec",
                args.sql_container,
                "/opt/mssql-tools18/bin/sqlcmd",
                "-b",
                "-S",
                "localhost",
                "-U",
                args.sql_user,
                "-P",
                args.sql_password,
                "-C",
                "-d",
                args.sql_db,
                "-i",
                remote_sql,
            ],
            check=True,
        )
        print("Applied SQL successfully.")


if __name__ == "__main__":
    main()
