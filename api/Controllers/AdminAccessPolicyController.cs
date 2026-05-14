using MagnaReadAcross.Api.Models;
using MagnaReadAcross.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace MagnaReadAcross.Api.Controllers;

[ApiController]
[Route("api/admin/access-policy")]
public sealed class AdminAccessPolicyController : ControllerBase
{
    private readonly IAccessPolicyService _accessPolicy;

    public AdminAccessPolicyController(IAccessPolicyService accessPolicy)
    {
        _accessPolicy = accessPolicy;
    }

    [HttpGet]
    public async Task<ActionResult<AccessPolicySnapshotDto>> Snapshot(CancellationToken ct)
    {
        if (!await IsAdminAsync(ct))
        {
            return Forbid();
        }
        return Ok(await _accessPolicy.GetSnapshotAsync(ct));
    }

    [HttpGet("groups")]
    public async Task<ActionResult<IReadOnlyList<AdGroupDto>>> Groups(CancellationToken ct)
    {
        if (!await IsAdminAsync(ct))
        {
            return Forbid();
        }
        return Ok(await _accessPolicy.GetKnownGroupsAsync(ct));
    }

    [HttpPut("assignments/{groupObjectId}")]
    public async Task<ActionResult<GroupTabAssignmentDto>> Upsert(
        string groupObjectId,
        [FromBody] GroupTabAssignmentDto assignment,
        CancellationToken ct)
    {
        if (!await IsAdminAsync(ct))
        {
            return Forbid();
        }

        var normalized = assignment with { GroupObjectId = groupObjectId };
        return Ok(await _accessPolicy.UpsertAssignmentAsync(normalized, User, ct));
    }

    [HttpDelete("assignments/{groupObjectId}")]
    public async Task<IActionResult> Delete(string groupObjectId, CancellationToken ct)
    {
        if (!await IsAdminAsync(ct))
        {
            return Forbid();
        }
        await _accessPolicy.DeleteAssignmentAsync(groupObjectId, ct);
        return NoContent();
    }

    private async Task<bool> IsAdminAsync(CancellationToken ct) =>
        (await _accessPolicy.GetEffectiveAccessAsync(User, ct)).IsAdmin;
}
