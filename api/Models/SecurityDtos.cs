namespace MagnaReadAcross.Api.Models;

public static class SecuredItems
{
    public const string TabOverview = "tab.overview";
    public const string TabHeatmap = "tab.heatmap";
    public const string TabInsights = "tab.insights";
    public const string TabValidation = "tab.validation";
    public const string TabFeedback = "tab.feedback";
    public const string TabPnl = "tab.pnl";
    public const string AdminAccess = "admin.access";

    public static readonly string[] All =
    [
        TabOverview,
        TabHeatmap,
        TabInsights,
        TabValidation,
        TabFeedback,
        TabPnl,
        AdminAccess,
    ];

    public static readonly string[] NonAdminDefault =
    [
        TabOverview,
        TabHeatmap,
        TabInsights,
        TabValidation,
        TabFeedback,
    ];
}

public sealed record EffectiveAccessDto(
    string UserId,
    bool IsAdmin,
    IReadOnlyList<string> GroupObjectIds,
    IReadOnlyList<string> AllowedItems);

public sealed record AdGroupDto(
    string ObjectId,
    string DisplayName,
    string? Description,
    bool IsAdmin);

public sealed record GroupTabAssignmentDto(
    string GroupObjectId,
    string DisplayName,
    IReadOnlyList<string> AllowedTabs);

public sealed record AccessPolicySnapshotDto(
    DateTimeOffset UpdatedAt,
    string UpdatedBy,
    IReadOnlyList<GroupTabAssignmentDto> Assignments);
