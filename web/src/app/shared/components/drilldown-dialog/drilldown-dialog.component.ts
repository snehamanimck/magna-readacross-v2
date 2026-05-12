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

import { IInitiative } from '@app/models';
import { DashboardChromeService, DrilldownService } from '@app/core-services';
import { FmtDollarPipe } from '../../pipes/format.pipe';

interface IDrillCol {
  key: keyof IInitiative;
  label: string;
  align?: 'left' | 'right';
  cls?: string;
}

const DRILL_COLS: IDrillCol[] = [
  { key: 'id',            label: 'ID',                cls: 'whitespace-nowrap font-mono text-xs text-gray-6' },
  { key: 'name',          label: 'Initiative Name',   cls: 'font-medium text-gray-1' },
  { key: 'description',   label: 'Description',       cls: 'text-xs text-gray-6' },
  { key: 'workstream',    label: 'Workstream',        cls: 'whitespace-nowrap text-xs text-gray-3' },
  { key: 'site',          label: 'Site',              cls: 'text-gray-3' },
  { key: 'owner',         label: 'Owner',             cls: 'text-gray-3 text-xs' },
  { key: 'stage',         label: 'Stage',             cls: 'whitespace-nowrap text-gray-3 text-xs' },
  { key: 'nrb',           label: 'NRB',               cls: 'whitespace-nowrap font-mono', align: 'right' },
  { key: 'spendCategory', label: 'Spend Cat.',        cls: 'whitespace-nowrap text-xs' },
  { key: 'mfgProcess',    label: 'Process',           cls: 'whitespace-nowrap text-gray-3 text-xs' },
  { key: 'lever',         label: 'Lever',             cls: 'text-gray-3 text-xs' },
  { key: 'subLever',      label: 'Sub Lever',         cls: 'text-gray-3 text-xs' },
];

/**
 * Cross-page drilldown dialog. Mirrors the offline dashboard's
 * `<dialog id="drilldown-dialog">` panel:
 *   • Sticky-header table of the matched initiatives,
 *   • Sort-by-site toggle and CSV export,
 *   • A banner counting any `Confidential`-redacted rows that contributed to
 *     the parent total but are not listed here, and
 *   • A green check (✓) next to ids in the priority-initiative set.
 *
 * Mounted once at the application shell so its scroll/sort state survives
 * route changes. Driven entirely by `DrilldownService` signals.
 */
