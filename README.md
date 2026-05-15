# Magna Read-Across Dashboard v2

SQL-first rewrite of the Magna Read-Across dashboard. Cube-style P&L data and
Wave initiative exports flow into a single `readacross` schema, an EF Core
+ ASP.NET 8 API exposes harmonized DTOs, and an Angular 21 SPA renders the
Initiative Overview, Heatmap, Insights, and Feedback experiences.

```
┌──────────────────┐    HTTPS/JSON    ┌─────────────────┐    EF Core    ┌────────────────────┐
│ Angular SPA      │ ───────────────▶ │ ASP.NET 8 API   │ ────────────▶ │ Azure SQL          │
│ (web/, :4200)    │                  │ (api/, :5080)   │   AAD token   │ readacross schema  │
└──────────────────┘                  └─────────────────┘               └────────────────────┘
```

---

## Table of contents

- [Repository layout](#repository-layout)
- [Quick start](#quick-start)
- [SQL data model](#sql-data-model)
  - [readacross.PnlEntries](#readacrosspnlentries)
  - [readacross.CosmaWaveInitiatives](#readacrosscosmawaveinitiatives)
  - [readacross.PowertrainWaveInitiatives](#readacrosspowertrainwaveinitiatives)
  - [readacross.ExteriorsWaveInitiatives](#readacrossexteriorswaveinitiatives)
  - [readacross.SeatingWaveInitiatives](#readacrossseatingwaveinitiatives)
  - [readacross.SubgroupEntityMap](#readacrosssubgroupentitymap)
  - [readacross.ArchetypeDefinitions / SiteArchetypes / PriorityInitiatives](#readacrossarchetypedefinitions--sitearchetypes--priorityinitiatives)
  - [readacross.ThoughtStarters](#readacrossthoughtstarters)
  - [readacross.PnlRecommendations](#readacrosspnlrecommendations)
  - [readacross.KnowledgeCenterAssets](#readacrossknowledgecenterassets)
  - [readacross.VideoLibraryAssets](#readacrossvideolibraryassets)
- [Ingestion pipeline](#ingestion-pipeline)
- [API contracts](#api-contracts)
- [Data contracts at a glance](#data-contracts-at-a-glance)
  - [DTO catalogue](#dto-catalogue)
  - [Endpoint → DTO map](#endpoint--dto-map)
  - [DB → DTO traceability](#db--dto-traceability)
  - [Subgroup data flow (worth calling out)](#subgroup-data-flow-worth-calling-out)
- [Frontend architecture](#frontend-architecture)
  - [Routing](#routing)
  - [Components](#components)
  - [Services](#services)
  - [Path aliases](#path-aliases)
  - [Cross-cutting UX (drilldown, search, click-throughs)](#cross-cutting-ux-drilldown-search-click-throughs)
- [Slides & videos](#slides--videos)
  - [End-to-end rendering chain](#end-to-end-rendering-chain)
  - [Add a new slide deck (Knowledge Center)](#add-a-new-slide-deck-knowledge-center)
  - [Add a new video (Video Library)](#add-a-new-video-video-library)
  - [Removing or replacing an asset](#removing-or-replacing-an-asset)
- [Operations cookbook](#operations-cookbook)
- [Configuration reference](#configuration-reference)

---

## Repository layout

```
magna-readacross-v2/
├── api/                    .NET 8 API (controllers / services / EF entities)
│   ├── Controllers/        REST controllers (5 surface areas)
│   ├── Data/               MagnaDbContext (default schema = readacross)
│   ├── Entities/           EF entities for each readacross.* table
│   ├── Models/             DTOs returned to the SPA
│   ├── Services/           Domain services (initiatives / aggregates / insights)
│   ├── Program.cs          DI, AAD token wiring, CORS, Swagger
│   └── appsettings.json    Connection string + CORS allow-list
├── web/                    Angular 21 SPA
│   └── src/app/
│       ├── app.component.ts        Shell (header + filter bar + router-outlet + 3 root dialogs)
│       ├── app.routes.ts            Lazy-loads the read-across domain
│       ├── core/services/           Cross-cutting singletons (signal-based):
│       │                            FilterService, DashboardChromeService,
│       │                            DrilldownService, ArchetypeService,
│       │                            InitiativeCacheService
│       ├── domains/read-across/     Domain barrel + feature routes
│       ├── features/                Page-level components (4 pages)
│       └── shared/
│           ├── components/          Header, FilterBar, Pill, GlobalSearch,
│           │                        DrilldownDialog, ArchetypeLegendDialog,
│           │                        DataQualityDialog
│           ├── data-services/       HTTP gateway → API
│           ├── models/              TypeScript shapes mirroring the DTOs
│           └── pipes/               Number / dollar / percent formatters
├── sql/                    Schema + deterministic seed / backfill scripts
│   ├── 01_schema.sql               Tables, indexes, FKs (readacross.*)
│   ├── 02_seed_pnl.sql             Demo PnlEntries rows
│   ├── 03_seed_wave.sql            Demo Wave initiative rows (3 tables)
│   ├── 04_seed_mapping_insights.sql Archetypes / SiteArchetypes / Insights
│   ├── 05_backfill_subgroups.sql   Idempotent UPDATE filling Subgroup
│   │                               on the 3 Wave tables (post-ingest)
│   ├── 06_seed_priority_initiatives.sql
│   │                               Top-NRB rows per workstream → demo
│   │                               Best Practice Candidate flags
│   └── 07_seed_subgroup_entity_map.sql
│                                   Baseline site/division → subgroup seed
├── scripts/                Python ingestion + media sync
├── docker-compose.yml      Spins up api + web; bind-mounts real
│                           video/slide assets into the web container
└── Makefile                One-line build / up / down / ingest
```

---

## Quick start

```bash
# 1. Bring up SQL (host-side container on port 14333) and run the schema scripts
sqlcmd -S localhost,14333 -U sa -P 'Magna#Seed2026!' -d MagnaReadAcross \
       -i sql/01_schema.sql -i sql/02_seed_pnl.sql \
       -i sql/03_seed_wave.sql -i sql/04_seed_mapping_insights.sql

# 2. (Optional) Refresh from the legacy artifacts (Wave Excel, slides, videos)
make ingest

# 3. Seed managed subgroup mappings + backfill Subgroup + seed demo Best Practice candidates.
#    These four scripts are idempotent and safe to re-run after every `make ingest`:
#      07 → INSERT missing baseline rows into SubgroupEntityMap (no overwrite)
#      05 → UPDATE Subgroup on Cosma / Powertrain / Exteriors / Seating rows
#      06 → INSERT top 5 NRB rows per workstream into PriorityInitiatives
#      08 → INSERT 343 Seating Wave initiatives mirroring the legacy
#           dashboard_data.json (idempotent — DELETE + INSERT)
sqlcmd -S localhost,14333 -U sa -P 'Magna#Seed2026!' -d MagnaReadAcross \
       -i sql/07_seed_subgroup_entity_map.sql \
       -i sql/08_seed_seating_wave.sql \
       -i sql/05_backfill_subgroups.sql \
       -i sql/06_seed_priority_initiatives.sql

# 4. Build + start the API and SPA
make build
make up

# Handy Make targets while iterating:
#   make seed-seating-wave   # apply sql/08_seed_seating_wave.sql + backfill subgroups
#   make backfill-subgroups  # rerun sql/05_backfill_subgroups.sql against all 4 wave tables
#   make coverage            # GET /api/Initiatives/subgroups/coverage (pretty-print)
#   make sql-shell           # interactive sqlcmd inside the SQL container

# Visit
#   http://localhost:4200   Angular SPA
#   http://localhost:5080   API (Swagger at /swagger in Development)
```

---

## SQL data model

All tables live in schema `readacross`. The full DDL is in `sql/01_schema.sql`.
Below is a column-level reference plus a representative seed row for each table
(taken verbatim from `sql/02_seed_pnl.sql`, `sql/03_seed_wave.sql`,
`sql/04_seed_mapping_insights.sql`).

Three additional **idempotent** scripts run after every full reload to keep
the SPA's filter rail and Best Practice chips populated:

- `sql/07_seed_subgroup_entity_map.sql` — INSERTs the baseline curated
  site/division → subgroup mappings into `SubgroupEntityMap` (without
  overwriting rows your team already maintains).
- `sql/05_backfill_subgroups.sql` — UPDATEs `Subgroup` on the three Wave
  tables using `SubgroupEntityMap` first, then falls back to deterministic
  prefix parsing for Powertrain/Exteriors.
- `sql/06_seed_priority_initiatives.sql` — TRUNCATE + INSERT the top 5 NRB
  rows per workstream into `PriorityInitiatives` so the green Best Practice
  chip on Insights cards has a real demo subset.

See [Data contracts at a glance → Subgroup data flow](#subgroup-data-flow-worth-calling-out)
for an end-to-end picture of how Subgroup propagates from disk → SPA pill.

### `readacross.PnlEntries`

Hyperion-style P&L cube fact rows. One row = one (`Cube`, `Entity`, `Scenario`,
`Time`, `Account`, `UD1..UD8`) intersection. Drives the Insights → P&L
Benchmarking ranking view.

| Column        | Type            | Nullable | Notes                                          |
| ------------- | --------------- | -------- | ---------------------------------------------- |
| PnlEntryId    | `BIGINT IDENTITY` | PK     | Surrogate key                                   |
| Cube          | `NVARCHAR(64)`  | no       | `Cosma` / `Powertrain` / `Exteriors`            |
| Entity        | `NVARCHAR(128)` | no       | Site code (e.g. `COSMABRAZILIUM`)               |
| Parent        | `NVARCHAR(128)` | yes      | Parent rollup (`COSMA_LATAM`, `PT_NA`, …)       |
| Cons          | `NVARCHAR(32)`  | yes      | Reporting currency                              |
| Scenario      | `NVARCHAR(64)`  | no       | `Budget26`, `Actual25`, …                       |
| Time          | `NVARCHAR(32)`  | no       | Period (`2025M1`)                               |
| View          | `NVARCHAR(32)`  | yes      | `Periodic` / `YTD`                              |
| Account       | `NVARCHAR(128)` | no       | `Top` (revenue) / `Direct Labor (DL)` / …       |
| Origin        | `NVARCHAR(64)`  | yes      | Cube dimension                                  |
| IC            | `NVARCHAR(64)`  | yes      | Inter-company flag                              |
| UD1..UD8      | `NVARCHAR(128)` | yes      | User-defined cube dimensions                    |
| Amount        | `DECIMAL(20,4)` | no       | Posted amount                                   |
| HasData       | `BIT`           | no       | Filter for empty cube intersections             |
| Annotation, Assumptions, AuditComm, Footnote, VarianceExp | `NVARCHAR(MAX)` | yes | Free-text cube metadata |
| LoadedAtUtc   | `DATETIME2(0)`  | no       | Defaults to `SYSUTCDATETIME()`                  |

Indexes: `(Cube, Entity, Time)`, `(Scenario, Account)`, `(Account)`.

**Sample row**

| Cube  | Entity         | Parent       | Cons | Scenario | Time   | View     | Account                  | UD8           | Amount     |
| ----- | -------------- | ------------ | ---- | -------- | ------ | -------- | ------------------------ | ------------- | ---------- |
| Cosma | COSMABRAZILIUM | COSMA_LATAM  | USD  | Budget26 | 2025M1 | Periodic | Direct Labor (DL)        | Adjusted_USI  | 435,223.79 |
| Cosma | COSMABRAZILIUM | COSMA_LATAM  | USD  | Budget26 | 2025M1 | Periodic | Material Conveyance (MC) | Adjusted_USI  | 88,210.00  |

### `readacross.CosmaWaveInitiatives`

Cosma Wave initiative export. Mirrors the Excel columns plus enrichment fields
the dashboard needs (NRB, taxonomy, archetypes).

| Column            | Type            | Notes                                                         |
| ----------------- | --------------- | ------------------------------------------------------------- |
| InitiativeId (PK) | `NVARCHAR(64)`  | Wave identifier (`CO-1001`)                                   |
| Name              | `NVARCHAR(512)` | Display title                                                 |
| Description       | `NVARCHAR(MAX)` |                                                               |
| Stage             | `NVARCHAR(64)`  | `L2`, `L3`, `L4`, `L5 (Realised)`, `Submitted for L4`, …      |
| Access            | `NVARCHAR(64)`  | `Open` / `Restricted`                                         |
| InitiativeOwner   | `NVARCHAR(256)` |                                                               |
| Site              | `NVARCHAR(128)` | `Cosma Brazil`, `Cosma USA East`, …                           |
| Subgroup          | `NVARCHAR(64)`  | `Cosma LATAM` / `Cosma NA` / `Cosma EU` / `Cosma APAC`        |
| SpendCategory     | `NVARCHAR(64)`  | `DL` / `IDL` / `Material Conveyance` / `VOH`                  |
| MfgProcess        | `NVARCHAR(64)`  | `Assembly`, `Cold stamp`, `Casting`, `Hot form`, …            |
| Lever             | `NVARCHAR(256)` | Lever taxonomy                                                |
| SubLever          | `NVARCHAR(256)` |                                                               |
| Nrb               | `DECIMAL(20,2)` | Net run-rate benefit ($)                                      |
| IsCategorized     | `BIT`           | Excludes uncategorized rows from rollups                      |
| Archetypes        | `NVARCHAR(512)` | Comma-delimited (`Framing,Assembly`)                          |
| LoadedAtUtc       | `DATETIME2(0)`  |                                                               |

Indexes: `(SpendCategory)`, `(Site)`.

**Sample row**

| InitiativeId | Name                                       | Stage | Site         | Subgroup     | SpendCategory | MfgProcess | Lever                                              | Nrb       | Archetypes        |
| ------------ | ------------------------------------------ | ----- | ------------ | ------------ | ------------- | ---------- | -------------------------------------------------- | --------- | ----------------- |
| CO-1001      | Robotic weld cell rebalance — Brazil L2    | L3    | Cosma Brazil | Cosma LATAM  | DL            | Assembly   | (Automation) Utilization and man-machine ratio      | 1,250,000 | Framing,Assembly  |

### `readacross.PowertrainWaveInitiatives`

Same shape as Cosma minus `Archetypes` (Powertrain doesn't expose archetypes
in the legacy data). `Subgroup` values: `PT - APAC` / `PT - EU` / `PT - NA`.

**Sample row**

| InitiativeId | Name                              | Stage | Site    | Subgroup | SpendCategory | MfgProcess | Lever | Nrb       |
| ------------ | --------------------------------- | ----- | ------- | -------- | ------------- | ---------- | ----- | --------- |
| PT-2001      | AC01 e-axle line OEE improvement  | L4    | PT AC01 | PT - NA  | DL            | Assembly   | OEE   | 1,820,000 |

### `readacross.ExteriorsWaveInitiatives`

Identical to Powertrain except the location column is named `Division` instead
of `Site` (the legacy Exteriors export uses the division grain). `Subgroup`
values: `Ext - AP` / `Ext - EU` / `Ext - NA`.

**Sample row**

| InitiativeId | Name                              | Stage | Division | Subgroup | SpendCategory | MfgProcess | Lever       | Nrb     |
| ------------ | --------------------------------- | ----- | -------- | -------- | ------------- | ---------- | ----------- | ------- |
| EX-3001      | Troy paint line cycle time         | L4    | Troy USA | Ext - NA | DL            | E-coat     | Cycle time  | 980,000 |

### `readacross.SeatingWaveInitiatives`

Seating Wave initiative export. Same shape as Powertrain — sites are written
in the legacy `"<NA|EU|CN*> - <Site>"` format so the prefix-fallback
inferer can map a row to one of the three Seating subgroups
(`Seat - NA` / `Seat - EU` / `Seat - CN`) when an explicit
`SubgroupEntityMap` row is not yet maintained. Seating initiative IDs do
not have a Wave deep-link, so the drilldown renders them as plain text
(parity with the legacy `magna-readacross/public/index.html`).

**Sample row**

| InitiativeId | Name                                | Stage | Site            | Subgroup    | SpendCategory | MfgProcess     | Lever                  | Nrb     |
| ------------ | ----------------------------------- | ----- | --------------- | ----------- | ------------- | -------------- | ---------------------- | ------- |
| SE-4001      | Foam line scrap reduction (NA)      | L3    | NA - Highland   | Seat - NA   | DL            | Foam molding   | Scrap & yield          | 540,000 |
| SE-4101      | Trim cell takt time uplift (CN)     | L4    | CN-East - Suzhou| Seat - CN   | DL            | Trim assembly  | Cycle time             | 380,000 |

### `readacross.SubgroupEntityMap`

Managed lookup table for entity (site/division) → subgroup assignments. This is
the table to update when hierarchy changes are introduced each quarter.

| Column               | Type               | Notes                                                     |
| -------------------- | ------------------ | --------------------------------------------------------- |
| SubgroupEntityMapId  | `BIGINT IDENTITY`  | PK                                                        |
| Workstream           | `NVARCHAR(64)`     | `Cosma` / `Powertrain` / `Exteriors` / `Seating`         |
| EntityName           | `NVARCHAR(128)`    | Site (Cosma/PT/Seating) or Division (Exteriors)          |
| Subgroup             | `NVARCHAR(64)`     | Canonical subgroup label shown in filter options          |
| IsActive             | `BIT`              | Soft enable/disable mapping rows                          |
| Notes                | `NVARCHAR(256)`    | Optional maintenance comment                              |
| UpdatedAtUtc         | `DATETIME2(0)`     | Last row update timestamp (default `SYSUTCDATETIME()`)   |

Unique key: (`Workstream`, `EntityName`).

### `readacross.ArchetypeDefinitions` / `SiteArchetypes` / `PriorityInitiatives`

Mapping tables that drive the archetype filter pills, site-archetype
relationships, and priority/best-practice flags.

```
ArchetypeDefinitions ─┐
   ArchetypeKey (PK) ─┼─< SiteArchetypes (SiteName, ArchetypeKey, Workstream)
                      │
                      └─ used by Cosma archetype filter UI
PriorityInitiatives    InitiativeId (PK) → flags an initiative as
                       "Best Practice Candidate" / "Benchmark Candidate"
```

**Sample rows**

| ArchetypeKey | DisplayName              | Workstream | Description                                  |
| ------------ | ------------------------ | ---------- | -------------------------------------------- |
| Framing      | Framing                  | Cosma      | High automation and BIW framing footprint    |
| LargeClassA  | Large Class A Facilities | Cosma      | Large footprint Class A facilities           |

| SiteName       | ArchetypeKey | Workstream |
| -------------- | ------------ | ---------- |
| Cosma Brazil   | Casting      | Cosma      |
| Cosma USA East | Framing      | Cosma      |

| InitiativeId | PriorityLabel             | Workstream |
| ------------ | ------------------------- | ---------- |
| CO-1001      | Best Practice Candidate   | Cosma      |
| PT-2001      | Benchmark Candidate       | Powertrain |

### `readacross.ThoughtStarters`

Coaching prompts surfaced on the Insights → Thought Starters tab, scoped by
the same taxonomy (`SpendCategory` / `MfgProcess` / `Lever` / `SubLever`) the
heatmap uses.

| Column             | Type            | Notes                                       |
| ------------------ | --------------- | ------------------------------------------- |
| ThoughtStarterId   | `BIGINT IDENTITY` | PK                                        |
| SpendCategory      | `NVARCHAR(64)`  |                                             |
| MfgProcess         | `NVARCHAR(64)`  |                                             |
| Lever / SubLever   | `NVARCHAR(256)` |                                             |
| Text               | `NVARCHAR(MAX)` | Prompt text                                 |
| AdvancedAutomation | `NVARCHAR(128)` | Free-text "Advanced Automation" label (e.g. `Cobot load/unload`, `Camera inspect`) — surfaced as a secondary pill in the Lever Insights dialog. `NULL` when not tagged. |
| IsActive           | `BIT`           | Soft-delete flag                            |
| SortOrder          | `INT`           |                                             |

**Sample row**

| SpendCategory | Lever                                       | Text                                                                                          | AdvancedAutomation |
| ------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------ |
| DL            | (Automation) Utilization and man-machine ratio | What would it take to increase robot utilization by 10 points in the top downtime cell?       | true               |

### `readacross.PnlRecommendations`

Per-site recommendations rendered on Insights → P&L-Informed Recommendations.

| Column              | Type            | Notes                                         |
| ------------------- | --------------- | --------------------------------------------- |
| PnlRecommendationId | `BIGINT IDENTITY` | PK                                          |
| Workstream          | `NVARCHAR(64)`  | `Cosma` / `Powertrain` / `Exteriors`          |
| Site                | `NVARCHAR(128)` | Site name                                     |
| Archetype           | `NVARCHAR(128)` | Optional archetype scope                      |
| InitiativeId        | `NVARCHAR(64)`  | Source initiative for the recommendation      |
| RecommendationText  | `NVARCHAR(MAX)` |                                               |
| OpportunityAmount   | `DECIMAL(20,2)` | $ value                                       |
| PriorityRank        | `INT`           | 1 = highest                                   |
| IsActive            | `BIT`           |                                               |

**Sample row**

| Workstream | Site           | Archetype | InitiativeId | RecommendationText                                                                          | OpportunityAmount | Rank |
| ---------- | -------------- | --------- | ------------ | ------------------------------------------------------------------------------------------- | ----------------- | ---- |
| Cosma      | Cosma USA East | Framing   | CO-1006      | Scale casting OEE playbook from top-performing line and enforce downtime pareto rituals.     | 1,250,000         | 1    |

### `readacross.KnowledgeCenterAssets`

Slide deck library, surfaced on Insights → Knowledge Center.
See [Slides & videos](#slides--videos) for the full rendering chain and the
workflow for adding new decks.

| Column           | Type             | Notes                              |
| ---------------- | ---------------- | ---------------------------------- |
| KnowledgeAssetId | `BIGINT IDENTITY` | PK                               |
| Title            | `NVARCHAR(256)`  |                                    |
| SpendCategory    | `NVARCHAR(64)`   | Optional taxonomy filter           |
| Workstream       | `NVARCHAR(64)`   |                                    |
| Description      | `NVARCHAR(MAX)`  |                                    |
| SlideUrl         | `NVARCHAR(1024)` | `/slides/<file>` after media sync  |
| ThumbnailUrl     | `NVARCHAR(1024)` |                                    |
| SortOrder        | `INT`            |                                    |
| IsActive         | `BIT`            |                                    |

### `readacross.VideoLibraryAssets`

Video assets, surfaced on Insights → Video Library. Same shape as
`KnowledgeCenterAssets` plus a `DurationSeconds` column. Seeded URLs follow
the `/videos/<file>` convention after the media sync runs. See
[Slides & videos](#slides--videos) for the rendering chain and the
workflow for adding new clips.

---

## Ingestion pipeline

Two scripts under `scripts/` reload the database and the static media tree
from the original artifacts.

### `scripts/ingest_from_original_artifacts.py`

Reads:

- `gms-dashboard-main/magna-dashboard/public/dashboard_data.json`
- `gms-dashboard-main/magna-dashboard/public/slides.json`
- `magna-readacross/public/index.html` (`VIDEO_LIBRARY` array)

Writes (full reload — `DELETE` before `INSERT`):

- Wave tables ← `dashboard_data.json.initiatives`
- `ThoughtStarters` ← `dashboard_data.json.thought_starters`
- `PnlRecommendations` ← `dashboard_data.json.pnl_recommendations.sites[*].recommendations`
- `ArchetypeDefinitions` + `SiteArchetypes` ← `archetypes` / `site_archetypes`
- `KnowledgeCenterAssets` ← `slides.json`
- `VideoLibraryAssets` ← `VIDEO_LIBRARY`

Notable transforms:

- Stage column widened to fit values like `Submitted for L4` and `L5 (Realised)`.
- `SlideUrl` normalized to `/slides/<filename>`, `VideoUrl` to `/videos/<filename>`.
- Uses `sqlcmd -b` so the run fails fast on any SQL error.

### `scripts/sync_media_assets.py`

Copies slides and videos into the Angular asset tree before the web container
is built:

| Source                                                       | Destination                  | Served at  |
| ------------------------------------------------------------ | ---------------------------- | ---------- |
| `gms-dashboard-main/magna-dashboard/public/slides`           | `web/src/assets/slides`      | `/slides/*` |
| `magna-readacross/public/videos`                             | `web/src/assets/videos`      | `/videos/*` |

Both scripts are wired into `make ingest` and `make ingest-and-restart`.

---

## API contracts

Base URL: `http://localhost:5080`. All routes are anonymous (auth lives at the
Azure SQL layer via AAD). JSON responses use camelCase property names.

### Health

```
GET /healthz
→ 200 { "status": "ok", "utc": "2026-05-03T13:34:08Z" }
```

### Initiatives — `api/Controllers/InitiativesController.cs`

```
GET /api/Initiatives
    ?workstream=Cosma&workstream=Powertrain
    &spendCategory=DL&spendCategory=IDL
    &stage=L3&stage=L4
    &subgroup=USA%20East
    &archetype=Framing
→ 200 InitiativeDto[]

GET /api/Initiatives/filter-options
→ 200 FilterOptionsDto

GET /api/Initiatives/subgroups
→ 200 SubgroupDto[]

GET /api/Initiatives/subgroups/coverage
→ 200 SubgroupCoverageDto[]
```

```ts
// InitiativeDto (api/Models/InitiativeDto.cs)
{
  id: string;                      // "10154"
  name?: string;
  description?: string;
  workstream: 'Cosma' | 'Powertrain' | 'Exteriors' | 'Seating';
  site?: string;                   // "BGM" / "APAC - MPJ" / "EU - Liberec" / "NA - Highland"
  subgroup?: string;               // "USA East" / "PT - APAC" / "Ext - EU" / "Seat - NA"
                                   // — sourced from the Subgroup column,
                                   //   populated via SubgroupEntityMap + sql/05_backfill_subgroups.sql
  owner?: string;
  stage?: string;                  // "L3 (Planned)"
  access?: string;                 // "Open" | "Restricted" | "General" | "Confidential"
                                   // — drilldown hides Confidential rows
  nrb: number;                     // 1_250_000
  spendCategory?: string;          // "DL" | "IDL" | "Material Conveyance" | "VOH"
  mfgProcess?: string;
  lever?: string;
  subLever?: string;
  isCategorized: boolean;
  archetypes: string[];            // ["Framing", "Assembly"] — Cosma only today
}

// FilterOptionsDto — distinct values for every global filter pill
{
  workstreams: string[];           // ["Cosma", "Powertrain", "Exteriors", "Seating"]
  spendCategories: string[];       // ["DL", "IDL", "Material Conveyance", "VOH"]
  stages: string[];                // ["L2 (Validated)", …, "Submitted for L3 approval"]
  subgroups: string[];             // 18 entries: 9 Cosma + 3 PT + 3 Ext + 3 Seat
  archetypes: string[];            // 7 Cosma archetype keys
  sites: string[];                 // every Site/Division across the 4 Wave tables
}

// SubgroupDto (api/Models/SubgroupDto.cs) — one row per (Workstream, Subgroup)
{
  subgroup: string;                // "USA East"
  workstream: string;              // "Cosma"
  initiativeCount: number;         // 142
  sites: string[];                 // ["Autolaunch", "BGM", "CBAM", "Eagle Bend", "Vehtek"]
}

// SubgroupCoverageDto (api/Models/SubgroupCoverageDto.cs) — hierarchy maintenance health check
{
  workstream: string;                  // "Cosma"
  totalRows: number;                   // 810
  missingStoredSubgroupRows: number;   // 4
  missingEffectiveSubgroupRows: number;// 1
  unmappedEntities: string[];          // ["New Site Name"]
}
```

### Aggregates — `api/Controllers/AggregatesController.cs`

```
GET /api/Aggregates/buckets?workstream=Cosma
→ 200 BucketRowDto[]

GET /api/Aggregates/heatmap?workstream=Cosma
→ 200 HeatmapCellDto[]
```

```ts
// BucketRowDto — one row per (SpendCategory, MfgProcess, Lever, SubLever)
{
  spendCategory: string;           // "DL"
  mfgProcess?: string;
  lever?: string;
  subLever?: string;
  countTotal: number;              // 253
  nrbTotal: number;                // 4_300_000
  byWorkstream: {                  // keyed by workstream name
    Cosma:      { count: 142, nrb: 2_100_000 },
    Powertrain: { count:  61, nrb: 1_300_000 },
    Exteriors:  { count:  50, nrb:   900_000 },
    Seating:    { count:  18, nrb:   320_000 },
  }
}

// HeatmapCellDto — one row per (taxonomy × workstream × site)
{
  spendCategory: string;
  mfgProcess?: string;
  lever?: string;
  subLever?: string;
  workstream: string;              // "Cosma"
  site?: string;                   // "Cosma Brazil"
  count: number;                   // 6
  nrb: number;                     // 740_000
}
```

### P&L — `api/Controllers/PnlController.cs`

```
GET /api/Pnl
    ?cube=Cosma&entity=COSMABRAZILIUM
    &scenario=Budget26&time=2025M1
    &account=Direct%20Labor%20(DL)
    &take=500&skip=0
→ 200 PnlEntry[]   // raw fact rows (capped at 5000)

GET /api/Pnl/summary?cube=Cosma&scenario=Budget26&time=2025M1
→ 200 PnlSummaryRow[]  // grouped by Cube/Entity/Scenario/Time/Account

GET /api/Pnl/benchmarks
→ 200 PnlBenchmarksDto // SQL-derived monthly_pnl + benchmarks + rankings

POST /api/Pnl/recompute
→ 200 { durationMs, benchmarkCount, recommendationCount } // recalculates derived P&L tables
```

```ts
// PnlSummaryRow — drives the Insights → P&L Benchmarking rank tiles
{
  cube:     string;   // "Cosma"
  entity:   string;   // "COSMABRAZILIUM"
  scenario: string;   // "Budget26"
  time:     string;   // "2025M1"
  account:  string;   // "Direct Labor (DL)"
  amount:   number;   // 435223.79
}
```

### Wave (raw passthrough) — `api/Controllers/WaveController.cs`

```
GET /api/wave/cosma                 → 200 CosmaWaveInitiative[]
GET /api/wave/cosma/{id}            → 200 | 404
GET /api/wave/powertrain            → 200 PowertrainWaveInitiative[]
GET /api/wave/powertrain/{id}       → 200 | 404
GET /api/wave/exteriors             → 200 ExteriorsWaveInitiative[]
GET /api/wave/exteriors/{id}        → 200 | 404
GET /api/wave/seating               → 200 SeatingWaveInitiative[]
GET /api/wave/seating/{id}          → 200 | 404
```

These return the EF entity shape 1:1 (column casing → camelCase via the JSON
serializer), useful for QA and admin tooling. The SPA does not call them — it
goes through `/api/Initiatives` for harmonized data.

### Insights — `api/Controllers/InsightsController.cs`

```
GET /api/Insights/thought-starters       → ThoughtStarterDto[]
GET /api/Insights/pnl-recommendations    → PnlRecommendationDto[]
GET /api/Insights/knowledge-center       → KnowledgeCenterAssetDto[]
GET /api/Insights/video-library          → VideoLibraryAssetDto[]
GET /api/Insights/archetypes             → ArchetypeDefinitionDto[]
GET /api/Insights/site-archetypes        → SiteArchetypeDto[]
GET /api/Insights/priority-initiatives   → PriorityInitiativeDto[]
GET /api/Insights/dashboard-config       → DashboardConfigDto
```

DTO shapes (see `api/Models/InsightsDtos.cs` and `api/Models/DashboardConfigDto.cs`):

```ts
ThoughtStarterDto       { thoughtStarterId, spendCategory?, mfgProcess?, lever?, subLever?, text, advancedAutomation, sortOrder }
PnlRecommendationDto    { pnlRecommendationId, workstream, site, archetype?, initiativeId?, recommendationText, opportunityAmount?, priorityRank, spendCategory?, primaryDriver?, siteValue?, benchmarkMedian?, quartile?, whitespaceEstimate?, deploymentCount?, deployingDivisions[], anchorMatch?, priorityCount?, priorityFraction?, evidenceStrength?, confidence?, rationale?, computedAtUtc }
KnowledgeCenterAssetDto { knowledgeAssetId, title, spendCategory?, workstream?, description?, slideUrl, thumbnailUrl?, sortOrder }
VideoLibraryAssetDto    { videoAssetId, title, spendCategory?, workstream?, description?, videoUrl, thumbnailUrl?, durationSeconds?, sortOrder }
ArchetypeDefinitionDto  { archetypeKey, displayName, workstream, description? }
SiteArchetypeDto        { siteArchetypeId, siteName, archetypeKey, workstream }
PriorityInitiativeDto   { initiativeId, priorityLabel, workstream? }

// DashboardConfigDto — top-level chrome the SPA boot-loads once.
{
  generated: string;                       // ISO snapshot timestamp
  feedbackEmail: string;                   // mailto: target for the Feedback page
  waveBaseUrls: { cosma: string; powertrain: string; ignite: string };
  workstreams: {                           // keyed by Cosma / Powertrain / Exteriors
    [name: string]: {
      label: string;
      shortName?: string;
      sourceFile?: string;
      sourceTab?: string;
      validationNote?: string;
      coverage?: { totalRows: number; categorizedRows: number; uncategorizedRows: number };
      excludedStages?: string[];
      excludedAccess?: string[];
    };
  };
}
```

P&L benchmarking data flow now runs entirely from SQL:

- Raw facts: `readacross.PnlEntries`
- Mapping metadata: `readacross.PnlAccountMap`, `readacross.PnlSiteDim`
- Derived outputs: `readacross.PnlSiteBenchmarks`, `readacross.PnlAnchors`, `readacross.PnlRankings`, enriched `readacross.PnlRecommendations`
- API projection: `GET /api/Pnl/benchmarks` via `PnlBenchmarkService` (no `api/Resources/pnl-benchmarks.json`)

`DashboardMetaSnapshots` is now the runtime metadata store for `dashboard-config`.
`DashboardSnapshots` is legacy-only and no longer serves P&L runtime sections.

The SPA fetches this once at boot via `DashboardChromeService.bootAsync()` and
exposes the result through signals (`config`, `priorityIds`, `feedbackEmail`,
`generated`, `lastRefreshedAt`). The Data Quality dialog's "Refresh" button
calls `refreshAsync()` to re-pull `dashboard-config` + `priority-initiatives`
without reloading the SPA.

---

## Data contracts at a glance

Every wire shape in one place, indexed by HTTP route and by source file.
The C# DTOs (under `api/Models/`) are the source of truth; the SPA's
`web/src/app/shared/models/read-across.models.ts` mirrors them with the same
field names in camelCase and an `I` prefix on every interface
(per `magna-readacross/FrontendInstructions.md`).

### DTO catalogue

| C# DTO                       | TypeScript interface          | Source file                              |
| ---------------------------- | ----------------------------- | ---------------------------------------- |
| `InitiativeDto`              | `IInitiative`                 | `api/Models/InitiativeDto.cs`            |
| `FilterOptionsDto`           | `IFilterOptions`              | `api/Models/FilterOptionsDto.cs`         |
| `SubgroupDto`                | `ISubgroup`                   | `api/Models/SubgroupDto.cs`              |
| `SubgroupCoverageDto`        | _(admin endpoint; no SPA type today)_ | `api/Models/SubgroupCoverageDto.cs` |
| `BucketRowDto`               | `IBucketRow`                  | `api/Models/BucketRowDto.cs`             |
| `HeatmapCellDto`             | `IHeatmapCell`                | `api/Models/HeatmapCellDto.cs`           |
| `PnlEntry`                   | `IPnlEntry`                   | `api/Entities/PnlEntry.cs` (raw entity)  |
| `PnlSummaryRow`              | `IPnlSummaryRow`              | `api/Models/PnlSummaryRow.cs`            |
| `ThoughtStarterDto`          | `IThoughtStarter`             | `api/Models/InsightsDtos.cs`             |
| `PnlRecommendationDto`       | `IPnlRecommendation`          | `api/Models/InsightsDtos.cs`             |
| `KnowledgeCenterAssetDto`    | `IKnowledgeCenterAsset`       | `api/Models/InsightsDtos.cs`             |
| `VideoLibraryAssetDto`       | `IVideoLibraryAsset`          | `api/Models/InsightsDtos.cs`             |
| `ArchetypeDefinitionDto`     | `IArchetypeDefinition`        | `api/Models/InsightsDtos.cs`             |
| `SiteArchetypeDto`           | `ISiteArchetype`              | `api/Models/InsightsDtos.cs`             |
| `PriorityInitiativeDto`      | `IPriorityInitiative`         | `api/Models/InsightsDtos.cs`             |
| `DashboardConfigDto`         | `IDashboardConfig`            | `api/Models/DashboardConfigDto.cs`       |
| `WorkstreamMetaDto`          | `IWorkstreamMeta`             | `api/Models/DashboardConfigDto.cs`       |

### Endpoint → DTO map

| Method | Route                                       | Returns                              |
| ------ | ------------------------------------------- | ------------------------------------ |
| GET    | `/healthz`                                  | `{ status, utc }`                    |
| GET    | `/api/Initiatives`                          | `InitiativeDto[]`                    |
| GET    | `/api/Initiatives/filter-options`           | `FilterOptionsDto`                   |
| GET    | `/api/Initiatives/subgroups`                | `SubgroupDto[]` (new)                |
| GET    | `/api/Initiatives/subgroups/coverage`       | `SubgroupCoverageDto[]`              |
| GET    | `/api/Aggregates/buckets`                   | `BucketRowDto[]`                     |
| GET    | `/api/Aggregates/heatmap`                   | `HeatmapCellDto[]`                   |
| GET    | `/api/Pnl`                                  | `PnlEntry[]` (raw, capped at 5000)   |
| GET    | `/api/Pnl/summary`                          | `PnlSummaryRow[]`                    |
| GET    | `/api/wave/cosma\|powertrain\|exteriors`    | raw entity rows (admin / QA only)    |
| GET    | `/api/wave/cosma\|powertrain\|exteriors/{id}` | single entity row                  |
| GET    | `/api/Insights/thought-starters`            | `ThoughtStarterDto[]`                |
| GET    | `/api/Insights/pnl-recommendations`         | `PnlRecommendationDto[]`             |
| GET    | `/api/Insights/knowledge-center`            | `KnowledgeCenterAssetDto[]`          |
| GET    | `/api/Insights/video-library`               | `VideoLibraryAssetDto[]`             |
| GET    | `/api/Insights/archetypes`                  | `ArchetypeDefinitionDto[]`           |
| GET    | `/api/Insights/site-archetypes`             | `SiteArchetypeDto[]`                 |
| GET    | `/api/Insights/priority-initiatives`        | `PriorityInitiativeDto[]`            |
| GET    | `/api/Insights/dashboard-config`            | `DashboardConfigDto`                 |

### DB → DTO traceability

Every read-side DTO maps back to one or more `readacross.*` tables. Use this
to figure out which seed / backfill script needs to run when a field is
empty in the SPA.

| DTO                          | Backing table(s)                                   | Populated by                                            |
| ---------------------------- | -------------------------------------------------- | ------------------------------------------------------- |
| `InitiativeDto`              | `CosmaWaveInitiatives`, `PowertrainWaveInitiatives`, `ExteriorsWaveInitiatives`, `SeatingWaveInitiatives` | `03_seed_wave.sql` + `make ingest` |
| `InitiativeDto.subgroup`     | (same) + `SubgroupEntityMap`                       | `07_seed_subgroup_entity_map.sql` + `05_backfill_subgroups.sql` (post-ingest) |
| `InitiativeDto.archetypes`   | `CosmaWaveInitiatives.Archetypes` (CSV)            | `03_seed_wave.sql` / `make ingest` (Cosma only today)   |
| `FilterOptionsDto`           | derived from the harmonized initiative list        | (computed in `InitiativeService.GetFilterOptionsAsync`) |
| `SubgroupDto`                | derived from `Subgroup` column on Wave tables      | (computed in `InitiativeService.GetSubgroupsAsync`)     |
| `BucketRowDto` / `HeatmapCellDto` | derived from the harmonized initiative list   | (computed in `AggregateService`)                        |
| `PnlEntry` / `PnlSummaryRow` | `PnlEntries`                                       | `02_seed_pnl.sql`                                       |
| `ThoughtStarterDto`          | `ThoughtStarters`                                  | `04_seed_mapping_insights.sql` / `make ingest`          |
| `PnlRecommendationDto`       | `PnlRecommendations`                               | `04_seed_mapping_insights.sql` / `make ingest`          |
| `KnowledgeCenterAssetDto`    | `KnowledgeCenterAssets`                            | `04_seed_mapping_insights.sql` / `make ingest`          |
| `VideoLibraryAssetDto`       | `VideoLibraryAssets`                               | `04_seed_mapping_insights.sql` / `make ingest`          |
| `ArchetypeDefinitionDto`     | `ArchetypeDefinitions`                             | `04_seed_mapping_insights.sql`                          |
| `SiteArchetypeDto`           | `SiteArchetypes`                                   | `04_seed_mapping_insights.sql`                          |
| `PriorityInitiativeDto`      | `PriorityInitiatives`                              | `06_seed_priority_initiatives.sql` (top NRB demo)       |
| `DashboardConfigDto`         | `DashboardMetaSnapshots` + runtime mapping/scoring tables (`MagnaDivisionAliases`, `CosmaSubgroupMap`, `ArchetypeMfgAllowed`, `SpendCategoryMetricMap`, `RecommendationScoring`) | `make ingest` (+ `sql/15_ui_runtime_tables.sql` for runtime knobs) |

### Runtime Mapping & Recommendation Config (quick index)

- **SQL tables + sample values**: see `Runtime Config: SQL tables + sample values` in this README.
- **Backend wiring**: see `Runtime Config: backend wiring` in this README.
- **UI wiring**: see `Runtime Config: UI wiring` in this README.
- **Ops runbook**: see `APP_MAINTENANCE.md` section `Runtime mapping/recommendation config tables`.

### Runtime Config: SQL tables + sample values

Canonical tables (legacy `UiRuntime*` tables are removed by `sql/15_ui_runtime_tables.sql`):

- `readacross.MagnaDivisionAliases`
- `readacross.CosmaSubgroupMap`
- `readacross.ArchetypeMfgAllowed`
- `readacross.SpendCategoryMetricMap`
- `readacross.RecommendationScoring`

Sample verification query:

```sql
SELECT TOP (10) * FROM readacross.MagnaDivisionAliases ORDER BY WorkstreamName;
SELECT TOP (10) * FROM readacross.CosmaSubgroupMap ORDER BY SiteName;
SELECT TOP (10) * FROM readacross.ArchetypeMfgAllowed ORDER BY ArchetypeKey, MfgProcess;
SELECT TOP (10) * FROM readacross.SpendCategoryMetricMap ORDER BY SpendCategory, MetricKey;
SELECT TOP (1)  * FROM readacross.RecommendationScoring ORDER BY UpdatedAtUtc DESC;
```

### Runtime Config: backend wiring

- DTO/contract:
  - `api/Models/DashboardConfigDto.cs`
  - `api/Models/DashboardConfigOptions.cs`
- Data access:
  - `api/Data/MagnaDbContext.cs`
  - `api/Entities/MagnaDivisionAlias.cs`
  - `api/Entities/CosmaSubgroupMap.cs`
  - `api/Entities/ArchetypeMfgAllowed.cs`
  - `api/Entities/SpendCategoryMetricMap.cs`
  - `api/Entities/RecommendationScoring.cs`
- Assembly logic:
  - `api/Services/DashboardConfigService.cs` (`BuildMappingConfigAsync`)

### Runtime Config: UI wiring

- API model contract:
  - `web/src/app/shared/models/read-across.models.ts`
    - `IDashboardConfig.mappingConfig`
    - `IMappingConfig.magnaDivisionAliases`
    - `IMappingConfig.recommendationConfig`
- Consumers:
  - `web/src/app/core/services/dashboard-chrome.service.ts`
  - `web/src/app/core/services/pnl-rec.service.ts`

### Subgroup data flow (worth calling out)

The Wave Excel exports do not currently track Subgroup. The chain that
populates the SPA pill row is:

```
Wave Excel export  ──ingest──▶  readacross.{Cosma,Powertrain,Exteriors,Seating}WaveInitiatives
                                  │  (Subgroup column = NULL)
                                  ▼
readacross.SubgroupEntityMap     ◀──maintain──  quarterly hierarchy updates
                                  │             (source-of-truth mapping table)
                                  ▼
sql/05_backfill_subgroups.sql    ──UPDATE──▶  Subgroup populated authoritatively:
                                  │             • Cosma: explicit map rows
                                  │             • PT/Ext: explicit map rows first
                                  │               + prefix fallback ("PT - *", "Ext - *")
                                  │             • Seating: explicit map rows first
                                  │               + prefix fallback ("NA"/"EU"/"CN*"
                                  │               → "Seat - NA/EU/CN")
                                  ▼
api/Services/InitiativeService.GetAllAsync
                                  │  reads Subgroup raw from DB; if a row
                                  │  is still NULL, SubgroupInferer.Coalesce
                                  │  consults SubgroupEntityMap first, then
                                  │  PT/Ext/Seat prefix fallback as safety net
                                  ▼
GET /api/Initiatives/subgroups            (one row per pair, with site list)
GET /api/Initiatives/filter-options       (.subgroups: string[])
GET /api/Initiatives                      (.subgroup on every row)
                                  │
                                  ▼
SPA FilterService / FilterBar (Subgroup pill row)
SPA pnl-benchmarking.component (subgroup peer set)
SPA drilldown subtitle / CSV export
```

### Legacy parity notes (vs `magna-readacross/public/index.html`)

The v2 SPA + API target full functional parity with the legacy
single-file dashboard at `magna-readacross/public/index.html`. The notable
behaviours that have moved over are:

- **Four workstreams** — `Cosma`, `Powertrain`, `Exteriors`, **`Seating`**.
  Seating uses the legacy prefix rules (`NA` → `Seat - NA`, `EU` →
  `Seat - EU`, `CN*` → `Seat - CN`) and renders initiative IDs as plain
  text in the drilldown (no Wave deep-link analogue exists).
- **Workstream colour accents** — Cosma red, PT blue, Ext green, Seating
  amber. Filter pills, KPI cards, heatmap workstream bands and the data
  quality dialog all share the same palette.
- **Subgroup pill row** — explicit-map first (`SubgroupEntityMap`), then
  prefix fallback for PT/Ext/Seating; `Unmapped` is intentionally never
  shown as a pill.
- **Insights deep-links** — buckets/heatmap pass `tab`, `lever`,
  `subLever`, and `spendCategory`; the Insights page now consumes
  `subLever` as the most specific scroll target.
- **Lever Insights modal** — the ★ next to a lever in
  Buckets/Heatmap opens a focused dialog with three tabs (Thought
  Starters / Knowledge Center / Video Library), each pre-filtered to
  the lever's `{spendCategory, mfgProcess, lever, subLever}` slice and
  showing a count badge per tab. Filter semantics match the legacy
  `getThoughtStarters` / `getMatchingSlides` / `getMatchingVideos`
  helpers (asset-empty fields are wildcards; `Revenue` excluded;
  `spendCat || lever` required). Header crumbs use the legacy `›` glyph
  and rows render the legacy amber numbered chip + breadcrumb pill +
  Advanced Automation pill.
- **Thought-starter Advanced Automation labels** — `ThoughtStarters
  .AdvancedAutomation` is now `NVARCHAR(128)` (was `BIT`) so the
  Lever Insights dialog can render the original free-text tag
  (`Cobot load/unload`, `Camera inspect`, `Inspect - AI for weld
  integrity`, …) instead of a generic on/off badge — matching the
  offline dashboard exactly.
- **Feedback recipient** — the mailto address comes from
  `dashboard-config.feedbackEmail` (via `DashboardChromeService.feedbackEmail`)
  so DevOps can re-target the form without a code change.
- **Confidential rows** — drilldown table hides `access === 'Confidential'`
  rows, banner shows the suppressed count, and the CSV export omits them.
  Mirrors the legacy "Confidential rows excluded" treatment.
- **Best-practice / priority IDs** — `PriorityInitiatives` table feeds
  `DashboardChromeService.isPriority`; drilldown rows render a green check
  next to flagged initiatives.
- **Buckets / heatmap KPI cards** — show all four workstreams (Cosma /
  Powertrain / Exteriors / Seating) and the buckets pivot grid renders
  four sub-columns (Cosma / PT / Ext / Seat) under each of the
  `Count`, `% of Total`, and `NRB` super-columns.

---

## Frontend architecture

Angular 21 standalone components, signal-based state, lazy-loaded feature
routes. Tailwind CSS is configured against the Digi Design System token set
(see `web/tailwind.config.js`).

### Routing

`app.routes.ts` lazy-loads the read-across domain, which then lazy-loads the
four feature pages.

```
/                  → redirect to /buckets
/buckets           BucketsPageComponent     Initiative Overview
/heatmap           HeatmapPageComponent     Concentration heatmap (green ramp)
/insights          InsightsPageComponent    5 sub-tabs:
                                              • P&L Benchmarking (PnlBenchmarkingComponent)
                                              • P&L-Informed Recommendations
                                              • Thought Starters
                                              • Knowledge Center
                                              • Video Library
/feedback          FeedbackPageComponent    Submission form
/**                → redirect to /buckets
```

### Components

| Selector                       | Path                                                                                | Role                                                                                                                       |
| ------------------------------ | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `mra-root`                     | `app/app.component.ts`                                                              | Shell: header + filter bar + `<router-outlet>` + 3 root dialogs (drilldown / archetype legend / data quality) |
| `mra-header`                   | `app/shared/components/header/header.component.ts`                                  | Magna wordmark, BETA badge, top nav, global search, Data Quality chip                                                       |
| `mra-filter-bar`               | `app/shared/components/filter-bar/filter-bar.component.ts`                          | Global pills (Workstream, Category, Stage, Subgroup, Archetype) + archetype legend launcher (`?`)                          |
| `mra-pill`                     | `app/shared/components/pill/pill.component.ts`                                      | Reusable pill chip (active/inactive + workstream-coloured variants)                                                        |
| `mra-global-search`            | `app/shared/components/global-search/global-search.component.ts`                    | Debounced full-text search across all initiatives; keyboard nav; "Open all matches" hands the result set to the drilldown |
| `mra-drilldown-dialog`         | `app/shared/components/drilldown-dialog/drilldown-dialog.component.ts`              | Native `<dialog>` initiative table (sticky header, sort by site, CSV export, P&L context banner, confidential suppression) |
| `mra-archetype-legend-dialog`  | `app/shared/components/archetype-legend-dialog/archetype-legend-dialog.component.ts`| Cosma archetype definitions + sites + "Filter to this archetype" button                                                    |
| `mra-data-quality-dialog`      | `app/shared/components/data-quality-dialog/data-quality-dialog.component.ts`        | Per-workstream coverage / exclusions / source files + Refresh button                                                       |
| _(routed)_                     | `app/features/buckets/buckets-page.component.ts`                                    | KPI cards + grouped two-tier bucket table; cells deep-link into the drilldown; lever ★ deep-links to Insights              |
| _(routed)_                     | `app/features/heatmap/heatmap-page.component.ts`                                    | KPI cards + Count/NRB toggle + green-ramp heatmap; cells & row totals open the drilldown                                   |
| _(routed)_                     | `app/features/insights/insights-page.component.ts`                                  | Tab host + 5 secondary tabs (P&L Benchmarking, Recommendations, Thought Starters, Knowledge Center, Video Library)         |
| `mra-pnl-benchmarking`         | `app/features/insights/pnl-benchmarking.component.ts`                               | Site selector → scope toggle (overall / archetype / subgroup using real archetype data) → 9 rank tiles → Strengths / Opp card |
| _(routed)_                     | `app/features/feedback/feedback-page.component.ts`                                  | Digi-DS feedback form (mailto target sourced from `DashboardChromeService.feedbackEmail()`)                                |

### Services

| Service                   | Path                                                                | Responsibility                                                                                                                  |
| ------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `ReadAcrossDataService`   | `app/shared/data-services/read-across-data.service.ts`              | Thin HTTP gateway around the API (one method per endpoint, returns `Promise<T>` via `firstValueFrom`)                           |
| `ReadAcrossAppService`    | `app/domains/read-across/app-services/read-across-app.service.ts`   | Application-layer facade consumed by feature components and core services                                                       |
| `FilterService`           | `app/core/services/filter.service.ts`                               | Signal-backed global filter store (`workstreams`, `spendCategories`, `stages`, `subgroups`, `archetypes`) shared by all pages   |
| `DashboardChromeService`  | `app/core/services/dashboard-chrome.service.ts`                     | Boot-loads `dashboard-config` + `priority-initiatives`; exposes `feedbackEmail()`, `generated()`, `isPriority()`, `buildWaveCardUrl()`, `refreshAsync()`, `lastRefreshedAt()`, `dataQualityOpen` signals |
| `DrilldownService`        | `app/core/services/drilldown.service.ts`                            | Owns the drilldown dialog state — `state`, `isOpen`, `sortBySite`; `open(payload)` / `close()` / `toggleSortBySite()` |
| `ArchetypeService`        | `app/core/services/archetype.service.ts`                            | Lazy-loads archetype definitions + site mappings; `prettify()`, `describe()`, `sitesFor()`, `archetypesBySite()`, `legendOpen` signal |
| `InitiativeCacheService`  | `app/core/services/initiative-cache.service.ts`                     | Caches the harmonized initiative list keyed by active workstream filter; `getAllAsync()`, `filterByContextAsync()`              |

### Path aliases

Defined in `web/tsconfig.json`:

```
@app/models          → src/app/shared/models
@app/data-services   → src/app/shared/data-services
@app/app-services    → src/app/domains/read-across/app-services/read-across-app.service.ts
@app/core-services   → src/app/core/services
@app/ui              → src/app/shared/components
@domains/read-across → src/app/domains/read-across
```

Components and services use these aliases exclusively — deep relative
imports across layer boundaries (e.g. `../../../core/services/...`) are not
allowed in this codebase.

### Cross-cutting UX (drilldown, search, click-throughs)

Several behaviours are wired across multiple pages so the SPA matches the
discoverability of the legacy offline dashboard.

#### Drilldown dialog (`mra-drilldown-dialog`)

A single root-level native `<dialog>` instance is opened by any page that has
a count / NRB cell worth exploring. State is owned by `DrilldownService`:

```ts
drilldown.open({
  title: 'DL · Stamping · Cycle time · Cosma Brazil',
  subtitle: '12 initiatives · $4.2M NRB',
  items: matchingInitiatives,                   // pre-filtered IInitiative[]
  context: { spendCategory: 'DL', mfgProcess: 'Stamping', site: 'Cosma Brazil' },
  pnlContext: {                                  // optional — adds blue banner
    workstream: 'Cosma',
    site: 'Cosma USA East',
    archetype: 'Framing',
    opportunityAmount: 1_250_000,
    recommendationText: 'Scale casting OEE playbook from top-performing line.',
    priorityRank: 1,
  },
});
```

Entry points:

| Surface                                       | Trigger                                                          |
| --------------------------------------------- | ---------------------------------------------------------------- |
| Initiative Overview (`/buckets`)              | Count / NRB cells per workstream column; category-band totals    |
| Heatmap (`/heatmap`)                          | Individual cells; row totals                                     |
| Global search (`mra-global-search`)           | "Open all matches" or per-result row click                       |
| Insights → P&L-Informed Recommendations cards | "Open in drilldown" link (renders the P&L context banner above)  |

The dialog renders a sticky-header table, supports site-grouping, exports the
visible rows to CSV, hides confidential rows from the body while keeping
their counts in the header, and renders Wave deep-links via
`DashboardChromeService.buildWaveCardUrl()`.

#### Global search (`mra-global-search`)

Replaces the static search input in the header. Debounced (250 ms) full-text
search against name / description / site / lever / sub-lever / id of every
cached initiative, with keyboard nav (`↑` / `↓` / `Enter`) and "Open all
matches" that hands the result set to the drilldown.

#### Archetype legend (`mra-archetype-legend-dialog`)

Triggered by the `?` button next to the **Archetype (Cosma)** filter pill row.
Lists every archetype with a friendly description and an expandable list of
sites; "Filter to this archetype" toggles the global `FilterService` pill.

#### Data quality (`mra-data-quality-dialog`)

Triggered by the **Data Quality · YYYY-MM-DD** chip in the header. Renders
per-workstream initiative counts, validation notes, exclusion rules, and
source-file references sourced from `DashboardConfigDto.workstreams`. Includes
a **Refresh** button that calls `DashboardChromeService.refreshAsync()` to
re-pull `dashboard-config` + `priority-initiatives` and bust the boot cache —
useful after a fresh `make ingest` run.

#### Deep-linking from buckets / heatmap → insights

The lever ★ icon on the Initiative Overview and Heatmap pages links to the
Insights page with `tab=thought-starters`, `spendCategory=<DL|IDL|MC|VOH>`,
and `lever=<lever name>` query parameters. The Insights page reads those
params, switches to the right tab, applies the spend category filter, and
scrolls to / highlights the matching lever via a `data-lever-anchor`
attribute and a one-shot CSS pulse animation.

---

## Slides & videos

The Knowledge Center and Video Library tabs render binary assets (PNG/PDF
slides and MP4 videos) that are **not** stored in the database. The DB only
holds the metadata row + a relative URL; the bytes themselves are static
files baked into the SPA's asset tree and served by Nginx at the same origin
as the SPA.

### End-to-end rendering chain

```
Disk (web/src/assets/slides/<file>)        ─┐
Disk (web/src/assets/videos/<file>)        ─┤
                                            │  npm run build
                                            ▼
                       dist/magna-readacross-web/browser/{slides,videos}/<file>
                                            │  Dockerfile COPY
                                            ▼
                Nginx /usr/share/nginx/html/{slides,videos}/<file>
                                            │  GET /slides/foo.png
                                            ▼
SQL (readacross.KnowledgeCenterAssets.SlideUrl = '/slides/foo.png')
SQL (readacross.VideoLibraryAssets.VideoUrl    = '/videos/bar.mp4')
                                            │  /api/Insights/knowledge-center
                                            ▼
                   ReadAcrossDataService.getKnowledgeCenterAssetsAsync()
                   ReadAcrossDataService.getVideoLibraryAssetsAsync()
                                            │
                                            ▼
                  InsightsPageComponent  (web/src/app/features/insights/insights-page.component.ts)
                       ├─ tab "Knowledge Center"  → cards with `<a [href]="asset.slideUrl" target="_blank">`
                       └─ tab "Video Library"     → cards with title / category / duration metadata
```

Two key implementation details that keep the URL layout stable:

1. **`web/angular.json`** declares `"assets": [{ "glob": "**/*", "input": "src/assets" }]`,
   so `src/assets/slides/foo.png` is published at `/slides/foo.png` (no `/assets/`
   prefix). The ingest script writes URLs in exactly that shape.
2. **`scripts/ingest_from_original_artifacts.py`** normalises every slide URL
   to `/slides/<basename>` (`slide_url = f"/slides/{Path(img).name}"`) and every
   video URL to `/videos/<basename>` so DB rows always match the on-disk path.

### Add a new slide deck (Knowledge Center)

The Knowledge Center renders `IKnowledgeCenterAsset[]` cards inside
`InsightsPageComponent` (`@case ('knowledge')`), filtered by a spend-category
pill row. Each card shows the title, optional `spendCategory` / `workstream`
badges, and an "Open asset" link that points at `slideUrl`.

**1. Drop the file on disk**

```bash
# Source-of-truth location (synced into the SPA by scripts/sync_media_assets.py):
cp my-new-deck.pdf  /Users/Sneha_Mani/Development/Magna/gms-dashboard-main/magna-dashboard/public/slides/

# Or, if you're skipping the legacy artifact tree, drop it straight into the SPA:
cp my-new-deck.pdf  magna-readacross-v2/web/src/assets/slides/
```

**2. Insert (or update) the metadata row**

```sql
INSERT INTO readacross.KnowledgeCenterAssets
    (Title, SpendCategory, Workstream, [Description], SlideUrl, ThumbnailUrl, SortOrder, IsActive)
VALUES
    (N'Cycle-Time SMED Playbook',
     N'DL',                              -- DL / IDL / Material Conveyance / VOH (or NULL for all)
     N'Cosma',                           -- Cosma / Powertrain / Exteriors (or NULL for all)
     N'30-day SMED execution guide for press changeovers.',
     N'/slides/my-new-deck.pdf',         -- ← matches the file on disk
     N'/slides/thumbs/my-new-deck.png',  -- optional
     50,                                 -- SortOrder (lower = earlier)
     1);                                 -- IsActive
```

**3. Rebuild the SPA so the file ships in the bundle**

```bash
make build && make up
# or, in local dev: cd web && npm run build
```

**4. Verify**

- `curl http://localhost:4200/slides/my-new-deck.pdf` → `200 OK`
- Visit `/insights` → "Knowledge Center" tab → the new card should appear.
  Its filter pill is driven by `SpendCategory`; the "All" pill shows everything.

> **Bulk reload from the legacy `slides.json`**: if you've added many slides
> at once, the easier path is to update
> `gms-dashboard-main/magna-dashboard/public/slides.json` and run
> `make ingest`. That one command runs `sync_media_assets.py` (copies the
> binaries into `web/src/assets/slides/`) and `ingest_from_original_artifacts.py`
> (truncates and re-inserts every `KnowledgeCenterAssets` row from JSON).

### Add a new video (Video Library)

The Video Library renders `IVideoLibraryAsset[]` cards inside
`InsightsPageComponent` (`@case ('video')`), filtered by the same spend-category
pill row. Each card shows the title, category/workstream badges, a duration
badge, and a description.

**1. Drop the file on disk**

```bash
# Source of truth for legacy ingestion:
cp launch-overview.mp4  /Users/Sneha_Mani/Development/Magna/magna-readacross/public/videos/

# Or place it directly in the SPA assets tree:
cp launch-overview.mp4  magna-readacross-v2/web/src/assets/videos/
```

> Keep videos web-friendly: H.264 MP4, ≤ 1080p, audio AAC. Anything bigger than
> ~50 MB will bloat the production image; consider hosting it on a CDN and
> putting the absolute URL into `VideoUrl` instead of a relative `/videos/...`
> path.

**2. Insert the metadata row**

```sql
INSERT INTO readacross.VideoLibraryAssets
    (Title, SpendCategory, Workstream, [Description], VideoUrl, ThumbnailUrl, DurationSeconds, SortOrder, IsActive)
VALUES
    (N'Press Changeover SMED Sprint',
     N'DL',
     N'Cosma',
     N'How to run a rapid SMED event in stamping operations.',
     N'/videos/launch-overview.mp4',          -- relative path served by Nginx
     N'/videos/thumbs/launch-overview.png',   -- optional
     420,                                     -- duration in seconds → renders as "7:00"
     20,                                      -- SortOrder
     1);
```

The duration is formatted by `formatDuration()` inside `InsightsPageComponent`
into the `M:SS` badge that shows in the top-right corner of each card.

**3. Rebuild & verify**

```bash
make build && make up
curl -I http://localhost:4200/videos/launch-overview.mp4   # expect 200
```

The card appears on `/insights` → "Video Library", filterable by the
`SpendCategory` pill row.

> **Bulk update**: extend the `VIDEO_LIBRARY` array inside
> `magna-readacross/public/index.html`, then run `make ingest`. The script
> regex-parses that array and reloads `VideoLibraryAssets` from scratch.

### Removing or replacing an asset

- **Soft delete** — set `IsActive = 0` on the relevant
  `KnowledgeCenterAssets` / `VideoLibraryAssets` row. The current API queries
  do not yet filter on `IsActive`, but the column is reserved for that purpose
  and the SPA already tolerates assets disappearing between loads.
- **Hard delete** — `DELETE FROM readacross.KnowledgeCenterAssets WHERE …`
  and remove the file from `web/src/assets/{slides,videos}/`. Rebuild the SPA.
- **Replace bytes only** — overwrite the file at the same path; no DB or SPA
  rebuild is needed because the URL is unchanged. Bust the browser cache by
  appending a `?v=<n>` query string in `SlideUrl` / `VideoUrl` if needed.

---

## Operations cookbook

From the repository root:

```bash
make build                 # docker compose build api web
make up                    # docker compose up -d
make down                  # docker compose down
make logs                  # tail compose logs
make ingest                # sync media + reload SQL from original artifacts
make ingest-and-restart    # ingest + rebuild api/web
make recompute-pnl         # POST /api/Pnl/recompute
```

### P&L bootstrap + recompute runbook

Use this when you want to refresh `readacross.PnlEntries` from the offline
monthly panel and then regenerate all derived benchmark/recommendation tables.

1) Load `PnlEntries` from the offline monthly panel:

```bash
python3 scripts/load_pnl_entries_from_monthly_pnl.py --apply-to-container
```

Current loader behavior:

- Source: `../magna-readacross/.cursor/p_and_l/outputs/standalone/pnl_benchmarking.json`
- Writes monthly rows for:
  - `Direct Labor (DL)`
  - `Indirect Labor (IDL)`
  - `Production Materials`
  - `Fixed Overhead (FOH)`
  - `Variable Overhead (VOH)`
  - `Scrap (303122)`
  - `Production Sales`
  - `Total Sales`
  - synthetic `EBITDA` (bootstrap estimate from monthly panel)
- Idempotent reset of `Scenario LIKE 'Actual%'` slice before insert.

2) Ensure the P&L calc schema/views are applied (one-time or after pull):

```bash
docker cp sql/12_schema_pnl_calc.sql magna-readacross-sql:/tmp/12_schema_pnl_calc.sql
docker cp sql/13_views_pnl.sql magna-readacross-sql:/tmp/13_views_pnl.sql
docker exec magna-readacross-sql /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P 'Magna#Seed2026!' -d MagnaReadAcross -C -b -i /tmp/12_schema_pnl_calc.sql
docker exec magna-readacross-sql /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P 'Magna#Seed2026!' -d MagnaReadAcross -C -b -i /tmp/13_views_pnl.sql
```

3) Rebuild/restart API (if service code changed), then recompute:

```bash
docker compose -f docker-compose.yml --project-directory . up -d --build api
curl -sS -X POST "http://localhost:5080/api/Pnl/recompute" -H "Content-Type: application/json"
```

4) Validate derived table counts:

```bash
docker exec -i magna-readacross-sql /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P 'Magna#Seed2026!' -d MagnaReadAcross -C -Q \
  "SELECT COUNT(*) AS PnlSiteBenchmarks FROM readacross.PnlSiteBenchmarks;
   SELECT COUNT(*) AS PnlRecommendations FROM readacross.PnlRecommendations;
   SELECT COUNT(*) AS PnlRankings FROM readacross.PnlRankings;
   SELECT COUNT(*) AS PnlAnchors FROM readacross.PnlAnchors;"
```

Reference outcome from the latest successful run:

- `PnlEntries` (`Actual%`): `2862`
- `/api/Pnl/recompute`: `benchmarkCount=371`, `recommendationCount=159`
- `PnlSiteBenchmarks`: `371`
- `PnlRecommendations`: `159`
- `PnlRankings`: `371`
- `PnlAnchors`: `7`

### Local SQL Server connection (for ad-hoc inspection)

The dev SQL container (`magna-readacross-sql`, image
`mcr.microsoft.com/mssql/server:2022-latest`) is exposed on the host via
`docker-compose.yml`. Use these credentials from any SQL client running
on your laptop:

| Setting        | Value                                  |
|----------------|----------------------------------------|
| Server / Host  | `localhost`                            |
| Port           | `14333`                                |
| Auth type      | SQL Server Authentication              |
| Username       | `sa`                                   |
| Password       | `Magna#Seed2026!`                      |
| Database       | `MagnaReadAcross`                      |
| Encrypt / TLS  | Optional — accept self-signed cert     |

Common clients:

```text
# Azure Data Studio / SSMS connection string
Server=localhost,14333;Database=MagnaReadAcross;User Id=sa;Password=Magna#Seed2026!;TrustServerCertificate=True;

# JDBC (DBeaver / IntelliJ)
jdbc:sqlserver://localhost:14333;databaseName=MagnaReadAcross;user=sa;password=Magna#Seed2026!;trustServerCertificate=true

# .NET / EF Core (matches api/appsettings.json default)
Server=localhost,14333;Database=MagnaReadAcross;User Id=sa;Password=Magna#Seed2026!;TrustServerCertificate=True;Encrypt=False;
```

Quick `sqlcmd` checks (uses the in-container tooling so no host install
is needed):

```bash
make sql-shell             # interactive sqlcmd inside the SQL container
make coverage              # GET /api/Initiatives/subgroups/coverage (pretty-printed JSON)

# Ad-hoc one-liner from the host shell
docker exec -i magna-readacross-sql /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P 'Magna#Seed2026!' -d MagnaReadAcross -C -Q \
  "SELECT TOP 5 InitiativeId, Name, Subgroup FROM readacross.SeatingWaveInitiatives;"
```

> The password contains a `#` — quote it (`'Magna#Seed2026!'`) in shells
> or escape it (`Magna\#Seed2026!`) inside `Makefile` recipes, otherwise
> the rest of the value is parsed as a comment.

### Quarterly hierarchy update runbook

When MAGNAUR hierarchy/entity lists change, treat `readacross.SubgroupEntityMap`
as the maintained source and then re-apply the backfill:

```sql
-- 1) Upsert mapping changes from the latest hierarchy package.
--    (Example row-level maintenance)
MERGE readacross.SubgroupEntityMap AS target
USING (VALUES
    (N'Cosma', N'New Site Name', N'USA East', 1, N'Q3 hierarchy update')
) AS source(Workstream, EntityName, Subgroup, IsActive, Notes)
    ON target.Workstream = source.Workstream
   AND target.EntityName = source.EntityName
WHEN MATCHED THEN
    UPDATE SET Subgroup = source.Subgroup,
               IsActive = source.IsActive,
               Notes = source.Notes,
               UpdatedAtUtc = SYSUTCDATETIME()
WHEN NOT MATCHED BY TARGET THEN
    INSERT (Workstream, EntityName, Subgroup, IsActive, Notes)
    VALUES (source.Workstream, source.EntityName, source.Subgroup, source.IsActive, source.Notes);
```

```bash
# 2) Re-apply subgroup backfill and refresh priority badges.
sqlcmd -S localhost,14333 -U sa -P 'Magna#Seed2026!' -d MagnaReadAcross \
       -i sql/05_backfill_subgroups.sql \
       -i sql/06_seed_priority_initiatives.sql
```

```sql
-- 3) Verify no unmapped rows remain.
SELECT 'Cosma' AS Workstream, COUNT(*) AS Unmapped
FROM readacross.CosmaWaveInitiatives
WHERE Subgroup IS NULL OR Subgroup = N''
UNION ALL
SELECT 'Powertrain', COUNT(*)
FROM readacross.PowertrainWaveInitiatives
WHERE Subgroup IS NULL OR Subgroup = N''
UNION ALL
SELECT 'Exteriors', COUNT(*)
FROM readacross.ExteriorsWaveInitiatives
WHERE Subgroup IS NULL OR Subgroup = N'';
```

```bash
# 4) API-level verification (includes fallback logic + unresolved entity names)
curl "http://localhost:5080/api/Initiatives/subgroups/coverage"
```

Local dev (without Docker):

```bash
# API — http://localhost:5080
cd api
dotnet run

# SPA — http://localhost:4200 with proxy.conf.json forwarding /api → :5080
cd web
npm install
npm start

# Lint + type-check the SPA
npm run validate          # ng build (dev) + ng lint — must be zero errors
npm run validate:types    # type-check only
npm run validate:lint     # ESLint only
```

### Coding standards

The SPA follows the project-wide guidelines in
[`magna-readacross/FrontendInstructions.md`](../magna-readacross/FrontendInstructions.md)
and [`magna-readacross/GeneralStandards.md`](../magna-readacross/GeneralStandards.md):

- Standalone components only — no NgModules.
- `inject()` exclusively, never constructor injection. All injected
  dependencies are `private readonly` (or `protected readonly` when bound
  from a template).
- Signal-based reactivity (`signal` / `computed` / `effect`) for component
  state; data services return `Promise<T>` via `firstValueFrom()`.
- New view queries use `viewChild()` / `viewChildren()` — never the
  decorator form (`@ViewChild` / `@ViewChildren`).
- All components use `ChangeDetectionStrategy.OnPush`.
- Interfaces use the `I` prefix (e.g. `IInitiative`, `IDashboardConfig`).
- Cross-layer imports go through path aliases (`@app/*`, `@domains/*`).
- Zero TypeScript errors and zero lint errors before any change is
  considered complete (`npm run validate`).

Useful endpoints during development:

- `http://localhost:5080/swagger` (in `Development`)
- `http://localhost:5080/healthz`

---

## Configuration reference

### API — `api/appsettings.json`

```json
{
  "Cors":  { "AllowedOrigins": "http://localhost:4200" },
  "ConnectionStrings": {
    "AzureSqlDb": "Server=tcp:<sql-server>.database.windows.net,1433;Database=<db>;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"
  }
}
```

The connection string deliberately omits `User Id` / `Password`. `Program.cs`
detects this and injects an AAD access token at runtime via
`DefaultAzureCredential`. Locally, `docker-compose.yml` overrides the connection
string to use SQL auth against the dev SQL container on host port `14333`.

To grant an Azure-hosted identity access:

```sql
CREATE USER [<app-name>] FROM EXTERNAL PROVIDER;
ALTER ROLE db_datareader ADD MEMBER [<app-name>];
ALTER ROLE db_datawriter ADD MEMBER [<app-name>];
```

### Docker — `docker-compose.yml`

| Service | Port (host → container) | Notes                                                              |
| ------- | ----------------------- | ------------------------------------------------------------------ |
| `api`   | `5080 → 8080`           | Reads `ConnectionStrings__AzureSqlDb` env var                      |
| `web`   | `4200 → 80`             | Static Angular bundle; proxies API calls in production via Nginx   |

### SPA — `web/src/environments/environment.ts`

`apiBaseUrl` is set to `/api` (proxy in dev, same-origin in prod). Override via
`environment.development.ts` for non-default ports.
