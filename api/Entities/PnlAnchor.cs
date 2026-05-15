using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MagnaReadAcross.Api.Entities;

[Table("PnlAnchors", Schema = "readacross")]
public class PnlAnchor
{
    [Key] public long PnlAnchorId { get; set; }
    [MaxLength(32)] public string ScopeKind { get; set; } = string.Empty;
    [MaxLength(128)] public string ScopeValue { get; set; } = string.Empty;
    [MaxLength(64)] public string MetricKey { get; set; } = string.Empty;
    [MaxLength(128)] public string AnchorEntity { get; set; } = string.Empty;
    [Column(TypeName = "decimal(20,10)")] public decimal? AnchorValue { get; set; }
    public DateTime ComputedAtUtc { get; set; } = DateTime.UtcNow;
}