@Component({
  selector: 'mra-drilldown-dialog',
  standalone: true,
  imports: [CommonModule, FmtDollarPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog #dlg (close)="onClose()" (click)="onBackdropClick($event)">
      <div class="flex flex-col" style="max-height:85vh">
        <header class="flex items-center justify-between border-b border-gray-f0 px-6 py-4 shrink-0">
          <div class="min-w-0">
            <h2 class="text-lg font-bold text-gray-1 truncate">{{ title() }}</h2>
            <p class="mt-0.5 text-sm text-gray-6">{{ subtitle() }}</p>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <button type="button"
                    class="rounded-full p-2 text-gray-6 hover:bg-gray-f0 hover:text-gray-1"
                    title="Export to CSV"
                    [disabled]="visibleItems().length === 0"
                    (click)="exportCsv()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
            </button>
            <button type="button"
                    class="rounded-full p-2 text-gray-6 hover:bg-gray-f0 hover:text-gray-1"
                    aria-label="Close drilldown"
                    (click)="close()">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2" stroke-linecap="round" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </header>

        @if (pnlContext(); as pnl) {
          <div class="px-5 py-3 border-b shrink-0"
               style="background-color:#F0F9FF;border-color:#BAE6FD;color:#0C4A6E">
            <div class="flex items-start gap-3">
              <svg class="h-4 w-4 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"
                   aria-hidden="true">
                <path fill-rule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0
                         012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0
                         00-1-1H9z" clip-rule="evenodd" />
              </svg>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 flex-wrap text-[11px] font-semibold uppercase tracking-wider">
                  <span>P&amp;L-Informed Recommendation</span>
                  @if (pnl.priorityRank) {
                    <span class="rounded-full bg-white/60 px-2 py-0.5 text-[10px]"
                          style="color:#0C4A6E">
                      Rank #{{ pnl.priorityRank }}
                    </span>
                  }
                  @if (pnl.archetype) {
                    <span class="rounded-full bg-white/60 px-2 py-0.5 text-[10px]"
                          style="color:#0C4A6E">
                      {{ pnl.archetype }}
                    </span>
                  }
                </div>
                <p class="mt-1 text-[13px] leading-snug" style="color:#0C4A6E">
                  {{ pnl.recommendationText }}
                </p>
                <div class="mt-1.5 text-[12px]" style="color:#0369A1">
                  <span class="font-bold">{{ pnl.workstream }} · {{ pnl.site }}</span>
                  @if (pnl.opportunityAmount && pnl.opportunityAmount > 0) {
                    <span> · est. opportunity
                      <span class="font-bold">{{ pnl.opportunityAmount | fmtDollar }}</span>
                    </span>
                  }
                </div>
              </div>
            </div>
          </div>
        }
        @if (suppressedCount() > 0) {
          <div class="px-4 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-800
                      flex items-center gap-2 shrink-0"
               style="background-color:#FFFBEB;border-color:#FDE68A;color:#92400E">
            <svg class="h-3.5 w-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fill-rule="evenodd"
                    d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168
                       2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10
                       6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1
                       1 0 100-2 1 1 0 000 2z"
                    clip-rule="evenodd" />
            </svg>
            {{ suppressedCount() }} confidential
            initiative{{ suppressedCount() > 1 ? 's' : '' }} included in totals above but not
            shown in this list
          </div>
        }
        @if (hasPriority()) {
          <div class="px-4 py-1.5 border-b text-xs flex items-center gap-1.5 shrink-0"
               style="background-color:#ECFDF5;border-color:#A7F3D0;color:#047857">
            <svg class="h-3.5 w-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fill-rule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0
                       00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0
                       10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                    clip-rule="evenodd" />
            </svg>
            <span><strong>✓</strong> = Best practice initiative that could scale to other Divisions</span>
          </div>
        }

        <div class="flex-1 overflow-auto">
          @if (visibleItems().length === 0 && suppressedCount() === 0) {
            <div class="px-4 py-12 text-center text-sm text-gray-6">No initiatives match this selection.</div>
          } @else if (visibleItems().length === 0) {
            <div class="px-4 py-12 text-center text-sm text-gray-6">
              All {{ suppressedCount() }} initiative{{ suppressedCount() > 1 ? 's' : '' }} in this
              bucket {{ suppressedCount() > 1 ? 'are' : 'is' }} confidential.
            </div>
          } @else {
            <table class="digi-grid">
              <thead class="sticky top-0 z-10">
                <tr>
                  @for (col of cols; track col.key) {
                    <th [class]="thClass(col)">
                      @if (col.key === 'site') {
                        <button type="button"
                                class="inline-flex items-center gap-1 hover:text-gray-1"
                                (click)="toggleSiteSort()">
                          {{ col.label }}
                          <svg class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"
                               aria-hidden="true"
                               [class.text-magna-red]="sortBySite()"
                               [class.opacity-40]="!sortBySite()">
                            @if (sortBySite()) {
                              <path fill-rule="evenodd"
                                    d="M10 5a.75.75 0 01.55.24l3.25 3.5a.75.75 0
                                       11-1.1 1.02L10 6.852 7.3 9.76a.75.75 0
                                       01-1.1-1.02l3.25-3.5A.75.75 0 0110 5z"
                                    clip-rule="evenodd" />
                            } @else {
                              <path fill-rule="evenodd"
                                    d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10
                                       4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0
                                       0110 3zm-3.76 9.2a.75.75 0 011.06.04l2.7 2.908 2.7-2.908a.75.75
                                       0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75
                                       0 01.04-1.06z"
                                    clip-rule="evenodd" />
                            }
                          </svg>
                        </button>
                      } @else {
                        {{ col.label }}
                      }
                    </th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (i of visibleItems(); track i.id) {
                  <tr>
                    @for (col of cols; track col.key) {
                      <td [class]="tdClass(col)">
                        @switch (col.key) {
                          @case ('id')  { <span [innerHTML]="renderId(i)"></span> }
                          @case ('nrb') { {{ i.nrb > 0 ? (i.nrb | fmtDollar) : '—' }} }
                          @case ('spendCategory') {
                            <span [class]="catBadgeClass(i.spendCategory)">
                              {{ i.spendCategory || 'Uncat.' }}
                            </span>
                          }
                          @case ('description') {
                            @if (i.description && i.description !== i.name) {
                              {{ i.description }}
                            } @else {
                              <span class="text-gray-ba">—</span>
                            }
                          }
                          @default {
                            @if (i[col.key]) {
                              {{ i[col.key] }}
                            } @else {
                              <span class="text-gray-ba">—</span>
                            }
                          }
                        }
                      </td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          }
        </div>
      </div>
    </dialog>
  `,
  styles: [`
    :host { display: contents; }
    dialog::backdrop { background: rgba(17, 17, 17, 0.45); }
    .digi-grid thead th { background: var(--digi-gray-f9); }
    .badge-dl { background:#DBEAFE; color:#1E40AF; }
    .badge-idl { background:#F3E8FF; color:#6B21A8; }
    .badge-mc { background:#DCFCE7; color:#166534; }
    .badge-voh { background:#FEF3C7; color:#92400E; }
    .badge-uncat { background:#F3F4F6; color:#374151; }
  `],
})
export class DrilldownDialogComponent implements AfterViewInit {
  private readonly drilldown = inject(DrilldownService);
  private readonly chrome = inject(DashboardChromeService);

  readonly dlgRef = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  readonly cols = DRILL_COLS;
  readonly sortBySite = this.drilldown.sortBySite;

  readonly title = computed(() => this.drilldown.state()?.title ?? '');

  readonly pnlContext = computed(() => this.drilldown.state()?.pnlContext);

  readonly allItems = computed<readonly IInitiative[]>(
    () => this.drilldown.state()?.items ?? [],
  );

  readonly visibleItems = computed(() => {
    const visible = this.allItems().filter(i => i.access !== 'Confidential');
    if (this.sortBySite()) {
      return [...visible].sort(
        (a, b) =>
          (a.site ?? '').localeCompare(b.site ?? '') || (b.nrb ?? 0) - (a.nrb ?? 0),
      );
    }
    return [...visible].sort((a, b) => {
      const ap = this.chrome.isPriority(a.id) ? 0 : 1;
      const bp = this.chrome.isPriority(b.id) ? 0 : 1;
      return ap - bp || (b.nrb ?? 0) - (a.nrb ?? 0);
    });
  });

  readonly suppressedCount = computed(
    () => this.allItems().length - this.visibleItems().length,
  );

  readonly hasPriority = computed(() =>
    this.visibleItems().some(i => this.chrome.isPriority(i.id)),
  );

  readonly subtitle = computed(() => {
    const explicit = this.drilldown.state()?.subtitle;
    if (explicit) return explicit;
    const items = this.allItems();
    const totalNrb = items.reduce((s, i) => s + (i.nrb ?? 0), 0);
    return `${items.length.toLocaleString('en-US')} initiatives · NRB total: ${this.dollar(totalNrb)}`;
  });

  constructor() {
    // Sync the native dialog with the service's `isOpen` signal. The
    // viewChild() signal is initially unresolved, so the early effect cycles
    // are no-ops until the view query lands.
    effect(() => {
      const dlg = this.dlgRef()?.nativeElement;
      if (!dlg) return;
      const want = this.drilldown.isOpen();
      const have = dlg.open;
      if (want && !have) dlg.showModal();
      else if (!want && have) dlg.close();
    });
  }

  ngAfterViewInit(): void {
    // Defensive flush: if the open signal fired before the view query was
    // available, push the dialog into showModal() now that the ref is wired.
    const dlg = this.dlgRef().nativeElement;
    if (this.drilldown.isOpen() && !dlg.open) dlg.showModal();
  }

  close(): void { this.drilldown.close(); }
  toggleSiteSort(): void { this.drilldown.toggleSortBySite(); }

  /** Native dialogs fire `close` on Esc — keep the service in sync. */
  onClose(): void { this.drilldown.close(); }

  /** Click outside the inner content (i.e. on the backdrop) closes the dialog. */
  onBackdropClick(ev: MouseEvent): void {
    if (ev.target === this.dlgRef().nativeElement) {
      this.close();
    }
  }

  thClass(col: IDrillCol): string {
    const align = col.align === 'right' ? 'text-right' : 'text-left';
    return `!${align} whitespace-nowrap`;
  }

  tdClass(col: IDrillCol): string {
    const align = col.align === 'right' ? 'num' : '';
    return `${col.cls ?? ''} ${align}`.trim();
  }

  renderId(i: IInitiative): string {
    const url = this.chrome.buildWaveCardUrl(i.id, i.workstream);
    const idText = this.escape(i.id);
    const link = `<a href="${url}" target="_blank" rel="noopener noreferrer"
                     class="text-magna-red underline-offset-2 hover:underline">${idText}</a>`;
    if (this.chrome.isPriority(i.id)) {
      const check = `
        <svg class="h-3.5 w-3.5 inline-block mr-1 -mt-0.5 align-text-bottom"
             style="color:#10B981" fill="currentColor" viewBox="0 0 20 20"
             aria-label="Best practice initiative">
          <path fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0
                   00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5
                   2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd"/>
        </svg>`;
      return `${check}${link}`;
    }
    return link;
  }

  catBadgeClass(cat?: string): string {
    const base = 'inline-block rounded px-2 py-0.5 text-xs font-medium ';
    switch (cat) {
      case 'DL':                   return base + 'badge-dl';
      case 'IDL':                  return base + 'badge-idl';
      case 'Material Conveyance':  return base + 'badge-mc';
      case 'VOH':                  return base + 'badge-voh';
      default:                     return base + 'badge-uncat';
    }
  }

  exportCsv(): void {
    const items = this.visibleItems();
    if (!items.length) return;
    const cols: (keyof IInitiative)[] = [
      'id', 'name', 'description', 'site', 'owner', 'stage', 'nrb',
      'spendCategory', 'mfgProcess', 'lever', 'subLever', 'workstream',
    ];
    const headers = [
      'ID', 'Initiative Name', 'Description', 'Site', 'Owner', 'Stage', 'NRB',
      'Spend Category', 'MFG Process', 'Lever', 'Sub Lever', 'Workstream',
    ];
    const rows = [
      headers.join(','),
      ...items.map(i => cols.map(c => this.csvCell(i[c])).join(',')),
    ];
    const blob = new Blob(['\uFEFF' + rows.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.slug(this.title()) || 'initiatives'}_export.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private csvCell(value: unknown): string {
    if (value == null) return '';
    const s = String(value);
    if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  private dollar(n: number): string {
    const a = Math.abs(n);
    if (a >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    if (a >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
    return `$${n.toFixed(0)}`;
  }

  private escape(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  private slug(s: string): string {
    return s.replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 40);
  }
}
