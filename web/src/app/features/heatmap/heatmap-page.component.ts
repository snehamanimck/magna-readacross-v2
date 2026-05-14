import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { ReadAcrossAppService } from '@domains/read-across';
import { IHeatmapCell } from '@app/models';
import {
  DrilldownService,
  FilterService,
  InitiativeCacheService,
  LeverInsightsService,
} from '@app/core-services';
import { FmtDollarPipe, FmtNumPipe } from '../../shared/pipes/format.pipe';

type Mode = 'count' | 'nrb';

interface RowKey { spendCategory: string; mfgProcess: string; lever: string; subLever: string; }

/**
 * Heatmap page. Mirrors production:
 *   • A page header with a Count / NRB ($) segmented toggle and a site
 *     selector to scope the columns.
 *   • A 5-card KPI summary row (Total, Unique Sites, Cosma, PT, Ext).
 *   • A two-tier column header (workstream → site).
 *   • A heat ramp built on Digi Aqua tints so the visualization stays in
 *     family with the rest of the design system.
 */
@Component({
  standalone: true,
  imports: [CommonModule, FmtDollarPipe, FmtNumPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-5">

      <!-- Page header -->
      <header class="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 class="text-[22px] font-bold text-gray-1 tracking-tight">Heatmap</h1>
          <p class="mt-1 text-[13px] text-gray-6 max-w-3xl">
            Initiative counts by classification and site. Color intensity reflects concentration.
            Click any lever <span class="text-caution-2">★</span> to see thought starters.
          </p>
        </div>
        <div class="flex items-center gap-3">
          <!-- Mode toggle -->
          <div class="inline-flex rounded-digi border border-gray-d0 overflow-hidden bg-white" role="tablist">
            <button type="button"
                    class="px-3 py-1.5 text-xs font-semibold transition-colors"
                    [class.text-white]="mode() === 'count'"
                    [class.text-gray-3]="mode() !== 'count'"
                    [style.background]="mode() === 'count' ? 'var(--digi-btn-primary)' : 'transparent'"
                    (click)="mode.set('count')">Count</button>
            <button type="button"
                    class="px-3 py-1.5 text-xs font-semibold transition-colors border-l border-gray-d0"
                    [class.text-white]="mode() === 'nrb'"
                    [class.text-gray-3]="mode() !== 'nrb'"
                    [style.background]="mode() === 'nrb' ? 'var(--digi-btn-primary)' : 'transparent'"
                    (click)="mode.set('nrb')">NRB ($)</button>
          </div>

          <!-- Site selector -->
          <select class="select !w-auto !py-1.5 text-xs !pr-8" [value]="siteFilter()"
                  (change)="onSiteChange($any($event.target).value)">
            <option value="">All Sites ({{ allSites().length }})</option>
            @for (s of allSites(); track s) { <option [value]="s">{{ s }}</option> }
          </select>
        </div>
      </header>

      <!-- KPI summary. Numbers are intentionally large + tabular so the
           6-card row reads as a "scoreboard" from across the room. -->
      <section class="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <article class="card p-4">
          <div class="kpi-label">Total Categorized</div>
          <div class="kpi-number text-gray-1">{{ kpiTotal() | fmtNum }}</div>
        </article>
        <article class="card p-4">
          <div class="kpi-label">Unique Sites</div>
          <div class="kpi-number text-gray-1">{{ allSites().length | fmtNum }}</div>
        </article>
        <article class="card p-4">
          <div class="kpi-label">Cosma</div>
          <div class="kpi-number ws-cosma">{{ kpiByWs('Cosma') | fmtNum }}</div>
        </article>
        <article class="card p-4">
          <div class="kpi-label">Powertrain</div>
          <div class="kpi-number ws-pt">{{ kpiByWs('Powertrain') | fmtNum }}</div>
        </article>
        <article class="card p-4">
          <div class="kpi-label">Exteriors</div>
          <div class="kpi-number ws-ext">{{ kpiByWs('Exteriors') | fmtNum }}</div>
        </article>
        <article class="card p-4">
          <div class="kpi-label">Seating</div>
          <div class="kpi-number ws-seat">{{ kpiByWs('Seating') | fmtNum }}</div>
        </article>
      </section>

      @if (loading()) {
        <div class="card p-12 text-center text-gray-7 text-sm">Loading heatmap…</div>
      } @else if ((cells() ?? []).length === 0) {
        <div class="card p-12 text-center text-gray-7 text-sm">No data matches the current filters.</div>
      } @else {
        <section class="card overflow-auto">
          <table class="digi-grid !text-[11px] heat-grid">
            <thead>
              <!-- Three-tier header: workstream supercolumn → subgroup
                   (region) sub-supercolumn → individual site. The subgroup
                   row makes the AP / EU / NA grouping visible for PT and
                   Exteriors, and shows Cosma's geographic regions. -->
              <tr>
                <th rowspan="3" class="!align-bottom sticky left-0 z-10 bg-gray-f9 w-72">
                  Spend Category / MFG Process / Lever / Sub Lever
                </th>
                <th rowspan="3" class="!align-bottom !text-right whitespace-nowrap">Total</th>
                @for (g of columnGroups(); track g.workstream) {
                  <th [attr.colspan]="g.totalSites" class="!text-center !border-l border-gray-d0"
                      [class.ws-cosma-bg]="g.workstream === 'Cosma'"
                      [class.ws-pt-bg]="g.workstream === 'Powertrain'"
                      [class.ws-ext-bg]="g.workstream === 'Exteriors'"
                      [class.ws-seat-bg]="g.workstream === 'Seating'">
                    {{ g.workstream }} <span class="opacity-70">({{ g.totalSites }})</span>
                  </th>
                }
              </tr>
              <tr>
                @for (sg of subgroupGroups(); track sg.key) {
                  <th [attr.colspan]="sg.sites.length"
                      class="!text-center !text-[10px] !font-semibold uppercase tracking-wide
                             !border-l border-gray-d0 bg-gray-f9 text-gray-3">
                    {{ sg.label }} <span class="opacity-60">({{ sg.sites.length }})</span>
                  </th>
                }
              </tr>
              <tr>
                @for (col of columns(); track col.key) {
                  <th class="!text-right whitespace-nowrap !border-l border-gray-f0"
                      [style.color]="wsColor(col.workstream)">
                    {{ col.site }}
                  </th>
                }
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track rowKey(row)) {
                <tr>
                  <td class="sticky left-0 bg-white align-top w-72">
                    <div class="font-semibold text-gray-1">{{ row.spendCategory }}</div>
                    <div class="text-gray-6 text-[10px] leading-tight">
                      {{ row.mfgProcess || '—' }} · {{ row.lever || '—' }}
                      @if (row.lever) {
                        <button type="button"
                                class="text-caution-2 ml-0.5 hover:text-warning-2"
                                title="See thought starters for this lever"
                                (click)="openLeverThoughtStarters(row)">★</button>
                      }
                      · {{ row.subLever || '—' }}
                    </div>
                  </td>
                  <td class="num font-semibold whitespace-nowrap"
                      [class.drill-cell]="rowTotal(row) > 0"
                      (click)="openRowTotalDrill(row)">
                    @if (mode() === 'count') { {{ rowTotal(row) | fmtNum }} } @else { {{ rowTotal(row) | fmtDollar }} }
                  </td>
                  @for (col of columns(); track col.key) {
                    <td class="num whitespace-nowrap"
                        [style.background]="cellColor(row, col)"
                        [style.color]="cellTextColor(row, col)"
                        [class.drill-cell]="cellValue(row, col) > 0"
                        (click)="openCellDrill(row, col)">
                      @if (cellValue(row, col) > 0) {
                        @if (mode() === 'count') { {{ cellValue(row, col) | fmtNum }} } @else { {{ cellValue(row, col) | fmtDollar }} }
                      } @else { · }
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </section>
      }
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
    .kpi-number {
      margin-top: 8px;
      font-size: 36px;
      font-weight: 800;
      line-height: 1;
      letter-spacing: -0.02em;
      font-variant-numeric: tabular-nums;
    }
    .drill-cell { cursor: pointer; }
    .drill-cell:hover { outline: 1px solid var(--digi-aqua-4); outline-offset: -1px; }
  `],
})
export class HeatmapPageComponent {
  readonly mode = signal<Mode>('count');
  readonly siteFilter = signal<string>('');

  private readonly appService = inject(ReadAcrossAppService);
  private readonly filterSvc = inject(FilterService);
  private readonly drilldown = inject(DrilldownService);
  private readonly initiatives = inject(InitiativeCacheService);
  private readonly leverInsights = inject(LeverInsightsService);
  private readonly router = inject(Router);
  private readonly cellsState = signal<IHeatmapCell[] | undefined>(undefined);

  readonly cells = this.cellsState.asReadonly();
  readonly loading = computed(() => this.cells() === undefined);

  // Apply category client-side filter
  readonly filteredCells = computed(() => {
    const cats = new Set(this.filterSvc.filters().spendCategories);
    const site = this.siteFilter();
    return (this.cells() ?? []).filter(c =>
      (cats.size === 0 || cats.has(c.spendCategory))
      && (!site || c.site === site));
  });

  // Distinct sites across all data (for the site selector).
  readonly allSites = computed(() => {
    const set = new Set<string>();
    for (const c of this.cells() ?? []) if (c.site) set.add(c.site);
    return Array.from(set).sort();
  });

  /**
   * Distinct columns: one entry per (workstream, subgroup, site).
   *
   * Sorted by `workstream → subgroup → site` so the resulting column order
   * lines up with the two-row sub/super-headers above. Cells with no
   * subgroup are bucketed into a sentinel `'—'` group and rendered last
   * within their workstream so they don't break the AP/EU/NA layout.
   */
  readonly columns = computed(() => {
    type Col = { key: string; workstream: string; subgroup: string; site: string };
    const map = new Map<string, Col>();
    for (const c of this.filteredCells()) {
      const site = c.site ?? '—';
      const subgroup = (c.subgroup && c.subgroup.trim()) || '—';
      const key = `${c.workstream}__${subgroup}__${site}`;
      if (!map.has(key)) map.set(key, { key, workstream: c.workstream, subgroup, site });
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.workstream !== b.workstream) return a.workstream.localeCompare(b.workstream);
      // Push the unknown-subgroup bucket to the end so it doesn't appear
      // between AP/EU/NA blocks for that workstream.
      const aMissing = a.subgroup === '—';
      const bMissing = b.subgroup === '—';
      if (aMissing !== bMissing) return aMissing ? 1 : -1;
      if (a.subgroup !== b.subgroup) return a.subgroup.localeCompare(b.subgroup);
      return a.site.localeCompare(b.site);
    });
  });

  /**
   * Top header tier: one supercolumn per workstream, spanning ALL of its
   * sites (across every subgroup). `totalSites` is the colspan used by
   * the workstream `<th>` and the "(n)" badge in its label.
   */
  readonly columnGroups = computed(() => {
    const map = new Map<string, { workstream: string; totalSites: number }>();
    for (const col of this.columns()) {
      let g = map.get(col.workstream);
      if (!g) { g = { workstream: col.workstream, totalSites: 0 }; map.set(col.workstream, g); }
      g.totalSites += 1;
    }
    return Array.from(map.values()).sort((a, b) => a.workstream.localeCompare(b.workstream));
  });

  /**
   * Middle header tier: one cell per (workstream, subgroup) pair, in the
   * exact same column order as `columns()`. The label strips off the
   * workstream prefix that the inferer adds (e.g. "PT - AP" → "AP",
   * "Ext: EU" → "EU") so the AP/EU/NA shorthand reads cleanly under
   * each workstream.
   */
  readonly subgroupGroups = computed(() => {
    type Group = { key: string; workstream: string; subgroup: string; label: string; sites: string[] };
    const groups: Group[] = [];
    for (const col of this.columns()) {
      const last = groups[groups.length - 1];
      const sameAsLast =
        last && last.workstream === col.workstream && last.subgroup === col.subgroup;
      if (sameAsLast) {
        last!.sites.push(col.site);
      } else {
        groups.push({
          key: `${col.workstream}__${col.subgroup}`,
          workstream: col.workstream,
          subgroup:   col.subgroup,
          label:      this.subgroupLabel(col.workstream, col.subgroup),
          sites:      [col.site],
        });
      }
    }
    return groups;
  });

  /**
   * Strip the workstream prefix our `SubgroupInferer` adds upstream so the
   * heatmap header reads `AP / EU / NA` (or the Cosma region name) without
   * repeating the workstream that's already shown one row up. We also
   * normalize the canonical `APAC` value to the 2-letter `AP` short form
   * used everywhere else in the dashboard for tighter column headers.
   */
  private subgroupLabel(workstream: string, subgroup: string): string {
    if (!subgroup || subgroup === '—') return '—';
    let label = subgroup;
    // PT subgroups arrive as "PT - APAC" / "PT - EU" / "PT - NA".
    if (workstream === 'Powertrain') {
      label = subgroup.replace(/^PT\s*[-:]\s*/i, '').trim() || subgroup;
    }
    // Exteriors arrive as "Ext: APAC" / "Ext: EU" / "Ext: NA".
    else if (workstream === 'Exteriors') {
      label = subgroup.replace(/^Ext\s*[-:]\s*/i, '').trim() || subgroup;
    }
    // Seating arrives as "Seat - NA" / "Seat - EU" / "Seat - CN".
    else if (workstream === 'Seating') {
      label = subgroup.replace(/^Seat\s*[-:]\s*/i, '').trim() || subgroup;
    }
    // Collapse APAC → AP for tighter PT/Ext column headers.
    if (/^APAC$/i.test(label)) label = 'AP';
    return label;
  }

  // Distinct rows: (spendCategory, mfgProcess, lever, subLever)
  readonly rows = computed<RowKey[]>(() => {
    const map = new Map<string, RowKey>();
    for (const c of this.filteredCells()) {
      const r: RowKey = {
        spendCategory: c.spendCategory,
        mfgProcess: c.mfgProcess ?? '',
        lever: c.lever ?? '',
        subLever: c.subLever ?? '',
      };
      const k = this.rowKey(r);
      if (!map.has(k)) map.set(k, r);
    }
    return Array.from(map.values()).sort((a, b) =>
      a.spendCategory.localeCompare(b.spendCategory)
      || a.mfgProcess.localeCompare(b.mfgProcess)
      || a.lever.localeCompare(b.lever)
      || a.subLever.localeCompare(b.subLever));
  });

  // Index for fast cell lookup
  private readonly cellIndex = computed(() => {
    const idx = new Map<string, IHeatmapCell>();
    for (const c of this.filteredCells()) {
      const key = `${this.rowKey({
        spendCategory: c.spendCategory,
        mfgProcess: c.mfgProcess ?? '',
        lever: c.lever ?? '',
        subLever: c.subLever ?? '',
      })}||${c.workstream}__${c.site ?? '—'}`;
      idx.set(key, c);
    }
    return idx;
  });

  private readonly maxValue = computed(() => {
    let max = 0;
    for (const c of this.filteredCells()) {
      const v = this.mode() === 'count' ? c.count : c.nrb;
      if (v > max) max = v;
    }
    return max;
  });

  // KPI helpers.
  readonly kpiTotal = computed(() =>
    this.filteredCells().reduce((s, c) => s + c.count, 0));
  kpiByWs(ws: string): number {
    return this.filteredCells().reduce((s, c) => s + (c.workstream === ws ? c.count : 0), 0);
  }

  rowKey(r: RowKey) { return `${r.spendCategory}|${r.mfgProcess}|${r.lever}|${r.subLever}`; }

  cellValue(r: RowKey, col: { workstream: string; site: string }): number {
    const c = this.cellIndex().get(`${this.rowKey(r)}||${col.workstream}__${col.site}`);
    if (!c) return 0;
    return this.mode() === 'count' ? c.count : c.nrb;
  }

  rowTotal(r: RowKey): number {
    let sum = 0;
    for (const col of this.columns()) sum += this.cellValue(r, col);
    return sum;
  }

  // Green heat ramp anchored to the Digi Success palette so the
  // visualization matches the production app's green-tinted concentration cells.
  cellColor(r: RowKey, col: { workstream: string; site: string }): string {
    const v = this.cellValue(r, col);
    const max = this.maxValue();
    if (!max || !v) return '#FFFFFF';
    const t = Math.min(v / max, 1);
    const p = Math.pow(t, 0.5);
    if (p < 0.33)      return this.lerp('#FFFFFF', '#DCFCE7', p / 0.33);          // very light green
    else if (p < 0.66) return this.lerp('#DCFCE7', '#48D76E', (p - 0.33) / 0.33); // mid green (Digi Success 1)
    else               return this.lerp('#48D76E', '#107C10', (p - 0.66) / 0.34); // dark green (Digi Success 2)
  }

  cellTextColor(r: RowKey, col: { workstream: string; site: string }): string {
    const hex = this.cellColor(r, col).replace('#', '');
    const lum = (0.299 * parseInt(hex.slice(0, 2), 16)
               + 0.587 * parseInt(hex.slice(2, 4), 16)
               + 0.114 * parseInt(hex.slice(4, 6), 16)) / 255;
    return lum > 0.55 ? '#111111' : '#FFFFFF';
  }

  // Workstream-specific accents — Digi Danger 2 / Digi Info 3 / Digi Success 2.
  wsColor(ws: string): string {
    if (ws === 'Cosma')      return '#DC3545';
    if (ws === 'Powertrain') return '#155EA9';
    if (ws === 'Exteriors')  return '#107C10';
    if (ws === 'Seating')    return '#B8860B';
    return '#444444';
  }

  onSiteChange(value: string) { this.siteFilter.set(value); }

  private lerp(a: string, b: string, t: number): string {
    const p = (h: string) => [
      parseInt(h.slice(1, 3), 16),
      parseInt(h.slice(3, 5), 16),
      parseInt(h.slice(5, 7), 16),
    ];
    const [r1, g1, b1] = p(a)!;
    const [r2, g2, b2] = p(b)!;
    const c = (v1: number, v2: number) => Math.round(v1 + (v2 - v1) * t).toString(16).padStart(2, '0');
    return `#${c(r1!, r2!)}${c(g1!, g2!)}${c(b1!, b2!)}`;
  }

  constructor() {
    effect(() => {
      const workstreams = this.filterSvc.filters().workstreams;
      void this.loadHeatmapAsync(workstreams.length > 0 ? workstreams : undefined);
    }, { allowSignalWrites: true });
  }

  private async loadHeatmapAsync(workstreams?: string[]): Promise<void> {
    this.cellsState.set(undefined);
    this.cellsState.set(await this.appService.getHeatmapAsync(workstreams));
  }

  // ---------------------------------------------------------------------------
  // Drilldown wiring
  // ---------------------------------------------------------------------------

  /** Click on a single (row × site) cell. */
  async openCellDrill(row: RowKey, col: { workstream: string; site: string }): Promise<void> {
    if (this.cellValue(row, col) <= 0) return;
    const items = await this.initiatives.filterByContextAsync({
      workstream:    col.workstream,
      site:          col.site,
      spendCategory: row.spendCategory,
      mfgProcess:    row.mfgProcess || undefined,
      lever:         row.lever      || undefined,
      subLever:      row.subLever   || undefined,
    });
    this.drilldown.open({
      title:    `${col.workstream} · ${col.site}`,
      subtitle: this.rowSubtitle(row),
      items,
      context:  {
        workstream: col.workstream,
        site:       col.site,
        spendCategory: row.spendCategory,
        mfgProcess: row.mfgProcess,
        lever:      row.lever,
        subLever:   row.subLever,
      },
    });
  }

  /** Click on the per-row Total cell — drills across all visible sites. */
  async openRowTotalDrill(row: RowKey): Promise<void> {
    if (this.rowTotal(row) <= 0) return;
    const site = this.siteFilter() || undefined;
    const items = await this.initiatives.filterByContextAsync({
      site,
      spendCategory: row.spendCategory,
      mfgProcess:    row.mfgProcess || undefined,
      lever:         row.lever      || undefined,
      subLever:      row.subLever   || undefined,
    });
    this.drilldown.open({
      title:    site ? `${row.spendCategory} · ${site}` : `${row.spendCategory} · All Sites`,
      subtitle: this.rowSubtitle(row),
      items,
      context:  {
        site,
        spendCategory: row.spendCategory,
        mfgProcess: row.mfgProcess,
        lever:      row.lever,
        subLever:   row.subLever,
      },
    });
  }

  /** ★ click on the row title → Lever Insights modal (parity with legacy). */
  openLeverThoughtStarters(row: RowKey): void {
    if (!row.lever) return;
    this.leverInsights.open({
      spendCategory: row.spendCategory || undefined,
      mfgProcess:    row.mfgProcess    || undefined,
      lever:         row.lever,
      subLever:      row.subLever      || undefined,
    });
  }

  private rowSubtitle(row: RowKey): string {
    return [
      row.spendCategory,
      row.mfgProcess || null,
      row.lever      || null,
      row.subLever   || null,
    ].filter(Boolean).join(' · ');
  }
}
