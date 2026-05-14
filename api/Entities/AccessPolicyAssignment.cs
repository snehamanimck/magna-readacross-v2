using System.ComponentModel.DataAnnotations;

namespace MagnaReadAcross.Api.Entities;

public sealed class AccessPolicyAssignment
{
    [Key]
    [MaxLength(64)]
    public string GroupObjectId { get; set; } = string.Empty;

    [MaxLength(256)]
    public string DisplayName { get; set; } = string.Empty;

    public string AllowedTabsJson { get; set; } = "[]";

    [MaxLength(256)]
    public string UpdatedBy { get; set; } = "system";

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
