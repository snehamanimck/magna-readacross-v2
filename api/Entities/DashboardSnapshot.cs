using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MagnaReadAcross.Api.Entities;

/// <summary>
/// Landing table for the structured-but-non-tabular blocks of the offline
/// <c>dashboard_data.json</c> bundle (per-workstream meta, filter_options,
/// pnl_benchmarking, pnl_peer_summary, pnl_rec_dl_mfg_policy, harmonization
/// notes, archetypes, site_archetypes, priority_ids, generated). One row per
/// <see cref="SectionKey"/> for the latest snapshot.
/// </summary>
[Table("DashboardSnapshots", Schema = "readacross")]
public class DashboardSnapshot
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
