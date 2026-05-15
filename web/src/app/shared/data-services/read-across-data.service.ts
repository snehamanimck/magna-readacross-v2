import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  IArchetypeDefinition,
  IBucketRow,
  IDashboardConfig,
  IFilterOptions,
  IHeatmapCell,
  IInitiative,
  IKnowledgeCenterAsset,
  IPnlBenchmarks,
  IPnlRecommendation,
  IPnlEntry,
  IPnlSummaryRow,
  IPriorityInitiative,
  ISiteArchetype,
  ISubgroup,
  IThoughtStarter,
  IVideoLibraryAsset,
} from '@app/models';

@Injectable({ providedIn: 'root' })
export class ReadAcrossDataService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;
  private readonly endpoints = {
    initiatives: '/Initiatives',
    initiativesFilterOptions: '/Initiatives/filter-options',
    initiativesSubgroups: '/Initiatives/subgroups',
    aggregatesBuckets: '/Aggregates/buckets',
    aggregatesHeatmap: '/Aggregates/heatmap',
    pnl: '/Pnl',
    pnlSummary: '/Pnl/summary',
    pnlBenchmarks: '/Pnl/benchmarks',
    insightsThoughtStarters: '/Insights/thought-starters',
    insightsPnlRecommendations: '/Insights/pnl-recommendations',
    insightsKnowledgeCenter: '/Insights/knowledge-center',
    insightsVideoLibrary: '/Insights/video-library',
    insightsPriorityInitiatives: '/Insights/priority-initiatives',
    insightsArchetypes: '/Insights/archetypes',
    insightsSiteArchetypes: '/Insights/site-archetypes',
    insightsDashboardConfig: '/Insights/dashboard-config',
  } as const;

  async getInitiativesAsync(filter?: {
    workstream?: string[];
    spendCategory?: string[];
    stage?: string[];
    subgroup?: string[];
    archetype?: string[];
  }): Promise<IInitiative[]> {
    return firstValueFrom(
      this.http.get<IInitiative[]>(this.url('initiatives'), {
        params: this.toParams(filter ?? {}),
      }),
    );
  }

  async getFilterOptionsAsync(): Promise<IFilterOptions> {
    return firstValueFrom(this.http.get<IFilterOptions>(this.url('initiativesFilterOptions')));
  }

  /**
   * One row per (Workstream, Subgroup) pair the harmonized initiative list
   * contains, with the rolled-up site array. Backed by the `Subgroup` column
   * on each Wave table — populated by `sql/05_backfill_subgroups.sql`.
   */
  async getSubgroupsAsync(): Promise<ISubgroup[]> {
    return firstValueFrom(this.http.get<ISubgroup[]>(this.url('initiativesSubgroups')));
  }

  async getBucketsAsync(workstreams?: string[]): Promise<IBucketRow[]> {
    return firstValueFrom(
      this.http.get<IBucketRow[]>(this.url('aggregatesBuckets'), {
        params: this.toParams({ workstream: workstreams }),
      }),
    );
  }

  async getHeatmapAsync(workstreams?: string[]): Promise<IHeatmapCell[]> {
    return firstValueFrom(
      this.http.get<IHeatmapCell[]>(this.url('aggregatesHeatmap'), {
        params: this.toParams({ workstream: workstreams }),
      }),
    );
  }

  async getPnlAsync(filter?: {
    cube?: string;
    entity?: string;
    scenario?: string;
    time?: string;
    account?: string;
    take?: number;
    skip?: number;
  }): Promise<IPnlEntry[]> {
    return firstValueFrom(
      this.http.get<IPnlEntry[]>(this.url('pnl'), {
        params: this.toParams(filter ?? {}),
      }),
    );
  }

  async getPnlSummaryAsync(filter?: {
    cube?: string;
    scenario?: string;
    time?: string;
  }): Promise<IPnlSummaryRow[]> {
    return firstValueFrom(
      this.http.get<IPnlSummaryRow[]>(this.url('pnlSummary'), {
        params: this.toParams(filter ?? {}),
      }),
    );
  }

  /**
   * Curated P&L benchmarks blob (53 Cosma + PT + Exteriors sites).
   * Drives the Insights → P&L Benchmarking page; backed by the static
   * `Resources/pnl-benchmarks.json` shipped with the API image.
   */
  async getPnlBenchmarksAsync(): Promise<IPnlBenchmarks> {
    return firstValueFrom(this.http.get<IPnlBenchmarks>(this.url('pnlBenchmarks')));
  }

  async getThoughtStartersAsync(): Promise<IThoughtStarter[]> {
    return firstValueFrom(this.http.get<IThoughtStarter[]>(this.url('insightsThoughtStarters')));
  }

  async getPnlRecommendationsAsync(): Promise<IPnlRecommendation[]> {
    return firstValueFrom(this.http.get<IPnlRecommendation[]>(this.url('insightsPnlRecommendations')));
  }

  async getKnowledgeCenterAssetsAsync(): Promise<IKnowledgeCenterAsset[]> {
    return firstValueFrom(this.http.get<IKnowledgeCenterAsset[]>(this.url('insightsKnowledgeCenter')));
  }

  async getVideoLibraryAssetsAsync(): Promise<IVideoLibraryAsset[]> {
    return firstValueFrom(this.http.get<IVideoLibraryAsset[]>(this.url('insightsVideoLibrary')));
  }

  async getPriorityInitiativesAsync(): Promise<IPriorityInitiative[]> {
    return firstValueFrom(this.http.get<IPriorityInitiative[]>(this.url('insightsPriorityInitiatives')));
  }

  async getArchetypeDefinitionsAsync(): Promise<IArchetypeDefinition[]> {
    return firstValueFrom(this.http.get<IArchetypeDefinition[]>(this.url('insightsArchetypes')));
  }

  async getSiteArchetypesAsync(): Promise<ISiteArchetype[]> {
    return firstValueFrom(this.http.get<ISiteArchetype[]>(this.url('insightsSiteArchetypes')));
  }

  /**
   * Per-workstream metadata + Wave deep-link base URLs + feedback recipient.
   * Pulled once at app boot — see `IDashboardConfig`.
   */
  async getDashboardConfigAsync(): Promise<IDashboardConfig> {
    return firstValueFrom(this.http.get<IDashboardConfig>(this.url('insightsDashboardConfig')));
  }

  private url(key: keyof typeof this.endpoints): string {
    return `${this.baseUrl}${this.endpoints[key]}`;
  }

  private toParams(obj: Record<string, unknown>): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(obj)) {
      if (value == null) {
        continue;
      }
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item != null && item !== '') {
            params = params.append(key, String(item));
          }
        }
      } else if (value !== '') {
        params = params.set(key, String(value));
      }
    }
    return params;
  }
}
