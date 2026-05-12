namespace MagnaReadAcross.Api.Models;

/// <summary>
/// Top-level shape for the P&amp;L Benchmarking endpoint.
///
/// Mirrors the offline reference (<c>magna-readacross/public/dashboard_data.json</c>
/// → <c>pnl_benchmarking</c>) so the SPA can render the full Cosma / Powertrain /
/// Exteriors ranking experience without round-tripping to the warehouse for
/// every metric.
///
/// Naming conventions:
///   • Reading the source JSON file uses <c>JsonNamingPolicy.SnakeCaseLower</c>
///     (see <see cref="Services.PnlBenchmarkService"/>).
///   • Writing to the wire uses the controller's default
///     <c>JsonNamingPolicy.CamelCase</c>, so the SPA sees camelCase keys.
/// </summary>
public record PnlBenchmarksDto
{
    /// <summary>ISO-8601 generation timestamp of the source snapshot.</summary>
    public string? Generated { get; init; }

    /// <summary>Schema version of the source snapshot.</summary>
    public string? Version { get; init; }

    /// <summary>Map of canonical site key → friendly display name.</summary>
    public IReadOnlyDictionary<string, string> SiteDisplayNames { get; init; }
        = new Dictionary<string, string>();

    /// <summary>Archetype definitions referenced by <see cref="Benchmarks"/>.</summary>
    public IReadOnlyDictionary<string, PnlArchetypeDefinitionDto> Archetypes { get; init; }
        = new Dictionary<string, PnlArchetypeDefinitionDto>();

    /// <summary>Per-site benchmark blob (metrics, archetype, anchors, opportunities).</summary>
    public IReadOnlyDictionary<string, PnlSiteBenchmarkDto> Benchmarks { get; init; }
        = new Dictionary<string, PnlSiteBenchmarkDto>();

    /// <summary>
    /// Pre-computed rankings keyed by scope (e.g. <c>"cosma"</c>,
    /// <c>"archetype_Assembly"</c>, <c>"subgroup_Brazil"</c>) → metric key →
    /// ordered list of <see cref="PnlRankEntryDto"/>.
    /// </summary>
    public IReadOnlyDictionary<string, IReadOnlyDictionary<string, IReadOnlyList<PnlRankEntryDto>>> Rankings { get; init; }
        = new Dictionary<string, IReadOnlyDictionary<string, IReadOnlyList<PnlRankEntryDto>>>();

    /// <summary>Map of site → archetype keys (one site can carry many archetypes).</summary>
    public IReadOnlyDictionary<string, IReadOnlyList<string>> SiteArchetypes { get; init; }
        = new Dictionary<string, IReadOnlyList<string>>();
}

public record PnlArchetypeDefinitionDto
{
    public string? Label       { get; init; }
    public string? Description { get; init; }
}

public record PnlSiteBenchmarkDto
{
    public string?  Subgroup                    { get; init; }
    public string?  Archetype                   { get; init; }
    public decimal? Trailing3mProductionRevenue { get; init; }
    public string?  AnchorCosma                 { get; init; }
    public string?  AnchorArchetype             { get; init; }
    public string?  AnchorSubgroup              { get; init; }
    public IReadOnlyList<PnlMetricDto> Metrics { get; init; } = Array.Empty<PnlMetricDto>();
}

public record PnlMetricDto
{
    public string Key   { get; init; } = string.Empty;
    public string Label { get; init; } = string.Empty;
    public string? Units { get; init; }
    public string? Calc  { get; init; }
    /// <summary>Either <c>"higher_better"</c> or <c>"lower_better"</c>.</summary>
    public string?  Direction      { get; init; }
    public decimal? SiteValue      { get; init; }
    public decimal? BestCosma      { get; init; }
    public decimal? BestArchetype  { get; init; }
    public decimal? BestSubgroup   { get; init; }
    public decimal? OppVsCosma     { get; init; }
    public decimal? OppVsArchetype { get; init; }
    public decimal? OppVsSubgroup  { get; init; }
}

public record PnlRankEntryDto
{
    public string   Site  { get; init; } = string.Empty;
    public decimal? Value { get; init; }
}
