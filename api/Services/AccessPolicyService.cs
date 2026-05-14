using System.Security.Claims;
using System.Text.Json;
using MagnaReadAcross.Api.Data;
using MagnaReadAcross.Api.Entities;
using MagnaReadAcross.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace MagnaReadAcross.Api.Services;

public sealed class AccessPolicyService : IAccessPolicyService
{
    private readonly MagnaDbContext _db;
    private readonly AccessControlOptions _options;
    private readonly IWebHostEnvironment _environment;

    public AccessPolicyService(
        MagnaDbContext db,
        IOptions<AccessControlOptions> options,
        IWebHostEnvironment environment)
    {
        _db = db;
        _options = options.Value;
        _environment = environment;
    }

    public async Task<EffectiveAccessDto> GetEffectiveAccessAsync(ClaimsPrincipal user, CancellationToken ct = default)
    {
        if (_environment.IsDevelopment() && _options.BypassAuthInDevelopment && user.Identity?.IsAuthenticated != true)
        {
            return new EffectiveAccessDto("local-dev", true, Array.Empty<string>(), SecuredItems.All);
        }

        var userId = user.FindFirstValue("oid")
                     ?? user.FindFirstValue(ClaimTypes.NameIdentifier)
                     ?? user.Identity?.Name
                     ?? "unknown";
        var groups = user.FindAll("groups").Select(c => c.Value).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        var isAdmin = !string.IsNullOrWhiteSpace(_options.AdminGroupObjectId)
                      && groups.Contains(_options.AdminGroupObjectId, StringComparer.OrdinalIgnoreCase);

        if (isAdmin)
        {
            return new EffectiveAccessDto(userId, true, groups, SecuredItems.All);
        }

        var assignments = await _db.AccessPolicyAssignments
            .AsNoTracking()
            .Where(x => groups.Contains(x.GroupObjectId))
            .ToListAsync(ct);

        var allowed = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (assignments.Count == 0)
        {
            foreach (var item in SecuredItems.NonAdminDefault)
            {
                allowed.Add(item);
            }
        }
        else
        {
            foreach (var assignment in assignments)
            {
                foreach (var item in DeserializeAllowedTabs(assignment.AllowedTabsJson))
                {
                    // Defense in depth: non-admin groups never grant PnL or admin.
                    if (string.Equals(item, SecuredItems.TabPnl, StringComparison.OrdinalIgnoreCase)
                        || string.Equals(item, SecuredItems.AdminAccess, StringComparison.OrdinalIgnoreCase))
                    {
                        continue;
                    }
                    allowed.Add(item);
                }
            }
        }

        return new EffectiveAccessDto(userId, false, groups, allowed.ToArray());
    }

    public async Task<AccessPolicySnapshotDto> GetSnapshotAsync(CancellationToken ct = default)
    {
        var rows = await _db.AccessPolicyAssignments.AsNoTracking().OrderBy(x => x.DisplayName).ToListAsync(ct);
        var latest = rows.OrderByDescending(x => x.UpdatedAt).FirstOrDefault();
        return new AccessPolicySnapshotDto(
            latest?.UpdatedAt ?? DateTimeOffset.UtcNow,
            latest?.UpdatedBy ?? "system",
            rows.Select(ToDto).ToArray());
    }

    public async Task<IReadOnlyList<AdGroupDto>> GetKnownGroupsAsync(CancellationToken ct = default)
    {
        var assignments = await _db.AccessPolicyAssignments.AsNoTracking().OrderBy(x => x.DisplayName).ToListAsync(ct);
        var groups = assignments.Select(x => new AdGroupDto(x.GroupObjectId, x.DisplayName, null, false)).ToList();
        if (!string.IsNullOrWhiteSpace(_options.AdminGroupObjectId))
        {
            groups.Insert(0, new AdGroupDto(_options.AdminGroupObjectId, "Read-Across Admins", "Configured Admin AD group", true));
        }
        return groups;
    }

    public async Task<GroupTabAssignmentDto> UpsertAssignmentAsync(
        GroupTabAssignmentDto assignment,
        ClaimsPrincipal user,
        CancellationToken ct = default)
    {
        var row = await _db.AccessPolicyAssignments.FindAsync([assignment.GroupObjectId], ct)
                  ?? new AccessPolicyAssignment { GroupObjectId = assignment.GroupObjectId };
        row.DisplayName = assignment.DisplayName;
        row.AllowedTabsJson = JsonSerializer.Serialize(assignment.AllowedTabs.Distinct().ToArray());
        row.UpdatedAt = DateTimeOffset.UtcNow;
        row.UpdatedBy = user.FindFirstValue("preferred_username")
                        ?? user.FindFirstValue(ClaimTypes.Email)
                        ?? user.Identity?.Name
                        ?? "unknown";

        _db.AccessPolicyAssignments.Update(row);
        await _db.SaveChangesAsync(ct);
        return ToDto(row);
    }

    public async Task DeleteAssignmentAsync(string groupObjectId, CancellationToken ct = default)
    {
        var row = await _db.AccessPolicyAssignments.FindAsync([groupObjectId], ct);
        if (row == null)
        {
            return;
        }
        _db.AccessPolicyAssignments.Remove(row);
        await _db.SaveChangesAsync(ct);
    }

    private static GroupTabAssignmentDto ToDto(AccessPolicyAssignment assignment) =>
        new(assignment.GroupObjectId, assignment.DisplayName, DeserializeAllowedTabs(assignment.AllowedTabsJson));

    private static string[] DeserializeAllowedTabs(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<string[]>(json) ?? Array.Empty<string>();
        }
        catch
        {
            return Array.Empty<string>();
        }
    }
}
