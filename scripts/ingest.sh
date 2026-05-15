#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
USE_XLSX=0
for arg in "$@"; do
    if [[ "$arg" == "--xlsx" ]]; then
        USE_XLSX=1
    fi
done

SQL_CONTAINER="${SQL_CONTAINER:-magna-readacross-sql}"
SQL_USER="${SQL_USER:-sa}"
SQL_PASSWORD="${SQL_PASSWORD:-Magna#Seed2026!}"
SQL_DB="${SQL_DB:-MagnaReadAcross}"
SQL_TOOLS="${SQL_TOOLS:-/opt/mssql-tools18/bin/sqlcmd}"

apply_sql() {
    local sql_file="$1"
    local base
    base="$(basename "$sql_file")"
    docker cp "$sql_file" "$SQL_CONTAINER:/tmp/$base"
    docker exec "$SQL_CONTAINER" "$SQL_TOOLS" \
        -S localhost -U "$SQL_USER" -P "$SQL_PASSWORD" -d "$SQL_DB" \
        -C -N -b -i "/tmp/$base"
}

python3 "$ROOT_DIR/scripts/sync_media_assets.py"

if [[ "$USE_XLSX" -eq 1 ]]; then
    echo "→ XLSX mode: loading PnlEntries from Rolling Analyst workbooks (stub-safe)..."
    python3 "$ROOT_DIR/scripts/load_pnl_entries_from_xlsx.py"
else
    echo "→ Bootstrap mode: loading PnlEntries from monthly_pnl JSON..."
    python3 "$ROOT_DIR/scripts/load_pnl_entries_from_monthly_pnl.py" --apply-to-container
fi

# Loads CosmaWaveInitiatives / PowertrainWaveInitiatives /
# ExteriorsWaveInitiatives / SeatingWaveInitiatives plus archetypes /
# thought-starters / knowledge-center / video-library
# / dashboard snapshots from the legacy `dashboard_data.json`.
python3 "$ROOT_DIR/scripts/ingest_from_original_artifacts.py" --apply-to-container

# Wave rows are inserted with NULL Subgroup. Run the SubgroupEntityMap-driven
# backfill so the four workstreams' filter pills + heatmap groupings light up
# without a second manual step.
echo "→ Running readacross.SubgroupEntityMap backfill (sql/05_backfill_subgroups.sql)…"
apply_sql "$ROOT_DIR/sql/05_backfill_subgroups.sql"

echo "→ Recomputing SQL-backed P&L benchmarks + recommendations..."
curl -sS -X POST "http://localhost:5080/api/Pnl/recompute" -H "Content-Type: application/json" || true
