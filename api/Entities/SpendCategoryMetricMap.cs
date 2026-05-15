using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MagnaReadAcross.Api.Entities;

[Table("SpendCategoryMetricMap", Schema = "readacross")]
public class SpendCategoryMetricMap
{
    [Key] public long SpendCategoryMetricMapId { get; set; }

    [MaxLength(64)] public string SpendCategory { get; set; } = string.Empty;
    [MaxLength(64)] public string MetricKey { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}
