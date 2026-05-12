using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MagnaReadAcross.Api.Entities;

[Table("VideoLibraryAssets", Schema = "readacross")]
public class VideoLibraryAsset
{
    [Key]             public long VideoAssetId      { get; set; }
    [MaxLength(256)]  public string Title           { get; set; } = string.Empty;
    [MaxLength(64)]   public string? SpendCategory  { get; set; }
    [MaxLength(64)]   public string? Workstream     { get; set; }
                      public string? Description    { get; set; }
    [MaxLength(1024)] public string VideoUrl        { get; set; } = string.Empty;
    [MaxLength(1024)] public string? ThumbnailUrl   { get; set; }
    public int? DurationSeconds { get; set; }
    public int SortOrder { get; set; } = 100;
    public bool IsActive { get; set; } = true;
}
