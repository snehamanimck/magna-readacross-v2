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

    /// <summary>
    /// Optional monthly P&amp;L panel per site (revenue, labor_qty, costs[*]).
    /// Powers the per-site "Relevant cost base" sizing on the
    /// P&amp;L-Informed Recommendations cards (mirrors legacy
    /// <c>_getSiteCostBase</c>: trailing-3-month avg of
    /// labour_benefits + wages + variable_moh + scrap, annualized).
    /// </summary>
    public IReadOnlyDictionary<string, PnlMonthlyPanelDto> MonthlyPnl { get; init; }
        = new Dictionary<string, PnlMonthlyPanelDto>();
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

/// <summary>
/// Monthly P&amp;L time-series panel for a single Cosma site (sourced from
/// legacy <c>pnl_benchmarking.monthly_pnl[site]</c>).
///
/// We project only the cost series the SPA needs for sizing P&amp;L-Informed
/// Recommendations (mirrors legacy <c>_getSiteCostBase</c>: trailing-3-month
/// average of labour_benefits + wages + variable_moh + scrap, annualized).
/// The legacy <c>revenue</c> / <c>labor_qty</c> blocks are nested objects
/// (production / other / total) and are intentionally NOT modelled here so
/// the deserializer doesn't need a recursive shape; the SPA only consumes
/// <see cref="Costs"/>.
/// </summary>
public record PnlMonthlyPanelDto
{
    public IReadOnlyList<string>   Months   { get; init; } = Array.Empty<string>();
    public PnlMonthlyCostsDto      Costs    { get; init; } = new();
}

public record PnlMonthlyCostsDto
{
    public IReadOnlyList<decimal?> LabourBenefits      { get; init; } = Array.Empty<decimal?>();
    public IReadOnlyList<decimal?> Wages               { get; init; } = Array.Empty<decimal?>();
    public IReadOnlyList<decimal?> ProductionMaterials { get; init; } = Array.Empty<decimal?>();
    public IReadOnlyList<decimal?> FixedMoh            { get; init; } = Array.Empty<decimal?>();
    public IReadOnlyList<decimal?> VariableMoh         { get; init; } = Array.Empty<decimal?>();
    public IReadOnlyList<decimal?> Scrap               { get; init; } = Array.Empty<decimal?>();
}
