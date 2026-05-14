import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { ReadAcrossAppService } from '@domains/read-across';
import { IBucketRow } from '@app/models';
import {
  DrilldownService,
  FilterService,
  InitiativeCacheService,
  LeverInsightsService,
} from '@app/core-services';
import { FmtDollarPipe, FmtNumPipe, FmtPctPipe } from '../../shared/pipes/format.pipe';

const CAT_ORDER: Record<string, number> = { DL: 0, IDL: 1, 'Material Conveyance': 2, VOH: 3 };
type Workstream = 'Cosma' | 'Powertrain' | 'Exteriors' | 'Seating';

/**
 * Initiative Overview page.
 *
 * Mirrors the production layout:
 *   • 6 KPI cards: Cosma / Powertrain / Exteriors / Seating categorized
 *     counts (each tinted by workstream), Combined count, and Combined NRB.
 *   • A pivot data grid with two-tier column headers: a top row that
 *     groups Count, % of Total, and NRB, and a sub-row that splits each
 *     group into Cosma / PT / Ext / Seat.
 *   • A leading "Spend Category" group row that can be collapsed/expanded.
 *   • A star (★) icon next to lever rows so users know they can drill in
 *     to thought starters (per production copy).
 */
@Component({
  standalone: true,
  imports: [CommonModule, FmtDollarPipe, FmtNumPipe, FmtPctPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-5">

      <!-- Page header -->
      <header>
        <h1 class="text-[22px] font-bold text-gray-1 tracking-tight">Initiative Overview</h1>
        <p class="mt-1 text-[13px] text-gray-6 max-w-3xl">
          Categorized initiative comparison across Cosma, Powertrain, Exteriors, and Seating
          by taxonomy classification. Click any lever
          <span class="inline-flex h-3.5 w-3.5 align-text-bottom items-center justify-center
                       text-caution-2">★</span>
          to see relevant thought starters.
        </p>
      </header>

      <!-- KPI cards. Numbers are intentionally large + tabular so the
           6-card row reads as a "scoreboard" from across the room. -->
      <section class="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <article class="card p-4">
          <div class="kpi-label">Cosma Categorized</div>
          <div class="kpi-number ws-cosma">{{ wsCount('Cosma') | fmtNum }}</div>
        </article>
        <article class="card p-4">
          <div class="kpi-label">Powertrain Categorized</div>
          <div class="kpi-number ws-pt">{{ wsCount('Powertrain') | fmtNum }}</div>
        </article>
        <article class="card p-4">
          <div class="kpi-label">Exteriors Categorized</div>
          <div class="kpi-number ws-ext">{{ wsCount('Exteriors') | fmtNum }}</div>
        </article>
        <article class="card p-4">
          <div class="kpi-label">Seating Categorized</div>
          <div class="kpi-number ws-seat">{{ wsCount('Seating') | fmtNum }}</div>
        </article>
        <article class="card p-4">
          <div class="kpi-label">Combined</div>
          <div class="kpi-number text-gray-1">{{ totalCount() | fmtNum }}</div>
        </article>
        <article class="card p-4">
          <div class="kpi-label">Combined NRB</div>
          <div class="kpi-number" style="color: var(--digi-aqua-6)">{{ totalNrb() | fmtDollar }}</div>
        </article>
      </section>

      <!-- Bucket data grid -->
      <section class="card overflow-hidden">
        <div class="overflow-auto">
          <table class="digi-grid bucket-grid">
            <thead>
              <!-- Top header: meta columns + 4 workstream-grouped supercolumns -->
              <tr>
                <th rowspan="2" class="!align-bottom">Spend Category</th>
                <th rowspan="2" class="!align-bottom">MFG Process</th>
                <th rowspan="2" class="!align-bottom">Lever</th>
                <th rowspan="2" class="!align-bottom">Sub Lever</th>
                <th colspan="4" class="!text-center !text-gray-1 !border-l border-gray-d0">Count</th>
                <th colspan="4" class="!text-center !text-gray-1 !border-l border-gray-d0">% of Total</th>
                <th colspan="4" class="!text-center !text-gray-1 !border-l border-gray-d0">NRB</th>
              </tr>
              <tr>
                <th class="!text-right ws-cosma !border-l border-gray-d0">Cosma</th>
                <th class="!text-right ws-pt">PT</th>
                <th class="!text-right ws-ext">Ext</th>
                <th class="!text-right ws-seat">Seat</th>
                <th class="!text-right ws-cosma !border-l border-gray-d0">Cosma</th>
                <th class="!text-right ws-pt">PT</th>
                <th class="!text-right ws-ext">Ext</th>
                <th class="!text-right ws-seat">Seat</th>
                <th class="!text-right ws-cosma !border-l border-gray-d0">Cosma</th>
                <th class="!text-right ws-pt">PT</th>
                <th class="!text-right ws-ext">Ext</th>
                <th class="!text-right ws-seat">Seat</th>
              </tr>
            </thead>
            <tbody>
              @if (loading()) {
                <tr><td colspan="16" class="text-center text-gray-7 !py-10">Loading…</td></tr>
              } @else if (sortedRows().length === 0) {
                <tr><td colspan="16" class="text-center text-gray-7 !py-10">
                  No initiatives match the current filters.
                </td></tr>
              } @else {
                @for (group of groupedRows(); track group.category) {
                  <!-- Category band -->
                  <tr class="bg-gray-f9 cursor-pointer hover:bg-aqua-1/40"
                      (click)="toggleCategory(group.category)">
                    <td class="!font-bold !text-gray-1">
                      <svg class="h-3 w-3 inline-block mr-1.5 text-gray-6 transition-transform"
                           [class.rotate-90]="!isCollapsed(group.category)"
                           viewBox="0 0 12 12" fill="none" stroke="currentColor"
                           stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M4.5 2.5 8 6l-3.5 3.5" />
                      </svg>
                      {{ group.category }}
                    </td>
                    <td colspan="3"></td>
                    <td class="num !font-semibold ws-cosma !border-l border-gray-f0"
                        [class.drill-cell]="group.cosmaCount > 0"
                        (click)="onCategoryDrill($event, group, 'Cosma', group.cosmaCount)">
                      {{ group.cosmaCount | fmtNum }}
                    </td>
                    <td class="num !font-semibold ws-pt"
                        [class.drill-cell]="group.ptCount > 0"
                        (click)="onCategoryDrill($event, group, 'Powertrain', group.ptCount)">
                      {{ group.ptCount | fmtNum }}
                    </td>
                    <td class="num !font-semibold ws-ext"
                        [class.drill-cell]="group.extCount > 0"
                        (click)="onCategoryDrill($event, group, 'Exteriors', group.extCount)">
                      {{ group.extCount | fmtNum }}
                    </td>
                    <td class="num !font-semibold ws-seat"
                        [class.drill-cell]="group.seatCount > 0"
                        (click)="onCategoryDrill($event, group, 'Seating', group.seatCount)">
                      {{ group.seatCount | fmtNum }}
                    </td>
                    <td class="num !font-semibold ws-cosma !border-l border-gray-f0">{{ group.cosmaPct | fmtPct }}</td>
                    <td class="num !font-semibold ws-pt">{{ group.ptPct | fmtPct }}</td>
                    <td class="num !font-semibold ws-ext">{{ group.extPct | fmtPct }}</td>
                    <td class="num !font-semibold ws-seat">{{ group.seatPct | fmtPct }}</td>
                    <td class="num !font-semibold ws-cosma !border-l border-gray-f0"
                        [class.drill-cell]="group.cosmaNrb > 0"
                        (click)="onCategoryDrill($event, group, 'Cosma', group.cosmaCount)">
                      {{ group.cosmaNrb | fmtDollar }}
                    </td>
                    <td class="num !font-semibold ws-pt"
                        [class.drill-cell]="group.ptNrb > 0"
                        (click)="onCategoryDrill($event, group, 'Powertrain', group.ptCount)">
                      {{ group.ptNrb | fmtDollar }}
                    </td>
                    <td class="num !font-semibold ws-ext"
                        [class.drill-cell]="group.extNrb > 0"
                        (click)="onCategoryDrill($event, group, 'Exteriors', group.extCount)">
                      {{ group.extNrb | fmtDollar }}
                    </td>
                    <td class="num !font-semibold ws-seat"
                        [class.drill-cell]="group.seatNrb > 0"
                        (click)="onCategoryDrill($event, group, 'Seating', group.seatCount)">
                      {{ group.seatNrb | fmtDollar }}
                    </td>
                  </tr>

                  <!-- Detail rows -->
                  @if (!isCollapsed(group.category)) {
                    @for (row of group.rows; track $index) {
                      <tr>
                        <td class="text-gray-7">{{ row.spendCategory }}</td>
                        <td class="text-gray-3">{{ row.mfgProcess || '—' }}</td>
                        <td class="text-gray-3">
                          {{ row.lever || '—' }}
                          @if (row.lever) {
                            <button type="button"
                                    class="ml-1 text-caution-2 hover:text-warning-2"
                                    title="See thought starters for this lever"
                                    (click)="openLeverThoughtStarters(row)">★</button>
                          }
                        </td>
                        <td class="text-gray-3">{{ row.subLever || '—' }}</td>
                        <td class="num ws-cosma !border-l border-gray-f0"
                            [class.drill-cell]="(row.byWorkstream['Cosma']?.count ?? 0) > 0"
                            (click)="openRowDrill(row, 'Cosma')">
                          {{ wsLeverCount(row, 'Cosma') }}
                        </td>
                        <td class="num ws-pt"
                            [class.drill-cell]="(row.byWorkstream['Powertrain']?.count ?? 0) > 0"
                            (click)="openRowDrill(row, 'Powertrain')">
                          {{ wsLeverCount(row, 'Powertrain') }}
                        </td>
                        <td class="num ws-ext"
                            [class.drill-cell]="(row.byWorkstream['Exteriors']?.count ?? 0) > 0"
                            (click)="openRowDrill(row, 'Exteriors')">
                          {{ wsLeverCount(row, 'Exteriors') }}
                        </td>
                        <td class="num ws-seat"
                            [class.drill-cell]="(row.byWorkstream['Seating']?.count ?? 0) > 0"
                            (click)="openRowDrill(row, 'Seating')">
                          {{ wsLeverCount(row, 'Seating') }}
                        </td>
                        <td class="num ws-cosma !border-l border-gray-f0">{{ leverPct(row, 'Cosma') }}</td>
                        <td class="num ws-pt">{{ leverPct(row, 'Powertrain') }}</td>
                        <td class="num ws-ext">{{ leverPct(row, 'Exteriors') }}</td>
                        <td class="num ws-seat">{{ leverPct(row, 'Seating') }}</td>
                        <td class="num ws-cosma !border-l border-gray-f0"
                            [class.drill-cell]="(row.byWorkstream['Cosma']?.nrb ?? 0) > 0"
                            (click)="openRowDrill(row, 'Cosma')">
                          {{ row.byWorkstream['Cosma']?.nrb ?? 0 | fmtDollar }}
                        </td>
                        <td class="num ws-pt"
                            [class.drill-cell]="(row.byWorkstream['Powertrain']?.nrb ?? 0) > 0"
                            (click)="openRowDrill(row, 'Powertrain')">
                          {{ row.byWorkstream['Powertrain']?.nrb ?? 0 | fmtDollar }}
                        </td>
                        <td class="num ws-ext"
                            [class.drill-cell]="(row.byWorkstream['Exteriors']?.nrb ?? 0) > 0"
                            (click)="openRowDrill(row, 'Exteriors')">
                          {{ row.byWorkstream['Exteriors']?.nrb ?? 0 | fmtDollar }}
                        </td>
                        <td class="num ws-seat"
                            [class.drill-cell]="(row.byWorkstream['Seating']?.nrb ?? 0) > 0"
                            (click)="openRowDrill(row, 'Seating')">
                          {{ row.byWorkstream['Seating']?.nrb ?? 0 | fmtDollar }}
                        </td>
                      </tr>
                    }
                  }
                }
              }
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .kpi-label {
      font-size: 12px;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      font-weight: 600;
      color: #666666;
    }
    /* Big tabular KPI numbers — match the heatmap KPI summary so the two
       overview pages feel like the same product. */
    .kpi-number {
      margin-top: 8px;
      font-size: 36px;
      font-weight: 800;
      line-height: 1;
      letter-spacing: -0.02em;
      font-variant-numeric: tabular-nums;
    }
    .bucket-grid thead th {
      font-size: 12px;
      padding-top: 8px;
      padding-bottom: 8px;
    }
    /* Bump body cell sizes so dense numeric columns stay readable. */
    .bucket-grid tbody td { font-size: 13px; padding-top: 7px; padding-bottom: 7px; }
    .bucket-grid tbody td.num { font-size: 14px; font-weight: 600; }
    .drill-cell { cursor: pointer; }
    .drill-cell:hover { background-color: rgba(218, 235, 241, 0.45); text-decoration: underline; }
  `],
})
export class BucketsPageComponent {
  private readonly appService = inject(ReadAcrossAppService);
  private readonly filterSvc = inject(FilterService);
  private readonly drilldown = inject(DrilldownService);
  private readonly initiatives = inject(InitiativeCacheService);
  private readonly leverInsights = inject(LeverInsightsService);
  private readonly router = inject(Router);
  private readonly rowsState = signal<IBucketRow[] | undefined>(undefined);
  readonly loading = computed(() => this.rowsState() === undefined);
  private readonly rows = computed<IBucketRow[]>(() => this.rowsState() ?? []);

  // Track which category bands are collapsed.
  readonly collapsed = signal<ReadonlySet<string>>(new Set());
  isCollapsed(cat: string) { return this.collapsed().has(cat); }
  toggleCategory(cat: string) {
    const next = new Set(this.collapsed());
    if (next.has(cat)) next.delete(cat); else next.add(cat);
    this.collapsed.set(next);
  }

  // Apply the client-side category filter.
  readonly sortedRows = computed(() => {
    const f = this.filterSvc.filters();
    const cats = new Set(f.spendCategories);

    return this.rows()
      .filter(r => cats.size === 0 || cats.has(r.spendCategory))
      .sort((a, b) => {
        const ao = CAT_ORDER[a.spendCategory] ?? 9;
        const bo = CAT_ORDER[b.spendCategory] ?? 9;
        if (ao !== bo) return ao - bo;
        return (a.mfgProcess ?? '').localeCompare(b.mfgProcess ?? '')
            || (a.lever ?? '').localeCompare(b.lever ?? '')
            || (a.subLever ?? '').localeCompare(b.subLever ?? '');
      });
  });

  // Pre-grouped view of the rows so the template can render category bands.
  readonly groupedRows = computed(() => {
    type Group = {
      category: string; rows: IBucketRow[];
      cosmaCount: number; ptCount: number; extCount: number; seatCount: number;
      cosmaNrb: number;   ptNrb: number;   extNrb: number;   seatNrb: number;
      cosmaPct: number;   ptPct: number;   extPct: number;   seatPct: number;
    };
    const map = new Map<string, Group>();
    for (const r of this.sortedRows()) {
      let g = map.get(r.spendCategory);
      if (!g) {
        g = {
          category: r.spendCategory, rows: [],
          cosmaCount: 0, ptCount: 0, extCount: 0, seatCount: 0,
          cosmaNrb: 0,   ptNrb: 0,   extNrb: 0,   seatNrb: 0,
          cosmaPct: 0,   ptPct: 0,   extPct: 0,   seatPct: 0,
        };
        map.set(r.spendCategory, g);
      }
      g.rows.push(r);
      g.cosmaCount += r.byWorkstream['Cosma']?.count      ?? 0;
      g.ptCount    += r.byWorkstream['Powertrain']?.count ?? 0;
      g.extCount   += r.byWorkstream['Exteriors']?.count  ?? 0;
      g.seatCount  += r.byWorkstream['Seating']?.count    ?? 0;
      g.cosmaNrb   += r.byWorkstream['Cosma']?.nrb        ?? 0;
      g.ptNrb      += r.byWorkstream['Powertrain']?.nrb   ?? 0;
      g.extNrb     += r.byWorkstream['Exteriors']?.nrb    ?? 0;
      g.seatNrb    += r.byWorkstream['Seating']?.nrb      ?? 0;
    }
    // Compute "% of total" relative to the workstream totals.
    const cosmaTotal = this.wsCount('Cosma');
    const ptTotal    = this.wsCount('Powertrain');
    const extTotal   = this.wsCount('Exteriors');
    const seatTotal  = this.wsCount('Seating');
    for (const g of map.values()) {
      g.cosmaPct = cosmaTotal ? (g.cosmaCount / cosmaTotal) * 100 : 0;
      g.ptPct    = ptTotal    ? (g.ptCount    / ptTotal)    * 100 : 0;
      g.extPct   = extTotal   ? (g.extCount   / extTotal)   * 100 : 0;
      g.seatPct  = seatTotal  ? (g.seatCount  / seatTotal)  * 100 : 0;
    }
    return Array.from(map.values()).sort((a, b) =>
      (CAT_ORDER[a.category] ?? 9) - (CAT_ORDER[b.category] ?? 9));
  });

  readonly totalCount = computed(() => this.sortedRows().reduce((s, r) => s + r.countTotal, 0));
  readonly totalNrb   = computed(() => this.sortedRows().reduce((s, r) => s + r.nrbTotal, 0));

  wsCount(ws: Workstream) { return this.sortedRows().reduce((s, r) => s + (r.byWorkstream[ws]?.count ?? 0), 0); }

  wsLeverCount(row: IBucketRow, ws: Workstream): string {
    const c = row.byWorkstream[ws]?.count ?? 0;
    return c > 0 ? c.toLocaleString('en-US') : '—';
  }

  leverPct(row: IBucketRow, ws: Workstream): string {
    const total = this.wsCount(ws);
    if (!total) return '—';
    const c = row.byWorkstream[ws]?.count ?? 0;
    if (c === 0) return '—';
    const pct = (c / total) * 100;
    return `${pct.toFixed(1)}%`;
  }

  constructor() {
    effect(() => {
      const workstreams = this.filterSvc.filters().workstreams;
      void this.loadBucketsAsync(workstreams.length > 0 ? workstreams : undefined);
    }, { allowSignalWrites: true });
  }

  private async loadBucketsAsync(workstreams?: string[]): Promise<void> {
    this.rowsState.set(undefined);
    this.rowsState.set(await this.appService.getBucketsAsync(workstreams));
  }

  // ---------------------------------------------------------------------------
  // Drilldown wiring
  // ---------------------------------------------------------------------------

  /**
   * Opens the drilldown for a single (workstream × bucket lever) cell.
   * Shows nothing when the cell count is zero.
   */
  async openRowDrill(row: IBucketRow, ws: Workstream): Promise<void> {
    const cell = row.byWorkstream[ws];
    if (!cell || cell.count <= 0) return;
    const items = await this.initiatives.filterByContextAsync({
      workstream:    ws,
      spendCategory: row.spendCategory,
      mfgProcess:    row.mfgProcess || undefined,
      lever:         row.lever      || undefined,
      subLever:      row.subLever   || undefined,
    });
    this.drilldown.open({
      title:    `${ws} · ${row.spendCategory}${row.lever ? ' · ' + row.lever : ''}`,
      subtitle: this.bucketSubtitle(row, items.length),
      items,
      context: {
        workstream: ws,
        spendCategory: row.spendCategory,
        mfgProcess: row.mfgProcess,
        lever: row.lever,
        subLever: row.subLever,
      },
    });
  }

  /**
   * Opens the drilldown for a category-band cell (sums all lever rows for the
   * category, scoped to a single workstream column).
   */
  async onCategoryDrill(
    ev: Event,
    group: { category: string; rows: readonly IBucketRow[] },
    ws: Workstream,
    cellCount: number,
  ): Promise<void> {
    ev.stopPropagation();
    if (cellCount <= 0) return;
    const items = await this.initiatives.filterByContextAsync({
      workstream:    ws,
      spendCategory: group.category,
    });
    this.drilldown.open({
      title:    `${ws} · ${group.category}`,
      subtitle: `All ${group.category.toLowerCase()} initiatives in ${ws}`,
      items,
      context: { workstream: ws, spendCategory: group.category },
    });
  }

  /**
   * Lever ★ click: opens the multi-tab "Lever Insights" dialog (Thought
   * Starters / Knowledge Center / Video Library) pre-filtered to this
   * lever's taxonomy slice. Mirrors the legacy
   * `openThoughtStarterPanel` modal — keeps the user on the buckets
   * page so they don't lose scroll position.
   */
  openLeverThoughtStarters(row: IBucketRow): void {
    if (!row.lever) return;
    this.leverInsights.open({
      spendCategory: row.spendCategory || undefined,
      mfgProcess:    row.mfgProcess    || undefined,
      lever:         row.lever,
      subLever:      row.subLever      || undefined,
    });
  }

  private bucketSubtitle(row: IBucketRow, count: number): string {
    const parts = [
      `${count.toLocaleString('en-US')} initiatives`,
      row.mfgProcess ? `Process: ${row.mfgProcess}` : null,
      row.subLever   ? `Sub Lever: ${row.subLever}` : null,
    ].filter(Boolean);
    return parts.join(' · ');
  }
}
