using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MagnaReadAcross.Api.Entities;

[Table("PnlRecommendations", Schema = "readacross")]
public class PnlRecommendation
{
    [Key]             public long PnlRecommendationId { get; set; }
    [MaxLength(64)]   public string Workstream        { get; set; } = string.Empty;
    [MaxLength(128)]  public string Site              { get; set; } = string.Empty;
    [MaxLength(128)]  public string? Archetype        { get; set; }
    [MaxLength(64)]   public string? InitiativeId     { get; set; }
                      public string RecommendationText { get; set; } = string.Empty;
    [Column(TypeName = "decimal(20,2)")]
    public decimal? OpportunityAmount { get; set; }
    public int PriorityRank { get; set; } = 99;
    public bool IsActive { get; set; } = true;
    [MaxLength(64)] public string? SpendCategory { get; set; }
    [MaxLength(64)] public string? PrimaryDriver { get; set; }
    [Column(TypeName = "decimal(20,6)")] public decimal? SiteValue { get; set; }
    [Column(TypeName = "decimal(20,6)")] public decimal? BenchmarkMedian { get; set; }
    public byte? Quartile { get; set; }
    [Column(TypeName = "decimal(20,2)")] public decimal? WhitespaceEstimate { get; set; }
    public int? DeploymentCount { get; set; }
    public IReadOnlyList<string> DeployingDivisions { get; set; } = Array.Empty<string>();
    [MaxLength(64)] public string? AnchorMatch { get; set; }
    public int? PriorityCount { get; set; }
    [Column(TypeName = "decimal(6,4)")] public decimal? PriorityFraction { get; set; }
    [MaxLength(16)] public string? EvidenceStrength { get; set; }
    [Column(TypeName = "decimal(6,4)")] public decimal? Confidence { get; set; }
    public string? Rationale { get; set; }
    public DateTime ComputedAtUtc { get; set; } = DateTime.UtcNow;
}
