using MagnaReadAcross.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace MagnaReadAcross.Api.Services.Pnl;

public interface IPnlEbitOverlayService
{
    Task ApplyAsync(CancellationToken ct = default);
}

public sealed class PnlEbitOverlayService : IPnlEbitOverlayService
{
    private static readonly HashSet<string> DefaultMonths = new(["2025M4", "2025M5", "2025M6"], StringComparer.OrdinalIgnoreCase);

    private readonly MagnaDbContext _db;
    private readonly ILogger<PnlEbitOverlayService> _logger;

    public PnlEbitOverlayService(MagnaDbContext db, ILogger<PnlEbitOverlayService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task ApplyAsync(CancellationToken ct = default)
    {
        var maps = await _db.PnlAccountMaps.AsNoTracking()
            .Where(x => x.IsActive && (x.InternalKey == "EBIT" || x.InternalKey == "revenue"))
            .ToListAsync(ct);
        if (maps.Count == 0)
        {
            _logger.LogWarning("Skipping EBIT overlay; account mappings for EBIT/revenue not found.");
            return;
        }

        var entries = await _db.PnlEntries.AsNoTracking()
            .Where(x => x.HasData && x.Scenario.StartsWith("Actual") && x.View == "Periodic" && DefaultMonths.Contains(x.Time))
            .ToListAsync(ct);

        var ebitBySite = new Dictionary<string, List<decimal>>(StringComparer.OrdinalIgnoreCase);
        var revBySite = new Dictionary<string, List<decimal>>(StringComparer.OrdinalIgnoreCase);

        foreach (var e in entries)
        {
            foreach (var m in maps.Where(m =>
                         (m.Cube == null || m.Cube.Equals(e.Cube, StringComparison.OrdinalIgnoreCase)) &&
                         (m.AccountLabelPattern.Equals(e.Account, StringComparison.OrdinalIgnoreCase)
                          || m.AccountKey.Equals(e.Account, StringComparison.OrdinalIgnoreCase)
                          || e.Account.Contains($"({m.AccountKey})", StringComparison.OrdinalIgnoreCase))))
            {
                var target = m.InternalKey == "EBIT" ? ebitBySite : revBySite;
                if (!target.TryGetValue(e.Entity, out var list))
                {
                    list = [];
                    target[e.Entity] = list;
                }
                list.Add(e.Amount * (m.Sign == 0 ? 1 : m.Sign));
            }
        }

        var profitabilityRows = await _db.PnlSiteBenchmarks
            .Where(x => x.MetricKey == "profitability")
            .ToListAsync(ct);

        foreach (var row in profitabilityRows)
        {
            var avgEbit = ebitBySite.TryGetValue(row.Site, out var ebitVals) && ebitVals.Count > 0 ? ebitVals.Average() : 0m;
            var avgRev = revBySite.TryGetValue(row.Site, out var revVals) && revVals.Count > 0 ? revVals.Average() : 0m;
            var siteValue = avgRev == 0 ? 0m : avgEbit / avgRev;
            row.SiteValue = siteValue;
            row.OppVsCosma = Opp(siteValue, row.BestCosma, row.Trailing3mProductionRevenue);
            row.OppVsArchetype = Opp(siteValue, row.BestArchetype, row.Trailing3mProductionRevenue);
            row.OppVsSubgroup = Opp(siteValue, row.BestSubgroup, row.Trailing3mProductionRevenue);
            row.ComputedAtUtc = DateTime.UtcNow;
        }

        var profitabilityRankings = await _db.PnlRankings
            .Where(x => x.MetricKey == "profitability")
            .ToListAsync(ct);
        _db.PnlRankings.RemoveRange(profitabilityRankings);
        await _db.SaveChangesAsync(ct);

        var benchmarks = await _db.PnlSiteBenchmarks.AsNoTracking()
            .Where(x => x.MetricKey == "profitability" && x.SiteValue.HasValue)
            .ToListAsync(ct);
        var siteDim = (await _db.PnlSiteDims.AsNoTracking().ToListAsync(ct))
            .ToDictionary(x => x.Entity, StringComparer.OrdinalIgnoreCase);

        var groups = new List<(string scopeKind, string scopeValue, Func<string, bool> predicate)>
        {
            ("cosma", "cosma", _ => true)
        };
        foreach (var arch in siteDim.Values.Where(x => !string.IsNullOrWhiteSpace(x.Archetype)).Select(x => x.Archetype!).Distinct(StringComparer.OrdinalIgnoreCase))
        {
            groups.Add(("archetype", arch, s => siteDim.TryGetValue(s, out var d) && string.Equals(d.Archetype, arch, StringComparison.OrdinalIgnoreCase)));
        }
        foreach (var subgroup in siteDim.Values.Where(x => !string.IsNullOrWhiteSpace(x.Subgroup)).Select(x => x.Subgroup!).Distinct(StringComparer.OrdinalIgnoreCase))
        {
            groups.Add(("subgroup", subgroup, s => siteDim.TryGetValue(s, out var d) && string.Equals(d.Subgroup, subgroup, StringComparison.OrdinalIgnoreCase)));
        }

        var newRankings = new List<Entities.PnlRanking>();
        foreach (var (scopeKind, scopeValue, predicate) in groups)
        {
            var ranked = benchmarks.Where(x => predicate(x.Site)).OrderByDescending(x => x.SiteValue).ToList();
            for (var i = 0; i < ranked.Count; i++)
            {
                newRankings.Add(new Entities.PnlRanking
                {
                    ScopeKind = scopeKind,
                    ScopeValue = scopeValue,
                    MetricKey = "profitability",
                    Rank = i + 1,
                    Entity = ranked[i].Site,
                    Value = ranked[i].SiteValue,
                    ComputedAtUtc = DateTime.UtcNow
                });
            }
        }

        await _db.PnlRankings.AddRangeAsync(newRankings, ct);
        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("Applied EBIT profitability overlay for {Count} sites.", profitabilityRows.Count);
    }

    private static decimal? Opp(decimal siteValue, decimal? best, decimal? prodRev)
    {
        if (!best.HasValue || !prodRev.HasValue) return null;
        return Math.Max(0, best.Value - siteValue) * prodRev.Value;
    }
}
