namespace MagnaReadAcross.Api.Models;

/// <summary>
/// One row per <c>(Workstream, Subgroup)</c> pair that has at least one
/// initiative in the harmonized list. Drives the SPA's "Subgroup &amp;
/// Archetype" pill row, the per-subgroup chip colours on Insights, and the
/// P&amp;L Benchmarking peer-set selector.
///
/// Sourced from the <c>Subgroup</c> column on each Wave table (populated by
/// <c>sql/05_backfill_subgroups.sql</c>, with
/// <see cref="Services.SubgroupInferer"/> as the in-process safety net).
/// </summary>
public record SubgroupDto
{
    /// <summary>Subgroup label as stored on the row (e.g. <c>USA East</c>, <c>PT - APAC</c>).</summary>
    public string Subgroup        { get; init; } = string.Empty;

    /// <summary>Owning workstream (<c>Cosma</c> / <c>Powertrain</c> / <c>Exteriors</c>).</summary>
    public string Workstream      { get; init; } = string.Empty;

    /// <summary>Number of initiatives the harmonized projection has under this subgroup.</summary>
    public int    InitiativeCount { get; init; }

    /// <summary>Distinct sites that roll up to this subgroup (sorted, may be empty).</summary>
    public IReadOnlyList<string> Sites { get; init; } = Array.Empty<string>();
}
