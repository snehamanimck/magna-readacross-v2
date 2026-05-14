export interface IInitiative {
  id: string;
  name?: string;
  description?: string;
  workstream: 'Cosma' | 'Powertrain' | 'Exteriors' | 'Seating';
  site?: string;
  subgroup?: string;
  owner?: string;
  stage?: string;
  /**
   * Wave Access flag (e.g. `Open` / `Restricted` / `Confidential`).
   * The drilldown table hides `Confidential` rows from the visible list but
   * keeps them in the aggregate counts, mirroring the legacy offline behaviour.
   */
  access?: string;
  nrb: number;
  spendCategory?: string;
  mfgProcess?: string;
  lever?: string;
  subLever?: string;
  isCategorized: boolean;
  archetypes: string[];
}

export interface IFilterOptions {
  workstreams: string[];
  spendCategories: string[];
  stages: string[];
  subgroups: string[];
  archetypes: string[];
  sites: string[];
}

/**
 * One row per (Workstream, Subgroup) pair returned by
 * `GET /api/Initiatives/subgroups`. Backed by the `Subgroup` column on each
 * Wave table — populated by `sql/05_backfill_subgroups.sql`.
 */
export interface ISubgroup {
  subgroup: string;
  workstream: string;
  initiativeCount: number;
  sites: string[];
}

export interface IWorkstreamBucketCell {
  count: number;
  nrb: number;
}

export interface IBucketRow {
  spendCategory: string;
  mfgProcess?: string;
  lever?: string;
  subLever?: string;
  countTotal: number;
  nrbTotal: number;
  byWorkstream: Record<string, IWorkstreamBucketCell>;
}

export interface IHeatmapCell {
  spendCategory: string;
  mfgProcess?: string;
  lever?: string;
  subLever?: string;
  workstream: string;
  site?: string;
  /**
   * Geographic / business subgroup the cell's site belongs to (e.g.
   * `'PT - AP'`, `'Ext: EU'`, `'USA East'`). Mirrored from the backend
   * {@link HeatmapCellDto.Subgroup}; used by the Heatmap page to render an
   * extra tier of column grouping above the per-site columns.
   */
  subgroup?: string;
  count: number;
  nrb: number;
}

export interface IPnlEntry {
  pnlEntryId: number;
  cube: string;
  entity: string;
  parent?: string;
  cons?: string;
  scenario: string;
  time: string;
  view?: string;
  account: string;
  origin?: string;
  ic?: string;
  ud1?: string;
  ud2?: string;
  ud3?: string;
  ud4?: string;
  ud5?: string;
  ud6?: string;
  ud7?: string;
  ud8?: string;
  amount: number;
  hasData: boolean;
  annotation?: string;
  assumptions?: string;
  auditComm?: string;
  footnote?: string;
  varianceExp?: string;
}

export interface IPnlSummaryRow {
  cube: string;
  entity: string;
  scenario: string;
  time: string;
  account: string;
  amount: number;
}

// ─── P&L Benchmarks blob ────────────────────────────────────────────────────
//
// Mirrors the API's `PnlBenchmarksDto` (see Models/PnlBenchmarkDtos.cs) which
// itself is a 1:1 export of the offline dashboard's `pnl_benchmarking`
// section. Drives the Insights → P&L Benchmarking page.

/** Either `'higher_better'` or `'lower_better'` for ranking direction. */
export type PnlMetricDirection = 'higher_better' | 'lower_better';

export interface IPnlMetric {
  key: string;
  label: string;
  units?: string;
  calc?: string;
  direction?: PnlMetricDirection;
  siteValue?: number | null;
  bestCosma?: number | null;
  bestArchetype?: number | null;
  bestSubgroup?: number | null;
  oppVsCosma?: number | null;
  oppVsArchetype?: number | null;
  oppVsSubgroup?: number | null;
}

export interface IPnlSiteBenchmark {
  subgroup?: string;
  archetype?: string;
  trailing3mProductionRevenue?: number;
  anchorCosma?: string;
  anchorArchetype?: string;
  anchorSubgroup?: string;
  metrics: IPnlMetric[];
}

export interface IPnlRankEntry {
  site: string;
  value?: number | null;
}

export interface IPnlArchetypeDefinition {
  label?: string;
  description?: string;
}

