import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime } from 'rxjs';

import { IInitiative } from '@app/models';
import { DashboardChromeService, DrilldownService, InitiativeCacheService } from '@app/core-services';
import { FmtDollarPipe } from '../../pipes/format.pipe';

const MAX_RESULTS = 12;

/**
 * Header search field that mirrors the offline dashboard's "global search":
 *   • Debounced full-text query against initiative id / name / description /
 *     site / lever, scoped to whatever workstream the global filter has
 *     selected (because that's what the user is "looking at").
 *   • Dropdown shows the top {@link MAX_RESULTS} matches with a count badge,
 *     supports keyboard navigation (↑/↓/Enter) and Escape-to-close.
 *   • Click on a result opens the drilldown with just that initiative.
 *   • "Open all" footer opens the drilldown with every match (incl. the
 *     ones that didn't fit in the dropdown), so the user can sort/export.
 */
@Component({
  selector: 'mra-global-search',
  standalone: true,
  imports: [CommonModule, FormsModule, FmtDollarPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative" #host>
      <label class="relative block">
        <span class="absolute inset-y-0 left-3 flex items-center text-gray-7 pointer-events-none">
          <svg class="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <circle cx="9" cy="9" r="6" />
            <path d="m13.5 13.5 3.5 3.5" />
          </svg>
        </span>
        <input #input type="search"
               class="input !pl-9 !pr-9 !py-1.5 w-72 !rounded-full"
               placeholder="Search initiatives, sites, levers…"
               role="combobox"
               aria-autocomplete="list"
               aria-controls="mra-global-search-listbox"
               [attr.aria-expanded]="isOpen()"
               [(ngModel)]="query"
               (focus)="onFocus()"
               (input)="onInput($any($event.target).value)"
               (keydown)="onKeydown($event)" />
        @if (query().length > 0) {
          <button type="button"
                  class="absolute inset-y-0 right-2.5 flex items-center text-gray-7
                         hover:text-gray-1"
                  aria-label="Clear search"
                  (click)="clear()">
            <svg class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        }
      </label>

      @if (isOpen() && query().length > 0) {
        <div class="absolute right-0 mt-2 w-[28rem] max-w-[90vw]
                    rounded-digi-md border border-gray-f0 bg-white shadow-digi-md z-[60]"
             role="listbox"
             id="mra-global-search-listbox">
          @if (loading()) {
            <div class="px-4 py-6 text-center text-xs text-gray-7">Searching…</div>
          } @else if (matches().length === 0) {
            <div class="px-4 py-6 text-center text-xs text-gray-7">
              No initiatives match <span class="font-semibold text-gray-3">"{{ query() }}"</span>.
            </div>
          } @else {
            <div class="px-3 py-2 border-b border-gray-f0 text-[11px] text-gray-7
                        flex items-center justify-between">
              <span>{{ matches().length }} match{{ matches().length === 1 ? '' : 'es' }}</span>
              @if (matches().length > MAX_RESULTS) {
                <span class="text-gray-9">Top {{ MAX_RESULTS }} shown</span>
              }
            </div>
            <ul class="max-h-80 overflow-auto py-1">
              @for (i of visibleMatches(); track i.id; let idx = $index) {
                <li role="option"
                    [attr.aria-selected]="idx === activeIndex()"
                    class="px-3 py-2 text-xs cursor-pointer flex items-start gap-3"
                    [class.bg-aqua-1]="idx === activeIndex()"
                    (mouseenter)="activeIndex.set(idx)"
                    (mousedown)="$event.preventDefault()"
                    (click)="openOne(i)">
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-1.5">
                      <span class="font-mono text-[10px] text-gray-7 shrink-0">{{ i.id }}</span>
                      @if (chrome.isPriority(i.id)) {
                        <span title="Priority initiative" style="color:#10B981" class="text-[10px]">✓</span>
                      }
                      <span class="font-semibold text-gray-1 truncate">{{ i.name || '—' }}</span>
                    </div>
                    <div class="mt-0.5 text-[11px] text-gray-6 flex items-center gap-2 flex-wrap">
                      <span [class]="wsTag(i.workstream)">{{ i.workstream }}</span>
                      <span class="text-gray-9">·</span>
                      <span>{{ i.site || '—' }}</span>
                      @if (i.lever) {
                        <span class="text-gray-9">·</span>
                        <span class="truncate">{{ i.lever }}</span>
                      }
                    </div>
                  </div>
                  <div class="num text-[11px] font-medium text-gray-3 shrink-0">
                    {{ i.nrb > 0 ? (i.nrb | fmtDollar) : '—' }}
                  </div>
                </li>
              }
            </ul>
            <button type="button"
                    class="w-full border-t border-gray-f0 px-3 py-2 text-[11px] font-semibold
                           text-aqua-6 hover:bg-aqua-1/40 text-left"
                    (mousedown)="$event.preventDefault()"
                    (click)="openAll()">
              Open all {{ matches().length }} match{{ matches().length === 1 ? '' : 'es' }} in drilldown →
            </button>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .ws-tag { display: inline-flex; padding: 0 6px; border-radius: 9999px; font-size: 10px; font-weight: 600; }
    .ws-cosma-tag { color: #93000C; background: rgba(232, 17, 35, 0.10); }
    .ws-pt-tag    { color: #155EA9; background: rgba(32, 142, 255, 0.10); }
    .ws-ext-tag   { color: #145114; background: rgba(16, 124, 16, 0.10); }
  `],
})
export class GlobalSearchComponent {
  private readonly cache = inject(InitiativeCacheService);
  private readonly drilldown = inject(DrilldownService);
  protected readonly chrome = inject(DashboardChromeService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly MAX_RESULTS = MAX_RESULTS;

  @ViewChild('host', { static: true }) hostRef!: ElementRef<HTMLElement>;
  @ViewChild('input', { static: true }) inputRef!: ElementRef<HTMLInputElement>;

  readonly query = signal('');
  readonly isOpen = signal(false);
  readonly loading = signal(false);
  readonly matches = signal<readonly IInitiative[]>([]);
  readonly activeIndex = signal(0);

  readonly visibleMatches = computed(() => this.matches().slice(0, MAX_RESULTS));

  private readonly debounce$ = new Subject<string>();

  constructor() {
    this.debounce$
      .pipe(debounceTime(150), takeUntilDestroyed(this.destroyRef))
      .subscribe(q => void this.runSearch(q));
  }

  onFocus(): void {
    if (this.query().length > 0) this.isOpen.set(true);
  }

  onInput(value: string): void {
    this.query.set(value);
    this.activeIndex.set(0);
    if (!value.trim()) {
      this.matches.set([]);
      this.isOpen.set(false);
      return;
    }
    this.isOpen.set(true);
    this.loading.set(true);
    this.debounce$.next(value);
  }

  clear(): void {
    this.query.set('');
    this.matches.set([]);
    this.isOpen.set(false);
    this.inputRef.nativeElement.focus();
  }

  onKeydown(ev: KeyboardEvent): void {
    if (ev.key === 'Escape') {
      this.isOpen.set(false);
      return;
    }
    if (!this.isOpen() || this.visibleMatches().length === 0) return;

    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      this.activeIndex.update(i => Math.min(i + 1, this.visibleMatches().length - 1));
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      this.activeIndex.update(i => Math.max(i - 1, 0));
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      const target = this.visibleMatches()[this.activeIndex()];
      if (target) this.openOne(target);
    }
  }

  /** Close the dropdown when the user clicks anywhere outside. */
  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent): void {
    if (!this.isOpen()) return;
    if (!this.hostRef.nativeElement.contains(ev.target as Node)) {
      this.isOpen.set(false);
    }
  }

  openOne(i: IInitiative): void {
    this.drilldown.open({
      title:    i.id,
      subtitle: `${i.workstream}${i.site ? ' · ' + i.site : ''}`,
      items:    [i],
    });
    this.isOpen.set(false);
  }

  openAll(): void {
    const items = [...this.matches()];
    if (items.length === 0) return;
    this.drilldown.open({
      title:    `Search: "${this.query()}"`,
      subtitle: `${items.length.toLocaleString('en-US')} matching initiatives`,
      items,
    });
    this.isOpen.set(false);
  }

  wsTag(ws: string): string {
    const base = 'ws-tag ';
    if (ws === 'Cosma')      return base + 'ws-cosma-tag';
    if (ws === 'Powertrain') return base + 'ws-pt-tag';
    if (ws === 'Exteriors')  return base + 'ws-ext-tag';
    return base;
  }

  private async runSearch(q: string): Promise<void> {
    const needle = q.trim().toLowerCase();
    if (!needle) {
      this.matches.set([]);
      this.loading.set(false);
      return;
    }
    try {
      const all = await this.cache.getAllAsync();
      const matched = all.filter(i =>
        i.id.toLowerCase().includes(needle)
        || (i.name        ?? '').toLowerCase().includes(needle)
        || (i.description ?? '').toLowerCase().includes(needle)
        || (i.site        ?? '').toLowerCase().includes(needle)
        || (i.lever       ?? '').toLowerCase().includes(needle)
        || (i.subLever    ?? '').toLowerCase().includes(needle)
        || (i.owner       ?? '').toLowerCase().includes(needle));
      // Stable order: priority first, then NRB desc, then id.
      matched.sort((a, b) => {
        const ap = this.chrome.isPriority(a.id) ? 0 : 1;
        const bp = this.chrome.isPriority(b.id) ? 0 : 1;
        return ap - bp || (b.nrb ?? 0) - (a.nrb ?? 0) || a.id.localeCompare(b.id);
      });
      this.matches.set(matched);
    } finally {
      this.loading.set(false);
    }
  }
}
