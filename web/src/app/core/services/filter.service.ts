import { Injectable, computed, signal } from '@angular/core';

export interface IDashboardFilters {
  workstreams: string[];
  spendCategories: string[];
  stages: string[];
  subgroups: string[];
  archetypes: string[];
}

const EMPTY: IDashboardFilters = {
  workstreams: [],
  spendCategories: [],
  stages: [],
  subgroups: [],
  archetypes: [],
};

/**
 * Global, signal-based filter store. Every page reads the same filters; pills
 * push updates through `toggle*` helpers.
 */
@Injectable({ providedIn: 'root' })
export class FilterService {
  private readonly _filters = signal<IDashboardFilters>({ ...EMPTY });
  readonly filters = this._filters.asReadonly();

  readonly hasAny = computed(() => {
    const f = this._filters();
    return f.workstreams.length + f.spendCategories.length + f.stages.length
         + f.subgroups.length + f.archetypes.length > 0;
  });

  toggleWorkstream(ws: string)      { this.toggle('workstreams', ws); }
  toggleSpendCategory(c: string)    { this.toggle('spendCategories', c); }
  toggleStage(s: string)            { this.toggle('stages', s); }
  toggleSubgroup(s: string)         { this.toggle('subgroups', s); }
  toggleArchetype(a: string)        {
    this.toggle('archetypes', a);
    // Cosma-only constraint: archetypes are Cosma-specific
    const cur = this._filters();
    if (cur.archetypes.length > 0 && !cur.workstreams.includes('Cosma')) {
      this._filters.set({ ...cur, workstreams: ['Cosma'] });
    }
  }

  clearAll()         { this._filters.set({ ...EMPTY }); }
  clearWorkstreams() { this._filters.set({ ...this._filters(), workstreams: [] }); }
  clearSubgroups()   { this._filters.set({ ...this._filters(), subgroups: [] }); }

  private toggle(key: keyof IDashboardFilters, value: string) {
    const cur = this._filters();
    const arr = cur[key];
    const next = arr.includes(value) ? arr.filter(x => x !== value) : [...arr, value];
    this._filters.set({ ...cur, [key]: next });
  }
}
