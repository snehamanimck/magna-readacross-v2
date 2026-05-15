using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MagnaReadAcross.Api.Entities;

[Table("MagnaDivisionAliases", Schema = "readacross")]
public class MagnaDivisionAlias
{
    [Key] public long MagnaDivisionAliasId { get; set; }

    [MaxLength(64)] public string MagnaDivision { get; set; } = string.Empty;
    [MaxLength(64)] public string DivisionAlias { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}
