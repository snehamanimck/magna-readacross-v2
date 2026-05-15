using MagnaReadAcross.Api.Data;
using MagnaReadAcross.Api.Services.Pnl;
using MagnaReadAcross.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace MagnaReadAcross.Api.Services;

/// <summary>
/// Loads and serves P&amp;L benchmark payload from relational SQL tables.
/// </summary>
public interface IPnlBenchmarkService
{
    Task<PnlBenchmarksDto> GetAllAsync(CancellationToken ct = default);
}

public class PnlBenchmarkService : IPnlBenchmarkService
{
    private readonly MagnaDbContext _db;
    private readonly IPnlCalculationEngine _calc;
    private readonly ILogger<PnlBenchmarkService> _logger;

    public PnlBenchmarkService(MagnaDbContext db, IPnlCalculationEngine calc, ILogger<PnlBenchmarkService> logger)
    {
        _db = db;
        _calc = calc;
        _logger = logger;
    }

    public async Task<PnlBenchmarksDto> GetAllAsync(CancellationToken ct = default)
    {
        var sites = await _db.PnlSiteDims.AsNoTracking()
            .Where(x => x.Workstream == "Cosma")
            .ToListAsync(ct);
        var benchmarkRows = await _db.PnlSiteBenchmarks.AsNoTracking().ToListAsync(ct);
        var rankingRows = await _db.PnlRankings.AsNoTracking().ToListAsync(ct);
        var archetypes = await _db.ArchetypeDefinitions.AsNoTracking()
            .Where(x => x.IsActive && x.Workstream == "Cosma")
            .ToListAsync(ct);
        var monthlyPnl = await _calc.BuildMonthlyPanelsAsync(ct);

        var benchmarks = benchmarkRows
            .GroupBy(x => x.Site, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(
                g => g.Key,
                g =>
                {
                    var siteMeta = sites.FirstOrDefault(s => s.Entity.Equals(g.Key, StringComparison.OrdinalIgnoreCase));
                    var first = g.First();
                    return new PnlSiteBenchmarkDto
                    {
                        Subgroup = siteMeta?.Subgroup,
                        Archetype = siteMeta?.Archetype,
                        Trailing3mProductionRevenue = first.Trailing3mProductionRevenue,
                        AnchorCosma = first.AnchorCosma,
                        AnchorArchetype = first.AnchorArchetype,
                        AnchorSubgroup = first.AnchorSubgroup,
                        Metrics = g.Select(row =>
                        {
                            var def = PnlMetricCatalog.Metrics.FirstOrDefault(m => m.Key == row.MetricKey);
                            return new PnlMetricDto
                            {
                                Key = row.MetricKey,
                                Label = def?.Label ?? row.MetricKey,
                                Units = def?.Units,
                                Calc = def?.Calc,
                                Direction = def?.Direction,
                                SiteValue = row.SiteValue,
                                BestCosma = row.BestCosma,
                                BestArchetype = row.BestArchetype,
                                BestSubgroup = row.BestSubgroup,
                                OppVsCosma = row.OppVsCosma,
                                OppVsArchetype = row.OppVsArchetype,
                                OppVsSubgroup = row.OppVsSubgroup,
                            };
                        }).ToList(),
                    };
                },
                StringComparer.OrdinalIgnoreCase);

        var rankings = rankingRows
            .GroupBy(x => x.ScopeKind.Equals("cosma", StringComparison.OrdinalIgnoreCase) ? "cosma" : $"{x.ScopeKind}_{x.ScopeValue}")
            .ToDictionary(
                g => g.Key,
                g => (IReadOnlyDictionary<string, IReadOnlyList<PnlRankEntryDto>>)g
                    .GroupBy(x => x.MetricKey, StringComparer.OrdinalIgnoreCase)
                    .ToDictionary(
                        m => m.Key,
                        m => (IReadOnlyList<PnlRankEntryDto>)m.OrderBy(x => x.Rank).Select(x => new PnlRankEntryDto
                        {
                            Site = x.Entity,
                            Value = x.Value
                        }).ToList(),
                        StringComparer.OrdinalIgnoreCase),
                StringComparer.OrdinalIgnoreCase);

        var siteArchetypes = sites
            .Where(x => !string.IsNullOrWhiteSpace(x.Archetype))
            .GroupBy(x => x.Entity, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(
                g => g.Key,
                g => (IReadOnlyList<string>)g.Select(x => x.Archetype!).Distinct(StringComparer.OrdinalIgnoreCase).ToList(),
                StringComparer.OrdinalIgnoreCase);

        var dto = new PnlBenchmarksDto
        {
            Generated = DateTime.UtcNow.ToString("O"),
            Version = "sql-v1",
            SiteDisplayNames = sites.ToDictionary(x => x.Entity, x => x.DisplayName ?? x.Entity, StringComparer.OrdinalIgnoreCase),
            Archetypes = archetypes.ToDictionary(x => x.ArchetypeKey, x => new PnlArchetypeDefinitionDto
            {
                Label = x.DisplayName,
                Description = x.Description
            }, StringComparer.OrdinalIgnoreCase),
            Benchmarks = benchmarks,
            Rankings = rankings,
            SiteArchetypes = siteArchetypes,
            MonthlyPnl = monthlyPnl,
        };

        _logger.LogInformation("Loaded P&L benchmarks from SQL: {Sites} sites, {Rows} metric rows.", dto.Benchmarks.Count, benchmarkRows.Count);
        return dto;
    }
}
