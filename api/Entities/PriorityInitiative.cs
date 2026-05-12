using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MagnaReadAcross.Api.Entities;

[Table("PriorityInitiatives", Schema = "readacross")]
public class PriorityInitiative
{
    [Key, MaxLength(64)] public string InitiativeId { get; set; } = string.Empty;
    [MaxLength(128)]     public string PriorityLabel { get; set; } = string.Empty;
    [MaxLength(64)]      public string? Workstream { get; set; }
}
