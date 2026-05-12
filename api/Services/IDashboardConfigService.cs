using MagnaReadAcross.Api.Models;

namespace MagnaReadAcross.Api.Services;

public interface IDashboardConfigService
{
    /// <summary>
    /// Build the dashboard-config payload. Reads the per-workstream meta
    /// blocks from the most recent <c>DashboardSnapshots</c> rows and falls
    /// back to <see cref="DashboardConfigOptions"/> when no snapshot is loaded.
    /// </summary>
    Task<DashboardConfigDto> GetAsync(CancellationToken ct = default);
}
