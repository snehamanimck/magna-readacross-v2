import { Injectable, computed, inject, signal } from '@angular/core';

import { ReadAcrossAppService } from '@domains/read-across';
import {
  IDashboardConfig,
  IPnlRecommendationRuntimeConfig,
  IPriorityInitiative,
} from '@app/models';

/**
 * Cross-cutting "chrome" data the SPA pulls once at boot:
 *   • feedback recipient + dashboard `generated` timestamp,
 *   • Wave deep-link base URLs (cosma / powertrain / ignite),
 *   • per-workstream data-quality summaries, and
 *   • the priority-initiative id set used to flag best-practice rows.
 *
 * Mirrors the offline dashboard's top-level `__OFFLINE_DASHBOARD_DATA__`
 * blob so every page (drilldown, search, feedback, etc.) can read from a
 * single source of truth without re-fetching.
 */
@Injectable({ providedIn: 'root' })
export class DashboardChromeService {
  private readonly app = inject(ReadAcrossAppService);

  private readonly _config = signal<IDashboardConfig | undefined>(undefined);
  private readonly _priorityIds = signal<ReadonlySet<string>>(new Set());
  private readonly _dataQualityOpen = signal(false);
  private readonly _refreshing = signal(false);
  private readonly _lastRefreshedAt = signal<Date | undefined>(undefined);
  private _bootStarted = false;

  readonly config = this._config.asReadonly();
  readonly priorityIds = this._priorityIds.asReadonly();
  /** Whether the Data Quality dialog should be visible. */
  readonly dataQualityOpen = this._dataQualityOpen.asReadonly();
  /** True while {@link refreshAsync} is in flight. Drives the spinner UI. */
  readonly refreshing = this._refreshing.asReadonly();
  /** Local clock time of the last successful refresh, undefined before boot. */
  readonly lastRefreshedAt = this._lastRefreshedAt.asReadonly();

  readonly feedbackEmail = computed(
    () => this._config()?.feedbackEmail ?? '',
  );

  readonly generated = computed(() => this._config()?.generated ?? '');
  readonly magnaDivisionAliases = computed(
    () => this._config()?.mappingConfig?.magnaDivisionAliases ?? {},
  );
  readonly recommendationConfig = computed<IPnlRecommendationRuntimeConfig | undefined>(
    () => this._config()?.mappingConfig?.recommendationConfig,
  );

  /** Lazy boot — call once from the app shell. Subsequent calls are no-ops. */
  async bootAsync(): Promise<void> {
    if (this._bootStarted) {
      return;
    }
    this._bootStarted = true;
    await this.loadAsync();
  }

  /**
   * Force a re-pull of dashboard-config + priority-initiatives. Used by the
   * Data Quality dialog's Refresh button so analysts can pick up a fresh
   * snapshot without reloading the SPA. Concurrent calls are coalesced via
   * the {@link refreshing} guard.
   */
  async refreshAsync(): Promise<void> {
    if (this._refreshing()) return;
    await this.loadAsync();
  }

  private async loadAsync(): Promise<void> {
    this._refreshing.set(true);
    try {
      const [config, priorities] = await Promise.all([
        this.safeLoad(() => this.app.getDashboardConfigAsync()),
        this.safeLoad(() => this.app.getPriorityInitiativesAsync()),
      ]);
      if (config) {
        this._config.set(config);
      }
      if (priorities) {
        this._priorityIds.set(this.toIdSet(priorities));
      }
      this._lastRefreshedAt.set(new Date());
    } finally {
      this._refreshing.set(false);
    }
  }

  /**
   * Build the Wave deep-link for a single initiative id.
   * Falls back to a sensible default when the config hasn't loaded yet (so
   * boot races don't produce broken links).
   */
  buildWaveCardUrl(initiativeId: string, workstream?: string): string {
    const slug = this.workstreamSlug(workstream);
    const base = this._config()?.waveBaseUrls?.[slug];
    if (!base) return '#';
    const numeric = String(initiativeId ?? '').replace(/\D/g, '') || initiativeId;
    return `${base}/card/${numeric}`;
  }

  isPriority(initiativeId: string): boolean {
    return this._priorityIds().has(String(initiativeId));
  }

  openDataQuality(): void  { this._dataQualityOpen.set(true); }
  closeDataQuality(): void { this._dataQualityOpen.set(false); }

  private workstreamSlug(workstream?: string): string {
    const raw = (workstream ?? '').trim();
    if (!raw) return 'cosma';
    const byName = this.magnaDivisionAliases();
    return byName[raw] ?? byName[raw.toLowerCase()] ?? 'cosma';
  }

  private toIdSet(rows: IPriorityInitiative[]): ReadonlySet<string> {
    const set = new Set<string>();
    for (const r of rows) {
      if (r?.initiativeId) {
        set.add(String(r.initiativeId));
      }
    }
    return set;
  }

  private async safeLoad<T>(fn: () => Promise<T>): Promise<T | undefined> {
    try {
      return await fn();
    } catch (err) {
      // Boot is best-effort; chrome should never block the rest of the SPA.
      console.warn('[DashboardChromeService] boot fetch failed', err);
      return undefined;
    }
  }
}
