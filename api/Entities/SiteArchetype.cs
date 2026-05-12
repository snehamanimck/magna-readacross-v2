using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MagnaReadAcross.Api.Entities;

[Table("SiteArchetypes", Schema = "readacross")]
public class SiteArchetype
{
    [Key]                 public long SiteArchetypeId { get; set; }
    [MaxLength(128)]      public string SiteName      { get; set; } = string.Empty;
    [MaxLength(128)]      public string ArchetypeKey  { get; set; } = string.Empty;
    [MaxLength(64)]       public string Workstream    { get; set; } = string.Empty;
}
