namespace MagnaReadAcross.Api.Models;

/// <summary>
/// Workstream-level subgroup coverage metrics used to validate hierarchy
/// maintenance after ingest/backfill cycles.
/// </summary>
public record SubgroupCoverageDto
{
    /// <summary>Owning workstream (<c>Cosma</c> / <c>Powertrain</c> / <c>Exteriors</c>).</summary>
    public string Workstream { get; init; } = string.Empty;

    /// <summary>Total rows currently present in that workstream's Wave table.</summary>
    public int TotalRows { get; init; }

    /// <summary>Rows where stored <c>Subgroup</c> is NULL/empty in the DB.</summary>
    public int MissingStoredSubgroupRows { get; init; }

    /// <summary>
    /// Rows still unresolved after API fallback logic
    /// (<c>SubgroupEntityMap</c> lookup + deterministic PT/Ext prefix fallback).
    /// </summary>
    public int MissingEffectiveSubgroupRows { get; init; }

    /// <summary>
    /// Distinct entity names (site/division) for unresolved rows, sorted; capped
    /// for payload size.
    /// </summary>
    public IReadOnlyList<string> UnmappedEntities { get; init; } = Array.Empty<string>();
}