/**
 * Top-level shape returned by `GET /api/Pnl/benchmarks`.
 *
 *   - `benchmarks`         — every site (53 Cosma + PT + Exteriors) → its
 *                            metrics, archetype, subgroup, opportunities
 *   - `rankings`           — pre-sorted lists keyed by `scopeKey` (e.g.
 *                            `'cosma'`, `'archetype_Assembly'`,
 *                            `'subgroup_Brazil'`) → metric key → ordered
 *                            array of `{ site, value }`
 *   - `siteDisplayNames`   — canonical site key → friendly label
 *   - `archetypes`         — archetype key → `{ label, description }`
 *   - `siteArchetypes`     — site → archetype keys (one site can carry many)
 */
export interface IPnlBenchmarks {
  generated?: string;
  version?: string;
  siteDisplayNames: Record<string, string>;
  archetypes: Record<string, IPnlArchetypeDefinition>;
  benchmarks: Record<string, IPnlSiteBenchmark>;
  rankings: Record<string, Record<string, IPnlRankEntry[]>>;
  siteArchetypes: Record<string, string[]>;
  /**
   * Optional monthly P&L panel per site. Used by the P&L-Informed
   * Recommendations page to size opportunity to the site's own cost base
   * (mirrors legacy `_getSiteCostBase`: trailing-3-month avg of
   * labour_benefits + wages + variable_moh + scrap, annualized).
   */
  monthlyPnl?: Record<string, IPnlMonthlyPanel>;
}

export interface IPnlMonthlyPanel {
  months: string[];
  revenue: (number | null)[];
  laborQty: (number | null)[];
  costs: IPnlMonthlyCosts;
}

export interface IPnlMonthlyCosts {
  labourBenefits: (number | null)[];
  wages: (number | null)[];
  productionMaterials: (number | null)[];
  fixedMoh: (number | null)[];
  variableMoh: (number | null)[];
  scrap: (number | null)[];
}

export interface IThoughtStarter {
  thoughtStarterId: number;
  spendCategory?: string;
  mfgProcess?: string;
  lever?: string;
  subLever?: string;
  text: string;
  advancedAutomation?: string;
  sortOrder: number;
}

export interface IPnlRecommendation {
  pnlRecommendationId: number;
  workstream: string;
  site: string;
  archetype?: string;
  initiativeId?: string;
  recommendationText: string;
  opportunityAmount?: number;
  priorityRank: number;
}

export interface IKnowledgeCenterAsset {
  knowledgeAssetId: number;
  title: string;
  spendCategory?: string;
  workstream?: string;
  description?: string;
  slideUrl: string;
  thumbnailUrl?: string;
  sortOrder: number;
}

export interface IVideoLibraryAsset {
  videoAssetId: number;
  title: string;
  spendCategory?: string;
  workstream?: string;
  description?: string;
  videoUrl: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  sortOrder: number;
}

/**
 * Surfaced by `GET /api/Insights/priority-initiatives`. Maps to the offline
 * dashboard's `priority_ids.ids[]` blob — the drilldown shows a green check
 * next to any initiative whose id is in this set.
 */
export interface IPriorityInitiative {
  initiativeId: string;
  priorityLabel: string;
  workstream?: string;
}

/** Surfaced by `GET /api/Insights/archetypes`. */
export interface IArchetypeDefinition {
  archetypeKey: string;
  displayName: string;
  workstream: string;
  description?: string;
}

/** Surfaced by `GET /api/Insights/site-archetypes`. */
export interface ISiteArchetype {
  siteArchetypeId: number;
  siteName: string;
  archetypeKey: string;
  workstream: string;
}

/**
 * Per-workstream data quality summary, surfaced inside `IDashboardConfig`.
 * Mirrors the legacy `cosma_meta` / `powertrain_meta` / `exteriors_meta`
 * blocks from `__OFFLINE_DASHBOARD_DATA__`.
 */
export interface IWorkstreamMeta {
  totalRaw: number;
  totalActive: number;
  totalCategorized: number;
  totalUncategorized?: number;
  totalNeedsReview?: number;
  benchmark?: string;
  lastValidated?: string;
  validationNotes: string[];
  exclusionRules: string[];
}

/**
 * Surfaced by `GET /api/Insights/dashboard-config`. The SPA pulls this once
 * at boot for cross-cutting chrome (feedback recipient, Wave deep-link base
 * URLs, per-workstream metadata).
 */
export interface IDashboardConfig {
  generated: string;
  feedbackEmail: string;
  /** keyed by workstream slug — `cosma`, `powertrain`, `ignite`. */
  waveBaseUrls: Record<string, string>;
  cosmaMeta?: IWorkstreamMeta;
  powertrainMeta?: IWorkstreamMeta;
  exteriorsMeta?: IWorkstreamMeta;
  seatingMeta?: IWorkstreamMeta;
}
