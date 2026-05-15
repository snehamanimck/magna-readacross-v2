using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MagnaReadAcross.Api.Entities;

[Table("PnlSiteDim", Schema = "readacross")]
public class PnlSiteDim
{
    [Key] public long PnlSiteDimId { get; set; }
    [MaxLength(128)] public string Entity { get; set; } = string.Empty;
    [MaxLength(128)] public string? DisplayName { get; set; }
    [MaxLength(64)] public string Workstream { get; set; } = string.Empty;
    [MaxLength(128)] public string? Region { get; set; }
    [MaxLength(128)] public string? Archetype { get; set; }
    [MaxLength(64)] public string? Subgroup { get; set; }
    public bool IsAnchorEligible { get; set; } = true;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}
