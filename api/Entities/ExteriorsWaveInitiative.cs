using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MagnaReadAcross.Api.Entities;

[Table("ExteriorsWaveInitiatives", Schema = "readacross")]
public class ExteriorsWaveInitiative
{
    [Key, MaxLength(64)] public string InitiativeId    { get; set; } = string.Empty;
    [MaxLength(512)]     public string? Name           { get; set; }
                          public string? Description   { get; set; }
    [MaxLength(64)]      public string? Stage          { get; set; }
    [MaxLength(64)]      public string? Access         { get; set; }
    [MaxLength(256)]     public string? InitiativeOwner{ get; set; }

    /// <summary>Exteriors uses "Division" — surfaced as "site" in the dashboard.</summary>
    [MaxLength(128)]     public string? Division       { get; set; }
    [MaxLength(64)]      public string? Subgroup       { get; set; }
    [MaxLength(64)]      public string? SpendCategory  { get; set; }
    [MaxLength(64)]      public string? MfgProcess     { get; set; }
    [MaxLength(256)]     public string? Lever          { get; set; }
    [MaxLength(256)]     public string? SubLever       { get; set; }

    [Column(TypeName = "decimal(20,2)")]
    public decimal? Nrb { get; set; }

    public bool IsCategorized { get; set; } = true;

    public DateTime LoadedAtUtc { get; set; } = DateTime.UtcNow;
}
