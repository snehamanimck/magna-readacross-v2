using MagnaReadAcross.Api.Models;
using MagnaReadAcross.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace MagnaReadAcross.Api.Controllers;

[ApiController]
[Route("api/media")]
public sealed class MediaController : ControllerBase
{
    private readonly IBlobDatasetService _blobDataset;

    public MediaController(IBlobDatasetService blobDataset)
    {
        _blobDataset = blobDataset;
    }

    [HttpGet("sas/{*assetId}")]
    [ProducesResponseType(typeof(MediaSasDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<MediaSasDto>> Sas(string assetId, CancellationToken ct)
        => Ok(await _blobDataset.IssueReadSasAsync(assetId, ct));

    [HttpPost("sas")]
    [ProducesResponseType(typeof(IReadOnlyList<MediaSasDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<MediaSasDto>>> Batch([FromBody] IReadOnlyList<string> assetIds, CancellationToken ct)
    {
        var results = new List<MediaSasDto>();
        foreach (var assetId in assetIds.Distinct(StringComparer.OrdinalIgnoreCase))
        {
            results.Add(await _blobDataset.IssueReadSasAsync(assetId, ct));
        }
        return Ok(results);
    }
}
