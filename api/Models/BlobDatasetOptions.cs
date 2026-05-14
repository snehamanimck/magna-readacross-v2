namespace MagnaReadAcross.Api.Models;

public sealed class BlobDatasetOptions
{
    public const string SectionName = "BlobDataset";

    public string AccountUrl { get; set; } = string.Empty;
    public string Container { get; set; } = "readacross";
    public string DatasetPrefix { get; set; } = "datasets/current";
    public int MediaSasMinutes { get; set; } = 15;
}
