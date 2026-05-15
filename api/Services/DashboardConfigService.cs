using System.Text.Json;
using MagnaReadAcross.Api.Data;
using MagnaReadAcross.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace MagnaReadAcross.Api.Services;

/// <summary>
/// Builds <see cref="DashboardConfigDto"/> by combining static configuration
/// (Wave URLs, feedback recipient) with the offline data-quality blocks the
/// ingest pipeline lands in <c>readacross.DashboardMetaSnapshots</c>. When no
/// snapshot row exists for a section the strongly-typed
/// <see cref="DashboardConfigOptions"/> values are used as a fallback so the
/// endpoint always returns a sensible payload.
/// </summary>
public class DashboardConfigService : IDashboardConfigService
{
    // Snapshot payloads were emitted with snake_case keys (matching the
    // source dashboard_data.json). Use a dedicated options bag so the global
    // camelCase API serializer never interferes with reading them.
    private static readonly JsonSerializerOptions SnapshotJsonOpts = new(JsonSerializerDefaults.Web)
    {
        PropertyNamingPolicy        = JsonNamingPolicy.SnakeCaseLower,
        PropertyNameCaseInsensitive = true,
    };

    private readonly DashboardConfigOptions _options;
    private readonly MagnaDbContext _db;

    public DashboardConfigService(IOptions<DashboardConfigOptions> options, MagnaDbContext db)
    {
        _options = options.Value;
        _db      = db;
    }

    public async Task<DashboardConfigDto> GetAsync(CancellationToken ct = default)
    {
        var snapshots = await _db.DashboardMetaSnapshots
            .AsNoTracking()
            .Where(s => s.SectionKey == "cosma_meta"
                     || s.SectionKey == "powertrain_meta"
                     || s.SectionKey == "exteriors_meta"
                     || s.SectionKey == "seating_meta"
                     || s.SectionKey == "generated")
            .GroupBy(s => s.SectionKey)
            .Select(g => g.OrderByDescending(x => x.GeneratedAtUtc).First())
            .ToListAsync(ct);

        var bySection = snapshots.ToDictionary(s => s.SectionKey, s => s, StringComparer.OrdinalIgnoreCase);

        var generated = bySection.TryGetValue("generated", out var g)
            ? ParseGenerated(g.PayloadJson)
            : DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ");
        var mappingConfig = await BuildMappingConfigAsync(ct);

        return new DashboardConfigDto
        {
            Generated      = generated,
            FeedbackEmail  = _options.FeedbackEmail,
            WaveBaseUrls   = new Dictionary<string, string>(_options.WaveBaseUrls, StringComparer.OrdinalIgnoreCase),
            MappingConfig  = mappingConfig,
            CosmaMeta      = MetaFromSnapshot(bySection, "cosma_meta")      ?? ToDto(_options.CosmaMeta),
            PowertrainMeta = MetaFromSnapshot(bySection, "powertrain_meta") ?? ToDto(_options.PowertrainMeta),
            ExteriorsMeta  = MetaFromSnapshot(bySection, "exteriors_meta")  ?? ToDto(_options.ExteriorsMeta),
            SeatingMeta    = MetaFromSnapshot(bySection, "seating_meta")    ?? ToDto(_options.SeatingMeta),
        };
    }

    private static string ParseGenerated(string payloadJson)
    {
        // The "generated" snapshot stores the raw scalar (string) verbatim.
        try
        {
            var raw = JsonSerializer.Deserialize<string>(payloadJson, SnapshotJsonOpts);
            return string.IsNullOrWhiteSpace(raw)
                ? DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ")
                : raw;
        }
        catch
        {
            return DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ");
        }
    }

    private static WorkstreamMetaDto? MetaFromSnapshot(
        IReadOnlyDictionary<string, Entities.DashboardMetaSnapshot> bySection,
        string key)
    {
        if (!bySection.TryGetValue(key, out var snap) || string.IsNullOrWhiteSpace(snap.PayloadJson))
            return null;

        try
        {
            var raw = JsonSerializer.Deserialize<RawMeta>(snap.PayloadJson, SnapshotJsonOpts);
            if (raw is null) return null;

            // The Cosma block uses `total_working` (post-exclusion) where the
            // PT/Ext blocks expose `total_active`. Treat them as equivalent.
            var totalActive = raw.TotalActive ?? raw.TotalWorking ?? 0;

            return new WorkstreamMetaDto
            {
                TotalRaw           = raw.TotalRaw ?? 0,
                TotalActive        = totalActive,
                TotalCategorized   = raw.TotalCategorized ?? 0,
                TotalUncategorized = raw.TotalUncategorized,
                TotalNeedsReview   = raw.TotalNeedsReview,
                Benchmark          = raw.Benchmark,
                LastValidated      = raw.LastValidated,
                ValidationNotes    = raw.ValidationNotes ?? Array.Empty<string>(),
                ExclusionRules     = raw.ExclusionRules  ?? Array.Empty<string>(),
            };
        }
        catch
        {
            return null;
        }
    }

