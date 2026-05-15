using MagnaReadAcross.Api.Data;
using MagnaReadAcross.Api.Entities;
using MagnaReadAcross.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace MagnaReadAcross.Api.Services.Pnl;

public interface IPnlCalculationEngine
{
    Task RecomputeAllAsync(CancellationToken ct = default);
    Task<IReadOnlyDictionary<string, PnlMonthlyPanelDto>> BuildMonthlyPanelsAsync(CancellationToken ct = default);
}

public sealed class PnlCalculationEngine : IPnlCalculationEngine
{
    private readonly MagnaDbContext _db;
    private readonly ILogger<PnlCalculationEngine> _logger;

    public PnlCalculationEngine(MagnaDbContext db, ILogger<PnlCalculationEngine> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task RecomputeAllAsync(CancellationToken ct = default)
    {
        var context = await BuildContextAsync(ct);
        var anchors = BuildAnchors(context);
        var benchmarks = BuildBenchmarks(context, anchors);
        var rankings = BuildRankings(context, benchmarks);

        await _db.PnlAnchors.ExecuteDeleteAsync(ct);
        await _db.PnlSiteBenchmarks.ExecuteDeleteAsync(ct);
        await _db.PnlRankings.ExecuteDeleteAsync(ct);

        await _db.PnlAnchors.AddRangeAsync(anchors, ct);
        await _db.PnlSiteBenchmarks.AddRangeAsync(benchmarks, ct);
        await _db.PnlRankings.AddRangeAsync(rankings, ct);
        await _db.SaveChangesAsync(ct);

        _logger.LogInformation(
            "P&L calculation recompute complete. Sites={Sites}, Benchmarks={Benchmarks}, Anchors={Anchors}, Rankings={Rankings}",
            context.SiteData.Count,
            benchmarks.Count,
            anchors.Count,
            rankings.Count);
    }

    public async Task<IReadOnlyDictionary<string, PnlMonthlyPanelDto>> BuildMonthlyPanelsAsync(CancellationToken ct = default)
    {
        var context = await BuildContextAsync(ct);
        var output = new Dictionary<string, PnlMonthlyPanelDto>(StringComparer.OrdinalIgnoreCase);
        foreach (var site in context.SiteData.Values)
        {
            output[site.Site] = site.MonthlyPanel;
        }
        return output;
    }

    private async Task<CalcContext> BuildContextAsync(CancellationToken ct)
    {
        var entries = await _db.PnlEntries.AsNoTracking()
            .Where(x => x.HasData && x.Scenario.StartsWith("Actual") && x.View == "Periodic")
            .ToListAsync(ct);
        var map = await _db.PnlAccountMaps.AsNoTracking().Where(x => x.IsActive).ToListAsync(ct);
        var dims = (await _db.PnlSiteDims.AsNoTracking().ToListAsync(ct))
            .ToDictionary(x => x.Entity, StringComparer.OrdinalIgnoreCase);

        var bySite = new Dictionary<string, SiteCalcData>(StringComparer.OrdinalIgnoreCase);

        foreach (var e in entries)
        {
            if (!TryParseMonth(e.Time, out var monthSort, out var monthLabel))
                continue;

            if (!TryMapInternalKey(e, map, out var internalKey, out var sign))
                continue;

            if (!bySite.TryGetValue(e.Entity, out var site))
            {
                dims.TryGetValue(e.Entity, out var dim);
                site = new SiteCalcData(
                    e.Entity,
                    dim?.DisplayName ?? e.Entity,
                    dim?.Workstream ?? e.Cube,
                    dim?.Archetype,
                    dim?.Subgroup,
                    dim?.Region ?? e.Parent);
                bySite[e.Entity] = site;
            }

            var key = (monthLabel, monthSort, internalKey);
            site.Monthly[key] = site.Monthly.TryGetValue(key, out var val)
                ? val + (e.Amount * sign)
                : (e.Amount * sign);
        }

        foreach (var site in bySite.Values)
        {
            site.MaterializeDerivedRows();
            site.MaterializeMonthlyPanel();
            site.MaterializeTrailingAverages(3);
        }

        return new CalcContext(bySite);
    }

    private static bool TryMapInternalKey(PnlEntry entry, IReadOnlyList<PnlAccountMap> map, out string internalKey, out short sign)
    {
        var match = map.FirstOrDefault(m =>
            (m.Cube == null || m.Cube.Equals(entry.Cube, StringComparison.OrdinalIgnoreCase)) &&
            (m.AccountLabelPattern.Equals(entry.Account, StringComparison.OrdinalIgnoreCase)
             || m.AccountKey.Equals(entry.Account, StringComparison.OrdinalIgnoreCase)
             || entry.Account.Contains($"({m.AccountKey})", StringComparison.OrdinalIgnoreCase)));

        if (match is null)
        {
            internalKey = string.Empty;
            sign = 1;
            return false;
        }

        internalKey = match.InternalKey;
        sign = match.Sign == 0 ? (short)1 : match.Sign;
        return true;
    }

    private static bool TryParseMonth(string? time, out int monthSort, out string monthLabel)
    {
        monthSort = 0;
        monthLabel = string.Empty;
        if (string.IsNullOrWhiteSpace(time) || time!.Length < 6)
            return false;
        if (!time.Contains('M', StringComparison.OrdinalIgnoreCase))
            return false;

        var parts = time.Split('M', 'm');
        if (parts.Length != 2)
            return false;
        if (!int.TryParse(parts[0], out var y))
            return false;
        if (!int.TryParse(parts[1], out var m))
            return false;
        monthSort = y * 100 + m;
        monthLabel = $"{y:D4}-{m:D2}";
        return true;
    }

    private static List<PnlAnchor> BuildAnchors(CalcContext ctx)
    {
        var now = DateTime.UtcNow;
        var outRows = new List<PnlAnchor>();

        var allSites = ctx.SiteData.Values.Where(x => x.Workstream.Equals("Cosma", StringComparison.OrdinalIgnoreCase)).ToList();
        var groups = new List<(string scopeKind, string scopeValue, List<SiteCalcData> sites)>
        {
            ("cosma", "cosma", allSites),
        };

        groups.AddRange(allSites.Where(x => !string.IsNullOrWhiteSpace(x.Archetype))
            .GroupBy(x => x.Archetype!, StringComparer.OrdinalIgnoreCase)
            .Select(g => ("archetype", g.Key, g.ToList())));
        groups.AddRange(allSites.Where(x => !string.IsNullOrWhiteSpace(x.Subgroup))
            .GroupBy(x => x.Subgroup!, StringComparer.OrdinalIgnoreCase)
            .Select(g => ("subgroup", g.Key, g.ToList())));

        foreach (var (scopeKind, scopeValue, sites) in groups)
        {
            if (sites.Count == 0)
                continue;

            var anchorCandidate = sites
                .Select(s => new
                {
                    Site = s,
                    Profitability = SafeRatio(
                        SumKeys(s.Trailing, ["EBITDA"]),
                        SumKeys(s.Trailing, ["production_sales"])),
                    Opex = SafeRatio(
                        SumKeys(s.Trailing, ["DL", "wages", "materials", "VOH", "scrap_expense"]),
                        SumKeys(s.Trailing, ["production_sales"]))
                })
                .Where(x => x.Profitability.HasValue)
                .OrderByDescending(x => x.Profitability)
                .FirstOrDefault();

            var anchor = anchorCandidate?.Site;
            if (anchor is null)
            {
                // Fallback when EBITDA isn't available in source rows:
                // choose the lowest opex ratio as the local best performer.
                anchor = sites
                    .Select(s => new
                    {
                        Site = s,
                        Opex = SafeRatio(
                            SumKeys(s.Trailing, ["DL", "wages", "materials", "VOH", "scrap_expense"]),
                            SumKeys(s.Trailing, ["production_sales"]))
                    })
                    .Where(x => x.Opex.HasValue)
                    .OrderBy(x => x.Opex)
                    .FirstOrDefault()?.Site;
            }

            if (anchor is null)
                continue;

            foreach (var metric in PnlMetricCatalog.Metrics)
            {
                var val = SafeRatio(SumKeys(anchor.Trailing, metric.Numerator), SumKeys(anchor.Trailing, metric.Denominator));
                outRows.Add(new PnlAnchor
                {
                    ScopeKind = scopeKind,
                    ScopeValue = scopeValue,
                    MetricKey = metric.Key,
                    AnchorEntity = anchor.Site,
                    AnchorValue = val,
                    ComputedAtUtc = now
                });
            }
        }

        return outRows;
    }

    private static List<PnlSiteBenchmark> BuildBenchmarks(CalcContext ctx, IReadOnlyList<PnlAnchor> anchors)
    {
        var now = DateTime.UtcNow;
        var anchorLookup = anchors.ToDictionary(
            x => $"{x.ScopeKind}:{x.ScopeValue}:{x.MetricKey}",
            x => x,
            StringComparer.OrdinalIgnoreCase);
        var outRows = new List<PnlSiteBenchmark>();

        foreach (var site in ctx.SiteData.Values.Where(x => x.Workstream.Equals("Cosma", StringComparison.OrdinalIgnoreCase)))
        {
            foreach (var metric in PnlMetricCatalog.Metrics)
            {
                var siteVal = SafeRatio(SumKeys(site.Trailing, metric.Numerator), SumKeys(site.Trailing, metric.Denominator));

                anchorLookup.TryGetValue($"cosma:cosma:{metric.Key}", out var cosmaAnchor);
                anchorLookup.TryGetValue($"archetype:{site.Archetype}:{metric.Key}", out var archAnchor);
                anchorLookup.TryGetValue($"subgroup:{site.Subgroup}:{metric.Key}", out var subgroupAnchor);

                var prodRev = SumKeys(site.Trailing, ["production_sales"]);

                outRows.Add(new PnlSiteBenchmark
                {
                    Site = site.Site,
                    MetricKey = metric.Key,
                    SiteValue = siteVal,
                    BestCosma = cosmaAnchor?.AnchorValue,
                    BestArchetype = archAnchor?.AnchorValue,
                    BestSubgroup = subgroupAnchor?.AnchorValue,
                    OppVsCosma = Opportunity(siteVal, cosmaAnchor?.AnchorValue, prodRev, metric.Direction),
                    OppVsArchetype = Opportunity(siteVal, archAnchor?.AnchorValue, prodRev, metric.Direction),
                    OppVsSubgroup = Opportunity(siteVal, subgroupAnchor?.AnchorValue, prodRev, metric.Direction),
                    Trailing3mProductionRevenue = prodRev,
                    AnchorCosma = cosmaAnchor?.AnchorEntity,
                    AnchorArchetype = archAnchor?.AnchorEntity,
                    AnchorSubgroup = subgroupAnchor?.AnchorEntity,
                    ComputedAtUtc = now,
                });
            }
        }

        return outRows;
    }

    private static List<PnlRanking> BuildRankings(CalcContext ctx, IReadOnlyList<PnlSiteBenchmark> benchmarks)
    {
        var now = DateTime.UtcNow;
        var outRows = new List<PnlRanking>();
        var siteLookup = ctx.SiteData;

        var groups = new List<(string scopeKind, string scopeValue, Func<PnlSiteBenchmark, bool> predicate)>
        {
            ("cosma", "cosma", b => true),
        };

        foreach (var arch in siteLookup.Values.Where(x => !string.IsNullOrWhiteSpace(x.Archetype))
                     .Select(x => x.Archetype!).Distinct(StringComparer.OrdinalIgnoreCase))
        {
            groups.Add(("archetype", arch, b => siteLookup.TryGetValue(b.Site, out var s) && string.Equals(s.Archetype, arch, StringComparison.OrdinalIgnoreCase)));
        }
        foreach (var subgroup in siteLookup.Values.Where(x => !string.IsNullOrWhiteSpace(x.Subgroup))
                     .Select(x => x.Subgroup!).Distinct(StringComparer.OrdinalIgnoreCase))
        {
            groups.Add(("subgroup", subgroup, b => siteLookup.TryGetValue(b.Site, out var s) && string.Equals(s.Subgroup, subgroup, StringComparison.OrdinalIgnoreCase)));
        }

        foreach (var metric in PnlMetricCatalog.Metrics)
        {
            foreach (var (scopeKind, scopeValue, predicate) in groups)
            {
                var ranked = benchmarks
                    .Where(b => b.MetricKey == metric.Key)
                    .Where(predicate)
                    .Where(b => b.SiteValue.HasValue)
                    .ToList();

                ranked = metric.Direction == "higher_better"
                    ? ranked.OrderByDescending(x => x.SiteValue).ToList()
                    : ranked.OrderBy(x => x.SiteValue).ToList();

                for (var i = 0; i < ranked.Count; i++)
                {
                    outRows.Add(new PnlRanking
                    {
                        ScopeKind = scopeKind,
                        ScopeValue = scopeValue,
                        MetricKey = metric.Key,
                        Rank = i + 1,
                        Entity = ranked[i].Site,
                        Value = ranked[i].SiteValue,
                        ComputedAtUtc = now,
                    });
                }
            }
        }

        return outRows;
    }

    private static decimal? SafeRatio(decimal? numerator, decimal? denominator)
    {
        if (!numerator.HasValue || !denominator.HasValue || denominator.Value == 0)
            return null;
        return numerator.Value / denominator.Value;
    }

    private static decimal? SumKeys(IReadOnlyDictionary<string, decimal?> data, IReadOnlyList<string> keys)
    {
        decimal sum = 0;
        var any = false;
        foreach (var key in keys)
        {
            if (!data.TryGetValue(key, out var v) || !v.HasValue)
                continue;
            sum += v.Value;
            any = true;
        }

        return any ? sum : null;
    }

    private static decimal? Opportunity(decimal? siteVal, decimal? benchVal, decimal? productionRevenue, string direction)
    {
        if (!siteVal.HasValue || !benchVal.HasValue || !productionRevenue.HasValue)
            return null;
        var gap = direction == "lower_better"
            ? Math.Max(0, siteVal.Value - benchVal.Value)
            : Math.Max(0, benchVal.Value - siteVal.Value);
        return gap * productionRevenue.Value;
    }

    private sealed record CalcContext(IReadOnlyDictionary<string, SiteCalcData> SiteData);

    private sealed class SiteCalcData
    {
        public string Site { get; }
        public string DisplayName { get; }
        public string Workstream { get; }
        public string? Archetype { get; }
        public string? Subgroup { get; }
        public string? Region { get; }
        public Dictionary<(string month, int monthSort, string key), decimal> Monthly { get; } = new();
        public Dictionary<string, decimal?> Trailing { get; } = new(StringComparer.OrdinalIgnoreCase);
        public PnlMonthlyPanelDto MonthlyPanel { get; private set; } = new();

        public SiteCalcData(string site, string displayName, string workstream, string? archetype, string? subgroup, string? region)
        {
            Site = site;
            DisplayName = displayName;
            Workstream = workstream;
            Archetype = archetype;
            Subgroup = subgroup;
            Region = region;
        }

        public void MaterializeDerivedRows()
        {
            var groups = Monthly
                .GroupBy(x => (x.Key.month, x.Key.monthSort))
                .ToList();

            foreach (var g in groups)
            {
                var voh = g.Where(x => x.Key.key is "VOH_variable" or "VOH_fixed").Sum(x => x.Value);
                var wages = g.Where(x => x.Key.key is "IDL" or "SGA_fixed" or "SGA_labour").Sum(x => x.Value);
                Monthly[(g.Key.month, g.Key.monthSort, "VOH")] = voh;
                Monthly[(g.Key.month, g.Key.monthSort, "wages")] = wages;
            }
        }

        public void MaterializeTrailingAverages(int months)
        {
            var byKey = Monthly
                .GroupBy(x => x.Key.key)
                .ToDictionary(x => x.Key, x => x.OrderByDescending(v => v.Key.monthSort).Take(months).Select(v => v.Value).ToList(), StringComparer.OrdinalIgnoreCase);
            foreach (var (key, values) in byKey)
            {
                if (values.Count == 0)
                    continue;
                Trailing[key] = values.Average();
            }
        }

        public void MaterializeMonthlyPanel()
        {
            var months = Monthly.Keys.Select(x => (x.month, x.monthSort)).Distinct().OrderBy(x => x.monthSort).ToList();
            var monthLabels = months.Select(x => x.month).ToArray();
            MonthlyPanel = new PnlMonthlyPanelDto
            {
                Months = monthLabels,
                Costs = new PnlMonthlyCostsDto
                {
                    LabourBenefits = ToSeries(months, "DL"),
                    Wages = ToSeries(months, "wages"),
                    ProductionMaterials = ToSeries(months, "materials"),
                    FixedMoh = ToSeries(months, "VOH_fixed"),
                    VariableMoh = ToSeries(months, "VOH_variable"),
                    Scrap = ToSeries(months, "scrap_expense"),
                },
            };
        }

        private IReadOnlyList<decimal?> ToSeries(IReadOnlyList<(string month, int monthSort)> months, string key)
        {
            var values = new List<decimal?>(months.Count);
            foreach (var m in months)
            {
                values.Add(Monthly.TryGetValue((m.month, m.monthSort, key), out var v) ? v : null);
            }
            return values;
        }
    }
}
