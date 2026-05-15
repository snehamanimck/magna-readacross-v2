import { Injectable, inject } from '@angular/core';

import {
  IInitiative,
  IPnlBenchmarks,
  IPnlMonthlyPanel,
  IPnlRecommendationRuntimeConfig,
  IPnlSiteBenchmark,
} from '@app/models';
import { DashboardChromeService } from './dashboard-chrome.service';

/* ──────────────────────────────────────────────────────────────────────────
   PnlRecService
   ───────────
   Port of the legacy `_computeSiteRecommendations` / `_buildHeatmapRowIndex`
   / `_getSiteCostBase` / `_pnlRelevanceForRow` block from
   `magna-readacross/public/index.html`.

   The legacy app generates the per-site recommendation cards client-side from
   three blobs (heatmap initiatives, monthly P&L, benchmarks) so v2 mirrors
   that exact shape. Pre-computing on the API would diverge whenever the
   warehouse refreshes mid-day, and would leave the SPA unable to re-rank
   when the user toggles workstream filters.

   The output of `compute()` is consumed by `InsightsPageComponent` to render
   the legacy card layout: subgroup pill row, site cards with
   archetype/subgroup/cost-base, three columns of recommendation tiles with
   numbered chip + spend-category badge + whitespace pill + breadcrumb +
   opportunity + peer bar + "X targeted initiatives" footer.
   ────────────────────────────────────────────────────────────────────────── */

const DEFAULT_PNL_REC_RUNTIME: IPnlRecommendationRuntimeConfig = {
  cosmaSubgroupMap: {
    'Eagle Bend': 'USA East',
    BGM: 'USA East',
    Vehtek: 'USA East',
    CBAM: 'USA East',
    Autolaunch: 'USA East',
    Formet: 'Canada',
    Karmax: 'Canada',
    Modatek: 'Canada',
    Presstran: 'Canada',
    MBCM: 'Canada',
    'P&F': 'Canada',
    Deco: 'Canada',
    'Magna Structures Meadowvale': 'Canada',
    Formex: 'Mexico',
    'San Luis Metal Forming': 'Mexico',
    Autotek: 'Mexico',
    Estampados: 'Mexico',
    Sonora: 'Mexico',
    CSL: 'Mexico',
    Salzgitter: 'Cosma EU',
    'Heavy Stamping': 'Cosma EU',
    Formpol: 'Cosma EU',
    Heiligenstadt: 'Cosma EU',
    Cartech: 'Cosma EU',
    Spain: 'Cosma EU',
    Stity: 'Cosma EU',
    Presstec: 'Cosma EU',
    MLE: 'Cosma EU',
    Hungary: 'Cosma EU',
    'BDW Markt Schwaben': 'Casting and UK',
    CCUK: 'Casting and UK',
    Telford: 'Casting and UK',
    'Kamtek Casting': 'Casting and UK',
    'BDW Soest': 'Casting and UK',
    CCMi: 'Casting and UK',
    'Magna Casting Poland': 'Casting and UK',
    Drive: 'USA South',
    Kamtek: 'USA South',
    SJP: 'Brazil',
    SAP: 'Brazil',
    Joinville: 'Brazil',
    Ibirite: 'Brazil',
    Shanghai: 'Cosma APAC',
    Xingqiao: 'Cosma APAC',
    Shenyang: 'Cosma APAC',
    Changsha: 'Cosma APAC',
    Hefei: 'Cosma APAC',
    Chongqing: 'Cosma APAC',
    Tianjin: 'Cosma APAC',
    Guangzhou: 'Cosma APAC',
    Changchun: 'Cosma APAC',
    Xingqiaorui: 'Cosma APAC',
    MPJ: 'Cosma APAC',
    LMV: 'USA West',
    MEVS: 'USA West',
    Williamsburg: 'USA West',
  },
  archetypeMfgAllowed: {
    Assembly: ['Assembly', 'Cold stamp', 'E-coat', 'Laser', 'Other'],
    'Auto-launch': ['Assembly', 'Laser', 'Other'],
    Casting: ['Assembly', 'Casting', 'Cold stamp', 'Other'],
    'Forming and BIW': ['Assembly', 'Cold stamp', 'E-coat', 'Hot form', 'Hydroform', 'Laser', 'Other'],
    Framing: ['Assembly', 'Cold stamp', 'Hot form', 'Hydroform', 'Laser', 'Other'],
    'Large Class A Facilities': ['Assembly', 'Cold stamp', 'E-coat', 'Laser', 'Other'],
    Tooling: ['Other'],
  },
  spendCategoryMetricMap: {
    DL: ['labour_benefits_ratio', 'wages_ratio'],
    IDL: ['labour_benefits_ratio', 'wages_ratio'],
    VOH: ['voh_ratio'],
    'Material Conveyance': ['voh_ratio'],
  },
  scoring: {
    costBaseTrailingMonths: 3,
    costBaseAnnualizationFactor: 12,
    maxDrilldownItems: 25,
    maxSiteRecommendations: 3,
    minPeerSites: 2,
    peerNrbRelevanceScale: 500_000,
    opportunityWhitespaceFactor: 0.6,
    opportunityUnderrepresentedFactor: 0.4,
    opportunityTopPeerMinCount: 3,
    opportunityTopPeerFraction: 0.3,
    bestPeersCount: 5,
    opportunityWeight: 0.35,
    pnlRelevanceWeight: 0.2,
    nrbShortfallWeight: 0.15,
    archetypeMatchWeight: 0.15,
    regionMatchWeight: 0.1,
    whitespaceBonusWeight: 0.05,
    pnlGapScaleFactor: 5,
  },
};

