using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MagnaReadAcross.Api.Entities;

[Table("PnlSiteBenchmarks", Schema = "readacross")]
public class PnlSiteBenchmark
{
    [Key] public long PnlSiteBenchmarkId { get; set; }
    [MaxLength(128)] public string Site { get; set; } = string.Empty;
    [MaxLength(64)] public string MetricKey { get; set; } = string.Empty;
    [Column(TypeName = "decimal(20,10)")] public decimal? SiteValue { get; set; }
    [Column(TypeName = "decimal(20,10)")] public decimal? BestCosma { get; set; }
    [Column(TypeName = "decimal(20,10)")] public decimal? BestArchetype { get; set; }
    [Column(TypeName = "decimal(20,10)")] public decimal? BestSubgroup { get; set; }
    [Column(TypeName = "decimal(20,2)")] public decimal? OppVsCosma { get; set; }
    [Column(TypeName = "decimal(20,2)")] public decimal? OppVsArchetype { get; set; }
    [Column(TypeName = "decimal(20,2)")] public decimal? OppVsSubgroup { get; set; }
    [Column(TypeName = "decimal(20,4)")] public decimal? Trailing3mProductionRevenue { get; set; }
    [MaxLength(128)] public string? AnchorCosma { get; set; }
    [MaxLength(128)] public string? AnchorArchetype { get; set; }
    [MaxLength(128)] public string? AnchorSubgroup { get; set; }
    public DateTime ComputedAtUtc { get; set; } = DateTime.UtcNow;
}
