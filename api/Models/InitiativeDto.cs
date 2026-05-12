namespace MagnaReadAcross.Api.Models;

/// <summary>
/// Harmonized initiative shape — same fields the legacy
/// <c>dashboard_data.json/initiatives[]</c> exposes, so the Angular client
/// can drop in 1:1.
/// </summary>
public record InitiativeDto
{
    public string  Id              { get; init; } = string.Empty;
    public string? Name            { get; init; }
    public string? Description     { get; init; }
    public string  Workstream      { get; init; } = string.Empty;   // Cosma / Powertrain / Exteriors
    public string? Site            { get; init; }
    public string? Subgroup        { get; init; }
    public string? Owner           { get; init; }
    public string? Stage           { get; init; }

    /// <summary>
    /// Wave Access flag (e.g. <c>Open</c> / <c>Restricted</c> / <c>Confidential</c>).
    /// The dashboard hides <c>Confidential</c> rows from the drilldown but keeps
    /// them in aggregate counts, mirroring the legacy offline behaviour.
    /// </summary>
    public string? Access          { get; init; }
    public decimal Nrb             { get; init; }
    public string? SpendCategory   { get; init; }   // DL / IDL / Material Conveyance / VOH
    public string? MfgProcess      { get; init; }
    public string? Lever           { get; init; }
    public string? SubLever        { get; init; }
    public bool    IsCategorized   { get; init; }
    public IReadOnlyList<string> Archetypes { get; init; } = Array.Empty<string>();
}
