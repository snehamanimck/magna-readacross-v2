using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MagnaReadAcross.Api.Entities;

[Table("RecommendationScoring", Schema = "readacross")]
public class RecommendationScoring
{
    [Key] public long RecommendationScoringId { get; set; }

    public int CostBaseTrailingMonths { get; set; } = 3;
    [Column(TypeName = "decimal(18,6)")] public decimal CostBaseAnnualizationFactor { get; set; } = 12m;
    public int MaxDrilldownItems { get; set; } = 25;
    public int MaxSiteRecommendations { get; set; } = 3;
    public int MinPeerSites { get; set; } = 2;
    [Column(TypeName = "decimal(18,6)")] public decimal PeerNrbRelevanceScale { get; set; } = 500_000m;
    [Column(TypeName = "decimal(18,6)")] public decimal OpportunityWhitespaceFactor { get; set; } = 0.6m;
    [Column(TypeName = "decimal(18,6)")] public decimal OpportunityUnderrepresentedFactor { get; set; } = 0.4m;
    public int OpportunityTopPeerMinCount { get; set; } = 3;
    [Column(TypeName = "decimal(18,6)")] public decimal OpportunityTopPeerFraction { get; set; } = 0.3m;
    public int BestPeersCount { get; set; } = 5;
    [Column(TypeName = "decimal(18,6)")] public decimal OpportunityWeight { get; set; } = 0.35m;
    [Column(TypeName = "decimal(18,6)")] public decimal PnlRelevanceWeight { get; set; } = 0.2m;
    [Column(TypeName = "decimal(18,6)")] public decimal NrbShortfallWeight { get; set; } = 0.15m;
    [Column(TypeName = "decimal(18,6)")] public decimal ArchetypeMatchWeight { get; set; } = 0.15m;
    [Column(TypeName = "decimal(18,6)")] public decimal RegionMatchWeight { get; set; } = 0.1m;
    [Column(TypeName = "decimal(18,6)")] public decimal WhitespaceBonusWeight { get; set; } = 0.05m;
    [Column(TypeName = "decimal(18,6)")] public decimal PnlGapScaleFactor { get; set; } = 5m;
    public bool IsActive { get; set; } = true;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}
