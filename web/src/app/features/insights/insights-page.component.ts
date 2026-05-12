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
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

import {
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
  imports: [CommonModule, FmtDollarPipe, PnlBenchmarkingComponent],
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

              <!-- Subgroup pill row -->
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

              @if (pnlRecommendations() === undefined) {
                <div class="text-sm text-gray-7">Loading recommendations…</div>
              } @else if (recsFiltered().length === 0) {
                <div class="card p-12 text-sm text-gray-7 text-center">
                  No recommendations match the current subgroup.
                </div>
              } @else {
                <div class="flex flex-col gap-4">
                  @for (siteGroup of recsBySite(); track siteGroup.site) {
                    <article class="card p-4">
                      <div class="flex items-center gap-2 flex-wrap">
                        <h3 class="text-base font-bold text-gray-1">{{ siteGroup.site }}</h3>
                        @if (siteGroup.archetype) {
                          <span class="badge badge-info">{{ siteGroup.archetype }}</span>
                        }
                      </div>
                      <div class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                        @for (rec of siteGroup.recs.slice(0, 3); track rec.pnlRecommendationId; let i = $index) {
                          <div class="rounded-digi border border-gray-f0 bg-white p-3 hover:shadow-digi transition-shadow flex flex-col">
                            <div class="flex items-start gap-2">
                              <span class="rec-rank-badge"
                                    [class.ws-cosma-bg]="rec.workstream === 'Cosma'"
                                    [class.ws-pt-bg]="rec.workstream === 'Powertrain'"
                                    [class.ws-ext-bg]="rec.workstream === 'Exteriors'">
                                {{ i + 1 }}
                              </span>
                              <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-1.5 flex-wrap">
                                  <span class="badge badge-info" style="text-transform:none">
                                    {{ rec.workstream }}
                                  </span>
                                  @if (rec.archetype) {
                                    <span class="badge badge-neutral" style="text-transform:none"
                                          title="Anchor archetype">
                                      {{ rec.archetype }}
                                    </span>
                                  }
                                  @if (rec.initiativeId && chrome.isPriority(rec.initiativeId)) {
                                    <span class="inline-flex items-center gap-1 text-[10px] font-semibold
                                                 px-1.5 py-0.5 rounded-full"
                                          style="color:#047857;background-color:#ECFDF5"
                                          title="Source initiative is a Best Practice candidate">
                                      <svg class="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 20 20"
                                           aria-hidden="true">
                                        <path fill-rule="evenodd"
                                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75
                                                 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06
                                                 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                                              clip-rule="evenodd" />
                                      </svg>
                                      Best Practice
                                    </span>
                                  } @else {
                                    <span class="text-[10px] text-success-2 font-semibold uppercase">
                                      True whitespace
                                    </span>
                                  }
                                </div>
                                <p class="mt-2 text-sm text-gray-1 leading-snug">
                                  {{ rec.recommendationText }}
                                </p>
                                <div class="mt-2 text-[11px] text-gray-6">
                                  <span class="font-bold text-aqua-6 tabular-nums">
                                    {{ rec.opportunityAmount ?? 0 | fmtDollar }}
                                  </span>
                                  est. achievable opportunity
                                </div>
                              </div>
                            </div>
                            <button type="button"
                                    class="mt-3 inline-flex items-center justify-center gap-1
                                           text-[11px] font-semibold text-aqua-6 hover:underline
                                           disabled:cursor-not-allowed disabled:text-gray-9
                                           disabled:hover:no-underline self-start"
                                    [disabled]="!rec.initiativeId"
                                    [title]="rec.initiativeId
                                      ? 'Open the supporting initiative in the drilldown'
                                      : 'No source initiative linked to this recommendation'"
                                    (click)="openRecommendationDrill(rec)">
                              Open in drilldown
                              <svg class="h-3 w-3" viewBox="0 0 16 16" fill="none" stroke="currentColor"
                                   stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                                   aria-hidden="true">
                                <path d="M6 3h7v7" /><path d="m13 3-8 8" />
                              </svg>
                            </button>
                          </div>
                        }
                      </div>
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
    .rec-rank-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
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
  readonly recSubgroup  = signal<string>('');
  readonly tsCategory   = signal<SpendCat | ''>('');
  readonly kcCategory   = signal<SpendCat | ''>('');
  readonly vlCategory   = signal<SpendCat | ''>('');

  // Server-loaded data.
  /** Curated P&L benchmarks blob (53 Cosma + PT + Exteriors sites). */
  readonly pnlBenchmarks = signal<IPnlBenchmarks | undefined>(undefined);
  readonly pnlRecommendations = signal<IPnlRecommendation[] | undefined>(undefined);
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
  protected readonly chrome = inject(DashboardChromeService);

  // ---- P&L Recommendations helpers -------------------------------------
  readonly recSubgroups = computed(() => {
    const set = new Set<string>();
    for (const r of this.pnlRecommendations() ?? []) if (r.archetype) set.add(r.archetype);
    return Array.from(set).sort();
  });
  readonly recsFiltered = computed(() => {
    const sg = this.recSubgroup();
    return (this.pnlRecommendations() ?? []).filter(r => !sg || r.archetype === sg);
  });
  readonly recsBySite = computed(() => {
    const map = new Map<string, { site: string; archetype?: string; recs: IPnlRecommendation[] }>();
    for (const rec of this.recsFiltered()) {
      let group = map.get(rec.site);
      if (!group) {
        group = { site: rec.site, archetype: rec.archetype, recs: [] };
        map.set(rec.site, group);
      }
      group.recs.push(rec);
    }
    for (const g of map.values()) {
      g.recs.sort((a, b) => (a.priorityRank ?? 99) - (b.priorityRank ?? 99));
    }
    return Array.from(map.values());
  });

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
   * Open the drilldown dialog for the source initiative behind a P&L
   * recommendation, with the rec context (opportunity $, archetype, source
   * text) pinned above the table. No-op for recs without an `initiativeId`.
   */
  async openRecommendationDrill(rec: IPnlRecommendation): Promise<void> {
    const id = rec.initiativeId;
    if (!id) return;
    const all = await this.initiativeCache.getAllAsync();
    const match = all.find(i => i.id === id);
    const items = match ? [match] : [];
    this.drilldown.open({
      title: `Initiative · ${id}`,
      subtitle: match?.name,
      items,
      pnlContext: {
        workstream: rec.workstream,
        site: rec.site,
        archetype: rec.archetype,
        opportunityAmount: rec.opportunityAmount,
        recommendationText: rec.recommendationText,
        priorityRank: rec.priorityRank,
      },
    });
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
        const lever = params.get('lever') ?? '';
        this.highlightedLever.set(lever);
        if (lever) {
          // Re-fire scroll once the levers render. queueMicrotask isn't
          // enough — the data may still be loading from the API.
          this.scrollToLeverWhenReady(lever);
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
