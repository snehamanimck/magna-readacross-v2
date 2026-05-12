using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MagnaReadAcross.Api.Entities;

[Table("ArchetypeDefinitions", Schema = "readacross")]
public class ArchetypeDefinition
{
    [Key, MaxLength(128)] public string ArchetypeKey { get; set; } = string.Empty;
    [MaxLength(128)]      public string DisplayName  { get; set; } = string.Empty;
    [MaxLength(64)]       public string Workstream   { get; set; } = string.Empty;
                          public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
}
