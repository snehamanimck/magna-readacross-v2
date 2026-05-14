using MagnaReadAcross.Api.Models;

namespace MagnaReadAcross.Api.Services;

public interface IBlobDatasetService
{
    Task<DatasetManifestDto> GetManifestAsync(CancellationToken ct = default);
    Task<SlidesIndexDto> GetSlidesIndexAsync(CancellationToken ct = default);
    Task<MediaSasDto> IssueReadSasAsync(string assetId, CancellationToken ct = default);
}
