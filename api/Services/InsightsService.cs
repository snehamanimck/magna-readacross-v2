using MagnaReadAcross.Api.Data;
using MagnaReadAcross.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace MagnaReadAcross.Api.Services;

public class InsightsService : IInsightsService
{
    private readonly MagnaDbContext _db;
    public InsightsService(MagnaDbContext db) => _db = db;

    public async Task<IReadOnlyList<ThoughtStarterDto>> GetThoughtStartersAsync(CancellationToken ct = default) =>
        await _db.ThoughtStarters.AsNoTracking()
            .Where(x => x.IsActive)
            .OrderBy(x => x.SortOrder)
            .Select(x => new ThoughtStarterDto
            {
                ThoughtStarterId = x.ThoughtStarterId,
                SpendCategory = x.SpendCategory,
                MfgProcess = x.MfgProcess,
                Lever = x.Lever,
                SubLever = x.SubLever,
                Text = x.Text,
                AdvancedAutomation = x.AdvancedAutomation,
                SortOrder = x.SortOrder,
            })
            .ToListAsync(ct);

    public async Task<IReadOnlyList<PnlRecommendationDto>> GetPnlRecommendationsAsync(CancellationToken ct = default) =>
        await _db.PnlRecommendations.AsNoTracking()
            .Where(x => x.IsActive)
            .OrderBy(x => x.PriorityRank)
            .ThenBy(x => x.Site)
            .Select(x => new PnlRecommendationDto
            {
                PnlRecommendationId = x.PnlRecommendationId,
                Workstream = x.Workstream,
                Site = x.Site,
                Archetype = x.Archetype,
                InitiativeId = x.InitiativeId,
                RecommendationText = x.RecommendationText,
                OpportunityAmount = x.OpportunityAmount,
                PriorityRank = x.PriorityRank,
                SpendCategory = x.SpendCategory,
                PrimaryDriver = x.PrimaryDriver,
                SiteValue = x.SiteValue,
                BenchmarkMedian = x.BenchmarkMedian,
                Quartile = x.Quartile,
                WhitespaceEstimate = x.WhitespaceEstimate,
                DeploymentCount = x.DeploymentCount,
                DeployingDivisions = x.DeployingDivisions,
                AnchorMatch = x.AnchorMatch,
                PriorityCount = x.PriorityCount,
                PriorityFraction = x.PriorityFraction,
                EvidenceStrength = x.EvidenceStrength,
                Confidence = x.Confidence,
                Rationale = x.Rationale,
                ComputedAtUtc = x.ComputedAtUtc,
            })
            .ToListAsync(ct);

    public async Task<IReadOnlyList<KnowledgeCenterAssetDto>> GetKnowledgeCenterAssetsAsync(CancellationToken ct = default) =>
        await _db.KnowledgeCenterAssets.AsNoTracking()
            .Where(x => x.IsActive)
            .OrderBy(x => x.SortOrder)
            .Select(x => new KnowledgeCenterAssetDto
            {
                KnowledgeAssetId = x.KnowledgeAssetId,
                Title = x.Title,
                SpendCategory = x.SpendCategory,
                Workstream = x.Workstream,
                Description = x.Description,
                SlideUrl = x.SlideUrl,
                ThumbnailUrl = x.ThumbnailUrl,
                SortOrder = x.SortOrder,
            })
            .ToListAsync(ct);

    public async Task<IReadOnlyList<VideoLibraryAssetDto>> GetVideoLibraryAssetsAsync(CancellationToken ct = default) =>
        await _db.VideoLibraryAssets.AsNoTracking()
            .Where(x => x.IsActive)
            .OrderBy(x => x.SortOrder)
            .Select(x => new VideoLibraryAssetDto
            {
                VideoAssetId = x.VideoAssetId,
                Title = x.Title,
                SpendCategory = x.SpendCategory,
                Workstream = x.Workstream,
                Description = x.Description,
                VideoUrl = x.VideoUrl,
                ThumbnailUrl = x.ThumbnailUrl,
                DurationSeconds = x.DurationSeconds,
                SortOrder = x.SortOrder,
            })
            .ToListAsync(ct);

    public async Task<IReadOnlyList<ArchetypeDefinitionDto>> GetArchetypeDefinitionsAsync(CancellationToken ct = default) =>
        await _db.ArchetypeDefinitions.AsNoTracking()
            .Where(x => x.IsActive)
            .OrderBy(x => x.DisplayName)
            .Select(x => new ArchetypeDefinitionDto
            {
                ArchetypeKey = x.ArchetypeKey,
                DisplayName = x.DisplayName,
                Workstream = x.Workstream,
                Description = x.Description,
            })
            .ToListAsync(ct);

    public async Task<IReadOnlyList<SiteArchetypeDto>> GetSiteArchetypesAsync(CancellationToken ct = default) =>
        await _db.SiteArchetypes.AsNoTracking()
            .OrderBy(x => x.SiteName)
            .ThenBy(x => x.ArchetypeKey)
            .Select(x => new SiteArchetypeDto
            {
                SiteArchetypeId = x.SiteArchetypeId,
                SiteName = x.SiteName,
                ArchetypeKey = x.ArchetypeKey,
                Workstream = x.Workstream,
            })
            .ToListAsync(ct);

    public async Task<IReadOnlyList<PriorityInitiativeDto>> GetPriorityInitiativesAsync(CancellationToken ct = default) =>
        await _db.PriorityInitiatives.AsNoTracking()
            .OrderBy(x => x.InitiativeId)
            .Select(x => new PriorityInitiativeDto
            {
                InitiativeId = x.InitiativeId,
                PriorityLabel = x.PriorityLabel,
                Workstream = x.Workstream,
            })
            .ToListAsync(ct);
}
