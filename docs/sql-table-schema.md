# SQL Table Schema Reference

This document is a quick reference for the main `readacross` SQL tables used by
the Magna Read-Across Dashboard. It includes table purpose, important columns,
and representative sample records from the local development database.

For day-to-day maintenance procedures, see `../APP_MAINTENANCE.md`.

## How To Inspect Any Table

Use this query to see exact column names, data types, nullability, and defaults:

```sql
SELECT
    c.TABLE_SCHEMA,
    c.TABLE_NAME,
    c.ORDINAL_POSITION,
    c.COLUMN_NAME,
    c.DATA_TYPE,
    c.CHARACTER_MAXIMUM_LENGTH,
    c.NUMERIC_PRECISION,
    c.NUMERIC_SCALE,
    c.IS_NULLABLE,
    c.COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS c
WHERE c.TABLE_SCHEMA = 'readacross'
  AND c.TABLE_NAME = 'MagnaDivisionAliases' -- change table name here
ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION;
```

From the local dev container:

```bash
docker exec -i magna-readacross-sql /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P 'Magna#Seed2026!' -d MagnaReadAcross -C -Q \
  "SELECT c.TABLE_NAME, c.ORDINAL_POSITION, c.COLUMN_NAME, c.DATA_TYPE,
          c.CHARACTER_MAXIMUM_LENGTH, c.IS_NULLABLE
   FROM INFORMATION_SCHEMA.COLUMNS c
   WHERE c.TABLE_SCHEMA = 'readacross'
   ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION;"
```

## Core Table Groups

| Group | Tables |
| --- | --- |
| Wave initiatives | `CosmaWaveInitiatives`, `PowertrainWaveInitiatives`, `ExteriorsWaveInitiatives`, `SeatingWaveInitiatives` |
| P&L facts and outputs | `PnlEntries`, `PnlSiteBenchmarks`, `PnlAnchors`, `PnlRankings`, `PnlRecommendations` |
| Runtime mapping/config | `MagnaDivisionAliases`, `CosmaSubgroupMap`, `ArchetypeMfgAllowed`, `SpendCategoryMetricMap`, `RecommendationScoring` |
| Insights and media | `ThoughtStarters`, `KnowledgeCenterAssets`, `VideoLibraryAssets`, `ArchetypeDefinitions`, `SiteArchetypes`, `PriorityInitiatives` |
| Dashboard metadata | `DashboardMetaSnapshots` |

## Wave Initiative Tables

These tables store initiative rows by division/workstream. The API harmonizes
them through `/api/Initiatives`.

### `readacross.CosmaWaveInitiatives`

Purpose: Cosma Wave initiative rows.

Important columns:

- `InitiativeId`
- `Name`
- `Description`
- `Stage`
- `Access`
- `InitiativeOwner`
- `Site`
- `Subgroup`
- `SpendCategory`
- `MfgProcess`
- `Lever`
- `SubLever`
- `Nrb`
- `IsCategorized`
- `Archetypes`

Sample record:

| InitiativeId | Site | Subgroup | SpendCategory | Lever | Nrb |
| --- | --- | --- | --- | --- | ---: |
| `10154` | `Presstran` | `Canada` | `DL` | `(Non-automation) Utilization and man-machine ratio` | `183598.53` |

### `readacross.PowertrainWaveInitiatives`

Purpose: Powertrain Wave initiative rows.

Important columns:

- `InitiativeId`
- `Name`
- `Description`
- `Stage`
- `Access`
- `InitiativeOwner`
- `Site`
- `Subgroup`
- `SpendCategory`
- `MfgProcess`
- `Lever`
- `SubLever`
- `Nrb`
- `IsCategorized`

### `readacross.ExteriorsWaveInitiatives`

Purpose: Exteriors Wave initiative rows.

Important columns:

- `InitiativeId`
- `Name`
- `Description`
- `Stage`
- `Access`
- `InitiativeOwner`
- `Division`
- `Subgroup`
- `SpendCategory`
- `MfgProcess`
- `Lever`
- `SubLever`
- `Nrb`
- `IsCategorized`