/** Drill-down peer initiative carries a `_peerSite` helper. */
export interface IPnlDrillInitiative extends IInitiative {
  /** Site that contributed the peer evidence (NOT the recommended site). */
  _peerSite: string;
  _relevance?: number;
}

export interface ISitePnlGap {
  gap: number;
  siteVal: number;
  bestVal: number;
  direction?: string;
}

export interface ISiteCostBase {
  lb: number;
  wages: number;
  voh: number;
  scrap: number;
  total: number;
  /** total × 12 — rendered as "Relevant cost base $X.XXM/yr" on the card. */
  annualized: number;
}

export interface IHeatmapRow {
  /** "<sc>||<mp>||<lv>||<sl>" composite key. */
  key: string;
  /** Spend category, e.g. `'DL'`. */
  sc: string;
  /** Manufacturing process, e.g. `'Assembly'`. */
  mp: string;
  /** Lever, e.g. `'(Automation) Utilization and man-machine ratio'`. */
  lv: string;
  /** Sub-lever (may be `''`). */
  sl: string;
  /** Per-site rollup: count + summed NRB + the contributing initiatives. */
  sites: Record<string, { count: number; nrb: number; inits: IInitiative[] }>;
}

/**
 * Scored recommendation, ready to render. `rank` is set by `compute()` after
 * sorting; the rest mirrors the legacy struct one-to-one so the templates
 * can be ported with minimal renaming.
 */
export interface IPnlRecCard {
  rank: number;
  row: IHeatmapRow;
  isWhitespace: boolean;
  nrbShortfall: number;
  siteNrb: number;
  siteCount: number;
  peerMedianNrb: number;
  totalPeerCount: number;
  archPeerCount: number;
  /** $ opportunity sized to the site's own cost base. */
  opportunity: number;
  /** Top-5 peer sites by NRB for the row. */
  bestPeers: string[];
  pnlGap: number;
  archMatchPct: number;
  regionMatchPct: number;
  score: number;
  /** Peer initiatives shown when the user clicks the card. */
  drillInits: IPnlDrillInitiative[];
}

@Injectable({ providedIn: 'root' })
export class PnlRecService {
  private readonly chrome = inject(DashboardChromeService);

  private runtime(): IPnlRecommendationRuntimeConfig {
    return this.chrome.recommendationConfig() ?? DEFAULT_PNL_REC_RUNTIME;
  }

