# Magna Read-Across Dashboard

SQL-backed dashboard for exploring Magna initiative read-across, P&L
benchmarks, site recommendations, and related enablement content.

The app loads Wave initiative data, P&L facts, mapping tables, slides, and videos
into the `readacross` SQL schema. An ASP.NET 8 API exposes the harmonized data,
and an Angular SPA renders Initiative Overview, Heatmap, Insights, P&L
Benchmarking, P&L-Informed Recommendations, and Feedback.

```text
Angular SPA (:4200) ──HTTP/JSON──> ASP.NET API (:5080) ──EF Core──> SQL Server
        web/                         api/                         readacross.*
```

## Start Here

- Daily/weekly operating procedure: `APP_MAINTENANCE.md`
- SQL table schema and sample records: `docs/sql-table-schema.md`
- Schema and data scripts: `sql/`
- API source: `api/`
- Angular source: `web/`

## Table Of Contents

- [Quick Start](#quick-start)
- [Repository Layout](#repository-layout)
- [System Architecture](#system-architecture)
- [Database Schema Reference](#database-schema-reference)
- [Core Data Flows](#core-data-flows)
- [Runtime Mapping And Recommendation Config](#runtime-mapping-and-recommendation-config)
- [Backend/API](#backendapi)
- [Frontend/UI](#frontendui)
- [Operations](#operations)
- [Configuration Reference](#configuration-reference)
- [Troubleshooting](#troubleshooting)

## Quick Start

From the repository root:

```bash
cd /Users/Sneha_Mani/Development/Magna/magna-readacross-v2
```

Start the app:

```bash
make up
```

Open:

- SPA: `http://localhost:4200`
- API health: `http://localhost:5080/healthz`
- Swagger, in Development: `http://localhost:5080/swagger`

Common commands:

```bash
make build                 # docker compose build api web
make up                    # docker compose up -d
make down                  # docker compose down
make logs                  # tail compose logs
make ingest                # sync media + reload SQL from source artifacts
make ingest-and-restart    # ingest + rebuild api/web
make backfill-subgroups    # run sql/05_backfill_subgroups.sql
make coverage              # inspect unmapped subgroup coverage
make recompute-pnl         # POST /api/Pnl/recompute
make sql-shell             # sqlcmd inside SQL container
```

## Repository Layout

```text
magna-readacross-v2/
├── api/                    ASP.NET 8 API
│   ├── Controllers/        REST endpoints
│   ├── Data/               EF Core DbContext
│   ├── Entities/           EF entities for readacross.* tables
│   ├── Models/             DTOs returned to Angular
│   └── Services/           Business/data assembly logic
├── web/                    Angular SPA
│   └── src/app/
│       ├── core/services/  shared signal services
│       ├── features/       page components
│       ├── shared/         models, pipes, reusable components
│       └── domains/        feature routing/app service layer
├── sql/                    schema, views, seeds, migrations
├── scripts/                ingest and asset sync scripts
├── docs/                   provisioning/supporting docs
├── APP_MAINTENANCE.md      steady-state SOP
├── docker-compose.yml      local api/web containers
└── Makefile                local operational shortcuts
```

## System Architecture

### Database

All app-owned objects live under the `readacross` schema.

Main table groups:

- Wave initiatives:
  - `CosmaWaveInitiatives`
  - `PowertrainWaveInitiatives`
  - `ExteriorsWaveInitiatives`
  - `SeatingWaveInitiatives`
- P&L facts and derived outputs:
  - `PnlEntries`
  - `PnlSiteBenchmarks`
  - `PnlAnchors`
  - `PnlRankings`
  - `PnlRecommendations`
- Mapping/config:
  - `SubgroupEntityMap`
  - `PnlAccountMap`
  - `PnlSiteDim`
  - `MagnaDivisionAliases`
  - `CosmaSubgroupMap`
  - `ArchetypeMfgAllowed`
  - `SpendCategoryMetricMap`
  - `RecommendationScoring`
- Insights/media:
  - `ThoughtStarters`
  - `KnowledgeCenterAssets`
  - `VideoLibraryAssets`
  - `ArchetypeDefinitions`
  - `SiteArchetypes`
  - `PriorityInitiatives`
- Dashboard metadata:
  - `DashboardMetaSnapshots`

## Database Schema Reference

For table schemas, key columns, inspection queries, and representative sample
records, see:

- `docs/sql-table-schema.md`

### API

The API is an ASP.NET 8 service using EF Core and SQL Server.

Important files:

- `api/Program.cs`: DI, CORS, auth setup, SQL connection.
- `api/Data/MagnaDbContext.cs`: EF table bindings.
- `api/Controllers/*Controller.cs`: endpoint surfaces.
- `api/Services/*`: data assembly and business logic.
- `api/Services/Pnl/*`: P&L calculation/recommendation engines.

### UI

The UI is an Angular SPA using standalone components and signal-based state.

Important files:

- `web/src/app/app.component.ts`: app shell.
- `web/src/app/shared/data-services/read-across-data.service.ts`: HTTP gateway.
- `web/src/app/domains/read-across/app-services/read-across-app.service.ts`: app-level service wrapper.
- `web/src/app/core/services/dashboard-chrome.service.ts`: dashboard config, priority IDs, Wave links.
- `web/src/app/core/services/pnl-rec.service.ts`: recommendation helper logic.
- `web/src/app/features/*`: page components.
- `web/src/app/shared/models/read-across.models.ts`: TypeScript DTO mirrors.

## Core Data Flows

### Wave Initiatives

```text
Wave exports / source artifacts
  -> scripts/ingest_from_original_artifacts.py
  -> readacross.{Cosma,Powertrain,Exteriors,Seating}WaveInitiatives
  -> sql/05_backfill_subgroups.sql
  -> /api/Initiatives, /api/Aggregates/*
  -> Buckets, Heatmap, Drilldown, Search
```

Maintain subgroup ownership in:

- `readacross.SubgroupEntityMap`

After Wave refreshes, run:

```bash
make backfill-subgroups
make coverage
```

### P&L Facts, Benchmarks, And Recommendations

```text
P&L facts
  -> readacross.PnlEntries
  -> POST /api/Pnl/recompute
  -> PnlCalculationEngine
  -> PnlRecommendationEngine
  -> PnlEbitOverlayService
  -> PnlSiteBenchmarks / PnlRankings / PnlAnchors / PnlRecommendations
  -> /api/Pnl/benchmarks and /api/Insights/pnl-recommendations
  -> Insights UI
```

Rows used by recompute:

- `HasData = 1`
- `Scenario LIKE 'Actual%'`
- `View = 'Periodic'`

How benchmarks are calculated:

1. `PnlCalculationEngine` reads eligible `readacross.PnlEntries` rows and maps
   source account labels to internal metric keys through `readacross.PnlAccountMap`.
2. It groups facts by entity and month, then enriches each entity with
   `readacross.PnlSiteDim` metadata such as display name, workstream, archetype,
   subgroup, and region.
3. It derives monthly rollups used by the UI. `VOH` is calculated from
   `VOH_variable + VOH_fixed`; `wages` is calculated from `IDL + SGA_fixed +
   SGA_labour`.
4. For each account key, it calculates a trailing three-month average from the
   most recent months available for that site.
5. It calculates seven benchmark metrics:
   `profitability`, `opex_ratio`, `labour_benefits_ratio`, `wages_ratio`,
   `prod_materials_ratio`, `voh_ratio`, and `scrap_ratio`.
6. It selects benchmark anchors within three scopes: all Cosma sites, each
   archetype, and each subgroup. The anchor is the highest-profitability site
   when EBITDA is available; if EBITDA is missing, the engine uses the lowest
   operating-expense ratio as the best performer.
7. For every Cosma site and metric, it writes the site value, best Cosma value,
   best archetype value, best subgroup value, anchor entities, and opportunity
   amounts into `readacross.PnlSiteBenchmarks`.
8. Opportunity is the positive gap between the site and anchor multiplied by
   trailing three-month production revenue. Lower-is-better metrics use
   `site value - anchor value`; profitability uses `anchor value - site value`.
9. It ranks sites for each metric and scope into `readacross.PnlRankings`.
   Higher profitability ranks first; lower cost ratios rank first.

Formula reference:

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

Opportunity formulas:

```text
For lower-is-better metrics:
  gap = max(0, site_ratio - anchor_ratio)
  opportunity = gap * trailing_3m(production_sales)

For profitability:
  gap = max(0, anchor_profitability - site_profitability)
  opportunity = gap * trailing_3m(production_sales)
```

Example:

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

After P&L refreshes, run:

```bash
make recompute-pnl
```

### Dashboard Config

```text
DashboardMetaSnapshots + mapping/scoring tables
  -> DashboardConfigService
  -> GET /api/Insights/dashboard-config
  -> DashboardChromeService
  -> Header, Feedback, Wave links, Data Quality, P&L recommendation config
```

## Runtime Mapping And Recommendation Config

These tables define the runtime mappings and scoring parameters used by the
API and SPA. They are returned through `GET /api/Insights/dashboard-config`
under `mappingConfig`.

### 1. SQL Tables + Sample Values

Canonical tables:

- `readacross.MagnaDivisionAliases`
- `readacross.CosmaSubgroupMap`
- `readacross.ArchetypeMfgAllowed`
- `readacross.SpendCategoryMetricMap`
- `readacross.RecommendationScoring`

The idempotent seed/maintenance script is `sql/15_ui_runtime_tables.sql`.

Sample inspection query:

```sql
SELECT TOP (10) * FROM readacross.MagnaDivisionAliases ORDER BY MagnaDivision;
SELECT TOP (10) * FROM readacross.CosmaSubgroupMap ORDER BY SiteName;
SELECT TOP (10) * FROM readacross.ArchetypeMfgAllowed ORDER BY ArchetypeKey, MfgProcess;
SELECT TOP (10) * FROM readacross.SpendCategoryMetricMap ORDER BY SpendCategory, MetricKey;
SELECT TOP (1)  * FROM readacross.RecommendationScoring ORDER BY UpdatedAtUtc DESC;
```

Expected local row counts after seed:

| Table | Expected rows |
| --- | ---: |
| `MagnaDivisionAliases` | 4 |
| `CosmaSubgroupMap` | 56 |
| `ArchetypeMfgAllowed` | 31 |
| `SpendCategoryMetricMap` | 6 |
| `RecommendationScoring` | 1 |

### 2. Backend Wiring

Relevant files:

- DTO/contract:
  - `api/Models/DashboardConfigDto.cs`
  - `api/Models/DashboardConfigOptions.cs`
- Entities:
  - `api/Entities/MagnaDivisionAlias.cs`
  - `api/Entities/CosmaSubgroupMap.cs`
  - `api/Entities/ArchetypeMfgAllowed.cs`
  - `api/Entities/SpendCategoryMetricMap.cs`
  - `api/Entities/RecommendationScoring.cs`
- Data access:
  - `api/Data/MagnaDbContext.cs`
- Assembly logic:
  - `api/Services/DashboardConfigService.cs`
  - method: `BuildMappingConfigAsync`

The API response shape:

```json
{
  "mappingConfig": {
    "magnaDivisionAliases": {
      "Cosma": "cosma",
      "Powertrain": "powertrain",
      "Exteriors": "ignite",
      "Seating": "cosma"
    },
    "recommendationConfig": {
      "cosmaSubgroupMap": {},
      "archetypeMfgAllowed": {},
      "spendCategoryMetricMap": {},
      "scoring": {}
    }
  }
}
```

### 3. UI Wiring

Relevant files:

- `web/src/app/shared/models/read-across.models.ts`
  - `IDashboardConfig.mappingConfig`
  - `IMappingConfig.magnaDivisionAliases`
  - `IMappingConfig.recommendationConfig`
- `web/src/app/core/services/dashboard-chrome.service.ts`
  - exposes `magnaDivisionAliases`
  - exposes `recommendationConfig`
  - builds Wave links
- `web/src/app/core/services/pnl-rec.service.ts`
  - consumes `recommendationConfig`
  - calculates recommendation cards when the page needs client-side ranking

### Maintenance Runbook

For day-to-day changes, use:

- `APP_MAINTENANCE.md`
- section: `Runtime mapping/recommendation config tables`

## Backend/API

### Main Endpoints

| Method | Route | Returns |
| --- | --- | --- |
| `GET` | `/healthz` | health status |
| `GET` | `/api/Initiatives` | harmonized initiatives |
| `GET` | `/api/Initiatives/filter-options` | filter values |
| `GET` | `/api/Initiatives/subgroups` | subgroup/site rollups |
| `GET` | `/api/Initiatives/subgroups/coverage` | unmapped coverage report |
| `GET` | `/api/Aggregates/buckets` | bucket rollups |
| `GET` | `/api/Aggregates/heatmap` | heatmap cells |
| `GET` | `/api/Pnl` | raw P&L entries |
| `GET` | `/api/Pnl/summary` | grouped P&L summary |
| `GET` | `/api/Pnl/benchmarks` | SQL-derived P&L benchmark payload |
| `POST` | `/api/Pnl/recompute` | recompute derived P&L tables |
| `GET` | `/api/Insights/dashboard-config` | dashboard/config payload |
| `GET` | `/api/Insights/pnl-recommendations` | persisted recommendations |
| `GET` | `/api/Insights/thought-starters` | thought starters |
| `GET` | `/api/Insights/knowledge-center` | slide cards |
| `GET` | `/api/Insights/video-library` | video cards |

### DTO Traceability

| API DTO | Angular interface | Notes |
| --- | --- | --- |
| `InitiativeDto` | `IInitiative` | row-level harmonized initiative |
| `BucketRowDto` | `IBucketRow` | Initiative Overview |
| `HeatmapCellDto` | `IHeatmapCell` | Heatmap |
| `PnlBenchmarksDto` | `IPnlBenchmarks` | P&L Benchmarking |
| `PnlRecommendationDto` | `IPnlRecommendation` | P&L recommendations |
| `DashboardConfigDto` | `IDashboardConfig` | dashboard chrome + mapping config |

## Frontend/UI

### Routes

| Route | Page |
| --- | --- |
| `/buckets` | Initiative Overview |
| `/heatmap` | Heatmap |
| `/insights` | P&L Benchmarking, P&L Recommendations, Thought Starters, Knowledge Center, Videos |
| `/feedback` | Feedback form |

### Key Components And Services

- `HeaderComponent`: title, nav, search, data quality button.
- `FilterBarComponent`: workstream/category/stage/subgroup/archetype filters.
- `GlobalSearchComponent`: cross-page initiative search.
- `DrilldownDialogComponent`: initiative row details and CSV export.
- `LeverInsightsDialogComponent`: focused thought starters/slides/videos.
- `PnlBenchmarkingComponent`: P&L metrics and rankings.
- `InsightsPageComponent`: Insights tab container.
- `DashboardChromeService`: config, priority flags, Wave URLs.
- `FilterService`: global filter state.
- `PnlRecService`: recommendation card calculation helpers.

### Path Aliases

Configured in `web/tsconfig.json`:

- `@app/models`
- `@app/data-services`
- `@app/app-services`
- `@app/core-services`
- `@app/ui`
- `@domains/read-across`

## Slides & Videos

Source locations:

- Videos: `../magna-readacross/public/videos`
- Slides: `../gms-dashboard-main/magna-dashboard/public/slides`

Metadata sources:

- Slides: `../magna-readacross/public/slides.json`
- Videos: `VIDEO_LIBRARY` in `../magna-readacross/public/index.html`

Local served paths:

- `/slides/...`
- `/videos/...`

Bulk reload:

```bash
make ingest
```

The ingest process populates:

- `readacross.KnowledgeCenterAssets`
- `readacross.VideoLibraryAssets`

## Operations

### Local SQL

The local SQL Server container is exposed on:

| Setting | Value |
| --- | --- |
| Host | `localhost` |
| Port | `14333` |
| Database | `MagnaReadAcross` |
| Username | `sa` |
| Password | `Magna#Seed2026!` |

Host connection string:

```text
Server=localhost,14333;Database=MagnaReadAcross;User Id=sa;Password=Magna#Seed2026!;TrustServerCertificate=True;Encrypt=False;
```

In-container command pattern:

```bash
docker exec -i magna-readacross-sql /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P 'Magna#Seed2026!' -d MagnaReadAcross -C -Q \
  "SELECT TOP 5 * FROM readacross.MagnaDivisionAliases;"
```

### P&L Recompute

```bash
make recompute-pnl
```

Validate:

```bash
docker exec -i magna-readacross-sql /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P 'Magna#Seed2026!' -d MagnaReadAcross -C -Q \
  "SELECT COUNT(*) AS PnlSiteBenchmarks FROM readacross.PnlSiteBenchmarks;
   SELECT COUNT(*) AS PnlRecommendations FROM readacross.PnlRecommendations;
   SELECT COUNT(*) AS PnlRankings FROM readacross.PnlRankings;
   SELECT COUNT(*) AS PnlAnchors FROM readacross.PnlAnchors;"
```

### Subgroup Maintenance

Update:

- `readacross.SubgroupEntityMap`

Then run:

```bash
make backfill-subgroups
make coverage
```

### Docker Disk Cleanup

If API builds fail with `no space left on device`, safe cleanup:

```bash
docker builder prune -af
docker image prune -af
docker container prune -f
```

This avoids removing running containers and named volumes.

## Configuration Reference

### API

Files:

- `api/appsettings.json`
- `api/appsettings.Development.json`

Main sections:

- `ConnectionStrings:AzureSqlDb`
- `Cors:AllowedOrigins`
- `AzureAd`
- `AccessControl`
- `BlobDataset`
- `DashboardConfig`

`DashboardConfig` still owns deployment-time values such as:

- `FeedbackEmail`
- `WaveBaseUrls`
- workstream metadata defaults

Runtime recommendation/mapping values are table-backed, not appsettings-backed.

### Docker

`docker-compose.yml` runs:

- `api` on host port `5080`
- `web` on host port `4200`

The web container mounts the videos/slides directory into Nginx so the app can serve
large binaries without baking them into the image.

### SPA

Environment files:

- `web/src/environments/environment.ts`
- `web/src/environments/environment.prod.ts`

Both default `apiBaseUrl` to `/api`.

## Troubleshooting

### App is not reachable

```bash
docker compose ps
curl http://localhost:5080/healthz
curl -I http://localhost:4200
```

### Runtime config looks stale

1. Refresh the DB Explorer tree.
2. Confirm the runtime config tables have rows:

```sql
SELECT COUNT(*) FROM readacross.MagnaDivisionAliases;
SELECT COUNT(*) FROM readacross.CosmaSubgroupMap;
SELECT COUNT(*) FROM readacross.ArchetypeMfgAllowed;
SELECT COUNT(*) FROM readacross.SpendCategoryMetricMap;
SELECT COUNT(*) FROM readacross.RecommendationScoring;
```

3. Rebuild API:

```bash
docker compose -f docker-compose.yml --project-directory . up -d --build api
```

### P&L recommendations are empty

Check:

- `PnlEntries` has `Actual%`, `Periodic`, `HasData=1` rows.
- `PnlSiteBenchmarks`, `PnlRankings`, `PnlAnchors`, `PnlRecommendations` have rows.
- `POST /api/Pnl/recompute` succeeds.

### Subgroup filters are missing

Check:

- `SubgroupEntityMap` contains the site/division.
- Wave tables have populated `Subgroup`.
- `make backfill-subgroups` was run after ingest.
- `make coverage` does not report unresolved entities.

