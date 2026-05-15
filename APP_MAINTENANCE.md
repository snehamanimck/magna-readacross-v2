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
- `Scenario LIKE 'Actual%'`, for example `Actual` or `Actual FY2026`
- `View = 'Periodic'`

The row also needs these values to be usable in benchmark calculations:

- `Time` must be in the HFM-style month format parsed by the API, for example
  `2026M1`, `2026M2`, or `2026M12`.
- `Entity` must identify the site. This is the key used to group monthly P&L
  facts by site.
- `Account` must match an active row in `readacross.PnlAccountMap`. Rows whose
  account labels cannot be mapped to an internal metric key are skipped.
- `Amount` must contain the numeric monthly value for that account.
- For benchmark output, the entity should also have metadata in
  `readacross.PnlSiteDim`, especially `Workstream`, `Archetype`, `Subgroup`,
  and display name. Cosma benchmark rows are generated for entities whose
  resolved workstream is `Cosma`.

If new rows do not satisfy those conditions, recompute will ignore them or they
will not contribute to the P&L benchmark metrics.

## Required post-step after P&L load

When a new month of P&L data is added to `readacross.PnlEntries`, run the
recompute step below. The app does not need a code change for a new month:
`PnlCalculationEngine` reads the latest eligible months from `PnlEntries`,
recalculates trailing three-month averages, refreshes benchmark anchors,
updates opportunities/rankings, and regenerates recommendations.

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

## How benchmarks are calculated

`PnlCalculationEngine` starts from eligible `PnlEntries` rows, maps source
accounts through `PnlAccountMap`, and joins site metadata from `PnlSiteDim`.
It builds monthly panels per entity, derives `VOH` from fixed and variable MOH,
derives `wages` from IDL and SGA labour accounts, and calculates trailing
three-month averages for each account key.

The benchmark metrics are profitability, operating expense ratio, production
labour and benefits ratio, wages ratio, production materials ratio, VOH ratio,
and scrap ratio. Benchmark anchors are selected across all Cosma sites, within
each archetype, and within each subgroup. The best performer is the site with
the highest profitability when EBITDA is available; otherwise it is the site
with the lowest operating-expense ratio.

For each Cosma site and metric, the engine writes the site value, anchor values,
anchor entities, and opportunity amounts to `PnlSiteBenchmarks`. Opportunity is
the positive site-to-anchor gap multiplied by trailing three-month production
revenue. Rankings are then written to `PnlRankings`, with higher profitability
ranking first and lower cost ratios ranking first.

## Benchmark formulas

```text
VOH = VOH_variable + VOH_fixed
wages = IDL + SGA_fixed + SGA_labour

trailing_3m(account_key) =
  average of that account key across the latest 3 months available for the site

profitability =
  trailing_3m(EBITDA) / trailing_3m(production_sales)

opex_ratio =
  (
    trailing_3m(DL)
    + trailing_3m(wages)
    + trailing_3m(materials)
    + trailing_3m(VOH)
    + trailing_3m(scrap_expense)
  ) / trailing_3m(production_sales)

labour_benefits_ratio =
  trailing_3m(DL) / trailing_3m(production_sales)

wages_ratio =
  trailing_3m(wages) / trailing_3m(production_sales)

prod_materials_ratio =
  trailing_3m(materials) / trailing_3m(production_sales)

voh_ratio =
  trailing_3m(VOH) / trailing_3m(production_sales)

scrap_ratio =
  trailing_3m(scrap_expense) / trailing_3m(production_sales)
```

## Opportunity example

```text
Site A latest 3 months:
  production_sales = 10,000,000 average per month
  DL = 1,000,000
  wages = 500,000
  materials = 4,000,000
  VOH = 1,000,000
  scrap_expense = 100,000
  EBITDA = 800,000

Site A opex_ratio =
  (1,000,000 + 500,000 + 4,000,000 + 1,000,000 + 100,000)
  / 10,000,000
  = 0.66, or 66%

If the subgroup anchor opex_ratio is 60%:
  gap = max(0, 0.66 - 0.60) = 0.06
  opportunity_vs_subgroup = 0.06 * 10,000,000 = 600,000

Site A profitability =
  800,000 / 10,000,000 = 0.08, or 8%

If the Cosma anchor profitability is 12%:
  gap = max(0, 0.12 - 0.08) = 0.04
  opportunity_vs_cosma = 0.04 * 10,000,000 = 400,000
```

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

## 5) Runtime mapping/recommendation config tables

These tables drive `GET /api/Insights/dashboard-config` under:

- `mappingConfig.magnaDivisionAliases`
- `mappingConfig.recommendationConfig`

### Tables

- `readacross.MagnaDivisionAliases`
- `readacross.CosmaSubgroupMap`
- `readacross.ArchetypeMfgAllowed`
- `readacross.SpendCategoryMetricMap`
- `readacross.RecommendationScoring`

Legacy `readacross.UiRuntime*` tables are retired and removed by:

- `sql/15_ui_runtime_tables.sql`

### Sample value checks

```bash
docker exec -i magna-readacross-sql /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P 'Magna#Seed2026!' -d MagnaReadAcross -C -Q \
  "SELECT TOP (10) * FROM readacross.MagnaDivisionAliases ORDER BY MagnaDivision;
   SELECT TOP (10) * FROM readacross.CosmaSubgroupMap ORDER BY SiteName;
   SELECT TOP (10) * FROM readacross.ArchetypeMfgAllowed ORDER BY ArchetypeKey, MfgProcess;
   SELECT TOP (10) * FROM readacross.SpendCategoryMetricMap ORDER BY SpendCategory, MetricKey;
   SELECT TOP (1)  * FROM readacross.RecommendationScoring ORDER BY UpdatedAtUtc DESC;"
```

### After changes

- Restart API (`make ingest-and-restart` or `docker compose ... up -d --build api`)
- Verify endpoint:
  - `curl -s http://localhost:5080/api/insights/dashboard-config`

---

## 6) Core maintenance commands

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

## 7) Troubleshooting quick checks

- `POST /api/Pnl/recompute` returns `404`
  - Rebuild/restart API container.
- Recompute succeeds but derived counts stay low/zero
  - Check `PnlEntries` filters (`Actual%`, `Periodic`, `HasData=1`).
  - Confirm `sql/12_schema_pnl_calc.sql` and `sql/13_views_pnl.sql` are applied.
- Wave subgroup pills are blank/missing
  - Update `SubgroupEntityMap`, rerun backfill, then run coverage check.
