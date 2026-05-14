import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';

import {
  IKnowledgeCenterAsset,
  IThoughtStarter,
  IVideoLibraryAsset,
} from '@app/models';
import { LeverInsightsService } from '@app/core-services';
import { ReadAcrossAppService } from '@domains/read-across';

type Tab = 'thought-starters' | 'knowledge' | 'video';

/**
 * Multi-tab "Lever Insights" dialog — parity with the legacy
 * `openThoughtStarterPanel` modal. Opens when the user clicks the ★
 * next to a lever in Buckets / Heatmap.
 *
 * Layout:
 *   • Header: breadcrumb-style title `{spendCategory} › {mfgProcess} › {lever}`
 *     plus optional sub-lever line.
 *   • Three tabs with row counts: Thought Starters / Knowledge Center /
 *     Video Library, each pre-filtered to the lever context.
 *   • Numbered list inside each tab so users can reference specific
 *     items by number during a review.
 *
 * Mounted once at the application shell; driven by `LeverInsightsService`.
 */
@Component({
  selector: 'mra-lever-insights-dialog',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog #dlg (close)="onClose()" (click)="onBackdropClick($event)" class="li-dlg">
      <div class="flex flex-col" style="max-height:88vh; min-width:min(56rem, 94vw)">
        <header class="flex items-start justify-between gap-3 border-b border-gray-f0 px-6 py-4 shrink-0">
          <div class="min-w-0">
            <h2 class="text-base font-bold text-gray-1 truncate">
              {{ headerCrumbs() }}
            </h2>
          </div>
          <button type="button"
                  class="rounded-full p-2 text-gray-6 hover:bg-gray-f0 hover:text-gray-1 shrink-0"
                  aria-label="Close lever insights"
                  (click)="close()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <!-- Tab strip -->
        <nav class="flex items-center gap-1 border-b border-gray-f0 px-6 shrink-0">
          @for (t of tabs; track t.id) {
            <button type="button"
                    class="li-tab"
                    [class.li-tab-active]="active() === t.id"
                    (click)="active.set(t.id)">
              {{ t.label }}
              <span class="ml-1.5 text-[11px] text-gray-6">({{ countFor(t.id) }})</span>
            </button>
          }
        </nav>

        <!-- Tab body -->
        <div class="overflow-auto px-6 py-4" style="background-color:#FAFAF7">
          @switch (active()) {
            @case ('thought-starters') {
              @if (filteredTs().length === 0) {
                <p class="text-sm text-gray-7 py-12 text-center">
                  No thought starters match this lever.
                </p>
              } @else {
                <ol class="flex flex-col">
                  @for (ts of filteredTs(); track ts.thoughtStarterId; let i = $index) {
                    <li class="li-row">
                      <span class="li-num">{{ i + 1 }}</span>
                      <div class="min-w-0 flex-1">
                        <p class="text-sm text-gray-1 leading-snug">{{ ts.text }}</p>
                        <div class="mt-1.5 flex items-center gap-1.5 flex-wrap">
                          <span class="li-tag">{{ crumb(ts.spendCategory, ts.mfgProcess, ts.lever, ts.subLever) }}</span>
                          @if (ts.advancedAutomation) {
                            <span class="li-tag li-tag-amber">{{ ts.advancedAutomation }}</span>
                          }
                        </div>
                      </div>
                    </li>
                  }
                </ol>
              }
            }

            @case ('knowledge') {
              @if (filteredKc().length === 0) {
                <p class="text-sm text-gray-7 py-12 text-center">
                  No knowledge-center slides match this lever.
                </p>
              } @else {
                <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                  @for (asset of filteredKc(); track asset.knowledgeAssetId; let i = $index) {
                    <article class="card overflow-hidden flex flex-col">
                      <div class="border-b border-gray-f0 bg-gray-f9 p-2 flex items-center justify-center">
                        @if (isPdf(asset.slideUrl)) {
                          <embed [src]="asset.slideUrl" type="application/pdf"
                                 class="block w-full h-56 rounded" />
                        } @else {
                          <img [src]="asset.slideUrl" [alt]="asset.title"
                               loading="lazy" decoding="async"
                               class="block w-full max-h-56 object-contain rounded" />
                        }
                      </div>
                      <div class="p-3 flex-1 flex flex-col">
                        <div class="flex items-start gap-2">
                          <span class="li-num">{{ i + 1 }}</span>
                          <h3 class="text-sm font-bold text-gray-1 flex-1">{{ asset.title }}</h3>
                        </div>
                        @if (asset.description) {
                          <p class="mt-1 text-xs text-gray-6">{{ asset.description }}</p>
                        }
                      </div>
                    </article>
                  }
                </div>
              }
            }

            @case ('video') {
              @if (filteredVid().length === 0) {
                <p class="text-sm text-gray-7 py-12 text-center">
                  No videos match this lever.
                </p>
              } @else {
                <ol class="flex flex-col gap-2.5">
                  @for (v of filteredVid(); track v.videoAssetId; let i = $index) {
                    <li class="rounded-digi border border-gray-f0 bg-white px-4 py-3
                               flex items-start gap-3">
                      <span class="li-num">{{ i + 1 }}</span>
                      <div class="min-w-0 flex-1">
                        <a [href]="v.videoUrl" target="_blank" rel="noopener noreferrer"
                           class="text-sm font-semibold text-aqua-6 hover:underline">
                          {{ v.title }}
                        </a>
                        @if (v.description) {
                          <p class="mt-0.5 text-xs text-gray-6">{{ v.description }}</p>
                        }
                      </div>
                    </li>
                  }
                </ol>
              }
            }
          }
        </div>
      </div>
    </dialog>
  `,
  styles: [`
    :host { display: contents; }
    .li-dlg::backdrop { background: rgba(17, 17, 17, 0.45); }

    .li-tab {
      padding: 10px 14px;
      font-size: 13px;
      font-weight: 600;
      color: #5B5B5B;
      border-bottom: 2px solid transparent;
      transition: color .15s, border-color .15s;
    }
    .li-tab:hover { color: #1A1A1A; }
    .li-tab-active {
      color: #93000C;            /* Magna red, matches header bottom indicator */
      border-bottom-color: #93000C;
    }

    .li-num {
      flex: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 26px;
      border-radius: 13px;
      background: #FFF3C2;        /* amber-100 chip per legacy */
      color: #B45309;             /* amber-700 numerals */
      font-size: 11px;
      font-weight: 700;
      margin-top: 2px;
    }
    .li-row {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px 16px;
      background: #FFFFFF;
      border-bottom: 1px solid #F0F0F0;
      transition: background-color .12s ease-in-out;
    }
    .li-row:first-child { border-top: 1px solid #F0F0F0; }
    .li-row:hover {
      background: rgba(255, 244, 200, 0.45); /* amber-50 hover, parity */
    }
    .li-tag {
      display: inline-flex;
      align-items: center;
      padding: 1px 9px;
      font-size: 10px;
      font-weight: 500;
      color: #5B5B5B;
      background: #FFFFFF;
      border: 1px solid #E5E7EB;
      border-radius: 9999px;
    }
    .li-tag-amber {
      color: #B45309;
      background: #FEF3C7;
      border-color: #FDE68A;
    }
  `],
})
export class LeverInsightsDialogComponent implements AfterViewInit {
  protected readonly svc = inject(LeverInsightsService);
  private readonly app   = inject(ReadAcrossAppService);

  readonly dlgRef = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  readonly tabs: ReadonlyArray<{ id: Tab; label: string }> = [
    { id: 'thought-starters', label: 'Thought Starters' },
    { id: 'knowledge',        label: 'Knowledge Center' },
    { id: 'video',            label: 'Video Library' },
  ];

  readonly active = signal<Tab>('thought-starters');

  // Lazy-loaded sources, fetched once on first open.
  private readonly _ts  = signal<IThoughtStarter[] | undefined>(undefined);
  private readonly _kc  = signal<IKnowledgeCenterAsset[] | undefined>(undefined);
  private readonly _vid = signal<IVideoLibraryAsset[] | undefined>(undefined);
  private fetchStarted = false;

  readonly ctx = this.svc.context;

  readonly headerCrumbs = computed(() => {
    const c = this.ctx();
    if (!c) return '';
    // Header uses › (U+203A) per legacy `openThoughtStarterPanel`.
    return [c.spendCategory, c.mfgProcess, c.lever, c.subLever]
      .filter(Boolean)
      .join(' \u203A ');
  });

  // ── filtered views ───────────────────────────────────────────────
  // Filter semantics intentionally mirror the legacy
  // `getThoughtStarters` / `getMatchingSlides` / `getMatchingVideos`
  // helpers in `magna-readacross/public/index.html`: the criterion is
  // applied only when both the context and the asset's field are
  // populated. An empty field on the asset acts as a wildcard so the
  // count badges match the offline dashboard.
  readonly filteredTs = computed<IThoughtStarter[]>(() => {
    const c = this.ctx();
    if (!c) return [];
    const rows = this._ts() ?? [];
    return rows.filter(r => {
      if ((r.spendCategory ?? '') === 'Revenue') return false;
      if (!this.legacyMatch(r.spendCategory, c.spendCategory)) return false;
      if (!this.legacyMatch(r.lever,         c.lever))         return false;
      if (!this.legacyMatch(r.mfgProcess,    c.mfgProcess))    return false;
      if (!this.legacyMatch(r.subLever,      c.subLever))      return false;
      return !!c.spendCategory || !!c.lever;
    });
  });

  // KC slides are tagged with `SpendCategory` (and optionally `Workstream`)
  // in v2's schema — `lever`/`mfgProcess` aren't yet captured. Filter by
  // spend category only so the dialog still surfaces the right slice
  // without false-empty results.
  readonly filteredKc = computed<IKnowledgeCenterAsset[]>(() => {
    const c = this.ctx();
    if (!c || !c.spendCategory) return [];
    const rows = this._kc() ?? [];
    return rows.filter(r => this.legacyMatch(r.spendCategory, c.spendCategory));
  });

  readonly filteredVid = computed<IVideoLibraryAsset[]>(() => {
    const c = this.ctx();
    if (!c || !c.spendCategory) return [];
    const rows = this._vid() ?? [];
    return rows.filter(r => this.legacyMatch(r.spendCategory, c.spendCategory));
  });

  countFor(tab: Tab): number {
    if (tab === 'thought-starters') return this.filteredTs().length;
    if (tab === 'knowledge')        return this.filteredKc().length;
    return this.filteredVid().length;
  }

  isPdf(url?: string): boolean {
    return !!url && /\.pdf(\?|$)/i.test(url);
  }

  crumb(spendCategory?: string, mfgProcess?: string, lever?: string, subLever?: string): string {
    // Per-row breadcrumb uses ` | ` separator per legacy.
    return [spendCategory, mfgProcess, lever, subLever].filter(Boolean).join(' | ');
  }

  /**
   * Legacy filter primitive (mirrors `index.html`'s
   * `if (b && a && norm(a) !== norm(b)) return false`): only enforces
   * equality when *both* sides are populated. Empty asset fields are
   * treated as wildcards so the modal matches the offline counts.
   */
  private legacyMatch(assetVal?: string, ctxVal?: string): boolean {
    if (!ctxVal || !assetVal) return true;
    return assetVal.trim().toLowerCase() === ctxVal.trim().toLowerCase();
  }

  constructor() {
    // Open / close the native <dialog> in response to service signals.
    effect(() => {
      const dlg = this.dlgRef()?.nativeElement;
      if (!dlg) return;
      const want = this.svc.isOpen();
      const have = dlg.open;
      if (want && !have) {
        dlg.showModal();
        // Reset to the first tab on each open so the entry experience
        // matches the legacy modal.
        this.active.set('thought-starters');
        void this.ensureLoaded();
      } else if (!want && have) {
        dlg.close();
      }
    });
  }

  ngAfterViewInit(): void {
    if (this.svc.isOpen() && !this.dlgRef().nativeElement.open) {
      this.dlgRef().nativeElement.showModal();
      void this.ensureLoaded();
    }
  }

  close():    void { this.svc.close(); }
  onClose():  void { this.svc.close(); }
  onBackdropClick(ev: MouseEvent): void {
    if (ev.target === this.dlgRef().nativeElement) this.close();
  }

  private async ensureLoaded(): Promise<void> {
    if (this.fetchStarted) return;
    this.fetchStarted = true;
    const [ts, kc, vid] = await Promise.all([
      this.app.getThoughtStartersAsync(),
      this.app.getKnowledgeCenterAssetsAsync(),
      this.app.getVideoLibraryAssetsAsync(),
    ]);
    this._ts.set(ts);
    this._kc.set(kc);
    this._vid.set(vid);
  }
}
