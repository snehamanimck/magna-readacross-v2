import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule, NgClass } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

import {
  IInitiative,
  IKnowledgeCenterAsset,
  IPnlBenchmarks,
  IPnlRecommendation,
  IThoughtStarter,
  IVideoLibraryAsset,
} from '@app/models';
import { ReadAcrossAppService } from '@domains/read-across';
import {
  DashboardChromeService,
  DrilldownService,
  InitiativeCacheService,
  IPnlRecCard,
  ISiteCostBase,
  PnlRecService,
} from '@app/core-services';
import { FmtDollarPipe } from '../../shared/pipes/format.pipe';
import { PnlBenchmarkingComponent } from './pnl-benchmarking.component';

type Tab = 'pnl' | 'pnl-recs' | 'thought-starters' | 'knowledge' | 'video';
type SpendCat = 'DL' | 'IDL' | 'MC' | 'VOH';

const SPEND_CATS: SpendCat[] = ['DL', 'IDL', 'MC', 'VOH'];

/**
 * Insights & Inspiration. Production has five sub-tabs:
 *   1. P&L Benchmarking — site-level rank summary (table for now).
 *   2. P&L-Informed Recommendations — ranked cards per site, gated by
 *      a subgroup pill row.
 *   3. Thought Starters — pill-filtered list grouped by lever.
 *   4. Knowledge Center — pill-filtered slide cards.
 *   5. Video Library — pill-filtered video card grid.
 */