  /**
   * Build a heatmap-row index keyed by `(sc, mp, lv, sl)` from the full
   * Cosma initiative list. Mirrors legacy `_buildHeatmapRowIndex`.
   *
   * Only categorised Cosma initiatives with a non-Other site are rolled up,
   * so the row index excludes draft/uncategorised work and keeps "Other /
   * Unmapped" out of the peer denominator.
   */
  buildHeatmapRowIndex(inits: ReadonlyArray<IInitiative>): Record<string, IHeatmapRow> {
    const rows: Record<string, IHeatmapRow> = {};
    for (const i of inits) {
      if (i.workstream !== 'Cosma') continue;
      if (!i.isCategorized) continue;
      if (!i.site || i.site === 'Other / Unmapped') continue;

      const sc = i.spendCategory ?? '';
      const mp = i.mfgProcess ?? '';
      const lv = i.lever ?? '';
      const sl = i.subLever ?? '';
      const key = `${sc}||${mp}||${lv}||${sl}`;

      let row = rows[key];
      if (!row) {
        row = { key, sc, mp, lv, sl, sites: {} };
        rows[key] = row;
      }

      const s = i.site;
      let bucket = row.sites[s];
      if (!bucket) {
        bucket = { count: 0, nrb: 0, inits: [] };
        row.sites[s] = bucket;
      }
      bucket.count += 1;
      bucket.nrb += i.nrb || 0;
      bucket.inits.push(i);
    }
    return rows;
  }

  /**
   * Trailing-3-month average of (Production L&B + Wages + VOH + Scrap),
   * annualised by ×12. Returns `undefined` when the site has no
   * `monthly_pnl` panel (e.g. Powertrain / Exteriors).
   */
  getSiteCostBase(siteName: string, benchmarks: IPnlBenchmarks): ISiteCostBase | undefined {
    const scoring = this.runtime().scoring;
    const trailingMonths = Math.max(1, Math.floor(scoring.costBaseTrailingMonths || 3));
    const annualization = Number.isFinite(scoring.costBaseAnnualizationFactor)
      ? scoring.costBaseAnnualizationFactor
      : 12;
    const panel: IPnlMonthlyPanel | undefined = benchmarks.monthlyPnl?.[siteName];
    if (!panel) return undefined;
    const t3avg = (arr?: (number | null)[] | null): number => {
      const lastN = (arr ?? []).slice(-trailingMonths).filter((x): x is number => x != null);
      if (lastN.length === 0) return 0;
      return lastN.reduce((a, b) => a + b, 0) / lastN.length;
    };
    const c = panel.costs ?? {} as IPnlMonthlyPanel['costs'];
    const lb    = t3avg(c.labourBenefits);
    const w     = t3avg(c.wages);
    const fm    = t3avg(c.fixedMoh);
    const vm    = t3avg(c.variableMoh);
    const scrap = t3avg(c.scrap);
    const total = lb + w + fm + vm + scrap;
    return { lb, wages: w, voh: fm + vm, scrap, total, annualized: total * annualization };
  }

  /**
   * Build the site's per-metric P&L gap map (legacy `_getSitePnlGaps`).
   * Used by `compute()` to weight rows whose spend-category aligns with the
   * weakest P&L ratios.
   */
  private getSitePnlGaps(siteName: string, benchmarks: IPnlBenchmarks): Record<string, ISitePnlGap> {
    const sd = benchmarks.benchmarks?.[siteName];
    const gaps: Record<string, ISitePnlGap> = {};
    if (!sd) return gaps;
    for (const m of sd.metrics ?? []) {
      const sv = m.siteValue;
      const bv = m.bestCosma;
      if (sv == null || bv == null) continue;
      const gap = m.direction === 'lower_better'
        ? Math.max(0, sv - bv)
        : Math.max(0, bv - sv);
      gaps[m.key] = { gap, siteVal: sv, bestVal: bv, direction: m.direction };
    }
    return gaps;
  }

  /** Map a heatmap row to the largest relevant P&L gap on the site. */
  private pnlRelevanceForRow(rowSc: string, rowSl: string, gaps: Record<string, ISitePnlGap>): number {
    if (rowSl && rowSl.toLowerCase().includes('scrap')) {
      return gaps['scrap_ratio']?.gap ?? 0;
    }
    const keys = this.runtime().spendCategoryMetricMap[rowSc] ?? [];
    let mx = 0;
    for (const k of keys) mx = Math.max(mx, gaps[k]?.gap ?? 0);
    return mx;
  }

