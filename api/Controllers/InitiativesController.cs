using MagnaReadAcross.Api.Models;
using MagnaReadAcross.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace MagnaReadAcross.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class InitiativesController : ControllerBase
{
    private readonly IInitiativeService _service;
    public InitiativesController(IInitiativeService service) => _service = service;

    /// <summary>Harmonized list of initiatives across all three Wave tables.</summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<InitiativeDto>>> Get(
        [FromQuery] string[]? workstream     = null,
        [FromQuery] string[]? spendCategory  = null,
        [FromQuery] string[]? stage          = null,
        [FromQuery] string[]? subgroup       = null,
        [FromQuery] string[]? archetype      = null,
        CancellationToken ct = default)
        => Ok(await _service.GetAllAsync(workstream, spendCategory, stage, subgroup, archetype, ct));

    /// <summary>Distinct values for every global filter pill.</summary>
    [HttpGet("filter-options")]
    public async Task<ActionResult<FilterOptionsDto>> GetFilterOptions(CancellationToken ct)
        => Ok(await _service.GetFilterOptionsAsync(ct));

    /// <summary>
    /// One row per <c>(Workstream, Subgroup)</c> pair that has at least one
    /// initiative. Includes the rolled-up site list so the SPA can render
    /// the Subgroup pill row, P&amp;L peer-set selector and per-subgroup
    /// chips without re-aggregating client-side.
    /// </summary>
    [HttpGet("subgroups")]
    public async Task<ActionResult<IReadOnlyList<SubgroupDto>>> GetSubgroups(CancellationToken ct)
        => Ok(await _service.GetSubgroupsAsync(ct));
}
