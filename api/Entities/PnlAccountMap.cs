using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MagnaReadAcross.Api.Entities;

[Table("PnlAccountMap", Schema = "readacross")]
public class PnlAccountMap
{
    [Key] public long PnlAccountMapId { get; set; }
    [MaxLength(64)] public string? Cube { get; set; }
    [MaxLength(64)] public string AccountKey { get; set; } = string.Empty;
    [MaxLength(128)] public string AccountLabelPattern { get; set; } = string.Empty;
    [MaxLength(64)] public string InternalKey { get; set; } = string.Empty;
    public short Sign { get; set; } = 1;
    public bool IsActive { get; set; } = true;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}
