namespace MagnaReadAcross.Api.Models;

/// <summary>
/// Lightweight configuration bundle the SPA pulls once at boot.
///
/// Mirrors the offline dashboard's <c>__OFFLINE_DASHBOARD_DATA__</c> top-level
/// keys (<c>feedback_email</c>, <c>wave_base_urls</c>, <c>generated</c> and the
/// per-workstream <c>cosma_meta</c> / <c>powertrain_meta</c> / <c>exteriors_meta</c>
/// quality blocks) so the Angular client can render the same chrome.
/// </summary>
public record DashboardConfigDto
{
    /// <summary>ISO-8601 timestamp marking when the dashboard data was last refreshed.</summary>
    public string Generated { get; init; } = string.Empty;

    /// <summary>Mailto recipient used by the Feedback page.</summary>
    public string FeedbackEmail { get; init; } = string.Empty;

    /// <summary>
    /// Wave instance base URLs, keyed by workstream slug
    /// (<c>cosma</c>, <c>powertrain</c>, <c>ignite</c>). The drilldown table
    /// builds <c>{baseUrl}/card/{numericId}</c> deep links from these.
    /// </summary>
    public IDictionary<string, string> WaveBaseUrls { get; init; } = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

    public WorkstreamMetaDto? CosmaMeta { get; init; }
    public WorkstreamMetaDto? PowertrainMeta { get; init; }
    public WorkstreamMetaDto? ExteriorsMeta { get; init; }
    public WorkstreamMetaDto? SeatingMeta { get; init; }
}

/// <summary>
/// Per-workstream data-quality summary the legacy dashboard surfaces in the
/// "data validation" panel.
/// </summary>
public record WorkstreamMetaDto
{
    public int TotalRaw { get; init; }
    public int TotalActive { get; init; }
    public int TotalCategorized { get; init; }
    public int? TotalUncategorized { get; init; }
    public int? TotalNeedsReview { get; init; }
    public string? Benchmark { get; init; }
    public string? LastValidated { get; init; }
    public IReadOnlyList<string> ValidationNotes { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> ExclusionRules  { get; init; } = Array.Empty<string>();
}
