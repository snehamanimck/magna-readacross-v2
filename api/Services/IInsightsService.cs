using MagnaReadAcross.Api.Models;

namespace MagnaReadAcross.Api.Services;

public interface IInsightsService
{
    Task<IReadOnlyList<ThoughtStarterDto>> GetThoughtStartersAsync(CancellationToken ct = default);
    Task<IReadOnlyList<PnlRecommendationDto>> GetPnlRecommendationsAsync(CancellationToken ct = default);
    Task<IReadOnlyList<KnowledgeCenterAssetDto>> GetKnowledgeCenterAssetsAsync(CancellationToken ct = default);
    Task<IReadOnlyList<VideoLibraryAssetDto>> GetVideoLibraryAssetsAsync(CancellationToken ct = default);
    Task<IReadOnlyList<ArchetypeDefinitionDto>> GetArchetypeDefinitionsAsync(CancellationToken ct = default);
    Task<IReadOnlyList<SiteArchetypeDto>> GetSiteArchetypesAsync(CancellationToken ct = default);
    Task<IReadOnlyList<PriorityInitiativeDto>> GetPriorityInitiativesAsync(CancellationToken ct = default);
}