  /** Collect each site's set of mfg-processes that have any DL evidence. */
  private buildSiteDlMfgEvidence(inits: ReadonlyArray<IInitiative>): Record<string, Set<string>> {
    const out: Record<string, Set<string>> = {};
    for (const i of inits) {
      if (i.workstream !== 'Cosma') continue;
      if (!i.isCategorized) continue;
      if (!i.site || i.site === 'Other / Unmapped') continue;
      if ((i.spendCategory ?? '').trim() !== 'DL') continue;
      const mp = (i.mfgProcess ?? '').trim();
      if (!mp) continue;
      let bag = out[i.site];
      if (!bag) { bag = new Set(); out[i.site] = bag; }
      bag.add(mp);
    }
    return out;
  }

  /**
   * Combined DL row gate: archetype prior ∩ site evidence.
   *
   * The legacy app also reads optional deny/allow overrides from
   * `pnl_rec_dl_mfg_policy` in the offline JSON; v2 doesn't yet ship that
   * policy bundle, so we omit those branches. (The base archetype + evidence
   * gate matches the legacy results on every site we've validated.)
   */
  private dlHeatmapRowEligible(
    mfgProcess: string,
    siteArch: string,
    evidenceSet: Set<string> | undefined,
  ): boolean {
    const archAllowed = this.runtime().archetypeMfgAllowed;
    if (!mfgProcess) return true;
    if (siteArch && archAllowed[siteArch] && !archAllowed[siteArch]!.includes(mfgProcess)) {
      return false;
    }
    const hasAnyEvidence = !!evidenceSet && evidenceSet.size > 0;
    if (hasAnyEvidence) return evidenceSet!.has(mfgProcess);
    return true;
  }

  /**
   * Pick up to `maxItems` peer initiatives to seed the drilldown when the
   * user clicks a recommendation card. Sorted by archetype/subgroup match
   * first, then NRB.
   */
  private selectDrilldownInits(
    row: IHeatmapRow,
    siteName: string,
    benchmarks: IPnlBenchmarks,
    maxItems?: number,
  ): IPnlDrillInitiative[] {
    const scoreCfg = this.runtime().scoring;
    const effectiveMaxItems = maxItems ?? scoreCfg.maxDrilldownItems;
    const peerNrbScale = Number.isFinite(scoreCfg.peerNrbRelevanceScale) && scoreCfg.peerNrbRelevanceScale > 0
      ? scoreCfg.peerNrbRelevanceScale
      : 500_000;
    const subgroupMap = this.runtime().cosmaSubgroupMap;
    const sd = benchmarks.benchmarks?.[siteName];
    const siteArch = sd?.archetype ?? benchmarks.siteArchetypes?.[siteName]?.[0] ?? '';
    const siteSg   = sd?.subgroup  ?? subgroupMap[siteName] ?? '';

    const peers: IPnlDrillInitiative[] = [];
    for (const [s, b] of Object.entries(row.sites)) {
      if (s === siteName) continue;
      for (const i of b.inits) peers.push({ ...i, _peerSite: s });
    }

    for (const i of peers) {
      const peerBm = benchmarks.benchmarks?.[i._peerSite];
      const peerArch = peerBm?.archetype ?? benchmarks.siteArchetypes?.[i._peerSite]?.[0] ?? '';
      const peerSg   = peerBm?.subgroup  ?? subgroupMap[i._peerSite] ?? '';
      let r = 0;
      if (siteArch && peerArch === siteArch) r += 3;
      if (siteSg   && peerSg   === siteSg)   r += 2;
      r += Math.min(2, (i.nrb || 0) / peerNrbScale);
      i._relevance = r;
    }

    peers.sort((a, b) => (b._relevance ?? 0) - (a._relevance ?? 0) || (b.nrb || 0) - (a.nrb || 0));
    return peers.slice(0, effectiveMaxItems);
  }

