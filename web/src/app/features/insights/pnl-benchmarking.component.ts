import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { IPnlBenchmarks, IPnlMetric, IPnlRankEntry, PnlMetricDirection } from '@app/models';
import { ArchetypeService } from '@app/core-services';

type Scope = 'cosma' | 'archetype' | 'subgroup';
type Mode  = 'rank' | 'gap';
type Tier  = 'top-decile' | 'top-quartile' | 'top-half' | 'bottom-half';

interface KpiTile {
  key: string;
  label: string;
  rank: number;
  totalSites: number;
  tier: Tier;
  gapValue: string;
  direction: 'higher_better' | 'lower_better';
}

interface RankRow {
  rank: number;
  site: string;
  displayName: string;
  archetype?: string;
  value?: number | null;
}

/**
 * P&L Benchmarking sub-view.
 *
 * Backed by the rich `IPnlBenchmarks` blob (53 Cosma + Powertrain +
 * Exteriors sites with per-metric values, archetype tags, and pre-computed
 * scope rankings). Mirrors the offline reference end-to-end: site selector,
 * tags, scope toggle, KPI summary, Strengths/Opportunity Areas, Full
 * Ranking with tier filter, Site Comparison, and the inline Page Guide.
 */
@Component({
  selector: 'mra-pnl-benchmarking',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-4">

      <!-- Site selector + Guide button -->
      <div class="flex items-center gap-3 flex-wrap">
        <span class="text-[11px] font-medium text-gray-6">Site</span>
        <select class="select !w-auto !py-1.5 text-xs !pr-8"
                [value]="site()"
                (change)="site.set($any($event.target).value)">
          <option value="">— Select a site —</option>
          @for (s of allSites(); track s.key) {
            <option [value]="s.key">{{ s.displayName }}</option>
          }
        </select>

        <span class="text-[11px] text-gray-6 ml-1">
          <span class="font-semibold text-gray-3 tabular-nums">{{ allSites().length }}</span>
          sites loaded
        </span>

        <button type="button"
                class="ml-auto inline-flex items-center gap-1.5 rounded-digi border px-3 py-1.5
                       text-xs font-semibold transition-colors"
                [class.bg-magna-red]="guideOpen()"
                [class.text-white]="guideOpen()"
                [class.border-magna-red]="guideOpen()"
                [class.bg-white]="!guideOpen()"
                [class.text-gray-3]="!guideOpen()"
                [class.border-gray-d0]="!guideOpen()"
                [class.hover:bg-gray-f9]="!guideOpen()"
                [attr.aria-expanded]="guideOpen()"
                aria-controls="pnl-page-guide"
                (click)="guideOpen.set(!guideOpen())">
          <svg class="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor"
               stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
            <circle cx="8" cy="8" r="6.5" />
            <path d="M8 11v.01" /><path d="M6.5 6a1.5 1.5 0 1 1 2.6 1c-.5.5-1.1.7-1.1 1.5" />
          </svg>
          Guide
        </button>
      </div>

      <!-- Page Guide (collapsible). -->
      @if (guideOpen()) {
        <article id="pnl-page-guide"
                 class="card overflow-hidden"
                 role="region"
                 aria-label="Page Guide">
          <header class="px-5 py-3 border-b border-gray-f0 bg-gray-f9 flex items-center justify-between">
            <h3 class="text-base font-bold text-gray-1">Page Guide</h3>
            <button type="button"
                    class="w-7 h-7 flex items-center justify-center rounded-full
                           text-gray-6 hover:bg-gray-f0 hover:text-gray-1 transition-colors
                           text-xl leading-none"
                    title="Close guide"
                    aria-label="Close guide"
                    (click)="guideOpen.set(false)">×</button>
          </header>

          <div class="p-5 max-h-[calc(90vh-48px)] overflow-y-auto">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
              @for (step of guideSteps; track step.n) {
                <div class="flex gap-2 items-start">
                  <span class="inline-flex shrink-0 items-center justify-center
                               w-5 h-5 mt-[2px] rounded-full text-[11px] font-bold
                               bg-magna-red text-white tabular-nums">{{ step.n }}</span>
                  <div class="min-w-0">
                    <div class="text-[13px] font-bold text-gray-1">{{ step.title }}</div>
                    <div class="text-[12px] text-gray-3 leading-snug">{{ step.desc }}</div>
                  </div>
                </div>
              }
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
              <section>
                <div class="text-[11px] font-bold text-gray-3 uppercase tracking-wider mb-1.5">
                  Glossary
                </div>
                <div class="rounded-digi border border-gray-f0 p-3 space-y-2 text-[12px] text-gray-3">
                  <div><span class="font-semibold text-gray-1">pp</span>
                    (percentage points) — Unit for ratio metrics. 12% vs 10% = 2 pp gap.</div>
                  <div><span class="font-semibold text-gray-1">$/head</span>
                    — Revenue per headcount gaps in absolute dollars per employee.</div>
                  <div><span class="font-semibold text-gray-1">Rank #1</span>
                    — Best performer: lowest cost ratio or highest profitability.</div>
                  <div><span class="font-semibold text-gray-1">Scope</span>
                    — Peer group: all Cosma, an archetype, or a regional subgroup.</div>
                </div>
              </section>

              <section>
                <div class="text-[11px] font-bold text-gray-3 uppercase tracking-wider mb-1.5">
                  Color Coding
                </div>
                <div class="rounded-digi border border-gray-f0 overflow-hidden">
                  <table class="w-full text-[11px]">
                    <thead>
                      <tr class="bg-gray-f9 border-b border-gray-f0 text-left">
                        <th class="py-1.5 px-2.5 font-semibold text-gray-3">Area</th>
                        <th class="py-1.5 px-2 font-semibold text-gray-3">
                          <span class="inline-block w-2 h-2 rounded-full mr-1 align-middle"
                                style="background:#34d399"></span>Green
                        </th>
                        <th class="py-1.5 px-2 font-semibold text-gray-3">
                          <span class="inline-block w-2 h-2 rounded-full mr-1 align-middle"
                                style="background:#fbbf24"></span>Amber
                        </th>
                        <th class="py-1.5 px-2 font-semibold text-gray-3">
                          <span class="inline-block w-2 h-2 rounded-full mr-1 align-middle"
                                style="background:#fca5a5"></span>Red
                        </th>
                      </tr>
                    </thead>
                    <tbody class="text-gray-1">
                      @for (row of colorCoding; track row.area) {
                        <tr class="border-b border-gray-f0 last:border-0">
                          <td class="py-1.5 px-2.5 font-medium text-gray-3">{{ row.area }}</td>
                          <td class="py-1.5 px-2">{{ row.green }}</td>
                          <td class="py-1.5 px-2">{{ row.amber }}</td>
                          <td class="py-1.5 px-2">{{ row.red }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </section>

              <section>
                <div class="text-[11px] font-bold text-gray-3 uppercase tracking-wider mb-1.5">
                  Gap to Tier
                </div>
                <div class="text-[11px] text-gray-3 mb-2">
                  Your rank determines the next performance tier you target:
                </div>
                <div class="grid grid-cols-2 gap-1.5">
                  @for (tier of gapTiers; track tier.label) {
                    <div class="rounded border border-gray-f0 py-1.5 px-2 text-center"
                         [style.background]="tier.bg ?? null"
                         [style.color]="tier.fg ?? null">
                      <div class="text-[11px] font-bold"
                           [style.color]="tier.fg ?? '#111111'">{{ tier.label }}</div>
                      <div class="text-[10px]"
                           [style.color]="tier.fg ?? '#444444'">{{ tier.detail }}</div>
                    </div>
                  }
                </div>
              </section>
            </div>
          </div>
        </article>
      }

      <!-- Site detail header -->
      @if (site() && selectedSiteData(); as sd) {
        <div class="flex items-center gap-2 flex-wrap">
          <h2 class="text-[20px] font-bold text-gray-1">{{ siteDisplayName(site()) }}</h2>
          @if (sd.archetype) {
            <span class="badge badge-neutral" style="text-transform:none">{{ sd.archetype }}</span>
          }
          @if (sd.subgroup) {
            <span class="badge badge-neutral" style="text-transform:none">{{ sd.subgroup }}</span>
          }
        </div>
      }

      <!-- Scope toggle -->
      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-[11px] font-medium text-gray-6">Scope</span>
        <div class="inline-flex rounded-digi border border-gray-d0 overflow-hidden bg-white">
          <button type="button" class="scope-btn"
                  [class.scope-active]="scope() === 'cosma'"
                  (click)="scope.set('cosma')">Cosma</button>
          <button type="button" class="scope-btn !border-l !border-gray-d0"
                  [class.scope-active]="scope() === 'archetype'"
                  (click)="scope.set('archetype')">Archetype</button>
          <button type="button" class="scope-btn !border-l !border-gray-d0"
                  [class.scope-active]="scope() === 'subgroup'"
                  (click)="scope.set('subgroup')">Subgroup</button>
        </div>
        <span class="text-[11px] text-gray-6 ml-1">
          Showing all <span class="font-semibold text-gray-3 tabular-nums">{{ peerCount() }}</span>
          {{ scopeLabel() }} sites
        </span>
        @if (scope() === 'archetype') {
          <button type="button"
                  class="text-[11px] font-semibold text-aqua-6 hover:underline"
                  (click)="archetypeSvc.openLegend()">
            What's an archetype? →
          </button>
        }
      </div>

      <hr class="border-gray-f0" />

      <!-- Metric header strip -->
      <div class="flex items-center gap-3 flex-wrap bg-gray-f9 border border-gray-f0 rounded-digi px-4 py-2.5">
        <span class="text-base font-bold text-gray-1">{{ activeMetricLabel() }}</span>
        @if (activeMetric()?.calc) {
          <span class="text-gray-d0">|</span>
          <span class="text-[12px] text-gray-6">{{ activeMetric()!.calc }}</span>
        }
        <span class="text-gray-d0">|</span>
        <span class="text-[12px] text-gray-3 font-semibold">
          Rank #1 = {{ activeMetric()?.direction === 'higher_better' ? 'highest' : 'lowest' }} value
          (best performer)
        </span>
      </div>

      <!-- KPI Summary -->
      <div class="flex items-center justify-between mt-1">
        <h3 class="text-base font-bold text-gray-1">KPI Summary</h3>
        <div class="inline-flex rounded-digi border border-gray-d0 overflow-hidden bg-white">
          <button type="button" class="mode-btn"
                  [class.mode-active]="mode() === 'rank'"
                  (click)="mode.set('rank')">Rank</button>
          <button type="button" class="mode-btn !border-l !border-gray-d0"
                  [class.mode-active]="mode() === 'gap'"
                  (click)="mode.set('gap')">Gap to Tier</button>
        </div>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
        @for (k of kpiTiles(); track k.key) {
          <button type="button"
                  class="kpi-tile"
                  [class.kpi-active]="selectedMetric() === k.key"
                  (click)="selectedMetric.set(k.key)">
            <div class="kpi-tile-name" [title]="k.label">{{ k.label }}</div>
            @if (mode() === 'rank') {
              <div class="kpi-tile-rank">
                <span class="kpi-rank-number">#{{ k.rank }}</span>
                <span class="kpi-rank-total">/ {{ k.totalSites }}</span>
              </div>
              <span class="tier-pill" [class]="tierClass(k.tier)">{{ tierLabel(k.tier) }}</span>
            } @else {
              <div class="kpi-tile-gap">
                <div class="text-[12px] text-gray-3 font-medium">{{ tierTarget(k.tier) }}</div>
                <span class="gap-pill">{{ k.gapValue }}</span>
              </div>
            }
          </button>
        }
      </div>

      <!-- Selected KPI detail card -->
      @if (selectedDetail(); as detail) {
        <article class="card p-5 mt-2">
          <div class="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-4 items-start">
            <div>
              <div class="text-magna-red font-extrabold leading-none tabular-nums tracking-tight"
                   style="font-size: 44px">#{{ detail.rank }}</div>
              <div class="mt-2 text-[12px] text-gray-7">
                of <span class="font-semibold text-gray-3">{{ detail.totalSites }}</span>
                sites in {{ scopeLabel() }}
              </div>
              <div class="text-[12px] text-gray-7">
                Top <span class="font-semibold text-gray-3">{{ detail.percentile }}%</span>
                across {{ scopeLabel() }}
              </div>
            </div>

            <div>
              <div class="font-bold text-gray-1">{{ siteDisplayName(site()) }}</div>
              <div class="text-[13px] text-gray-3">
                for <span class="font-semibold">{{ detail.kpiLabel }}</span>
              </div>
              <div class="mt-1 text-[13px] font-semibold"
                   [class.text-success-2]="detail.aboveMedian"
                   [class.text-danger-3]="!detail.aboveMedian">
                {{ Math.abs(detail.ranksFromMedian) }} ranks
                {{ detail.aboveMedian ? 'above' : 'below' }} median
              </div>
              @if (siteTags().length > 0) {
                <div class="mt-2 flex items-center gap-1.5 flex-wrap">
                  @for (tag of siteTags(); track tag) {
                    <span class="badge badge-neutral" style="text-transform:none">{{ tag }}</span>
                  }
                </div>
              }
            </div>
          </div>

          <hr class="my-4 border-gray-f0" />

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div class="text-base font-bold text-success-2">Strengths</div>
              <ul class="mt-2 space-y-2">
                @for (s of strengths(); track s.key) {
                  <li class="text-sm text-gray-3 flex items-baseline gap-2">
                    <span class="text-[18px] font-extrabold text-success-2 tabular-nums leading-none">
                      #{{ s.rank }}
                    </span>
                    <span class="flex-1">{{ s.label }}</span>
                    <span class="text-gray-7 text-[12px] tabular-nums">/ {{ s.totalSites }}</span>
                  </li>
                }
              </ul>
            </div>
            <div>
              <div class="text-base font-bold text-danger-3">Opportunity Areas</div>
              <ul class="mt-2 space-y-2">
                @for (o of opportunities(); track o.key) {
                  <li class="text-sm text-gray-3 flex items-baseline gap-2">
                    <span class="text-[18px] font-extrabold text-danger-3 tabular-nums leading-none">
                      #{{ o.rank }}
                    </span>
                    <span class="flex-1">{{ o.label }}</span>
                    <span class="text-gray-7 text-[12px] tabular-nums">/ {{ o.totalSites }}</span>
                  </li>
                }
              </ul>
            </div>
          </div>
        </article>
      }

      <!-- Full Ranking -->
      @if (selectedMetric()) {
        <article class="card mt-2 overflow-hidden">
          <header class="px-4 py-3 flex items-center justify-between border-b border-gray-f0">
            <div class="flex items-center gap-3">
              <span class="text-base font-bold text-gray-1">Full Ranking</span>
              <div class="inline-flex rounded-digi border border-gray-d0 overflow-hidden bg-white">
                <button type="button" class="rank-tier-btn"
                        [class.rank-tier-active]="rankTier() === 'top'"
                        (click)="rankTier.set('top')">Top third</button>
                <button type="button" class="rank-tier-btn !border-l !border-gray-d0"
                        [class.rank-tier-active]="rankTier() === 'middle'"
                        (click)="rankTier.set('middle')">Middle third</button>
                <button type="button" class="rank-tier-btn !border-l !border-gray-d0"
                        [class.rank-tier-active]="rankTier() === 'bottom'"
                        (click)="rankTier.set('bottom')">Bottom third</button>
                <button type="button" class="rank-tier-btn !border-l !border-gray-d0"
                        [class.rank-tier-active]="rankTier() === 'all'"
                        (click)="rankTier.set('all')">All</button>
              </div>
            </div>
            <span class="text-xs text-gray-6 font-normal tabular-nums">
              {{ peerCount() }} sites
            </span>
          </header>
          <div class="overflow-auto max-h-[460px]">
            <table class="digi-grid">
              <thead>
                <tr>
                  <th class="!w-16">Rank</th>
                  <th>Site</th>
                  <th>Archetype</th>
                  <th class="!text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                @for (r of fullRankingTier(); track r.site) {
                  <tr [class.bg-aqua-1]="r.site === site()">
                    <td class="text-base font-extrabold text-gray-1 tabular-nums">#{{ r.rank }}</td>
                    <td class="font-semibold text-gray-1">{{ r.displayName }}</td>
                    <td class="text-gray-3">{{ r.archetype || '—' }}</td>
                    <td class="num font-semibold tabular-nums">
                      {{ formatMetricValue(r.value) }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </article>
      }

      <!-- Site Comparison -->
      @if (allSites().length >= 2) {
        <article class="card mt-2 overflow-hidden">
          <header class="p-4 flex items-end gap-4 flex-wrap border-b border-gray-f0">
            <div class="flex-1 min-w-0">
              <h3 class="text-base font-bold text-gray-1">Site Comparison</h3>
              <p class="text-[12px] text-gray-6 mt-0.5">
                Compares two sites across all P&amp;L metrics with metric-specific gap sizing.
              </p>
            </div>
            <label class="flex items-center gap-2 text-[11px] font-medium text-gray-6">
              SITE A
              <select class="select !w-auto !py-1.5 text-xs !pr-8"
                      [value]="compareA()"
                      (change)="compareA.set($any($event.target).value)">
                @for (s of allSites(); track s.key) {
                  <option [value]="s.key">{{ s.displayName }}</option>
                }
              </select>
            </label>
            <span class="text-[11px] font-semibold text-gray-6">vs</span>
            <label class="flex items-center gap-2 text-[11px] font-medium text-gray-6">
              SITE B
              <select class="select !w-auto !py-1.5 text-xs !pr-8"
                      [value]="compareB()"
                      (change)="compareB.set($any($event.target).value)">
                @for (s of allSites(); track s.key) {
                  <option [value]="s.key">{{ s.displayName }}</option>
                }
              </select>
            </label>
          </header>
          <div class="overflow-auto">
            <table class="digi-grid">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th class="!text-right">{{ siteDisplayName(compareA()) || 'Site A' }} rank</th>
                  <th class="!text-right">{{ siteDisplayName(compareB()) || 'Site B' }} rank</th>
                  <th class="!text-right">Gap size</th>
                  <th class="!text-right">Advantage</th>
                </tr>
              </thead>
              <tbody>
                @for (row of comparisonRows(); track row.metric) {
                  <tr>
                    <td class="font-semibold text-gray-1">{{ row.metric }}</td>
                    <td class="num font-bold"
                        [class.text-success-2]="row.aRank < row.bRank"
                        [class.text-danger-3]="row.aRank > row.bRank">
                      #{{ row.aRank }}
                      <span class="text-gray-7 font-normal">/ {{ row.totalSites }}</span>
                    </td>
                    <td class="num font-bold"
                        [class.text-success-2]="row.bRank < row.aRank"
                        [class.text-danger-3]="row.bRank > row.aRank">
                      #{{ row.bRank }}
                      <span class="text-gray-7 font-normal">/ {{ row.totalSites }}</span>
                    </td>
                    <td class="num">
                      <span class="gap-pill" style="background:#FCE7E9;color:#93000C">
                        {{ row.gapLabel }}
                      </span>
                    </td>
                    <td class="num font-semibold"
                        [class.text-success-2]="!!row.advantage">
                      {{ row.advantageDisplay || '—' }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </article>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }

    .scope-btn {
      padding: 6px 14px;
      font-size: 12px;
      font-weight: 600;
      color: #444444;
      background: transparent;
      transition: background 120ms ease, color 120ms ease;
    }
    .scope-btn:hover { background: #DBEBF1; }
    .scope-active {
      background: #C8102E !important;
      color: #FFFFFF !important;
    }
    .scope-active:hover { background: #A00D24 !important; }

    .mode-btn {
      padding: 6px 14px;
      font-size: 12px;
      font-weight: 600;
      color: #444444;
      background: transparent;
    }
    .mode-btn:hover { background: #DBEBF1; }
    .mode-active {
      background: #C8102E !important;
      color: #FFFFFF !important;
    }

    .kpi-tile {
      display: flex;
      flex-direction: column;
      gap: 8px;
      align-items: stretch;
      text-align: left;
      padding: 16px 14px 18px;
      background: #FFFFFF;
      border: 1px solid #F0F0F0;
      border-radius: 8px;
      transition: box-shadow 120ms ease, border-color 120ms ease, transform 120ms ease;
      cursor: pointer;
      min-height: 130px;
    }
    .kpi-tile:hover {
      box-shadow: 0 2px 6px rgba(17,17,17,0.08);
      border-color: #D0D0D0;
    }
    .kpi-active {
      border-color: #C8102E !important;
      box-shadow: 0 0 0 1px #C8102E;
    }
    .kpi-tile-name {
      font-size: 13px;
      font-weight: 600;
      color: #222222;
      line-height: 1.3;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .kpi-tile-rank, .kpi-tile-gap {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .kpi-tile-rank { align-items: flex-start; }
    .kpi-rank-number {
      font-size: 32px;
      font-weight: 800;
      color: #C8102E;
      line-height: 1;
      letter-spacing: -0.02em;
      font-variant-numeric: tabular-nums;
    }
    .kpi-rank-total {
      display: inline-block;
      margin-left: 4px;
      font-size: 14px;
      color: #666666;
      font-weight: 600;
      line-height: 1;
      font-variant-numeric: tabular-nums;
    }

    .tier-pill {
      align-self: flex-start;
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .tier-top-decile   { background: #d1fae5; color: #065f46; }
    .tier-top-quartile { background: #DDEFDD; color: #145114; }
    .tier-top-half     { background: #FEF3C7; color: #92400E; }
    .tier-bottom-half  { background: #FCE7E9; color: #93000C; }

    .gap-pill {
      align-self: flex-start;
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      background: #FEF3C7;
      color: #92400E;
    }

    .rank-tier-btn {
      padding: 4px 10px;
      font-size: 11px;
      font-weight: 600;
      color: #444444;
      background: transparent;
      transition: background 120ms ease, color 120ms ease;
    }
    .rank-tier-btn:hover { background: #DBEBF1; }
    .rank-tier-active {
      background: #C8102E !important;
      color: #FFFFFF !important;
    }
  `],
})
export class PnlBenchmarkingComponent {
  /** Curated benchmarks blob from `GET /api/Pnl/benchmarks`. */
  readonly benchmarks = input<IPnlBenchmarks | undefined>(undefined);

  protected readonly archetypeSvc = inject(ArchetypeService);

  // ---- View state ------------------------------------------------------
  readonly site            = signal<string>('');
  readonly scope           = signal<Scope>('cosma');
  readonly mode            = signal<Mode>('rank');
  readonly selectedMetric  = signal<string>('');
  readonly rankTier        = signal<'top' | 'middle' | 'bottom' | 'all'>('all');
  readonly compareA        = signal<string>('');
  readonly compareB        = signal<string>('');
  readonly guideOpen       = signal<boolean>(false);

  // Expose Math to the template.
  readonly Math = Math;

  // ---- Static reference data for the Page Guide ------------------------
  readonly guideSteps: ReadonlyArray<{ n: number; title: string; desc: string }> = [
    { n: 1, title: 'Pick your site',     desc: 'Scan the KPI Summary for rank or gaps.' },
    { n: 2, title: 'Click a metric pill', desc: 'See the full ranking.' },
    { n: 3, title: 'Scroll down',         desc: 'Strengths, opportunities, recommendations.' },
    { n: 4, title: 'Site Comparison',     desc: 'Benchmark against a peer.' },
  ];
  readonly colorCoding: ReadonlyArray<{ area: string; green: string; amber: string; red: string }> = [
    { area: 'KPI Summary', green: 'Top 25%',   amber: '25–50%',     red: 'Bottom 50%' },
    { area: 'Gap to Tier', green: 'To decile', amber: 'To quartile', red: 'To median' },
    { area: 'Comparison',  green: 'Small',     amber: 'Moderate',    red: 'Large+' },
  ];
  readonly gapTiers: ReadonlyArray<{ label: string; detail: string; bg?: string; fg?: string }> = [
    { label: 'Bottom 50%',  detail: 'Median (P50)' },
    { label: 'Top 25–50%',  detail: 'Quartile (P25)' },
    { label: 'Top 10–25%',  detail: 'Decile (P10)' },
    { label: 'Top 10%',     detail: 'No gap', bg: '#d1fae5', fg: '#065f46' },
  ];

  // ---- Derived data ----------------------------------------------------

  /**
   * Every site present in the benchmarks blob, sorted by display name.
   * This is the canonical "all 53 Cosma + PT + Exteriors" list that
   * powers the site selector and the Site Comparison dropdowns.
   */
  readonly allSites = computed<{ key: string; displayName: string }[]>(() => {
    const b = this.benchmarks();
    if (!b) return [];
    const names = b.siteDisplayNames ?? {};
    return Object.keys(b.benchmarks ?? {})
      .map(k => ({ key: k, displayName: names[k] ?? k }))
      .sort((a, b2) => a.displayName.localeCompare(b2.displayName));
  });

  readonly selectedSiteData = computed(() => {
    const b = this.benchmarks();
    const s = this.site();
    if (!b || !s) return undefined;
    return b.benchmarks?.[s];
  });

  /** Reference shape for the active metric (label, calc, direction). */
  readonly activeMetric = computed<IPnlMetric | undefined>(() => {
    const sd = this.selectedSiteData();
    if (!sd) return undefined;
    const key = this.selectedMetric() || sd.metrics[0]?.key || '';
    return sd.metrics.find(m => m.key === key) ?? sd.metrics[0];
  });
  readonly activeMetricLabel = computed(() => this.activeMetric()?.label ?? 'Profitability');

  readonly scopeLabel = computed<string>(() => {
    const sd = this.selectedSiteData();
    if (this.scope() === 'archetype') return sd?.archetype ?? 'Archetype';
    if (this.scope() === 'subgroup')  return sd?.subgroup  ?? 'Subgroup';
    return 'Cosma';
  });

  /**
   * Sites in the active scope.
   *
   *   - `cosma`     → every site in the benchmarks blob (53)
   *   - `archetype` → every site whose archetype matches the selected site
   *   - `subgroup`  → every site whose subgroup matches the selected site
   *
   * IMPORTANT: we deliberately do NOT use `benchmarks.rankings.<scope>` for
   * counts — those pre-sorted lists are truncated to the top 10 in the
   * source bundle. Computing peers directly from `benchmarks` gives us the
   * full 53-site denominator the offline dashboard shows.
   */
  private readonly peerSites = computed<string[]>(() => {
    const b = this.benchmarks();
    const sd = this.selectedSiteData();
    if (!b) return [];
    const all = Object.keys(b.benchmarks ?? {});
    if (this.scope() === 'archetype') {
      const target = sd?.archetype;
      if (!target) return all;
      return all.filter(k => b.benchmarks[k]?.archetype === target);
    }
    if (this.scope() === 'subgroup') {
      const target = sd?.subgroup;
      if (!target) return all;
      return all.filter(k => b.benchmarks[k]?.subgroup === target);
    }
    return all;
  });

  /**
   * Build a ranked `{ site, value }[]` for the given metric key across the
   * supplied peer set. Sort direction is taken from the metric definition
   * (`lower_better` → ascending; everything else → descending).
   */
  private rankingForMetric(metricKey: string, peers: string[]): IPnlRankEntry[] {
    const b = this.benchmarks();
    if (!b || !metricKey || peers.length === 0) return [];

    const direction: PnlMetricDirection = (b.benchmarks[peers[0]!]?.metrics
      .find(m => m.key === metricKey)?.direction ?? 'higher_better');

    const rows: IPnlRankEntry[] = [];
    for (const site of peers) {
      const m = b.benchmarks[site]?.metrics.find(mm => mm.key === metricKey);
      if (m && m.siteValue != null && !Number.isNaN(m.siteValue)) {
        rows.push({ site, value: m.siteValue });
      }
    }
    rows.sort((a, c) => {
      const va = a.value ?? 0;
      const vc = c.value ?? 0;
      return direction === 'lower_better' ? va - vc : vc - va;
    });
    return rows;
  }

  /** Ranking for the active metric across the active scope's peer sites. */
  private readonly rankingForActive = computed<IPnlRankEntry[]>(() => {
    const key = this.activeMetric()?.key ?? '';
    return this.rankingForMetric(key, this.peerSites());
  });

  readonly peerCount = computed(() => this.peerSites().length);

  // ---- KPI tiles -------------------------------------------------------
  readonly kpiTiles = computed<KpiTile[]>(() => {
    const sd = this.selectedSiteData();
    const peers = this.peerSites();
    if (!sd || peers.length === 0) return [];
    const site = this.site();
    return sd.metrics.map(m => {
      const ranking = this.rankingForMetric(m.key, peers);
      const total = ranking.length || peers.length || 1;
      const idx = ranking.findIndex(r => r.site === site);
      const rank = idx >= 0 ? idx + 1 : total;
      const tier = this.tierFor(rank, total);
      return {
        key:        m.key,
        label:      this.shortMetricLabel(m.label, m.key),
        rank,
        totalSites: total,
        tier,
        gapValue:   this.gapFor(rank, total),
        direction:  (m.direction ?? 'higher_better') as PnlMetricDirection,
      } satisfies KpiTile;
    });
  });

  readonly selectedDetail = computed(() => {
    const tiles = this.kpiTiles();
    if (tiles.length === 0) return undefined;
    const id = this.selectedMetric() || tiles[0]!.key;
    const tile = tiles.find(t => t.key === id) ?? tiles[0]!;
    const median = Math.ceil(tile.totalSites / 2);
    const ranksFromMedian = median - tile.rank;
    return {
      kpiLabel:   tile.label,
      rank:       tile.rank,
      totalSites: tile.totalSites,
      percentile: Math.max(1, Math.round((tile.rank / tile.totalSites) * 100)),
      ranksFromMedian,
      aboveMedian: ranksFromMedian > 0,
    };
  });

  readonly siteTags = computed<string[]>(() => {
    const sd = this.selectedSiteData();
    if (!sd) return [];
    return [sd.archetype, sd.subgroup].filter(Boolean) as string[];
  });

  readonly strengths = computed(() =>
    this.kpiTiles().slice().sort((a, b) => a.rank - b.rank).slice(0, 3));
  readonly opportunities = computed(() =>
    this.kpiTiles().slice().sort((a, b) => b.rank - a.rank).slice(0, 3));

  // ---- Full ranking ----------------------------------------------------
  readonly fullRanking = computed<RankRow[]>(() => {
    const ranking = this.rankingForActive();
    return ranking.map((r, i) => ({
      rank:        i + 1,
      site:        r.site,
      displayName: this.siteDisplayName(r.site) || r.site,
      archetype:   this.archetypeForSite(r.site),
      value:       r.value,
    }));
  });

  readonly fullRankingTier = computed<RankRow[]>(() => {
    const all = this.fullRanking();
    if (this.rankTier() === 'all') return all;
    const third = Math.max(1, Math.ceil(all.length / 3));
    if (this.rankTier() === 'top')    return all.slice(0, third);
    if (this.rankTier() === 'middle') return all.slice(third, 2 * third);
    return all.slice(2 * third);
  });

  // ---- Site Comparison -------------------------------------------------
  readonly comparisonRows = computed(() => {
    const b = this.benchmarks();
    const a = this.compareA();
    const c = this.compareB();
    if (!b || !a || !c || a === c) return [];
    const sdA = b.benchmarks?.[a];
    if (!sdA) return [];
    // Comparisons are always across the full Cosma peer set (53 sites).
    const peers = Object.keys(b.benchmarks ?? {});
    return sdA.metrics.map(m => {
      const ranking = this.rankingForMetric(m.key, peers);
      const total = ranking.length || peers.length || 1;
      const aIdx = ranking.findIndex(r => r.site === a);
      const bIdx = ranking.findIndex(r => r.site === c);
      const aRank = aIdx >= 0 ? aIdx + 1 : total;
      const bRank = bIdx >= 0 ? bIdx + 1 : total;
      const gap = Math.abs(aRank - bRank);
      const advantage = aRank === bRank ? '' : (aRank < bRank ? a : c);
      return {
        metric:           this.shortMetricLabel(m.label, m.key),
        aRank,
        bRank,
        totalSites:       total,
        gapLabel:         this.gapBucketForRanks(gap, total),
        advantage,
        advantageDisplay: advantage ? this.siteDisplayName(advantage) : '',
      };
    });
  });

  // ---- Helpers ---------------------------------------------------------
  siteDisplayName(key: string): string {
    if (!key) return '';
    const b = this.benchmarks();
    return b?.siteDisplayNames?.[key] ?? key;
  }

  /** Best-effort archetype for a given site, used by the Full Ranking column. */
  private archetypeForSite(site: string): string {
    const b = this.benchmarks();
    if (!b) return '';
    return b.benchmarks?.[site]?.archetype ?? '';
  }

  tierLabel(t: Tier): string {
    if (t === 'top-decile')   return 'Top 10%';
    if (t === 'top-quartile') return 'Top 25%';
    if (t === 'top-half')     return 'Top 50%';
    return 'Bottom 50%';
  }
  tierClass(t: Tier): string {
    if (t === 'top-decile')   return 'tier-top-decile';
    if (t === 'top-quartile') return 'tier-top-quartile';
    if (t === 'top-half')     return 'tier-top-half';
    return 'tier-bottom-half';
  }
  tierTarget(t: Tier): string {
    if (t === 'top-decile')   return 'Best in class';
    if (t === 'top-quartile') return 'To decile';
    if (t === 'top-half')     return 'To quartile';
    return 'To median';
  }

  /**
   * Format a metric value for the Full Ranking table. Ratio-style metrics
   * (0–1 floats) display as percentages with two decimals; everything else
   * displays as a compact number with grouped thousands.
   */
  formatMetricValue(v?: number | null): string {
    if (v == null || Number.isNaN(v)) return '—';
    if (Math.abs(v) <= 1.5) return `${(v * 100).toFixed(2)}%`;
    return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }

  // ---- Internal --------------------------------------------------------

  /**
   * Short tile-friendly labels matching the offline reference:
   *   profitability         → Profitability
   *   opex_ratio            → Operating
   *   labour_benefits_ratio → Production labour
   *   wages_ratio           → Wages
   *   prod_materials_ratio  → Materials
   *   voh_ratio             → VOH
   *   scrap_ratio           → Scrap
   *
   * Falls back to a clean version of the source label for any extra metrics
   * the upstream bundle may add later.
   */
  private static readonly TILE_LABEL_BY_KEY: Readonly<Record<string, string>> = {
    profitability:         'Profitability',
    opex_ratio:            'Operating',
    labour_benefits_ratio: 'Production labour',
    wages_ratio:           'Wages',
    prod_materials_ratio:  'Materials',
    voh_ratio:             'VOH',
    scrap_ratio:           'Scrap',
  };
  private shortMetricLabel(label: string, key?: string): string {
    if (key && PnlBenchmarkingComponent.TILE_LABEL_BY_KEY[key]) {
      return PnlBenchmarkingComponent.TILE_LABEL_BY_KEY[key]!;
    }
    return label
      .replace(' expense ratio', '')
      .replace(' & benefits', '')
      .replace('Revenue per headcount', 'Revenue per headc…')
      .trim();
  }

  private tierFor(rank: number, total: number): Tier {
    const pct = rank / total;
    if (pct <= 0.10) return 'top-decile';
    if (pct <= 0.25) return 'top-quartile';
    if (pct <= 0.50) return 'top-half';
    return 'bottom-half';
  }

  private gapFor(rank: number, total: number): string {
    const pct = rank / total;
    if (pct <= 0.10) return 'No gap';
    if (pct <= 0.25) return '< 1 pp';
    if (pct <= 0.50) return '1 – 2 pp';
    if (pct <= 0.75) return '2 – 5 pp';
    return '> 5 pp';
  }

  private gapBucketForRanks(gap: number, total: number): string {
    if (gap === 0) return 'tied';
    const pct = gap / total;
    if (pct <= 0.10) return '< 1 pp';
    if (pct <= 0.25) return '1 – 2 pp';
    if (pct <= 0.50) return '2 – 5 pp';
    return '> 5 pp';
  }

  constructor() {
    // Auto-select the first available site when data lands.
    effect(() => {
      const sites = this.allSites();
      if (!this.site() && sites.length > 0) {
        queueMicrotask(() => this.site.set(sites[0]!.key));
      }
    });

    // Auto-select the first metric (typically Profitability) once a site is
    // chosen; this drives the KPI Summary detail card and Full Ranking.
    effect(() => {
      const sd = this.selectedSiteData();
      if (sd && !this.selectedMetric() && sd.metrics.length > 0) {
        queueMicrotask(() => this.selectedMetric.set(sd.metrics[0]!.key));
      }
    });

    // Seed the Site Comparison selectors as soon as the site list is known.
    effect(() => {
      const sites = this.allSites();
      const current = this.site();
      if (sites.length >= 2) {
        if (!this.compareA()) {
          queueMicrotask(() => this.compareA.set(current || sites[0]!.key));
        }
        if (!this.compareB()) {
          queueMicrotask(() => {
            const a = this.compareA() || sites[0]!.key;
            const fallback = sites.find(s => s.key !== a) ?? sites[1]!;
            this.compareB.set(fallback.key);
          });
        }
      }
    });

    void this.archetypeSvc.ensureLoadedAsync();
  }
}
