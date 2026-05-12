import { Injectable, computed, effect, inject, signal } from '@angular/core';

import { ReadAcrossAppService } from '@domains/read-across';
import { IInitiative } from '@app/models';
import { FilterService } from './filter.service';
import { IDrilldownContext } from './drilldown.service';

/**
 * Caches the harmonized initiative list keyed by the active workstream filter.
 * The global workstream pills are server-side filters, so each distinct
 * combination is fetched at most once per session; everything else (category,
 * stage, subgroup, archetype) is applied client-side.
 *
 * The bucket and heatmap pages render aggregates, but the drilldown dialog
 * needs the underlying initiatives — this service keeps them warm so the
 * first drilldown click on a populated session is instant.
 */
@Injectable({ providedIn: 'root' })
export class InitiativeCacheService {
  private readonly app = inject(ReadAcrossAppService);
  private readonly filters = inject(FilterService);

  private readonly cache = new Map<string, Promise<IInitiative[]>>();
  private readonly _loading = signal(false);
  readonly loading = this._loading.asReadonly();

  private readonly workstreamKey = computed(() =>
    [...this.filters.filters().workstreams].sort().join('|'),
  );

  constructor() {
    // Warm the cache for the active workstream filter on every change.
    // The promise is fired-and-forgotten — consumers `await` it explicitly.
    effect(() => {
      void this.getAllAsync();
    });
  }

  async getAllAsync(): Promise<IInitiative[]> {
    const key = this.workstreamKey();
    let entry = this.cache.get(key);
    if (!entry) {
      this._loading.set(true);
      const ws = key ? key.split('|') : undefined;
      entry = this.app
        .getInitiativesAsync(ws ? { workstream: ws } : undefined)
        .finally(() => this._loading.set(false));
      this.cache.set(key, entry);
    }
    return entry;
  }

  /**
   * Returns the subset of cached initiatives that match a drill context,
   * additionally applying the active client-side filters (stage, subgroup,
   * archetype, spend category) so drilldowns stay consistent with whatever
   * the user has filtered to in the chrome.
   */
  async filterByContextAsync(ctx: IDrilldownContext): Promise<IInitiative[]> {
    const all = await this.getAllAsync();
    const f = this.filters.filters();
    const cats = new Set(f.spendCategories);
    const stages = new Set(f.stages);
    const subgroups = new Set(f.subgroups);
    const archetypes = new Set(f.archetypes);
    return all.filter(i => {
      if (ctx.workstream    && i.workstream    !== ctx.workstream)    return false;
      if (ctx.spendCategory && i.spendCategory !== ctx.spendCategory) return false;
      if (ctx.mfgProcess    && (i.mfgProcess ?? '') !== ctx.mfgProcess) return false;
      if (ctx.lever         && (i.lever      ?? '') !== ctx.lever)      return false;
      if (ctx.subLever      && (i.subLever   ?? '') !== ctx.subLever)   return false;
      if (ctx.site          && i.site        !== ctx.site)              return false;
      if (cats.size      && !cats.has(i.spendCategory ?? ''))            return false;
      if (stages.size    && !stages.has(i.stage ?? ''))                  return false;
      if (subgroups.size && i.subgroup && !subgroups.has(i.subgroup))    return false;
      if (archetypes.size && !i.archetypes.some(a => archetypes.has(a))) return false;
      return true;
    });
  }
}
