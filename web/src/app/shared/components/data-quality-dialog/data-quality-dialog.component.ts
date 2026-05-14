import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';

import { IWorkstreamMeta } from '@app/models';
import { DashboardChromeService } from '@app/core-services';

interface IPanelMeta {
  workstream: 'Cosma' | 'Powertrain' | 'Exteriors' | 'Seating';
  accent: string;
  meta?: IWorkstreamMeta;
}

/**
 * "Data Quality" dialog. Mirrors the offline dashboard's `*_meta` blocks
 * (`cosma_meta`, `powertrain_meta`, `exteriors_meta`) so analysts can see:
 *   • how many initiatives were ingested vs categorized,
 *   • the validation date and the per-source notes that explain the diff
 *     against the prior baseline, and
 *   • the exclusion rules that suppressed initiatives from totals
 *     (e.g. `[GCSD]` / `[BP26]` prefix filters).
 *
 * Mounted once at the app shell; opened via `DashboardChromeService.openDataQuality()`.
 */
@Component({
  selector: 'mra-data-quality-dialog',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog #dlg (close)="onClose()" (click)="onBackdropClick($event)" class="dq-dlg">
      <div class="flex flex-col" style="max-height:88vh; min-width:min(56rem, 94vw)">
        <header class="flex items-start justify-between gap-3 border-b border-gray-f0 px-6 py-4 shrink-0">
          <div>
            <h2 class="text-lg font-bold text-gray-1">Data Quality &amp; Coverage</h2>
            <p class="mt-0.5 text-sm text-gray-6">
              Per-workstream initiative counts, validation context, and the
              exclusion rules used to derive the totals you see in the dashboard.
            </p>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <button type="button"
                    class="inline-flex items-center gap-1.5 rounded-digi border border-gray-f0
                           bg-white px-3 py-1.5 text-[12px] font-semibold text-gray-3
                           hover:border-aqua-4 hover:text-aqua-6 transition-colors
                           disabled:cursor-not-allowed disabled:opacity-60"
                    title="Re-pull dashboard config + priority initiatives from the API"
                    [disabled]="chrome.refreshing()"
                    (click)="onRefresh()">
              <svg class="h-3.5 w-3.5"
                   [class.animate-spin]="chrome.refreshing()"
                   viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" />
                <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" />
                <path d="M21 3v5h-5" />
                <path d="M3 21v-5h5" />
              </svg>
              {{ chrome.refreshing() ? 'Refreshing…' : 'Refresh' }}
            </button>
            <button type="button"
                    class="rounded-full p-2 text-gray-6 hover:bg-gray-f0 hover:text-gray-1"
                    aria-label="Close data quality dialog"
                    (click)="close()">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2" stroke-linecap="round" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </header>

        @if (chrome.generated() || lastRefreshedDisplay()) {
          <div class="px-6 py-2 border-b border-gray-f0 bg-gray-f9 text-[12px] text-gray-6
                      shrink-0 flex items-center gap-4 flex-wrap">
            @if (chrome.generated()) {
              <span>Snapshot generated:
                <span class="font-semibold text-gray-3">{{ generatedDisplay() }}</span>
              </span>
            }
            @if (lastRefreshedDisplay()) {
              <span class="text-gray-7">·</span>
              <span>Last refreshed:
                <span class="font-semibold text-gray-3">{{ lastRefreshedDisplay() }}</span>
              </span>
            }
          </div>
        }

        <div class="flex-1 overflow-auto px-6 py-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
          @for (p of panels(); track p.workstream) {
            <article class="rounded-digi border border-gray-f0 bg-white overflow-hidden">
              <div class="px-4 py-2.5 text-[12px] font-bold uppercase tracking-wider text-white"
                   [style.background]="p.accent">
                {{ p.workstream }}
              </div>

              @if (!p.meta) {
                <div class="px-4 py-8 text-center text-[12px] text-gray-7">
                  No metadata published for this workstream.
                </div>
              } @else {
                <dl class="grid grid-cols-2 gap-x-3 gap-y-1.5 px-4 pt-3 text-[12px]">
                  <dt class="text-gray-6">Total raw</dt>
                  <dd class="text-right font-mono text-gray-1">{{ formatNum(p.meta.totalRaw) }}</dd>

                  <dt class="text-gray-6">Total active</dt>
                  <dd class="text-right font-mono text-gray-1">{{ formatNum(p.meta.totalActive) }}</dd>

                  <dt class="text-gray-6 font-medium">Categorized</dt>
                  <dd class="text-right font-mono font-bold text-gray-1">
                    {{ formatNum(p.meta.totalCategorized) }}
                  </dd>

                  @if (p.meta.totalUncategorized != null) {
                    <dt class="text-gray-6">Uncategorized</dt>
                    <dd class="text-right font-mono text-gray-3">
                      {{ formatNum(p.meta.totalUncategorized) }}
                    </dd>
                  }
                  @if (p.meta.totalNeedsReview != null) {
                    <dt class="text-gray-6">Needs review</dt>
                    <dd class="text-right font-mono text-warning-2">
                      {{ formatNum(p.meta.totalNeedsReview) }}
                    </dd>
                  }
                  @if (p.meta.lastValidated) {
                    <dt class="text-gray-6">Validated</dt>
                    <dd class="text-right text-gray-3">{{ p.meta.lastValidated }}</dd>
                  }
                  @if (p.meta.benchmark) {
                    <dt class="text-gray-6">Benchmark</dt>
                    <dd class="text-right text-gray-3 truncate" [title]="p.meta.benchmark">
                      {{ p.meta.benchmark }}
                    </dd>
                  }
                </dl>

                @if (p.meta.validationNotes.length > 0) {
                  <section class="px-4 mt-3">
                    <h4 class="text-[11px] font-bold uppercase tracking-wider text-gray-6">
                      Validation notes
                    </h4>
                    <ul class="mt-1.5 list-disc pl-4 space-y-1 text-[12px] text-gray-3">
                      @for (n of p.meta.validationNotes; track n) { <li>{{ n }}</li> }
                    </ul>
                  </section>
                }

                @if (p.meta.exclusionRules.length > 0) {
                  <section class="px-4 mt-3 mb-3">
                    <h4 class="text-[11px] font-bold uppercase tracking-wider text-gray-6">
                      Exclusion rules
                    </h4>
                    <ul class="mt-1.5 space-y-1 text-[12px] text-gray-3">
                      @for (r of p.meta.exclusionRules; track r) {
                        <li class="font-mono text-[11px]
                                   bg-gray-f9 border border-gray-f0 rounded px-2 py-1 truncate"
                            [title]="r">{{ r }}</li>
                      }
                    </ul>
                  </section>
                }
              }
            </article>
          }
        </div>

        <footer class="border-t border-gray-f0 bg-gray-f9 px-6 py-3 text-[11px] text-gray-6">
          Definitions:
          <span class="font-medium text-gray-3">Total raw</span> = ingested rows;
          <span class="font-medium text-gray-3">Active</span> = after population filter;
          <span class="font-medium text-gray-3">Categorized</span> = mapped into the read-across taxonomy.
        </footer>
      </div>
    </dialog>
  `,
  styles: [`
    :host { display: contents; }
    .dq-dlg::backdrop { background: rgba(17, 17, 17, 0.45); }
  `],
})
export class DataQualityDialogComponent implements AfterViewInit {
  protected readonly chrome = inject(DashboardChromeService);

  readonly dlgRef = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  readonly panels = computed<IPanelMeta[]>(() => {
    const cfg = this.chrome.config();
    const panels: IPanelMeta[] = [
      { workstream: 'Cosma',      accent: '#93000C', meta: cfg?.cosmaMeta },
      { workstream: 'Powertrain', accent: '#155EA9', meta: cfg?.powertrainMeta },
      { workstream: 'Exteriors',  accent: '#107C10', meta: cfg?.exteriorsMeta },
    ];
    // Seating only renders when the API ships a `seatingMeta` block; this
    // mirrors the legacy app, which omits Seating from the data-quality
    // strip until rows are actually loaded.
    if (cfg?.seatingMeta) {
      panels.push({ workstream: 'Seating', accent: '#B8860B', meta: cfg.seatingMeta });
    }
    return panels;
  });

  readonly generatedDisplay = computed(() => {
    const raw = this.chrome.generated();
    if (!raw) return '';
    // Inputs come in ISO form (e.g. "2026-04-02T11:34:10.232556"); fall back
    // to the raw string if Date parsing fails so we never show "Invalid Date".
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? raw : d.toLocaleString();
  });

  readonly lastRefreshedDisplay = computed(() => {
    const ts = this.chrome.lastRefreshedAt();
    return ts ? ts.toLocaleTimeString() : '';
  });

  constructor() {
    effect(() => {
      const dlg = this.dlgRef()?.nativeElement;
      if (!dlg) return;
      const want = this.chrome.dataQualityOpen();
      const have = dlg.open;
      if (want && !have) dlg.showModal();
      else if (!want && have) dlg.close();
    });
  }

  ngAfterViewInit(): void {
    const dlg = this.dlgRef().nativeElement;
    if (this.chrome.dataQualityOpen() && !dlg.open) dlg.showModal();
  }

  close(): void   { this.chrome.closeDataQuality(); }
  onClose(): void { this.chrome.closeDataQuality(); }
  onBackdropClick(ev: MouseEvent): void {
    if (ev.target === this.dlgRef().nativeElement) this.close();
  }

  onRefresh(): void { void this.chrome.refreshAsync(); }

  formatNum(n: number | undefined | null): string {
    if (n == null) return '—';
    return n.toLocaleString('en-US');
  }
}
