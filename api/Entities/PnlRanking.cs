using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MagnaReadAcross.Api.Entities;

[Table("PnlRankings", Schema = "readacross")]
public class PnlRanking
{
    [Key] public long PnlRankingId { get; set; }
    [MaxLength(32)] public string ScopeKind { get; set; } = string.Empty;
    [MaxLength(128)] public string ScopeValue { get; set; } = string.Empty;
    [MaxLength(64)] public string MetricKey { get; set; } = string.Empty;
    public int Rank { get; set; }
    [MaxLength(128)] public string Entity { get; set; } = string.Empty;
    [Column(TypeName = "decimal(20,10)")] public decimal? Value { get; set; }
    public DateTime ComputedAtUtc { get; set; } = DateTime.UtcNow;
}
