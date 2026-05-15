using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MagnaReadAcross.Api.Entities;

[Table("ArchetypeMfgAllowed", Schema = "readacross")]
public class ArchetypeMfgAllowed
{
    [Key] public long ArchetypeMfgAllowedId { get; set; }

    [MaxLength(128)] public string ArchetypeKey { get; set; } = string.Empty;
    [MaxLength(64)] public string MfgProcess { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}