### `readacross.SeatingWaveInitiatives`

Purpose: Seating Wave initiative rows.

Important columns:

- `InitiativeId`
- `Name`
- `Description`
- `Stage`
- `Access`
- `InitiativeOwner`
- `Site`
- `Subgroup`
- `SpendCategory`
- `MfgProcess`
- `Lever`
- `SubLever`
- `Nrb`
- `IsCategorized`

## P&L Tables

### `readacross.PnlEntries`

Purpose: raw Hyperion-style P&L cube fact rows.

Important columns:

- `PnlEntryId`
- `Cube`
- `Entity`
- `Parent`
- `Cons`
- `Scenario`
- `Time`
- `View`
- `Account`
- `Origin`
- `IC`
- `UD1` through `UD8`
- `Amount`
- `HasData`
- `LoadedAtUtc`

Rows used by recompute:

- `HasData = 1`
- `Scenario LIKE 'Actual%'`
- `View = 'Periodic'`

Sample record:

| Cube | Entity | Scenario | Time | View | Account | Amount | HasData |
| --- | --- | --- | --- | --- | --- | ---: | --- |
| `Cosma` | `COSMABRAZILIUM` | `Budget26` | `2025M1` | `Periodic` | `Top` | `330.0000` | `1` |

### `readacross.PnlSiteBenchmarks`

Purpose: computed benchmark metrics by site.

Important columns:

- `Site`
- `MetricKey`
- `SiteValue`
- `BestCosma`
- `BestArchetype`
- `BestSubgroup`
- `OppVsCosma`
- `OppVsArchetype`
- `OppVsSubgroup`
- `Trailing3mProductionRevenue`
- `AnchorCosma`
- `AnchorArchetype`
- `AnchorSubgroup`
- `ComputedAtUtc`

Sample record:

| Site | MetricKey | SiteValue | BestCosma |
| --- | --- | ---: | ---: |
| `Autotek` | `labour_benefits_ratio` | `.0507135525` | `-2.1632449023` |

### `readacross.PnlRecommendations`

Purpose: computed P&L-informed site recommendation cards.

Important columns:

- `Workstream`
- `Site`
- `Archetype`
- `InitiativeId`
- `RecommendationText`
- `OpportunityAmount`
- `PriorityRank`
- `SpendCategory`
- `PrimaryDriver`
- `SiteValue`
- `BenchmarkMedian`
- `Quartile`
- `WhitespaceEstimate`
- `DeploymentCount`
- `DeployingDivisions`
- `EvidenceStrength`
- `Confidence`
- `Rationale`
- `ComputedAtUtc`

Sample record:

| Workstream | Site | RecommendationText | OpportunityAmount | PriorityRank |
| --- | --- | --- | ---: | ---: |
| `Cosma` | `SAP` | `OEE` | `1271525.43` | `1` |

### `readacross.PnlAnchors`

Purpose: best-performing anchor site per scope/metric.

Important columns:

- `ScopeKind`
- `ScopeValue`
- `MetricKey`
- `AnchorEntity`
- `AnchorValue`
- `ComputedAtUtc`

### `readacross.PnlRankings`

Purpose: ordered site ranking per scope/metric.

Important columns:

- `ScopeKind`
- `ScopeValue`
- `MetricKey`
- `Rank`
- `Entity`
- `Value`
- `ComputedAtUtc`

## Runtime Mapping And Recommendation Config Tables

These tables feed `GET /api/Insights/dashboard-config` under
`mappingConfig`.

### `readacross.MagnaDivisionAliases`

Purpose: maps Magna division names to Wave division alias keys.

Important columns:

- `MagnaDivision`
- `DivisionAlias`
- `IsActive`
- `UpdatedAtUtc`

Sample record:

| MagnaDivision | DivisionAlias | UpdatedAtUtc |
| --- | --- | --- |
| `Cosma` | `cosma` | `2026-05-15 16:12:10` |

### `readacross.CosmaSubgroupMap`

Purpose: maps Cosma site names to subgroup names used by recommendations.

Important columns:

- `SiteName`
- `Subgroup`
- `IsActive`
- `UpdatedAtUtc`

