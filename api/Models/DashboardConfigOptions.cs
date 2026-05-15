namespace MagnaReadAcross.Api.Models;

/// <summary>
/// Bound from the <c>DashboardConfig</c> section of <c>appsettings.json</c> and
/// reshaped into <see cref="DashboardConfigDto"/> at the controller boundary.
/// Kept in configuration (rather than the database) because every value is a
/// deployment-time constant — the SPA only needs to read it, never write it.
/// </summary>
public class DashboardConfigOptions
{
    public const string SectionName = "DashboardConfig";

    public string FeedbackEmail { get; set; } = string.Empty;

    /// <summary>Maps the workstream slug (cosma / powertrain / ignite) to its Wave base URL.</summary>
    public Dictionary<string, string> WaveBaseUrls { get; set; } = new(StringComparer.OrdinalIgnoreCase);

    public WorkstreamMetaOptions? CosmaMeta { get; set; }
    public WorkstreamMetaOptions? PowertrainMeta { get; set; }
    public WorkstreamMetaOptions? ExteriorsMeta { get; set; }
    public WorkstreamMetaOptions? SeatingMeta { get; set; }

    /// <summary>
    /// UI runtime knobs consumed by the SPA (routing slugs, recommendation
    /// heuristics, taxonomy maps). Keeping these in config removes a large
    /// set of hardcoded literals from Angular services.
    /// </summary>
    public MappingConfigOptions MappingConfig { get; set; } = new();
}

public class WorkstreamMetaOptions
{
    public int TotalRaw { get; set; }
    public int TotalActive { get; set; }
    public int TotalCategorized { get; set; }
    public int? TotalUncategorized { get; set; }
    public int? TotalNeedsReview { get; set; }
    public string? Benchmark { get; set; }
    public string? LastValidated { get; set; }
    public List<string> ValidationNotes { get; set; } = new();
    public List<string> ExclusionRules  { get; set; } = new();
}

public class MappingConfigOptions
{
    /// <summary>
    /// Canonical workstream display name (Cosma / Powertrain / Exteriors /
    /// Seating) -> Wave slug key used by <see cref="DashboardConfigDto.WaveBaseUrls"/>.
    /// </summary>
    public Dictionary<string, string> MagnaDivisionAliases { get; set; } = new(StringComparer.OrdinalIgnoreCase);

    public PnlRecommendationRuntimeOptions RecommendationConfig { get; set; } = new();
}

public class PnlRecommendationRuntimeOptions
{
    public Dictionary<string, string> CosmaSubgroupMap { get; set; } = new(StringComparer.OrdinalIgnoreCase);

    public Dictionary<string, List<string>> ArchetypeMfgAllowed { get; set; } = new(StringComparer.OrdinalIgnoreCase);

    public Dictionary<string, List<string>> SpendCategoryMetricMap { get; set; } = new(StringComparer.OrdinalIgnoreCase);

    public PnlRecommendationScoringOptions Scoring { get; set; } = new();
}

public class PnlRecommendationScoringOptions
{
    public int CostBaseTrailingMonths { get; set; } = 3;
    public decimal CostBaseAnnualizationFactor { get; set; } = 12m;
    public int MaxDrilldownItems { get; set; } = 25;
    public int MaxSiteRecommendations { get; set; } = 3;
    public int MinPeerSites { get; set; } = 2;
    public decimal PeerNrbRelevanceScale { get; set; } = 500_000m;
    public decimal OpportunityWhitespaceFactor { get; set; } = 0.6m;
    public decimal OpportunityUnderrepresentedFactor { get; set; } = 0.4m;
    public int OpportunityTopPeerMinCount { get; set; } = 3;
    public decimal OpportunityTopPeerFraction { get; set; } = 0.3m;
    public int BestPeersCount { get; set; } = 5;
    public decimal OpportunityWeight { get; set; } = 0.35m;
    public decimal PnlRelevanceWeight { get; set; } = 0.20m;
    public decimal NrbShortfallWeight { get; set; } = 0.15m;
    public decimal ArchetypeMatchWeight { get; set; } = 0.15m;
    public decimal RegionMatchWeight { get; set; } = 0.10m;
    public decimal WhitespaceBonusWeight { get; set; } = 0.05m;
    public decimal PnlGapScaleFactor { get; set; } = 5m;
}
