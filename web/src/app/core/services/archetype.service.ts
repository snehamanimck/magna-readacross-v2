import { Injectable, computed, inject, signal } from '@angular/core';

import { ReadAcrossAppService } from '@domains/read-across';
import { IArchetypeDefinition, ISiteArchetype } from '@app/models';

/**
 * Cosma archetype data, lazily loaded the first time something needs it.
 *
 * The offline dashboard exposes:
 *   • `archetypes.definitions[name] = description` — what each archetype means.
 *   • `site_archetypes[site] = [archetype, …]` — which archetypes apply to a site.
 *
 * In v2 these come from `getArchetypeDefinitionsAsync()` and
 * `getSiteArchetypesAsync()`. This service caches both, normalises the
 * display name (legacy "Auto-launch" → "Launch/Exit"), and provides
 * convenience lookups for the legend dialog and the P&L benchmarking peer
 * scope.
 */
@Injectable({ providedIn: 'root' })
export class ArchetypeService {
  private readonly app = inject(ReadAcrossAppService);

  private readonly _definitions = signal<readonly IArchetypeDefinition[]>([]);
  private readonly _siteMap = signal<readonly ISiteArchetype[]>([]);
  private readonly _loaded = signal(false);
  private readonly _legendOpen = signal(false);
  private bootStarted = false;

  readonly definitions = this._definitions.asReadonly();
  readonly siteMap = this._siteMap.asReadonly();
  readonly loaded = this._loaded.asReadonly();
  /** True while the legend dialog should be visible. Controlled via openLegend()/closeLegend(). */
  readonly legendOpen = this._legendOpen.asReadonly();

  /** Sorted list of all archetype keys, prettified for display. */
  readonly displayNames = computed(() => {
    const seen = new Set<string>();
    const out: { key: string; display: string }[] = [];
    for (const d of this._definitions()) {
      if (seen.has(d.archetypeKey)) continue;
      seen.add(d.archetypeKey);
      out.push({ key: d.archetypeKey, display: this.prettify(d.archetypeKey) });
    }
    out.sort((a, b) => a.display.localeCompare(b.display));
    return out;
  });

  /** Sites grouped by archetype key, for the legend dialog. */
  readonly sitesByArchetype = computed<ReadonlyMap<string, readonly string[]>>(() => {
    const map = new Map<string, string[]>();
    for (const s of this._siteMap()) {
      const arr = map.get(s.archetypeKey) ?? [];
      arr.push(s.siteName);
      map.set(s.archetypeKey, arr);
    }
    for (const arr of map.values()) arr.sort();
    return map;
  });

  /** Quick lookup: site → list of archetype keys. */
  readonly archetypesBySite = computed<ReadonlyMap<string, readonly string[]>>(() => {
    const map = new Map<string, string[]>();
    for (const s of this._siteMap()) {
      const arr = map.get(s.siteName) ?? [];
      arr.push(s.archetypeKey);
      map.set(s.siteName, arr);
    }
    for (const arr of map.values()) arr.sort();
    return map;
  });

  async ensureLoadedAsync(): Promise<void> {
    if (this.bootStarted) return;
    this.bootStarted = true;
    try {
      const [defs, sites] = await Promise.all([
        this.app.getArchetypeDefinitionsAsync(),
        this.app.getSiteArchetypesAsync(),
      ]);
      this._definitions.set(defs);
      this._siteMap.set(sites);
      this._loaded.set(true);
    } catch (err) {
      // Soft-fail: the legend will simply show empty until a refresh.
      console.warn('[ArchetypeService] load failed', err);
      this.bootStarted = false;
    }
  }

  /** Returns the prettified display name for an archetype key. */
  prettify(key: string): string {
    if (!key) return '';
    return key
      .replace('Auto-launch', 'Launch/Exit')
      .replace('Autolaunch',  'Launch/Exit');
  }

  /** Description for a given key, used in the legend dialog. */
  describe(key: string): string {
    const hit = this._definitions().find(d => d.archetypeKey === key);
    return hit?.description ?? '';
  }

  /** Sites belonging to a given archetype key. Empty array if none. */
  sitesFor(key: string): readonly string[] {
    return this.sitesByArchetype().get(key) ?? [];
  }

  /** Show the legend dialog (mounted once at the app shell). */
  openLegend(): void {
    void this.ensureLoadedAsync();
    this._legendOpen.set(true);
  }
  closeLegend(): void { this._legendOpen.set(false); }
}