Sample record:

| SiteName | Subgroup |
| --- | --- |
| `Autolaunch` | `USA East` |

### `readacross.ArchetypeMfgAllowed`

Purpose: maps archetypes to manufacturing processes that are valid for
recommendation gating.

Important columns:

- `ArchetypeKey`
- `MfgProcess`
- `IsActive`
- `UpdatedAtUtc`

Sample record:

| ArchetypeKey | MfgProcess |
| --- | --- |
| `Assembly` | `Assembly` |

### `readacross.SpendCategoryMetricMap`

Purpose: maps spend categories to P&L metric keys used for recommendation
relevance.

Important columns:

- `SpendCategory`
- `MetricKey`
- `IsActive`
- `UpdatedAtUtc`

Sample record:

| SpendCategory | MetricKey |
| --- | --- |
| `DL` | `labour_benefits_ratio` |

### `readacross.RecommendationScoring`

Purpose: stores recommendation ranking weights and limits.

Important columns:

- `CostBaseTrailingMonths`
- `CostBaseAnnualizationFactor`
- `MaxDrilldownItems`
- `MaxSiteRecommendations`
- `MinPeerSites`
- `PeerNrbRelevanceScale`
- `OpportunityWhitespaceFactor`
- `OpportunityUnderrepresentedFactor`
- `OpportunityTopPeerMinCount`
- `OpportunityTopPeerFraction`
- `BestPeersCount`
- `OpportunityWeight`
- `PnlRelevanceWeight`
- `NrbShortfallWeight`
- `ArchetypeMatchWeight`
- `RegionMatchWeight`
- `WhitespaceBonusWeight`
- `PnlGapScaleFactor`
- `IsActive`
- `UpdatedAtUtc`

Sample record:

| CostBaseTrailingMonths | MaxSiteRecommendations | OpportunityWeight | PnlRelevanceWeight |
| ---: | ---: | ---: | ---: |
| `3` | `3` | `.350000` | `.200000` |

## Insights And Media Tables

### `readacross.ThoughtStarters`

Purpose: thought starter content displayed in Insights and Lever Insights.

Important columns:

- `SpendCategory`
- `MfgProcess`
- `Lever`
- `SubLever`
- `Text`
- `AdvancedAutomation`
- `IsActive`
- `SortOrder`

Sample record:

| SpendCategory | MfgProcess | Lever | SubLever | AdvancedAutomation |
| --- | --- | --- | --- | --- |
| `DL` | `Cold stamp` | `(Automation) Utilization and man-machine ratio` |  | `Camera inspect` |

### `readacross.KnowledgeCenterAssets`

Purpose: slide/deck cards in the Knowledge Center.

Important columns:

- `Title`
- `SpendCategory`
- `Workstream`
- `Description`
- `SlideUrl`
- `ThumbnailUrl`
- `SortOrder`
- `IsActive`

### `readacross.VideoLibraryAssets`

Purpose: video cards in the Video Library.

Important columns:

- `Title`
- `SpendCategory`
- `Workstream`
- `Description`
- `VideoUrl`
- `ThumbnailUrl`
- `DurationSeconds`
- `SortOrder`
- `IsActive`

### `readacross.ArchetypeDefinitions`

Purpose: archetype labels and descriptions.

Important columns:

- `ArchetypeKey`
- `DisplayName`
- `Workstream`
- `Description`
- `IsActive`

### `readacross.SiteArchetypes`

Purpose: site-to-archetype mapping.

Important columns:

- `SiteName`
- `ArchetypeKey`
- `Workstream`

### `readacross.PriorityInitiatives`

Purpose: initiative IDs flagged as priority/best-practice candidates.

Important columns:

- `InitiativeId`
- `PriorityLabel`
- `Workstream`

## Dashboard Metadata

### `readacross.DashboardMetaSnapshots`

Purpose: stores dashboard metadata sections consumed by
`DashboardConfigService`.

Important columns:

- `SectionKey`
- `GeneratedAtUtc`
- `SourceFile`
- `PayloadJson`
- `LoadedAtUtc`

