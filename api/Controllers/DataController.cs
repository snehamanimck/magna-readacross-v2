using MagnaReadAcross.Api.Models;
using MagnaReadAcross.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace MagnaReadAcross.Api.Controllers;

[ApiController]
[Route("api/data")]
public sealed class DataController : ControllerBase
{
    private readonly IBlobDatasetService _blobDataset;

    public DataController(IBlobDatasetService blobDataset)
    {
        _blobDataset = blobDataset;
    }

    [HttpGet("manifest")]
    [ProducesResponseType(typeof(DatasetManifestDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<DatasetManifestDto>> Manifest(CancellationToken ct)
        => Ok(await _blobDataset.GetManifestAsync(ct));

    [HttpGet("slides-index")]
    [ProducesResponseType(typeof(SlidesIndexDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<SlidesIndexDto>> SlidesIndex(CancellationToken ct)
        => Ok(await _blobDataset.GetSlidesIndexAsync(ct));
}
