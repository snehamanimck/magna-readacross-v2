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
}