@Component({
  standalone: true,
  imports: [CommonModule, NgClass, FmtDollarPipe, PnlBenchmarkingComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-5">
      <header>
        <h1 class="text-[22px] font-bold text-gray-1 tracking-tight">Insights &amp; Inspiration</h1>
      </header>

      <!-- Sub-tabs -->
      <nav class="flex flex-wrap gap-0 border-b border-gray-f0" role="tablist">
        @for (t of tabs; track t.id) {
          <button
            type="button"
            role="tab"
            [attr.aria-selected]="active() === t.id"
            class="relative px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors"
            [class.border-aqua-6]="active() === t.id"
            [class.text-aqua-6]="active() === t.id"
            [class.border-transparent]="active() !== t.id"
            [class.text-gray-6]="active() !== t.id"
            [class.hover:text-aqua-6]="active() !== t.id"
            [class.hover:bg-aqua-1/40]="active() !== t.id"
            (click)="active.set(t.id)">
            {{ t.label }}
          </button>
        }
      </nav>

      <!-- Active tab body -->
      <section>
        @switch (active()) {

          @case ('pnl') {
            @if (pnlBenchmarks() === undefined) {
              <div class="card p-12 text-center text-gray-7 text-sm">Loading P&amp;L data…</div>
            } @else {
              <mra-pnl-benchmarking [benchmarks]="pnlBenchmarks()"></mra-pnl-benchmarking>
            }
          }

          @case ('pnl-recs') {
            <div class="flex flex-col gap-4">
              <header>
                <h2 class="text-base font-bold text-gray-1">P&amp;L-Informed Site Recommendations</h2>
                <p class="mt-1 text-[13px] text-gray-6 max-w-3xl">
                  For each Cosma site, the top 3 heatmap rows are identified where peer evidence and
                  the site's P&amp;L performance suggest the greatest improvement opportunity. Each
                  recommendation maps directly to a row on the initiative heatmap, sized to the
                  site's own cost base.
                </p>
              </header>

              <!-- Subgroup pill row (regions: APAC, Brazil, Canada, …) -->
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="text-[11px] font-medium text-gray-6 mr-1">Subgroup:</span>
                <button type="button" class="pill"
                        [class.pill-on]="!recSubgroup()"
                        [class.pill-off]="!!recSubgroup()"
                        (click)="recSubgroup.set('')">All</button>
                @for (g of recSubgroups(); track g) {
                  <button type="button" class="pill"
                          [class.pill-on]="recSubgroup() === g"
                          [class.pill-off]="recSubgroup() !== g"
                          (click)="recSubgroup.set(g)">{{ g }}</button>
                }
              </div>

              <!-- "How it works" methodology disclosure -->
              <div>
                <button type="button"
                        class="text-[11px] text-magna-red font-medium hover:underline"
                        (click)="recsHowItWorksOpen.set(!recsHowItWorksOpen())"
                        [attr.aria-expanded]="recsHowItWorksOpen()"
                        aria-controls="pnl-rec-methodology">
                  How it works {{ recsHowItWorksOpen() ? '▴' : '▾' }}
                </button>
                @if (recsHowItWorksOpen()) {
                  <div id="pnl-rec-methodology"
                       class="mt-2 p-4 rounded-digi border border-gray-f0 bg-gray-f9 text-[12px]
                              text-gray-3 leading-relaxed max-w-3xl">
                    <p class="font-semibold text-gray-1 mb-2">How recommendations are generated</p>
                    <p class="mb-2">
                      Each recommendation points to a specific heatmap row — a unique combination of
                      spend category, manufacturing process, lever, and sub-lever. For
                      <strong>DL</strong> rows, a site must match its archetype's typical
                      manufacturing processes <em>and</em> have at least one categorized Cosma DL
                      initiative in that manufacturing process. The engine scores every eligible row
                      using a weighted composite of five factors:
                    </p>
                    <ul class="list-disc ml-4 mb-2 space-y-1">
                      <li><strong>NRB opportunity (35%)</strong> — estimated dollar opportunity scaled to
                        the site's cost base; rows with larger achievable NRB rank higher regardless
                        of whitespace status.</li>
                      <li><strong>P&amp;L relevance (20%)</strong> — rows aligned to the site's weakest
                        P&amp;L ratios (labor, VOH, scrap) are prioritized.</li>
                      <li><strong>Archetype match (15%)</strong> — rows where sites of the same archetype
                        have meaningful activity are weighted higher.</li>
                      <li><strong>NRB shortfall (15%)</strong> — how far the site's NRB lags the peer
                        median in that row; whitespace and under-represented rows both contribute
                        proportionally.</li>
                      <li><strong>Region / subgroup match (10%)</strong> — peer presence within the
                        same subgroup adds relevance.</li>
                      <li><strong>Whitespace bonus (+5%)</strong> — small tiebreaker for rows where the
                        site has zero initiatives.</li>
                    </ul>
                    <p>
                      <strong>Opportunity sizing:</strong> Peer NRB is scaled by the ratio of the
                      site's relevant cost base (Production L&amp;B + Wages + VOH + Scrap, trailing 3
                      months × 12) to the peer cost base, with a reasonableness discount of 60% for
                      whitespace rows and 40% for under-represented rows.
                    </p>
                  </div>
                }
              </div>

              @if (pnlBenchmarks() === undefined || initiatives() === undefined) {
                <div class="text-sm text-gray-7">Loading recommendations…</div>
              } @else if (recSiteGroups().length === 0) {
                <div class="card p-12 text-sm text-gray-7 text-center">
                  No Cosma sites match the current subgroup.
                </div>
              } @else {
                <div class="text-[11px] text-gray-6">
                  {{ recSiteGroups().length }} of {{ recsAllSiteCount() }} Cosma sites shown
                </div>

                <div class="flex flex-col gap-4">
                  @for (sg of recSiteGroups(); track sg.site) {
                    <article class="card overflow-hidden">
                      <header class="px-5 py-3 bg-gray-f9 border-b border-gray-f0
                                     flex items-center gap-3 flex-wrap">
                        <h3 class="text-base font-bold text-gray-1">{{ sg.site }}</h3>
                        @if (sg.subgroup) {
                          <span class="text-[11px] text-gray-6">{{ sg.subgroup }}</span>
                        }
                        @if (sg.archetype) {
                          <span class="px-1.5 py-0.5 rounded text-[10px] font-medium
                                       bg-aqua-1 text-aqua-6 border border-aqua-3">
                            {{ sg.archetype }}
                          </span>
                        }
                        @if (sg.costBase) {
                          <span class="text-[10px] text-gray-7 ml-auto">
                            Relevant cost base: <span class="tabular-nums">{{ sg.costBase.annualized | fmtDollar }}</span>/yr
                          </span>
                        }
                      </header>

                      @if (sg.recs.length === 0) {
                        <div class="px-5 py-6 text-center text-sm text-gray-7">
                          Insufficient peer data to generate heatmap-row recommendations for this site.
                        </div>
                      } @else {
                        <div class="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0
                                    md:divide-x divide-gray-f0">
                          @for (rec of sg.recs; track rec.row.key) {
                            <div class="px-4 py-4 flex flex-col gap-2"
                                 [class.cursor-pointer]="rec.drillInits.length > 0"
                                 [class.hover:bg-gray-f9]="rec.drillInits.length > 0"
                                 (click)="openRecDrill(sg, rec)">
                              <div class="flex items-center gap-2 flex-wrap">
                                <span class="rec-rank-pip">{{ rec.rank }}</span>
                                <span class="px-1.5 py-0.5 rounded text-[10px] font-bold"
                                      [ngClass]="recScClass(rec.row.sc)">
                                  {{ rec.row.sc }}
                                </span>
                                <span class="px-1.5 py-0.5 rounded text-[10px] font-medium border"
                                      [ngClass]="rec.isWhitespace
                                        ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                                        : 'text-amber-700 bg-amber-50 border-amber-200'">
                                  {{ rec.isWhitespace ? 'True whitespace' : 'Under-represented lever' }}
                                </span>
                              </div>

                              <div class="font-semibold text-sm text-gray-1 leading-snug">
                                {{ recBreadcrumb(rec.row) }}
                              </div>

                              @if (rec.opportunity > 0) {
                                <div class="flex items-center gap-1.5">
                                  <span class="text-xs font-bold text-emerald-700 tabular-nums">
                                    {{ rec.opportunity | fmtDollar }}
                                  </span>
                                  <span class="text-[10px] text-gray-7">est. achievable opportunity</span>
                                </div>
                              }

                              @if (!rec.isWhitespace && rec.siteCount > 0) {
                                <div class="text-[10px] text-gray-6">
                                  Site has {{ rec.siteCount }} initiative{{ rec.siteCount === 1 ? '' : 's' }}
                                  ({{ rec.siteNrb | fmtDollar }} NRB) vs. peer median
                                  {{ rec.peerMedianNrb | fmtDollar }}
                                </div>
                              }

                              <div class="flex items-center gap-2">
                                <div class="flex-1 h-1.5 rounded-full bg-gray-f0 overflow-hidden">
                                  <div class="h-full rounded-full bg-aqua-6"
                                       [style.width.%]="recPeerBarPct(rec)"></div>
                                </div>
                                <span class="text-[11px] font-semibold text-gray-3 whitespace-nowrap">
                                  {{ rec.totalPeerCount }} peer sites ({{ rec.archPeerCount }} same archetype)
                                </span>
                              </div>

                              @if (rec.drillInits.length > 0) {
                                <div class="text-[10px] text-gray-7">
                                  {{ rec.drillInits.length }} targeted initiatives • click to explore
                                </div>
                              }
                            </div>
                          }
                        </div>
                      }
                    </article>
                  }
                </div>
              }
            </div>
          }

          @case ('thought-starters') {
            <div class="flex flex-col gap-4">
              <header>
                <h2 class="text-base font-bold text-gray-1">Thought Starters</h2>
                <p class="mt-1 text-[13px] text-gray-6">
                  {{ thoughtStarters()?.length ?? 0 }} thought starters, organized by spend category and lever.
                </p>
              </header>

              <!-- Spend category pill row -->
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="text-[11px] font-medium text-gray-6 mr-1">Category:</span>
                <button type="button" class="pill"
                        [class.pill-on]="!tsCategory()"
                        [class.pill-off]="!!tsCategory()"
                        (click)="tsCategory.set('')">All</button>
                @for (cat of spendCategories; track cat) {
                  <button type="button" class="pill"
                          [class.pill-on]="tsCategory() === cat"
                          [class.pill-off]="tsCategory() !== cat"
                          (click)="tsCategory.set(cat)">{{ cat }}</button>
                }
              </div>

              @if (thoughtStarters() === undefined) {
                <div class="text-sm text-gray-7">Loading thought starters…</div>
              } @else if (tsFiltered().length === 0) {
                <div class="card p-12 text-sm text-gray-7 text-center">No thought starters found.</div>
              } @else {
                @for (catGroup of tsByCategory(); track catGroup.category) {
                  <article class="card overflow-hidden">
                    <div class="section-rail flex items-center gap-2">
                      <span class="font-bold text-base">{{ catGroup.category }}</span>
                      <span class="section-rail-meta">
                        {{ catGroup.count }} thought starters across {{ catGroup.leverCount }} levers
                      </span>
                    </div>
                    <div class="p-4 flex flex-col gap-3">
                      @for (lever of catGroup.levers; track lever.name) {
                        <div [attr.data-lever-anchor]="lever.name"
                             [class.lever-highlight]="highlightedLever() === lever.name">
                          <div class="flex items-center justify-between mb-2">
                            <h4 class="text-aqua-6 text-sm font-semibold">{{ lever.name }}</h4>
                            <span class="badge badge-info">{{ lever.items.length }}</span>
                          </div>
                          <div class="flex flex-col gap-2">
                            @for (ts of lever.items; track ts.thoughtStarterId) {
                              <div class="rounded-digi border border-gray-f0 bg-gray-f9 px-3 py-2.5">
                                <p class="text-sm text-gray-1 leading-snug">{{ ts.text }}</p>
                                <div class="mt-1.5 flex items-center gap-1.5 flex-wrap">
                                  @if (ts.mfgProcess) { <span class="badge badge-neutral" style="text-transform:none">{{ ts.mfgProcess }}</span> }
                                  @if (ts.subLever)   { <span class="badge badge-neutral" style="text-transform:none">{{ ts.subLever }}</span> }
                                </div>
                              </div>
                            }
                          </div>
                        </div>
                      }
                    </div>
                  </article>
                }
              }
            </div>
          }

          @case ('knowledge') {
            <div class="flex flex-col gap-4">
              <header>
                <h2 class="text-base font-bold text-gray-1">Knowledge Center</h2>
                <p class="mt-1 text-[13px] text-gray-6">
                  {{ knowledgeAssets()?.length ?? 0 }} use-case slides organized by taxonomy.
                </p>
              </header>

              <!-- Spend category pill row -->
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="text-[11px] font-medium text-gray-6 mr-1">Category:</span>
                <button type="button" class="pill"
                        [class.pill-on]="!kcCategory()"
                        [class.pill-off]="!!kcCategory()"
                        (click)="kcCategory.set('')">All</button>
                @for (cat of spendCategories; track cat) {
                  <button type="button" class="pill"
                          [class.pill-on]="kcCategory() === cat"
                          [class.pill-off]="kcCategory() !== cat"
                          (click)="kcCategory.set(cat)">{{ cat }}</button>
                }
              </div>

              @if (knowledgeAssets() === undefined) {
                <div class="text-sm text-gray-7">Loading knowledge assets…</div>
              } @else if (kcFiltered().length === 0) {
                <div class="card p-12 text-sm text-gray-7 text-center">No knowledge assets found.</div>
              } @else {
                <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                  @for (asset of kcFiltered(); track asset.knowledgeAssetId) {
                    <article class="card overflow-hidden hover:shadow-digi transition-shadow flex flex-col">
                      <div class="border-b border-gray-f0 bg-gray-f9 p-2 flex items-center justify-center">
                        @if (isPdf(asset.slideUrl)) {
                          <embed [src]="asset.slideUrl" type="application/pdf"
                                 class="block w-full h-72 rounded" />
                        } @else {
                          <img [src]="asset.slideUrl" [alt]="asset.title"
                               loading="lazy" decoding="async"
                               class="block w-full max-h-72 object-contain rounded" />
                        }
                      </div>
                      <div class="p-4 flex-1 flex flex-col">
                        <div class="flex items-start gap-2 flex-wrap">
                          <h3 class="text-sm font-bold text-gray-1 flex-1">{{ asset.title }}</h3>
                        </div>
                        <div class="mt-1 flex items-center gap-1.5 flex-wrap">
                          @if (asset.spendCategory) { <span class="badge badge-info">{{ asset.spendCategory }}</span> }
                          @if (asset.workstream)    { <span class="badge badge-neutral" style="text-transform:none">{{ asset.workstream }}</span> }
                        </div>
                        @if (asset.description) {
                          <p class="mt-3 text-sm text-gray-3 leading-relaxed">{{ asset.description }}</p>
                        }
                        <a class="mt-auto pt-3 btn-tertiary btn-sm !px-0 self-start"
                           [href]="asset.slideUrl"
                           target="_blank" rel="noopener noreferrer"
                           title="Open this slide full-size in a new tab">
                          Open full size
                          <svg class="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor"
                               stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <path d="M6 3h7v7" /><path d="m13 3-8 8" />
                          </svg>
                        </a>
                      </div>
                    </article>
                  }
                </div>
              }
            </div>
          }

          @case ('video') {
            <div class="flex flex-col gap-4">
              <header>
                <h2 class="text-base font-bold text-gray-1">Video Library</h2>
                <p class="mt-1 text-[13px] text-gray-6">
                  Curated videos related to the Magna initiative read-across.
                </p>
              </header>

              <!-- Spend category pill row -->
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="text-[11px] font-medium text-gray-6 mr-1">Category:</span>
                <button type="button" class="pill"
                        [class.pill-on]="!vlCategory()"
                        [class.pill-off]="!!vlCategory()"
                        (click)="vlCategory.set('')">All</button>
                @for (cat of spendCategories; track cat) {
                  <button type="button" class="pill"
                          [class.pill-on]="vlCategory() === cat"
                          [class.pill-off]="vlCategory() !== cat"
                          (click)="vlCategory.set(cat)">{{ cat }}</button>
                }
              </div>

              @if (videoAssets() === undefined) {
                <div class="text-sm text-gray-7">Loading videos…</div>
              } @else if (vlFiltered().length === 0) {
                <div class="card p-12 text-sm text-gray-7 text-center">No videos found.</div>
              } @else {
                <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
                  @for (video of vlFiltered(); track video.videoAssetId) {
                    <article class="card overflow-hidden hover:shadow-digi transition-shadow flex flex-col">
                      <div class="aspect-video bg-gray-1">
                        <!--
                          preload="metadata" — fetches headers only on first paint
                          so we don't pull every MP4 in the grid; the user pays
                          full bandwidth only after pressing play.
                        -->
                        <video class="h-full w-full object-contain bg-gray-1"
                               controls preload="metadata"
                               [attr.poster]="video.thumbnailUrl ?? null"
                               [attr.aria-label]="video.title">
                          <source [src]="video.videoUrl" type="video/mp4" />
                          <a [href]="video.videoUrl" target="_blank" rel="noopener noreferrer">
                            Download {{ video.title }}
                          </a>
                        </video>
                      </div>
                      <div class="p-4 flex-1 flex flex-col">
                        <div class="flex items-start justify-between gap-2">
                          <h3 class="text-sm font-bold text-gray-1 flex-1">{{ video.title }}</h3>
                          @if (video.durationSeconds) {
                            <span class="badge badge-neutral">{{ formatDuration(video.durationSeconds) }}</span>
                          }
                        </div>
                        <div class="mt-1.5 flex items-center gap-1.5 flex-wrap">
                          @if (video.spendCategory) { <span class="badge badge-info">{{ video.spendCategory }}</span> }
                          @if (video.workstream)    { <span class="badge badge-neutral" style="text-transform:none">{{ video.workstream }}</span> }
                        </div>
                        @if (video.description) {
                          <p class="mt-3 text-sm text-gray-3 leading-relaxed line-clamp-3">{{ video.description }}</p>
                        }
                      </div>
                    </article>
                  }
                </div>
              }
            </div>
          }
        }
      </section>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .rec-rank-pip {
      /* Numbered chip on each P&L recommendation card. Matches the
         legacy magna-red circle from \`renderPnlRecommendations\`. */
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      border-radius: 9999px;
      font-size: 10px;
      font-weight: 700;
      background-color: #C8102E;
      color: #FFFFFF;
      flex-shrink: 0;
    }
    .line-clamp-3 {
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .lever-highlight {
      animation: leverPulse 2.4s ease-out 1;
      border-radius: 6px;
    }
    @keyframes leverPulse {
      0%   { background-color: rgba(255, 185, 0, 0.30); }
      100% { background-color: transparent; }
    }
  `],
})
export class InsightsPageComponent implements AfterViewInit {
  readonly tabs: { id: Tab; label: string }[] = [
    { id: 'pnl',              label: 'P&L Benchmarking' },
    { id: 'pnl-recs',         label: 'P&L-Informed Recommendations' },
    { id: 'thought-starters', label: 'Thought Starters' },
    { id: 'knowledge',        label: 'Knowledge Center' },
    { id: 'video',            label: 'Video Library' },
  ];
  readonly active = signal<Tab>('pnl');

  readonly spendCategories = SPEND_CATS;

  // Per-tab state.
  readonly recSubgroup       = signal<string>('');
  readonly recsHowItWorksOpen = signal<boolean>(false);
  readonly tsCategory   = signal<SpendCat | ''>('');
  readonly kcCategory   = signal<SpendCat | ''>('');
  readonly vlCategory   = signal<SpendCat | ''>('');

  // Server-loaded data.
  /** Curated P&L benchmarks blob (53 Cosma + PT + Exteriors sites). */
  readonly pnlBenchmarks = signal<IPnlBenchmarks | undefined>(undefined);
  readonly pnlRecommendations = signal<IPnlRecommendation[] | undefined>(undefined);
  readonly initiatives   = signal<readonly IInitiative[] | undefined>(undefined);
  readonly thoughtStarters = signal<IThoughtStarter[] | undefined>(undefined);
  readonly knowledgeAssets = signal<IKnowledgeCenterAsset[] | undefined>(undefined);
  readonly videoAssets = signal<IVideoLibraryAsset[] | undefined>(undefined);
  readonly highlightedLever = signal<string>('');

  private readonly appService = inject(ReadAcrossAppService);
  private readonly route = inject(ActivatedRoute);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly drilldown = inject(DrilldownService);
  private readonly initiativeCache = inject(InitiativeCacheService);
  private readonly pnlRecs = inject(PnlRecService);
  protected readonly chrome = inject(DashboardChromeService);

  // ---- P&L Recommendations helpers -------------------------------------

  /**
   * Compute every Cosma site's top-3 recommendations by replaying the
   * legacy `_computeSiteRecommendations` algorithm in TypeScript. Cached on
   * the bench/inits inputs so the heavy heatmap-row index isn't rebuilt on
   * every subgroup-pill click.
   */
  private readonly recsAllSites = computed(() => {
    const bench = this.pnlBenchmarks();
    const inits = this.initiatives();
    if (!bench || !inits) return [];
    const apiRecs = this.pnlRecommendations() ?? [];
    if (apiRecs.length === 0) {
      return this.pnlRecs.computeAll(bench, inits);
    }

    const grouped = new Map<string, IPnlRecommendation[]>();
    for (const rec of apiRecs) {
      if (rec.workstream !== 'Cosma') continue;
      const list = grouped.get(rec.site) ?? [];
      list.push(rec);
      grouped.set(rec.site, list);
    }

    return Array.from(grouped.entries()).map(([site, recs]) => {
      const sd = bench.benchmarks?.[site];
      const archetype = sd?.archetype ?? bench.siteArchetypes?.[site]?.[0];
      const subgroup = sd?.subgroup;
      const costBase = this.pnlRecs.getSiteCostBase(site, bench);
      const mapped: IPnlRecCard[] = recs
        .sort((a, b) => a.priorityRank - b.priorityRank)
        .slice(0, 3)
        .map((r, idx) => ({
          rank: r.priorityRank || idx + 1,
          row: {
            key: `${r.spendCategory ?? 'Other'}||${r.recommendationText ?? ''}`,
            sc: r.spendCategory ?? 'Other',
            mp: '',
            lv: r.recommendationText ?? '',
            sl: '',
            sites: {},
          },
          isWhitespace: true,
          nrbShortfall: 0,
          siteNrb: 0,
          siteCount: 0,
          peerMedianNrb: r.benchmarkMedian ?? 0,
          totalPeerCount: r.deploymentCount ?? 0,
          archPeerCount: r.deploymentCount ?? 0,
          opportunity: r.whitespaceEstimate ?? r.opportunityAmount ?? 0,
          bestPeers: r.deployingDivisions ?? [],
          pnlGap: 0,
          archMatchPct: 0,
          regionMatchPct: 0,
          score: r.confidence ?? 0,
          drillInits: [],
        }));

      return { site, archetype, subgroup, costBase, recs: mapped };
    });
  });

  /** Distinct subgroups across all Cosma sites — drives the pill row. */
  readonly recSubgroups = computed<string[]>(() => {
    const set = new Set<string>();
    for (const sg of this.recsAllSites()) {
      if (sg.subgroup) set.add(sg.subgroup);
    }
    return Array.from(set).sort();
  });

  /** Cosma sites visible after the subgroup filter is applied. */
  readonly recSiteGroups = computed(() => {
    const sg = this.recSubgroup();
    const all = this.recsAllSites();
    if (!sg) return all;
    return all.filter(s => s.subgroup === sg);
  });

  /** Total Cosma site count for the "X of Y Cosma sites shown" header. */
  readonly recsAllSiteCount = computed(() => this.recsAllSites().length);

  // ---- Thought Starter helpers ------------------------------------------
  readonly tsFiltered = computed(() => {
    const cat = this.tsCategory();
    return (this.thoughtStarters() ?? []).filter(t =>
      !cat || this.matchesShortCat(t.spendCategory, cat));
  });
  readonly tsByCategory = computed(() => {
    type Lever = { name: string; items: IThoughtStarter[] };
    type Cat = { category: string; count: number; leverCount: number; levers: Lever[] };
    const map = new Map<string, Cat>();
    for (const t of this.tsFiltered()) {
      const cat = this.shortCat(t.spendCategory) || 'Other';
      let c = map.get(cat);
      if (!c) { c = { category: cat, count: 0, leverCount: 0, levers: [] }; map.set(cat, c); }
      c.count += 1;
      const leverName = t.lever || 'Other';
      let lever = c.levers.find(l => l.name === leverName);
      if (!lever) { lever = { name: leverName, items: [] }; c.levers.push(lever); }
      lever.items.push(t);
    }
    for (const c of map.values()) c.leverCount = c.levers.length;
    return Array.from(map.values()).sort((a, b) =>
      SPEND_CATS.indexOf(a.category as SpendCat) - SPEND_CATS.indexOf(b.category as SpendCat));
  });

  // ---- Knowledge Center helpers -----------------------------------------
  readonly kcFiltered = computed(() => {
    const cat = this.kcCategory();
    return (this.knowledgeAssets() ?? []).filter(a =>
      !cat || this.matchesShortCat(a.spendCategory, cat));
  });

  // ---- Video Library helpers --------------------------------------------
  readonly vlFiltered = computed(() => {
    const cat = this.vlCategory();
    return (this.videoAssets() ?? []).filter(v =>
      !cat || this.matchesShortCat(v.spendCategory, cat));
  });

  /**
   * Open the drilldown dialog seeded with the recommendation's targeted peer
   * initiatives (legacy `_selectDrilldownInits`). The site-card context is
   * pinned above the table so the user can see why these initiatives matter.
   */
  openRecDrill(
    sg: { site: string; archetype?: string; subgroup?: string; costBase?: ISiteCostBase },
    rec: IPnlRecCard,
  ): void {
    if (rec.drillInits.length === 0) return;
    const breadcrumb = this.recBreadcrumb(rec.row);
    const oppText = rec.isWhitespace ? 'True whitespace' : 'Under-represented lever';
    this.drilldown.open({
      title: `${sg.site} · ${breadcrumb}`,
      subtitle: rec.drillInits.length === 1
        ? '1 targeted initiative'
        : `${rec.drillInits.length} targeted initiatives`,
      items: rec.drillInits,
      context: {
        spendCategory: rec.row.sc || undefined,
        mfgProcess:    rec.row.mp || undefined,
        lever:         rec.row.lv || undefined,
        subLever:      rec.row.sl || undefined,
        site:          sg.site,
        workstream:    'Cosma',
      },
      pnlContext: {
        workstream:        'Cosma',
        site:              sg.site,
        archetype:         sg.archetype,
        opportunityAmount: rec.opportunity,
        recommendationText: `${oppText} — ${rec.totalPeerCount} peer sites (${rec.archPeerCount} same archetype)`,
        priorityRank:      rec.rank,
      },
    });
  }

  /** Renders a heatmap row's breadcrumb path (sc › mp › lv › sl). */
  recBreadcrumb(row: IPnlRecCard['row']): string {
    return [row.sc, row.mp, row.lv, row.sl].filter(Boolean).join(' \u203A ');
  }

  /** Tailwind classes for the spend-category badge on each rec card. */
  recScClass(sc: string): string {
    switch (sc) {
      case 'DL':                    return 'bg-blue-100 text-blue-800';
      case 'IDL':                   return 'bg-purple-100 text-purple-800';
      case 'VOH':                   return 'bg-amber-100 text-amber-800';
      case 'MC':
      case 'Material Conveyance':   return 'bg-green-100 text-green-800';
      default:                      return 'bg-gray-f0 text-gray-3';
    }
  }

  /**
   * Width of the peer-progress bar = `archPeerCount / totalPeerCount`.
   * Clamped to [0,100] so a degenerate row with zero peers doesn't blow up.
   */
  recPeerBarPct(rec: IPnlRecCard): number {
    return Math.min(100, Math.round(
      (rec.archPeerCount / Math.max(1, rec.totalPeerCount)) * 100,
    ));
  }

  // Map a "Material Conveyance" → "MC" so pill labels stay tight.
  private shortCat(value: string | undefined): SpendCat | undefined {
    if (!value) return undefined;
    if (value === 'Material Conveyance') return 'MC';
    if ((SPEND_CATS as readonly string[]).includes(value)) return value as SpendCat;
    return undefined;
  }
  private matchesShortCat(value: string | undefined, target: SpendCat): boolean {
    return this.shortCat(value) === target;
  }

  constructor() {
    void this.loadPnlBenchmarksAsync();
    void this.loadPnlRecommendationsAsync();
    void this.loadInitiativesAsync();
    void this.loadThoughtStartersAsync();
    void this.loadKnowledgeAssetsAsync();
    void this.loadVideoAssetsAsync();

    // React to deep-link query params (e.g. lever ★ click on the bucket page)
    // so the user lands on the right tab with the right filter pre-applied.
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const tab = params.get('tab');
        if (this.isTab(tab)) this.active.set(tab);
        const cat = this.shortCat(params.get('spendCategory') ?? undefined);
        if (cat) this.tsCategory.set(cat);
        // The buckets / heatmap pages emit `lever` plus an optional
        // `subLever`. Compose the most specific available value so the
        // scroll target matches the lever row in the rendered tree.
        const lever    = params.get('lever') ?? '';
        const subLever = params.get('subLever') ?? '';
        const target   = subLever || lever;
        this.highlightedLever.set(target);
        if (target) {
          // Re-fire scroll once the levers render. queueMicrotask isn't
          // enough — the data may still be loading from the API.
          this.scrollToLeverWhenReady(target);
        }
      });
  }

  ngAfterViewInit(): void {
    // First-paint scroll for the case where data was already cached.
    if (this.highlightedLever()) this.scrollToLeverWhenReady(this.highlightedLever());
  }

  private async loadPnlBenchmarksAsync(): Promise<void> {
    this.pnlBenchmarks.set(await this.appService.getPnlBenchmarksAsync());
  }

  private async loadInitiativesAsync(): Promise<void> {
    // Re-uses the shared cache that the heatmap / buckets pages already
    // populate, so navigating here doesn't trigger a duplicate network call.
    this.initiatives.set(await this.initiativeCache.getAllAsync());
  }

  private async loadPnlRecommendationsAsync(): Promise<void> {
    this.pnlRecommendations.set(await this.appService.getPnlRecommendationsAsync());
  }

  private async loadThoughtStartersAsync(): Promise<void> {
    this.thoughtStarters.set(await this.appService.getThoughtStartersAsync());
  }

  private async loadKnowledgeAssetsAsync(): Promise<void> {
    this.knowledgeAssets.set(await this.appService.getKnowledgeCenterAssetsAsync());
  }

  private async loadVideoAssetsAsync(): Promise<void> {
    this.videoAssets.set(await this.appService.getVideoLibraryAssetsAsync());
  }

  formatDuration(seconds?: number): string {
    if (!seconds || seconds <= 0) return 'n/a';
    const mins = Math.floor(seconds / 60);
    const rem = seconds % 60;
    return `${mins}:${String(rem).padStart(2, '0')}`;
  }

  /**
   * The Knowledge Center renders PNG/JPG slides as <img> and PDF decks as
   * <embed type="application/pdf">. Defaults to image when the URL has no
   * recognisable extension so unknown future formats stay viewable.
   */
  isPdf(url: string | undefined | null): boolean {
    return !!url && url.toLowerCase().split('?')[0]!.endsWith('.pdf');
  }

  private isTab(value: string | null): value is Tab {
    return !!value && this.tabs.some(t => t.id === value);
  }

  /**
   * Polls until the lever heading is in the DOM (the thought-starter list
   * loads asynchronously), then scrolls it into view. Bails after ~3 s so we
   * never leak a long-running interval.
   */
  private scrollToLeverWhenReady(lever: string): void {
    const start = Date.now();
    const tick = () => {
      const target = this.host.nativeElement.querySelector<HTMLElement>(
        `[data-lever-anchor="${CSS.escape(lever)}"]`,
      );
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      if (Date.now() - start < 3000) {
        setTimeout(tick, 120);
      }
    };
    setTimeout(tick, 80);
  }
}
