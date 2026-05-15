using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MagnaReadAcross.Api.Entities;

/// <summary>
/// Meta-only snapshot storage for dashboard chrome/config blocks:
/// generated, cosma_meta, powertrain_meta, exteriors_meta, seating_meta,
/// plus optional taxonomy helper sections (filter_options, archetypes,
/// site_archetypes, priority_ids, harmonization_notes).
/// </summary>
[Table("DashboardMetaSnapshots", Schema = "readacross")]
public class DashboardMetaSnapshot
{
    [Key] public long SnapshotId { get; set; }

    [Required, MaxLength(64)]
    public string SectionKey { get; set; } = string.Empty;

    public DateTime GeneratedAtUtc { get; set; }

    [MaxLength(512)]
    public string? SourceFile { get; set; }

    [Required]
    public string PayloadJson { get; set; } = string.Empty;

    public DateTime LoadedAtUtc { get; set; }
}
