using MagnaReadAcross.Api.Models;
using MagnaReadAcross.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MagnaReadAcross.Api.Controllers;

[ApiController]
[Route("api/me")]
public sealed class MeController : ControllerBase
{
    private readonly IAccessPolicyService _accessPolicy;

    public MeController(IAccessPolicyService accessPolicy)
    {
        _accessPolicy = accessPolicy;
    }

    [HttpGet("access")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(EffectiveAccessDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<EffectiveAccessDto>> Access(CancellationToken ct)
        => Ok(await _accessPolicy.GetEffectiveAccessAsync(User, ct));
}
