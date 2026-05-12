using MagnaReadAcross.Api.Models;

namespace MagnaReadAcross.Api.Services;

public class AggregatesService : IAggregatesService
{
    private readonly IInitiativeService _initiatives;
    public AggregatesService(IInitiativeService initiatives) => _initiatives = initiatives;

    public async Task<IReadOnlyList<BucketRowDto>> GetBucketsAsync(
        IReadOnlyCollection<string>? workstreams = null, CancellationToken ct = default)
    {
        var initiatives = await _initiatives.GetAllAsync(workstreams: workstreams, ct: ct);

        var rows = initiatives
            .Where(i => i.IsCategorized && !string.IsNullOrEmpty(i.SpendCategory))
            .GroupBy(i => new
            {
                i.SpendCategory,
                MfgProcess = i.MfgProcess ?? "",
                Lever      = i.Lever ?? "",
                SubLever   = i.SubLever ?? "",
            })
            .Select(g =>
            {
                var byWs = g.GroupBy(i => i.Workstream)
                            .ToDictionary(
                                gw => gw.Key,
                                gw => new BucketWorkstreamCell(gw.Count(), gw.Sum(x => x.Nrb)));

                return new BucketRowDto
                {
                    SpendCategory = g.Key.SpendCategory!,
                    MfgProcess    = g.Key.MfgProcess,
                    Lever         = g.Key.Lever,
                    SubLever      = g.Key.SubLever,
                    CountTotal    = g.Count(),
                    NrbTotal      = g.Sum(x => x.Nrb),
                    ByWorkstream  = byWs,
                };
            })
            .OrderBy(r => r.SpendCategory)
            .ThenBy(r => r.MfgProcess)
            .ThenBy(r => r.Lever)
            .ThenBy(r => r.SubLever)
            .ToList();

        return rows;
    }

    public async Task<IReadOnlyList<HeatmapCellDto>> GetHeatmapAsync(
        IReadOnlyCollection<string>? workstreams = null, CancellationToken ct = default)
    {
        var initiatives = await _initiatives.GetAllAsync(workstreams: workstreams, ct: ct);

        return initiatives
            .Where(i => i.IsCategorized && !string.IsNullOrEmpty(i.SpendCategory) && !string.IsNullOrEmpty(i.Site))
            .GroupBy(i => new
            {
                i.SpendCategory,
                MfgProcess = i.MfgProcess ?? "",
                Lever      = i.Lever ?? "",
                SubLever   = i.SubLever ?? "",
                i.Workstream,
                i.Site,
            })
            .Select(g => new HeatmapCellDto
            {
                SpendCategory = g.Key.SpendCategory!,
                MfgProcess    = g.Key.MfgProcess,
                Lever         = g.Key.Lever,
                SubLever      = g.Key.SubLever,
                Workstream    = g.Key.Workstream,
                Site          = g.Key.Site,
                // Subgroup is a property of the site (one site → one subgroup),
                // so picking the first non-empty value in the group is safe and
                // matches what the rest of the API would return.
                Subgroup      = g.Select(x => x.Subgroup)
                                 .FirstOrDefault(s => !string.IsNullOrWhiteSpace(s)),
                Count         = g.Count(),
                Nrb           = g.Sum(x => x.Nrb),
            })
            .ToList();
    }
}
