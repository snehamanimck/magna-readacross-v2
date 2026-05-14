using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MagnaReadAcross.Api.Entities;

[Table("ThoughtStarters", Schema = "readacross")]
public class ThoughtStarter
{
    [Key]                  public long ThoughtStarterId { get; set; }
    [MaxLength(64)]        public string? SpendCategory { get; set; }
    [MaxLength(64)]        public string? MfgProcess    { get; set; }
    [MaxLength(256)]       public string? Lever         { get; set; }
    [MaxLength(256)]       public string? SubLever      { get; set; }
                           public string Text           { get; set; } = string.Empty;
    [MaxLength(128)] public string? AdvancedAutomation { get; set; }
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; } = 100;
}
