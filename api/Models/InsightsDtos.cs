namespace MagnaReadAcross.Api.Models;

public record ThoughtStarterDto
{
    public long ThoughtStarterId { get; init; }
    public string? SpendCategory { get; init; }
    public string? MfgProcess { get; init; }
    public string? Lever { get; init; }
    public string? SubLever { get; init; }
    public string Text { get; init; } = string.Empty;
    /// <summary>
    /// Free-text "Advanced Automation" label from the legacy dashboard
    /// (e.g. "Cobot load/unload", "Camera inspect"). Rendered as a
    /// secondary pill on the Lever Insights dialog. <c>null</c> /
    /// empty when the thought-starter has no automation tag.
    /// </summary>
    public string? AdvancedAutomation { get; init; }
    public int SortOrder { get; init; }
}

public record PnlRecommendationDto
{
    public long PnlRecommendationId { get; init; }
    public string Workstream { get; init; } = string.Empty;
    public string Site { get; init; } = string.Empty;
    public string? Archetype { get; init; }
    public string? InitiativeId { get; init; }
    public string RecommendationText { get; init; } = string.Empty;
    public decimal? OpportunityAmount { get; init; }
    public int PriorityRank { get; init; }
}

public record KnowledgeCenterAssetDto
{
    public long KnowledgeAssetId { get; init; }
    public string Title { get; init; } = string.Empty;
    public string? SpendCategory { get; init; }
    public string? Workstream { get; init; }
    public string? Description { get; init; }
    public string SlideUrl { get; init; } = string.Empty;
    public string? ThumbnailUrl { get; init; }
    public int SortOrder { get; init; }
}

public record VideoLibraryAssetDto
{
    public long VideoAssetId { get; init; }
    public string Title { get; init; } = string.Empty;
    public string? SpendCategory { get; init; }
    public string? Workstream { get; init; }
    public string? Description { get; init; }
    public string VideoUrl { get; init; } = string.Empty;
    public string? ThumbnailUrl { get; init; }
    public int? DurationSeconds { get; init; }
    public int SortOrder { get; init; }
}

public record ArchetypeDefinitionDto
{
    public string ArchetypeKey { get; init; } = string.Empty;
    public string DisplayName { get; init; } = string.Empty;
    public string Workstream { get; init; } = string.Empty;
    public string? Description { get; init; }
}

public record SiteArchetypeDto
{
    public long SiteArchetypeId { get; init; }
    public string SiteName { get; init; } = string.Empty;
    public string ArchetypeKey { get; init; } = string.Empty;
    public string Workstream { get; init; } = string.Empty;
}

public record PriorityInitiativeDto
{
    public string InitiativeId { get; init; } = string.Empty;
    public string PriorityLabel { get; init; } = string.Empty;
    public string? Workstream { get; init; }
}
