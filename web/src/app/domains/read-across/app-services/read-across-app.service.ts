import { Injectable, inject } from '@angular/core';

import { ReadAcrossDataService } from '@app/data-services';
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
  IPnlSummaryRow,
  IPriorityInitiative,
  ISiteArchetype,
  ISubgroup,
  IThoughtStarter,
  IVideoLibraryAsset,
} from '@app/models';

@Injectable({ providedIn: 'root' })
export class ReadAcrossAppService {
  private readonly dataService = inject(ReadAcrossDataService);

  getInitiativesAsync(filter?: {
    workstream?: string[];
    spendCategory?: string[];
    stage?: string[];
    subgroup?: string[];
    archetype?: string[];
  }): Promise<IInitiative[]> {
    return this.dataService.getInitiativesAsync(filter);
  }

  getBucketsAsync(workstreams?: string[]): Promise<IBucketRow[]> {
    return this.dataService.getBucketsAsync(workstreams);
  }

  getHeatmapAsync(workstreams?: string[]): Promise<IHeatmapCell[]> {
    return this.dataService.getHeatmapAsync(workstreams);
  }

  getFilterOptionsAsync(): Promise<IFilterOptions> {
    return this.dataService.getFilterOptionsAsync();
  }

  getSubgroupsAsync(): Promise<ISubgroup[]> {
    return this.dataService.getSubgroupsAsync();
  }

  getPnlSummaryAsync(filter?: { cube?: string; scenario?: string; time?: string }): Promise<IPnlSummaryRow[]> {
    return this.dataService.getPnlSummaryAsync(filter);
  }

  /**
   * Curated P&L benchmarks for every Cosma / PT / Exteriors site. See
   * {@link IPnlBenchmarks}. Cached server-side as a singleton so this is
   * effectively a free call after the first request per process lifetime.
   */
  getPnlBenchmarksAsync(): Promise<IPnlBenchmarks> {
    return this.dataService.getPnlBenchmarksAsync();
  }

  getThoughtStartersAsync(): Promise<IThoughtStarter[]> {
    return this.dataService.getThoughtStartersAsync();
  }

  getPnlRecommendationsAsync(): Promise<IPnlRecommendation[]> {
    return this.dataService.getPnlRecommendationsAsync();
  }

  getKnowledgeCenterAssetsAsync(): Promise<IKnowledgeCenterAsset[]> {
    return this.dataService.getKnowledgeCenterAssetsAsync();
  }

  getVideoLibraryAssetsAsync(): Promise<IVideoLibraryAsset[]> {
    return this.dataService.getVideoLibraryAssetsAsync();
  }

  getPriorityInitiativesAsync(): Promise<IPriorityInitiative[]> {
    return this.dataService.getPriorityInitiativesAsync();
  }

  getArchetypeDefinitionsAsync(): Promise<IArchetypeDefinition[]> {
    return this.dataService.getArchetypeDefinitionsAsync();
  }

  getSiteArchetypesAsync(): Promise<ISiteArchetype[]> {
    return this.dataService.getSiteArchetypesAsync();
  }

  getDashboardConfigAsync(): Promise<IDashboardConfig> {
    return this.dataService.getDashboardConfigAsync();
  }
}