    private static WorkstreamMetaDto? ToDto(WorkstreamMetaOptions? src) => src is null ? null : new WorkstreamMetaDto
    {
        TotalRaw           = src.TotalRaw,
        TotalActive        = src.TotalActive,
        TotalCategorized   = src.TotalCategorized,
        TotalUncategorized = src.TotalUncategorized,
        TotalNeedsReview   = src.TotalNeedsReview,
        Benchmark          = src.Benchmark,
        LastValidated      = src.LastValidated,
        ValidationNotes    = src.ValidationNotes.ToArray(),
        ExclusionRules     = src.ExclusionRules.ToArray(),
    };

    private static MappingConfigDto ToMappingConfigDto(MappingConfigOptions? src)
    {
        src ??= new MappingConfigOptions();
        return new MappingConfigDto
        {
            MagnaDivisionAliases = new Dictionary<string, string>(
                src.MagnaDivisionAliases ?? new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase),
                StringComparer.OrdinalIgnoreCase),
            RecommendationConfig = new PnlRecommendationRuntimeDto
            {
                CosmaSubgroupMap = new Dictionary<string, string>(
                    src.RecommendationConfig?.CosmaSubgroupMap
                    ?? new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase),
                    StringComparer.OrdinalIgnoreCase),
                ArchetypeMfgAllowed = (src.RecommendationConfig?.ArchetypeMfgAllowed
                                       ?? new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase))
                    .ToDictionary(
                        kv => kv.Key,
                        kv => (IReadOnlyList<string>)kv.Value.ToArray(),
                        StringComparer.OrdinalIgnoreCase),
                SpendCategoryMetricMap = (src.RecommendationConfig?.SpendCategoryMetricMap
                                          ?? new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase))
                    .ToDictionary(
                        kv => kv.Key,
                        kv => (IReadOnlyList<string>)kv.Value.ToArray(),
                        StringComparer.OrdinalIgnoreCase),
                Scoring = ToScoringDto(src.RecommendationConfig?.Scoring),
            },
        };
    }

    private static PnlRecommendationScoringDto ToScoringDto(PnlRecommendationScoringOptions? src)
    {
        src ??= new PnlRecommendationScoringOptions();
        return new PnlRecommendationScoringDto
        {
            CostBaseTrailingMonths = src.CostBaseTrailingMonths,
            CostBaseAnnualizationFactor = src.CostBaseAnnualizationFactor,
            MaxDrilldownItems = src.MaxDrilldownItems,
            MaxSiteRecommendations = src.MaxSiteRecommendations,
            MinPeerSites = src.MinPeerSites,
            PeerNrbRelevanceScale = src.PeerNrbRelevanceScale,
            OpportunityWhitespaceFactor = src.OpportunityWhitespaceFactor,
            OpportunityUnderrepresentedFactor = src.OpportunityUnderrepresentedFactor,
            OpportunityTopPeerMinCount = src.OpportunityTopPeerMinCount,
            OpportunityTopPeerFraction = src.OpportunityTopPeerFraction,
            BestPeersCount = src.BestPeersCount,
            OpportunityWeight = src.OpportunityWeight,
            PnlRelevanceWeight = src.PnlRelevanceWeight,
            NrbShortfallWeight = src.NrbShortfallWeight,
            ArchetypeMatchWeight = src.ArchetypeMatchWeight,
            RegionMatchWeight = src.RegionMatchWeight,
            WhitespaceBonusWeight = src.WhitespaceBonusWeight,
            PnlGapScaleFactor = src.PnlGapScaleFactor,
        };
    }

    private async Task<MappingConfigDto> BuildMappingConfigAsync(CancellationToken ct)
    {
        var fallback = ToMappingConfigDto(_options.MappingConfig);

        var divisionAliases = await _db.MagnaDivisionAliases
            .AsNoTracking()
            .Where(x => x.IsActive)
            .ToListAsync(ct);
        var subgroupMap = await _db.CosmaSubgroupMaps
            .AsNoTracking()
            .Where(x => x.IsActive)
            .ToListAsync(ct);
        var archetypeMfg = await _db.ArchetypeMfgAllowed
            .AsNoTracking()
            .Where(x => x.IsActive)
            .ToListAsync(ct);
        var spendCategoryMetric = await _db.SpendCategoryMetricMap
            .AsNoTracking()
            .Where(x => x.IsActive)
            .ToListAsync(ct);
        var scoring = await _db.RecommendationScoring
            .AsNoTracking()
            .Where(x => x.IsActive)
            .OrderByDescending(x => x.UpdatedAtUtc)
            .ThenByDescending(x => x.RecommendationScoringId)
            .FirstOrDefaultAsync(ct);

        var hasSqlRuntime = divisionAliases.Count > 0
                            || subgroupMap.Count > 0
                            || archetypeMfg.Count > 0
                            || spendCategoryMetric.Count > 0
                            || scoring is not null;
        if (!hasSqlRuntime)
            return fallback;

        return new MappingConfigDto
        {
            MagnaDivisionAliases = divisionAliases.Count > 0
                ? divisionAliases
                    .GroupBy(x => x.MagnaDivision, StringComparer.OrdinalIgnoreCase)
                    .ToDictionary(
                        g => g.Key,
                        g => g.OrderByDescending(x => x.UpdatedAtUtc).ThenByDescending(x => x.MagnaDivisionAliasId).First().DivisionAlias,
                        StringComparer.OrdinalIgnoreCase)
                : fallback.MagnaDivisionAliases,
            RecommendationConfig = new PnlRecommendationRuntimeDto
            {
                CosmaSubgroupMap = subgroupMap.Count > 0
                    ? subgroupMap
                        .GroupBy(x => x.SiteName, StringComparer.OrdinalIgnoreCase)
                        .ToDictionary(
                            g => g.Key,
                            g => g.OrderByDescending(x => x.UpdatedAtUtc).ThenByDescending(x => x.CosmaSubgroupMapId).First().Subgroup,
                            StringComparer.OrdinalIgnoreCase)
                    : fallback.RecommendationConfig.CosmaSubgroupMap,
                ArchetypeMfgAllowed = archetypeMfg.Count > 0
                    ? archetypeMfg
                        .GroupBy(x => x.ArchetypeKey, StringComparer.OrdinalIgnoreCase)
                        .ToDictionary(
                            g => g.Key,
                            g => (IReadOnlyList<string>)g
                                .Select(x => x.MfgProcess)
                                .Distinct(StringComparer.OrdinalIgnoreCase)
                                .OrderBy(x => x, StringComparer.OrdinalIgnoreCase)
                                .ToArray(),
                            StringComparer.OrdinalIgnoreCase)
                    : fallback.RecommendationConfig.ArchetypeMfgAllowed,
                SpendCategoryMetricMap = spendCategoryMetric.Count > 0
                    ? spendCategoryMetric
                        .GroupBy(x => x.SpendCategory, StringComparer.OrdinalIgnoreCase)
                        .ToDictionary(
                            g => g.Key,
                            g => (IReadOnlyList<string>)g
                                .Select(x => x.MetricKey)
                                .Distinct(StringComparer.OrdinalIgnoreCase)
                                .OrderBy(x => x, StringComparer.OrdinalIgnoreCase)
                                .ToArray(),
                            StringComparer.OrdinalIgnoreCase)
                    : fallback.RecommendationConfig.SpendCategoryMetricMap,
                Scoring = scoring is not null
                    ? new PnlRecommendationScoringDto
                    {
                        CostBaseTrailingMonths = scoring.CostBaseTrailingMonths,
                        CostBaseAnnualizationFactor = scoring.CostBaseAnnualizationFactor,
                        MaxDrilldownItems = scoring.MaxDrilldownItems,
                        MaxSiteRecommendations = scoring.MaxSiteRecommendations,
                        MinPeerSites = scoring.MinPeerSites,
                        PeerNrbRelevanceScale = scoring.PeerNrbRelevanceScale,
                        OpportunityWhitespaceFactor = scoring.OpportunityWhitespaceFactor,
                        OpportunityUnderrepresentedFactor = scoring.OpportunityUnderrepresentedFactor,
                        OpportunityTopPeerMinCount = scoring.OpportunityTopPeerMinCount,
                        OpportunityTopPeerFraction = scoring.OpportunityTopPeerFraction,
                        BestPeersCount = scoring.BestPeersCount,
                        OpportunityWeight = scoring.OpportunityWeight,
                        PnlRelevanceWeight = scoring.PnlRelevanceWeight,
                        NrbShortfallWeight = scoring.NrbShortfallWeight,
                        ArchetypeMatchWeight = scoring.ArchetypeMatchWeight,
                        RegionMatchWeight = scoring.RegionMatchWeight,
                        WhitespaceBonusWeight = scoring.WhitespaceBonusWeight,
                        PnlGapScaleFactor = scoring.PnlGapScaleFactor,
                    }
                    : fallback.RecommendationConfig.Scoring,
            },
        };
    }

    /// <summary>Mirrors the snake_case shape of the offline meta blocks.</summary>
    private sealed class RawMeta
    {
        public int? TotalRaw           { get; set; }
        public int? TotalActive        { get; set; }
        public int? TotalWorking       { get; set; }
        public int? TotalCategorized   { get; set; }
        public int? TotalUncategorized { get; set; }
        public int? TotalNeedsReview   { get; set; }
        public string? Benchmark       { get; set; }
        public string? LastValidated   { get; set; }
        public IReadOnlyList<string>? ValidationNotes { get; set; }
        public IReadOnlyList<string>? ExclusionRules  { get; set; }
    }
}
