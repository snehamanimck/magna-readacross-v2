using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MagnaReadAcross.Api.Entities;

[Table("SubgroupEntityMap", Schema = "readacross")]
public class SubgroupEntityMapRow
{
    [Key]
    public long SubgroupEntityMapId { get; set; }

    [MaxLength(64)]
    public string Workstream { get; set; } = string.Empty;

    [MaxLength(128)]
    public string EntityName { get; set; } = string.Empty;

    [MaxLength(64)]
    public string Subgroup { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;

    [MaxLength(256)]
    public string? Notes { get; set; }

    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}
