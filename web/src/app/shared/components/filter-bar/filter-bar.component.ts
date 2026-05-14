import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map, startWith } from 'rxjs/operators';

import { IFilterOptions } from '@app/models';
import { ReadAcrossAppService } from '@domains/read-across';
import { ArchetypeService, FilterService } from '@app/core-services';
import { PillComponent } from '../pill/pill.component';

const VISIBLE_ON: ReadonlySet<string> = new Set(['/buckets', '/heatmap']);

/**
 * Cross-page filter rail. Mirrors the production layout: a "Filters" label
 * on the left, then label-on-the-left chip groups (Workstream / Category
 * / Stage), and a "Subgroup & Archetype" pill that expands a second row.
 *
 * Visually anchored to the Digi DS surface — white background, Gray F0
 * hairline borders, Roboto Roboto-medium chip labels.
 */
@Component({
  selector: 'mra-filter-bar',
  standalone: true,
  imports: [CommonModule, PillComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isVisible()) {
      <div class="border-b border-gray-f0 bg-white">
        <div class="mx-auto flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-2.5">

          <!-- "Filters" leading label -->
          <span class="flex items-center gap-1.5 text-xs font-semibold text-gray-3">
            <svg class="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor"
                 stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
              <path d="M2 4h12" /><path d="M4 8h8" /><path d="M6 12h4" />
            </svg>
            Filters
          </span>

          <!-- Workstream group with leading "All" pill -->
          <div class="flex items-center gap-1.5">
            <span class="text-[11px] font-medium text-gray-6">Workstream:</span>
            <mra-pill [active]="!hasAnyWs()" (click)="filters.clearWorkstreams()">All</mra-pill>
            <mra-pill variant="cosma" [active]="hasWs('Cosma')"      (click)="filters.toggleWorkstream('Cosma')">Cosma</mra-pill>
            <mra-pill variant="pt"    [active]="hasWs('Powertrain')" (click)="filters.toggleWorkstream('Powertrain')">Powertrain</mra-pill>
            <mra-pill variant="ext"   [active]="hasWs('Exteriors')"  (click)="filters.toggleWorkstream('Exteriors')">Exteriors</mra-pill>
            <mra-pill variant="seat"  [active]="hasWs('Seating')"    (click)="filters.toggleWorkstream('Seating')">Seating</mra-pill>
          </div>

          <span class="hidden md:block w-px h-5 bg-gray-f0" aria-hidden="true"></span>

          <!-- Spend Category group -->
          <div class="flex items-center gap-1.5">
            <span class="text-[11px] font-medium text-gray-6">Category:</span>
            @for (c of categories; track c.value) {
              <mra-pill [active]="hasCat(c.value)" (click)="filters.toggleSpendCategory(c.value)">
                {{ c.label }}
              </mra-pill>
            }
          </div>

          <span class="hidden md:block w-px h-5 bg-gray-f0" aria-hidden="true"></span>

          <!-- Stage group -->
          <div class="flex items-center gap-1.5">
            <span class="text-[11px] font-medium text-gray-6">Stage:</span>
            @for (s of stages; track s) {
              <mra-pill [active]="hasStage(s)" (click)="filters.toggleStage(s)">{{ s }}</mra-pill>
            }
          </div>

          <span class="hidden md:block w-px h-5 bg-gray-f0" aria-hidden="true"></span>

          <!-- Subgroup & Archetype pill (single toggle that opens a sub-row).
               Shows a red active-count badge when any subgroup or archetype
               filter is on, so the filter rail signals "you have hidden
               filters applied" even when the row is collapsed. -->
          <mra-pill [active]="expanded()" (click)="expanded.set(!expanded())">
            <svg class="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                 [class.rotate-90]="expanded()" aria-hidden="true">
              <path d="M4.5 2.5 8 6l-3.5 3.5" />
            </svg>
            Subgroup &amp; Archetype
            @if (subgroupArchetypeCount(); as n) {
              @if (n > 0) {
                <span class="ml-1 inline-flex h-4 min-w-[16px] items-center justify-center
                             rounded-full bg-magna-red px-1 text-[10px] font-bold leading-none
                             text-white"
                      [attr.aria-label]="n + ' active filters'">{{ n }}</span>
              }
            }
          </mra-pill>

          @if (filters.hasAny()) {
            <button type="button" class="ml-auto text-[11px] font-medium text-gray-6 hover:text-danger-3 transition-colors"
                    (click)="filters.clearAll()">
              Clear all
            </button>
          }
        </div>

        @if (expanded()) {
          <div class="mx-auto flex flex-col gap-2 border-t border-gray-f0 bg-gray-f9 px-6 py-3">
            @if (subgroups().length > 0) {
              <div class="flex flex-wrap items-center gap-1.5">
                <span class="text-[11px] font-medium text-gray-6 mr-1">Subgroup:</span>
                <mra-pill [active]="!hasAnySubgroup()" (click)="filters.clearSubgroups()">All</mra-pill>
                @for (sg of subgroups(); track sg) {
                  <mra-pill [active]="hasSubgroup(sg)" (click)="filters.toggleSubgroup(sg)">{{ sg }}</mra-pill>
                }
              </div>
            }
            @if (archetypes().length > 0) {
              <div class="flex flex-wrap items-center gap-1.5">
                <span class="text-[11px] font-medium text-gray-6 mr-1 inline-flex items-center gap-1">
                  Archetype <span class="text-gray-7 font-normal">(Cosma)</span>:
                  <button type="button"
                          class="inline-flex h-4 w-4 items-center justify-center rounded-full
                                 border border-gray-d0 text-gray-6 hover:border-aqua-4 hover:text-aqua-6
                                 transition-colors"
                          title="What do these archetypes mean?"
                          aria-label="Show archetype legend"
                          (click)="archetypeSvc.openLegend()">
                    <svg class="h-2.5 w-2.5" viewBox="0 0 16 16" fill="none" stroke="currentColor"
                         stroke-width="2" stroke-linecap="round" aria-hidden="true">
                      <circle cx="8" cy="8" r="6.5" />
                      <path d="M8 11v.01" />
                      <path d="M6.5 6a1.5 1.5 0 1 1 2.6 1c-.5.5-1.1.7-1.1 1.5" />
                    </svg>
                  </button>
                </span>
                @for (a of archetypes(); track a) {
                  <mra-pill [active]="hasArchetype(a)" (click)="filters.toggleArchetype(a)">
                    {{ archetypeSvc.prettify(a) }}
                  </mra-pill>
                }
              </div>
            }
          </div>
        }
      </div>
    }
  `,
})
export class FilterBarComponent {
  protected readonly filters = inject(FilterService);
  protected readonly archetypeSvc = inject(ArchetypeService);
  private readonly appService = inject(ReadAcrossAppService);
  private readonly router = inject(Router);

  // Production uses short labels (DL · IDL · MC · VOH) so the bar fits a
  // single row on common 1440-px screens.
  readonly categories = [
    { value: 'DL',                  label: 'DL'  },
    { value: 'IDL',                 label: 'IDL' },
    { value: 'Material Conveyance', label: 'MC'  },
    { value: 'VOH',                 label: 'VOH' },
  ];
  readonly stages = ['L2', 'L3', 'L4', 'L5'];

  readonly expanded = signal(false);

  private readonly optionsState = signal<IFilterOptions>({
    workstreams: [],
    spendCategories: [],
    stages: [],
    subgroups: [],
    archetypes: [],
    sites: [],
  });
  private readonly options = this.optionsState.asReadonly();
  readonly subgroups  = computed(() => this.options().subgroups);
  readonly archetypes = computed(() => this.options().archetypes);

  /**
   * Number of active filters in the collapsible Subgroup + Archetype row.
   * Drives the red count badge on the pill so the rail communicates active
   * "advanced" filters even when the row is collapsed.
   */
  readonly subgroupArchetypeCount = computed(() => {
    const f = this.filters.filters();
    return f.subgroups.length + f.archetypes.length;
  });

  // Hide on Insights / Feedback (matches legacy FILTER_TABS).
  private readonly url = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map(e => (e as NavigationEnd).urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );
  readonly isVisible = computed(() => {
    const u = (this.url() || '/').split('?')[0]!;
    return VISIBLE_ON.has(u);
  });

  hasWs(ws: string)        { return this.filters.filters().workstreams.includes(ws); }
  hasAnyWs()               { return this.filters.filters().workstreams.length > 0; }
  hasCat(c: string)        { return this.filters.filters().spendCategories.includes(c); }
  hasStage(s: string)      { return this.filters.filters().stages.includes(s); }
  hasSubgroup(sg: string)  { return this.filters.filters().subgroups.includes(sg); }
  hasAnySubgroup()         { return this.filters.filters().subgroups.length > 0; }
  hasArchetype(a: string)  { return this.filters.filters().archetypes.includes(a); }

  constructor() {
    void this.loadFilterOptionsAsync();
    // Warm the archetype cache so the legend is instant on first open.
    void this.archetypeSvc.ensureLoadedAsync();
  }

  private async loadFilterOptionsAsync(): Promise<void> {
    this.optionsState.set(await this.appService.getFilterOptionsAsync());
  }
}
