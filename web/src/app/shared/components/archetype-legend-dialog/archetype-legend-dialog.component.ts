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

import { ArchetypeService, FilterService } from '@app/core-services';

/**
 * Cosma archetype legend.
 *
 * Mounted once at the application shell. Pages call
 * `ArchetypeLegendDialogComponent.openShared()` (via the static signal-based
 * "open" controller below) to show:
 *   • the prettified archetype name,
 *   • its description (`archetypes.definitions[key]` from the offline blob),
 *   • the sites currently classified under it, and
 *   • a "Filter to this archetype" shortcut that pushes the key into the
 *     global FilterService so the rest of the SPA narrows in.
 *
 * Uses the same native `<dialog>` pattern as `DrilldownDialogComponent`.
 */
@Component({
  selector: 'mra-archetype-legend-dialog',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog #dlg (close)="onClose()" (click)="onBackdropClick($event)" class="legend-dlg">
      <div class="flex flex-col" style="max-height:85vh; min-width:min(46rem, 92vw)">
        <header class="flex items-start justify-between gap-3 border-b border-gray-f0 px-6 py-4 shrink-0">
          <div>
            <h2 class="text-lg font-bold text-gray-1">Cosma Site Archetypes</h2>
            <p class="mt-0.5 text-sm text-gray-6">
              Operational archetypes used to scope peer comparisons in P&amp;L Benchmarking
              and to constrain valid lever × MFG-process combinations.
            </p>
          </div>
          <button type="button"
                  class="rounded-full p-2 text-gray-6 hover:bg-gray-f0 hover:text-gray-1"
                  aria-label="Close legend"
                  (click)="close()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div class="flex-1 overflow-auto px-6 py-4">
          @if (!archetypes.loaded()) {
            <div class="py-8 text-center text-sm text-gray-7">Loading archetype data…</div>
          } @else if (entries().length === 0) {
            <div class="py-8 text-center text-sm text-gray-7">
              No archetype definitions have been published yet.
            </div>
          } @else {
            <div class="grid grid-cols-1 gap-3">
              @for (a of entries(); track a.key) {
                <article class="rounded-digi border border-gray-f0 bg-white p-4">
                  <div class="flex items-center justify-between gap-2 flex-wrap">
                    <h3 class="text-sm font-bold text-gray-1">{{ a.display }}</h3>
                    <div class="flex items-center gap-2">
                      <span class="badge badge-info">{{ a.sites.length }} site{{ a.sites.length === 1 ? '' : 's' }}</span>
                      <button type="button"
                              class="text-[11px] font-semibold text-aqua-6 hover:underline"
                              [class.opacity-60]="filters.filters().archetypes.includes(a.key)"
                              (click)="applyFilter(a.key)">
                        {{ filters.filters().archetypes.includes(a.key)
                            ? 'Filtering by this' : 'Filter to this →' }}
                      </button>
                    </div>
                  </div>

                  @if (a.description) {
                    <p class="mt-1.5 text-[13px] text-gray-3 leading-relaxed">{{ a.description }}</p>
                  }

                  <div class="mt-3">
                    <button type="button"
                            class="inline-flex items-center gap-1 text-[11px] text-gray-6
                                   hover:text-gray-1 transition-colors"
                            (click)="toggleSites(a.key)">
                      <svg class="h-3 w-3 transition-transform"
                           [class.rotate-90]="expanded() === a.key"
                           viewBox="0 0 12 12" fill="none" stroke="currentColor"
                           stroke-width="2" stroke-linecap="round" aria-hidden="true">
                        <path d="M4.5 2.5 8 6l-3.5 3.5" />
                      </svg>
                      {{ expanded() === a.key ? 'Hide sites' : 'Show sites' }}
                    </button>
                    @if (expanded() === a.key) {
                      <ul class="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] text-gray-3">
                        @for (s of a.sites; track s) {
                          <li class="truncate" [title]="s">{{ s }}</li>
                        }
                      </ul>
                    }
                  </div>
                </article>
              }
            </div>
          }
        </div>

        <footer class="border-t border-gray-f0 bg-gray-f9 px-6 py-3 text-[11px] text-gray-6">
          Archetypes are Cosma-specific. Selecting one in the filter bar narrows
          all dashboards to the matching Cosma sites.
        </footer>
      </div>
    </dialog>
  `,
  styles: [`
    :host { display: contents; }
    .legend-dlg::backdrop { background: rgba(17,17,17,0.45); }
  `],
})
export class ArchetypeLegendDialogComponent implements AfterViewInit {
  protected readonly archetypes = inject(ArchetypeService);
  protected readonly filters    = inject(FilterService);

  readonly dlgRef = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  /** key of the currently expanded site list (only one open at a time). */
  readonly expanded = signal<string>('');

  /** Combined view-model for the template. */
  readonly entries = computed(() => {
    return this.archetypes.displayNames().map(({ key, display }) => ({
      key,
      display,
      description: this.archetypes.describe(key),
      sites: this.archetypes.sitesFor(key),
    }));
  });

  constructor() {
    effect(() => {
      const dlg = this.dlgRef()?.nativeElement;
      if (!dlg) return;
      const want = this.archetypes.legendOpen();
      const have = dlg.open;
      if (want && !have) dlg.showModal();
      else if (!want && have) dlg.close();
    });
  }

  ngAfterViewInit(): void {
    const dlg = this.dlgRef().nativeElement;
    if (this.archetypes.legendOpen() && !dlg.open) dlg.showModal();
  }

  toggleSites(key: string): void {
    this.expanded.update(cur => (cur === key ? '' : key));
  }

  applyFilter(key: string): void {
    this.filters.toggleArchetype(key);
  }

  close(): void { this.archetypes.closeLegend(); }
  onClose(): void { this.archetypes.closeLegend(); }
  onBackdropClick(ev: MouseEvent): void {
    if (ev.target === this.dlgRef().nativeElement) this.close();
  }
}
