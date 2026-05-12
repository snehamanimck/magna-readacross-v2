import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { DashboardChromeService } from '@app/core-services';
import { GlobalSearchComponent } from '../global-search/global-search.component';

interface NavItem { path: string; label: string; icon: string; }

/**
 * Top-level application chrome.
 *
 * Production layout: full Magna wordmark (left) + product name + BETA
 * badge → underline tab rail → search input on the far right. Anchored
 * to a sticky white surface with the Digi DS Gray F0 hairline border.
 */
@Component({
  selector: 'mra-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, GlobalSearchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="sticky top-0 z-50 border-b border-gray-f0 bg-white">
      <div class="mx-auto flex h-14 items-center gap-6 px-6">

        <!-- Brand mark + product name -->
        <a routerLink="/buckets" class="flex items-center gap-3 group shrink-0">
          <!-- Real Magna corporate wordmark (SVG asset shipped with the app).
               Note: Angular flattens src/assets into the deploy root, so the
               served URL is /magna-logo.svg, not /assets/magna-logo.svg. -->
          <img src="magna-logo.svg" alt="Magna"
               class="h-7 w-auto select-none"
               draggable="false" />
          <span class="text-[16px] font-bold text-gray-1 tracking-tight">Read-Across Dashboard</span>
          <span class="badge"
                style="background-color: #FEF3C7; color: #92400E; border: 1px solid #FCD34D">BETA</span>
        </a>

        <!-- Primary nav rail -->
        <nav class="flex gap-0 self-stretch items-stretch ml-2">
          @for (item of nav; track item.path) {
            <a
              [routerLink]="item.path"
              routerLinkActive="!text-aqua-6 !border-aqua-6"
              [routerLinkActiveOptions]="{ exact: false }"
              class="relative flex items-center gap-2 border-b-2 border-transparent
                     px-4 text-sm font-medium text-gray-6
                     hover:text-aqua-6 hover:bg-aqua-1/40
                     transition-colors">
              <span class="text-[15px]" [innerHTML]="item.icon" aria-hidden="true"></span>
              {{ item.label }}
            </a>
          }
        </nav>

        <!-- Right-aligned: Data Quality chip + global search -->
        <div class="ml-auto flex items-center gap-3">
          <button type="button"
                  class="inline-flex items-center gap-1.5 rounded-full border border-gray-f0
                         bg-gray-f9 px-3 py-1 text-[11px] font-medium text-gray-6
                         hover:border-aqua-4 hover:text-aqua-6 transition-colors"
                  title="Per-workstream coverage, validation notes, and exclusion rules"
                  (click)="chrome.openDataQuality()">
            <svg class="h-3 w-3" viewBox="0 0 16 16" fill="none" stroke="currentColor"
                 stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
              <path d="M3 13V6" /><path d="M7 13V3" /><path d="M11 13V8" /><path d="M2 13h13" />
            </svg>
            <span>Data Quality</span>
            @if (snapshotDate(); as d) {
              <span class="text-gray-7">· {{ d }}</span>
            }
          </button>
          <mra-global-search></mra-global-search>
        </div>
      </div>
    </header>
  `,
})
export class HeaderComponent {
  protected readonly chrome = inject(DashboardChromeService);

  /** Compact "as of YYYY-MM-DD" copy for the header chip. */
  readonly snapshotDate = computed(() => {
    const raw = this.chrome.generated();
    if (!raw) return '';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw.slice(0, 10);
    return d.toISOString().slice(0, 10);
  });

  readonly nav: NavItem[] = [
    {
      path: '/buckets',  label: 'Initiative Overview',
      icon: '<svg viewBox="0 0 20 20" class="h-4 w-4 inline" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 17V8" /><path d="M8 17V4" /><path d="M13 17v-7" /><path d="M2 17h16" /></svg>',
    },
    {
      path: '/heatmap',  label: 'Heatmap',
      icon: '<svg viewBox="0 0 20 20" class="h-4 w-4 inline" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="4" height="4" /><rect x="9" y="3" width="4" height="4" /><rect x="3" y="9" width="4" height="4" /><rect x="9" y="9" width="4" height="4" /><rect x="3" y="15" width="4" height="2" /><rect x="9" y="15" width="4" height="2" /></svg>',
    },
    {
      path: '/insights', label: 'Insights & Inspiration',
      icon: '<svg viewBox="0 0 20 20" class="h-4 w-4 inline" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="10" cy="9" r="5" /><path d="M7.5 17h5" /><path d="M8.5 14.5h3" /></svg>',
    },
    {
      path: '/feedback', label: 'Give Feedback',
      icon: '<svg viewBox="0 0 20 20" class="h-4 w-4 inline" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h14v9H8l-3 3v-3H3z" /></svg>',
    },
  ];
}
