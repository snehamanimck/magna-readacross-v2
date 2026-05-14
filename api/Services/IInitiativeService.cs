using MagnaReadAcross.Api.Models;

namespace MagnaReadAcross.Api.Services;

public interface IInitiativeService
{
    Task<IReadOnlyList<InitiativeDto>> GetAllAsync(
        IReadOnlyCollection<string>? workstreams = null,
        IReadOnlyCollection<string>? spendCategories = null,
        IReadOnlyCollection<string>? stages = null,
        IReadOnlyCollection<string>? subgroups = null,
        IReadOnlyCollection<string>? archetypes = null,
        CancellationToken ct = default);

    Task<FilterOptionsDto> GetFilterOptionsAsync(CancellationToken ct = default);

    /// <summary>
    /// Distinct subgroups across the harmonized initiative list, with the
    /// owning workstream, initiative count, and the sites that roll up to
    /// each subgroup.
    /// </summary>
    Task<IReadOnlyList<SubgroupDto>> GetSubgroupsAsync(CancellationToken ct = default);

    /// <summary>
    /// Per-workstream subgroup coverage metrics for operational validation
    /// after hierarchy updates and ingest/backfill runs.
    /// </summary>
    Task<IReadOnlyList<SubgroupCoverageDto>> GetSubgroupCoverageAsync(CancellationToken ct = default);
}