  /**
   * Compute the top-N (default 3) ranked recommendations for a single site.
   *
   * Score weighting (mirrors the offline `How it works` panel):
   *   - 35% NRB opportunity (cost-base-scaled)
   *   - 20% P&L relevance (alignment to the site's weakest ratio gap)
   *   - 15% NRB shortfall vs peer median
   *   - 15% archetype peer activity
   *   - 10% region / subgroup peer activity
   *   - +5% whitespace bonus (small tiebreaker, never overrides $ opportunity)
   */
  computeForSite(
    siteName: string,
    benchmarks: IPnlBenchmarks,
    rowIndex: Record<string, IHeatmapRow>,
    inits: ReadonlyArray<IInitiative>,
    dlEvidenceBySite: Record<string, Set<string>>,
    maxResults?: number,
  ): IPnlRecCard[] {
    const runtime = this.runtime();
    const scoreCfg = runtime.scoring;
    const subgroupMap = runtime.cosmaSubgroupMap;
    const effectiveMaxResults = maxResults ?? scoreCfg.maxSiteRecommendations;
    const minPeerSites = Math.max(1, Math.floor(scoreCfg.minPeerSites || 2));
    const topPeerMinCount = Math.max(1, Math.floor(scoreCfg.opportunityTopPeerMinCount || 3));
    const topPeerFraction = scoreCfg.opportunityTopPeerFraction > 0 ? scoreCfg.opportunityTopPeerFraction : 0.3;
    const bestPeersCount = Math.max(1, Math.floor(scoreCfg.bestPeersCount || 5));
    const sd: IPnlSiteBenchmark | undefined = benchmarks.benchmarks?.[siteName];
    if (!sd) return [];

    const siteArch = sd.archetype ?? benchmarks.siteArchetypes?.[siteName]?.[0] ?? '';
    const siteSg   = sd.subgroup  ?? subgroupMap[siteName] ?? '';
    const siteCost = this.getSiteCostBase(siteName, benchmarks);
    const gaps     = this.getSitePnlGaps(siteName, benchmarks);
    const allBenchSites = Object.keys(benchmarks.benchmarks ?? {});
    const siteDlEvidence = dlEvidenceBySite[siteName];

    const scored: IPnlRecCard[] = [];

    for (const row of Object.values(rowIndex)) {
      if (row.sc === 'DL'
        && !this.dlHeatmapRowEligible(row.mp, siteArch, siteDlEvidence)) {
        continue;
      }

      const siteData    = row.sites[siteName];
      const siteNrb     = siteData?.nrb ?? 0;
      const siteCount   = siteData?.count ?? 0;
      const isWhitespace = !siteData || siteCount === 0;

      const peerSites = Object.keys(row.sites).filter(s => s !== siteName);
      if (peerSites.length < minPeerSites) continue;

      const peerNrbs       = peerSites.map(s => row.sites[s]!.nrb);
      const peerSorted     = peerNrbs.slice().sort((a, b) => a - b);
      const peerMedianNrb  = peerSorted[Math.floor(peerSorted.length / 2)] ?? 0;

      // Archetype-weighted peer set for cost-base-aware opportunity sizing.
      const archPeerCosts: { site: string; nrb: number; cost: number }[] = [];
      let archPeerCount = 0;
      if (siteArch) {
        for (const s of peerSites) {
          const peerArch = benchmarks.benchmarks?.[s]?.archetype
            ?? benchmarks.siteArchetypes?.[s]?.[0]
            ?? '';
          if (peerArch === siteArch) {
            archPeerCount += 1;
            const pc = this.getSiteCostBase(s, benchmarks);
            if (pc) archPeerCosts.push({ site: s, nrb: row.sites[s]!.nrb, cost: pc.total });
          }
        }
      }

      const totalPeerCount = peerSites.length;

      const pnlGap = this.pnlRelevanceForRow(row.sc, row.sl, gaps);

      const archMatchPct = siteArch
        ? archPeerCount / Math.max(
            1,
            allBenchSites.filter(s =>
              s !== siteName
              && (benchmarks.benchmarks?.[s]?.archetype ?? benchmarks.siteArchetypes?.[s]?.[0] ?? '') === siteArch,
            ).length,
          )
        : 0;

      const nrbShortfall = peerMedianNrb > 0
        ? Math.max(0, 1 - (siteNrb / peerMedianNrb))
        : (isWhitespace ? 1 : 0);

      let regionMatchPct = 0;
      if (siteSg) {
        const regionPeers = peerSites.filter(s => {
          const psg = benchmarks.benchmarks?.[s]?.subgroup ?? subgroupMap[s] ?? '';
          return psg === siteSg;
        });
        regionMatchPct = regionPeers.length / Math.max(1, peerSites.length);
      }

      let opportunity = 0;
      if (siteCost && siteCost.total > 0) {
        const refPeers = archPeerCosts.length >= 2
          ? archPeerCosts
          : peerSites
              .map(s => {
                const pc = this.getSiteCostBase(s, benchmarks);
                return pc ? { site: s, nrb: row.sites[s]!.nrb, cost: pc.total } : null;
              })
              .filter((x): x is { site: string; nrb: number; cost: number } => x != null);
        if (refPeers.length) {
          const topPeers = refPeers
            .slice()
            .sort((a, b) => b.nrb - a.nrb)
            .slice(0, Math.max(topPeerMinCount, Math.ceil(refPeers.length * topPeerFraction)));
          const avgRefNrb  = topPeers.reduce((a, p) => a + p.nrb, 0)  / topPeers.length;
          const avgRefCost = topPeers.reduce((a, p) => a + p.cost, 0) / topPeers.length;
          if (avgRefCost > 0) {
            const scaled = avgRefNrb * (siteCost.total / avgRefCost);
            opportunity = scaled * (isWhitespace
              ? scoreCfg.opportunityWhitespaceFactor
              : scoreCfg.opportunityUnderrepresentedFactor);
          }
        }
      }

      const bestPeers = peerSites
        .slice()
        .sort((a, b) => row.sites[b]!.nrb - row.sites[a]!.nrb)
        .slice(0, bestPeersCount);

      scored.push({
        rank: 0, // assigned after sort
        row,
        isWhitespace,
        nrbShortfall,
        siteNrb,
        siteCount,
        peerMedianNrb,
        totalPeerCount,
        archPeerCount,
        opportunity,
        bestPeers,
        pnlGap,
        archMatchPct,
        regionMatchPct,
        score: 0,
        drillInits: [], // populated below for the kept top-N only
      });
    }

    // Normalise opportunity across this site's candidate rows, then score.
    const maxOpp = Math.max(1, ...scored.map(s => s.opportunity));
    for (const s of scored) {
      const normOpp = s.opportunity / maxOpp;
      const wsBonus = s.isWhitespace ? scoreCfg.whitespaceBonusWeight : 0;
      s.score = normOpp * scoreCfg.opportunityWeight
        + s.nrbShortfall * scoreCfg.nrbShortfallWeight
        + Math.min(1, s.pnlGap * scoreCfg.pnlGapScaleFactor) * scoreCfg.pnlRelevanceWeight
        + s.archMatchPct * scoreCfg.archetypeMatchWeight
        + s.regionMatchPct * scoreCfg.regionMatchWeight
        + wsBonus;
    }

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, effectiveMaxResults);
    top.forEach((s, i) => {
      s.rank = i + 1;
      s.drillInits = this.selectDrilldownInits(s.row, siteName, benchmarks, scoreCfg.maxDrilldownItems);
    });
    return top;
  }

  /**
   * Compute the recommendations for every Cosma site present in
   * `benchmarks` and return them grouped by site. Heavyweight pieces
   * (heatmap row index, DL evidence) are computed once per call.
   */
  computeAll(
    benchmarks: IPnlBenchmarks,
    inits: ReadonlyArray<IInitiative>,
  ): { site: string; archetype?: string; subgroup?: string; costBase?: ISiteCostBase; recs: IPnlRecCard[] }[] {
    const runtime = this.runtime();
    const rowIndex = this.buildHeatmapRowIndex(inits);
    const dlEvidenceBySite = this.buildSiteDlMfgEvidence(inits);

    const allBenchSites = Object.keys(benchmarks.benchmarks ?? {});
    const out: { site: string; archetype?: string; subgroup?: string; costBase?: ISiteCostBase; recs: IPnlRecCard[] }[] = [];

    for (const site of allBenchSites) {
      const sd = benchmarks.benchmarks[site];
      const archetype = sd?.archetype ?? benchmarks.siteArchetypes?.[site]?.[0];
      const subgroup  = sd?.subgroup  ?? runtime.cosmaSubgroupMap[site];
      const costBase  = this.getSiteCostBase(site, benchmarks);
      const recs      = this.computeForSite(
        site,
        benchmarks,
        rowIndex,
        inits,
        dlEvidenceBySite,
        runtime.scoring.maxSiteRecommendations,
      );
      out.push({ site, archetype, subgroup, costBase, recs });
    }

    return out;
  }
}
