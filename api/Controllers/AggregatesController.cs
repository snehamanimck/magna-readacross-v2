using MagnaReadAcross.Api.Models;
using MagnaReadAcross.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace MagnaReadAcross.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AggregatesController : ControllerBase
{
    private readonly IAggregatesService _agg;
    public AggregatesController(IAggregatesService agg) => _agg = agg;

    /// <summary>Bucket rollup for the Initiative Overview page.</summary>
    [HttpGet("buckets")]
    public async Task<ActionResult<IReadOnlyList<BucketRowDto>>> Buckets(
        [FromQuery] string[]? workstream = null, CancellationToken ct = default)
        => Ok(await _agg.GetBucketsAsync(workstream, ct));

    /// <summary>Heatmap cells (taxonomy × workstream/site) for the Heatmap page.</summary>
    [HttpGet("heatmap")]
    public async Task<ActionResult<IReadOnlyList<HeatmapCellDto>>> Heatmap(
        [FromQuery] string[]? workstream = null, CancellationToken ct = default)
        => Ok(await _agg.GetHeatmapAsync(workstream, ct));
}
