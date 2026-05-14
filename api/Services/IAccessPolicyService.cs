using System.Security.Claims;
using MagnaReadAcross.Api.Models;

namespace MagnaReadAcross.Api.Services;

public interface IAccessPolicyService
{
    Task<EffectiveAccessDto> GetEffectiveAccessAsync(ClaimsPrincipal user, CancellationToken ct = default);
    Task<AccessPolicySnapshotDto> GetSnapshotAsync(CancellationToken ct = default);
    Task<IReadOnlyList<AdGroupDto>> GetKnownGroupsAsync(CancellationToken ct = default);
    Task<GroupTabAssignmentDto> UpsertAssignmentAsync(GroupTabAssignmentDto assignment, ClaimsPrincipal user, CancellationToken ct = default);
    Task DeleteAssignmentAsync(string groupObjectId, CancellationToken ct = default);
}
