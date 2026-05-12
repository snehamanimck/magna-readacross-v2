using MagnaReadAcross.Api.Models;

namespace MagnaReadAcross.Api.Services;

public interface IAggregatesService
{
    Task<IReadOnlyList<BucketRowDto>>   GetBucketsAsync(IReadOnlyCollection<string>? workstreams = null, CancellationToken ct = default);
    Task<IReadOnlyList<HeatmapCellDto>> GetHeatmapAsync(IReadOnlyCollection<string>? workstreams = null, CancellationToken ct = default);
}
