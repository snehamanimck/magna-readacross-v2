# App Maintenance SOP (Steady State)

This document is the day-to-day operating procedure once the app is live.
It focuses on recurring data maintenance only.

---

## At-a-Glance Checklist

Use this section as the quick operations runbook; details are in later sections.

### Daily (or each data refresh)

- **Wave refresh completed?**
  - Load/update Wave tables.
  - Run:
    - `make backfill-subgroups`
    - `make coverage`
- **P&L refresh completed?**
  - Load/update `readacross.PnlEntries`.
  - Run:
    - `make recompute-pnl`
- **UI sanity check**
  - Open Insights tab and confirm:
    - P&L Benchmarking loads
    - P&L recommendations load
    - Wave subgroup filters show expected values

### Weekly

- **Mapping drift check**
  - Review new/renamed site/division names against:
    - `readacross.SubgroupEntityMap`
    - `readacross.PnlSiteDim`
- **Data quality check**
  - Verify non-zero row counts for:
    - `PnlEntries` (`Scenario LIKE 'Actual%'`)
    - `PnlSiteBenchmarks`
    - `PnlRankings`
    - `PnlRecommendations`

### As Needed

- **Site/division renamed or regrouped**
  - Update `SubgroupEntityMap` and/or `PnlSiteDim`.
  - Rerun:
    - `make backfill-subgroups`
    - `make coverage`
    - `make recompute-pnl`
- **New videos/slides**
  - Place files in source folders:
    - videos: `../magna-readacross/public/videos`
    - slides: `../gms-dashboard-main/magna-dashboard/public/slides`
  - Update metadata:
    - slides: `../magna-readacross/public/slides.json`
    - videos: `VIDEO_LIBRARY` in `../magna-readacross/public/index.html`
  - Run:
    - `make ingest-and-restart`

---

## Working Directory

```bash
cd /Users/Sneha_Mani/Development/Magna/magna-readacross-v2
```

---

## 1) Wave Data (steady-state updates)

## Tables to maintain

- `readacross.CosmaWaveInitiatives`
- `readacross.PowertrainWaveInitiatives`
- `readacross.ExteriorsWaveInitiatives`
- `readacross.SeatingWaveInitiatives`

Teams can load these tables directly (ETL/job/manual SQL).  
After each wave load, run subgroup backfill.

## Required post-step

```bash
make backfill-subgroups
make coverage
```

This applies `sql/05_backfill_subgroups.sql` and checks unmapped entities.

## If site names changed

Update mapping rows in:

- `readacross.SubgroupEntityMap`

Then rerun:

```bash
make backfill-subgroups
make coverage
```

---

## 2) P&L Data (steady-state updates)

## Table to maintain

- `readacross.PnlEntries`

Your upstream process should insert/update facts here.

## Rows that the calculation pipeline actually uses

- `HasData = 1`
- `Scenario LIKE 'Actual%'`
- `View = 'Periodic'`

If new rows do not satisfy those conditions, recompute will ignore them.

## Required post-step after P&L load

```bash
make recompute-pnl
```

Equivalent API call:

```bash
curl -s -X POST "http://localhost:5080/api/Pnl/recompute" | python3 -m json.tool
```

## What gets recomputed

From `PnlEntries`, the app regenerates:

- `readacross.PnlSiteBenchmarks`
- `readacross.PnlRankings`
- `readacross.PnlAnchors`
- `readacross.PnlRecommendations`

The endpoint chain is:

1. `PnlCalculationEngine.RecomputeAllAsync`
2. `PnlRecommendationEngine.RecomputeAllAsync`
3. `PnlEbitOverlayService.ApplyAsync`

## Validate recompute output

```bash
docker exec -i magna-readacross-sql /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P 'Magna#Seed2026!' -d MagnaReadAcross -C -Q \
  "SELECT COUNT(*) AS PnlEntriesActual FROM readacross.PnlEntries WHERE Scenario LIKE 'Actual%';
   SELECT COUNT(*) AS PnlSiteBenchmarks FROM readacross.PnlSiteBenchmarks;
   SELECT COUNT(*) AS PnlRankings FROM readacross.PnlRankings;
   SELECT COUNT(*) AS PnlAnchors FROM readacross.PnlAnchors;
   SELECT COUNT(*) AS PnlRecommendations FROM readacross.PnlRecommendations;"
```

---

## 3) Site Name Mapping: where to update

When naming changes happen (site/division renamed, regrouped, moved between subgroups):

## A) Wave subgroup mapping

- Update `readacross.SubgroupEntityMap`
- Run:

```bash
make backfill-subgroups
make coverage
```

## B) P&L site display/archetype mapping

- Update `readacross.PnlSiteDim`

Then rerun:

```bash
make recompute-pnl
```

This ensures `/api/Pnl/benchmarks` reflects current site labels/archetypes/subgroups.

---

## 4) Videos and Slides: where to place files

Both binaries and metadata must be maintained.

## File locations (source of truth)

- Videos: `../magna-readacross/public/videos`
- Slides: `../gms-dashboard-main/magna-dashboard/public/slides`

`scripts/sync_media_assets.py` copies these into:

- `web/src/assets/videos`
- `web/src/assets/slides`

## Metadata locations (source of truth)

- Slides metadata: `../magna-readacross/public/slides.json`
  - populates `readacross.KnowledgeCenterAssets`
- Video metadata: `VIDEO_LIBRARY` array in `../magna-readacross/public/index.html`
  - populates `readacross.VideoLibraryAssets`

If file exists but metadata is missing, the card will not appear in UI.

## Standard update sequence for media

1) Add/replace files in source folders above.  
2) Update metadata (`slides.json` / `VIDEO_LIBRARY`).  
3) Run:

```bash
make ingest-and-restart
```

4) Verify:

```bash
docker exec -i magna-readacross-sql /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P 'Magna#Seed2026!' -d MagnaReadAcross -C -Q \
  "SELECT COUNT(*) AS Slides FROM readacross.KnowledgeCenterAssets;
   SELECT COUNT(*) AS Videos FROM readacross.VideoLibraryAssets;"
```

---

## 5) Core maintenance commands

```bash
make up
make build
make logs
make ingest
make ingest-and-restart
make backfill-subgroups
make coverage
make recompute-pnl
make sql-shell
```

---

## 6) Troubleshooting quick checks

- `POST /api/Pnl/recompute` returns `404`
  - Rebuild/restart API container.
- Recompute succeeds but derived counts stay low/zero
  - Check `PnlEntries` filters (`Actual%`, `Periodic`, `HasData=1`).
  - Confirm `sql/12_schema_pnl_calc.sql` and `sql/13_views_pnl.sql` are applied.
- Wave subgroup pills are blank/missing
  - Update `SubgroupEntityMap`, rerun backfill, then run coverage check.
