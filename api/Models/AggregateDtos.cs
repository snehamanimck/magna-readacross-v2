namespace MagnaReadAcross.Api.Models;

public record FilterOptionsDto
{
    public IReadOnlyList<string> Workstreams      { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> SpendCategories  { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Stages           { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Subgroups        { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Archetypes       { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Sites            { get; init; } = Array.Empty<string>();
}

public record BucketRowDto
{
    public string  SpendCategory { get; init; } = string.Empty;
    public string? MfgProcess    { get; init; }
    public string? Lever         { get; init; }
    public string? SubLever      { get; init; }
    public int     CountTotal    { get; init; }
    public decimal NrbTotal      { get; init; }
    public Dictionary<string, BucketWorkstreamCell> ByWorkstream { get; init; } = new();
}

public record BucketWorkstreamCell(int Count, decimal Nrb);

public record HeatmapCellDto
{
    public string  SpendCategory { get; init; } = string.Empty;
    public string? MfgProcess    { get; init; }
    public string? Lever         { get; init; }
    public string? SubLever      { get; init; }
    public string  Workstream    { get; init; } = string.Empty;
    public string? Site          { get; init; }
    /// <summary>
    /// Geographic / business subgroup the cell's site belongs to (e.g. "PT - AP",
    /// "Ext: EU", "USA East"). Lets the SPA render an extra tier of column
    /// grouping above the per-site columns on the Heatmap page. Inferred
    /// upstream from the source initiative's <c>Subgroup</c> column.
    /// </summary>
    public string? Subgroup      { get; init; }
    public int     Count         { get; init; }
    public decimal Nrb           { get; init; }
}

public record PnlSummaryRow
{
    public string  Cube      { get; init; } = string.Empty;
    public string  Entity    { get; init; } = string.Empty;
    public string  Scenario  { get; init; } = string.Empty;
    public string  Time      { get; init; } = string.Empty;
    public string  Account   { get; init; } = string.Empty;
    public decimal Amount    { get; init; }
}
