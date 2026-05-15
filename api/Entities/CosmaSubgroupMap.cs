using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MagnaReadAcross.Api.Entities;

[Table("CosmaSubgroupMap", Schema = "readacross")]
public class CosmaSubgroupMap
{
    [Key] public long CosmaSubgroupMapId { get; set; }

    [MaxLength(128)] public string SiteName { get; set; } = string.Empty;
    [MaxLength(64)] public string Subgroup { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}
