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
