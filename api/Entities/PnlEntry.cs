using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MagnaReadAcross.Api.Entities;

/// <summary>
/// Hyperion-style P&amp;L cube fact row, mirroring the source extract:
/// Cube | Entity | Parent | Cons | Scenario | Time | View | Account | Origin |
/// IC | UD1..UD8 | Amount | HasData | Annotation | Assumptions | AuditComm |
/// Footnote | VarianceExp.
/// </summary>
[Table("PnlEntries", Schema = "readacross")]
public class PnlEntry
{
    [Key]
    public long PnlEntryId { get; set; }

    [Required, MaxLength(64)]   public string Cube     { get; set; } = string.Empty;
    [Required, MaxLength(128)]  public string Entity   { get; set; } = string.Empty;
    [MaxLength(128)]            public string? Parent  { get; set; }
    [MaxLength(32)]             public string? Cons    { get; set; }
    [Required, MaxLength(64)]   public string Scenario { get; set; } = string.Empty;

    [Required, MaxLength(32), Column("Time")]
    public string Time { get; set; } = string.Empty;

    [MaxLength(32), Column("View")]
    public string? View { get; set; }

    [Required, MaxLength(128)]  public string Account { get; set; } = string.Empty;
    [MaxLength(64)]             public string? Origin { get; set; }
    [MaxLength(64)]             public string? IC     { get; set; }

    [MaxLength(128)] public string? UD1 { get; set; }
    [MaxLength(128)] public string? UD2 { get; set; }
    [MaxLength(128)] public string? UD3 { get; set; }
    [MaxLength(128)] public string? UD4 { get; set; }
    [MaxLength(128)] public string? UD5 { get; set; }
    [MaxLength(128)] public string? UD6 { get; set; }
    [MaxLength(128)] public string? UD7 { get; set; }
    [MaxLength(128)] public string? UD8 { get; set; }

    [Column(TypeName = "decimal(20,4)")]
    public decimal Amount { get; set; }

    public bool HasData { get; set; } = true;

    public string? Annotation  { get; set; }
    public string? Assumptions { get; set; }
    public string? AuditComm   { get; set; }
    public string? Footnote    { get; set; }
    public string? VarianceExp { get; set; }

    public DateTime LoadedAtUtc { get; set; } = DateTime.UtcNow;
}
