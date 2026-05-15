using MagnaReadAcross.Api.Data;
using MagnaReadAcross.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace MagnaReadAcross.Api.Services.Pnl;

public interface IPnlRecommendationEngine
{
    Task RecomputeAllAsync(CancellationToken ct = default);
}

public sealed class PnlRecommendationEngine : IPnlRecommendationEngine
{
    private readonly MagnaDbContext _db;
    private readonly ILogger<PnlRecommendationEngine> _logger;

    private static readonly IReadOnlyDictionary<string, IReadOnlyList<string>> SpendCategoryMetrics =
        new Dictionary<string, IReadOnlyList<string>>(StringComparer.OrdinalIgnoreCase)
        {
            ["DL"] = ["labour_benefits_ratio", "wages_ratio"],
            ["IDL"] = ["labour_benefits_ratio", "wages_ratio"],
            ["VOH"] = ["voh_ratio"],
            ["Material Conveyance"] = ["voh_ratio"],
            ["MC"] = ["voh_ratio"],
        };

    public PnlRecommendationEngine(MagnaDbContext db, ILogger<PnlRecommendationEngine> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task RecomputeAllAsync(CancellationToken ct = default)
    {
        var initiatives = await _db.CosmaWaveInitiatives.AsNoTracking()
            .Where(x => x.IsCategorized && x.Site != null && x.Site != "Other / Unmapped")
            .ToListAsync(ct);
        var benchmarks = await _db.PnlSiteBenchmarks.AsNoTracking().ToListAsync(ct);
        var siteDims = (await _db.PnlSiteDims.AsNoTracking()
            .Where(x => x.Workstream == "Cosma")
            .ToListAsync(ct))
            .ToDictionary(x => x.Entity, StringComparer.OrdinalIgnoreCase);
        var priority = (await _db.PriorityInitiatives.AsNoTracking().Select(x => x.InitiativeId).ToListAsync(ct))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var benchmarkLookup = benchmarks
            .GroupBy(x => x.Site, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(
                g => g.Key,
                g => g.ToDictionary(x => x.MetricKey, StringComparer.OrdinalIgnoreCase),
                StringComparer.OrdinalIgnoreCase);

        var clusters = initiatives
            .GroupBy(i => new
            {
                Sc = i.SpendCategory ?? string.Empty,
                Mp = i.MfgProcess ?? string.Empty,
                Lv = i.Lever ?? string.Empty,
                Sl = i.SubLever ?? string.Empty
            })
            .Select(g => new Cluster(
                g.Key.Sc,
                g.Key.Mp,
                g.Key.Lv,
                g.Key.Sl,
                g.ToList(),
                g.Where(x => !string.IsNullOrWhiteSpace(x.Site)).Select(x => x.Site!).Distinct(StringComparer.OrdinalIgnoreCase).ToList(),
                g.Where(x => x.Nrb.HasValue).Select(x => x.Nrb!.Value).DefaultIfEmpty(0).Average()))
            .Where(c => c.ImplementingSites.Count > 0)
            .ToList();

        var outRows = new List<PnlRecommendation>();
        var now = DateTime.UtcNow;

        foreach (var site in benchmarkLookup.Keys)
        {
            var siteRows = new List<PnlRecommendation>();
            foreach (var cluster in clusters)
            {
                if (cluster.ImplementingSites.Contains(site, StringComparer.OrdinalIgnoreCase))
                    continue;

                var metricKeys = SpendCategoryMetrics.TryGetValue(cluster.SpendCategory, out var keys)
                    ? keys
                    : Array.Empty<string>();
                if (metricKeys.Count == 0)
                    continue;

                var primaryMetric = metricKeys
                    .Select(k => benchmarkLookup.TryGetValue(site, out var m) && m.TryGetValue(k, out var bm) ? bm : null)
                    .Where(x => x is not null && x.SiteValue.HasValue && x.BestCosma.HasValue)
                    .OrderByDescending(x => (x!.SiteValue!.Value - x.BestCosma!.Value))
                    .FirstOrDefault();

                if (primaryMetric is null)
                    continue;

                var deployingSites = cluster.ImplementingSites.Where(s => !s.Equals(site, StringComparison.OrdinalIgnoreCase)).ToList();
                var deploymentCount = deployingSites.Count;
                var peerValues = deployingSites
                    .Select(s => benchmarkLookup.TryGetValue(s, out var byMetric) && byMetric.TryGetValue(primaryMetric.MetricKey, out var val) ? val.SiteValue : null)
                    .Where(x => x.HasValue)
                    .Select(x => x!.Value)
                    .OrderBy(x => x)
                    .ToList();
                var benchmarkMedian = peerValues.Count == 0 ? (decimal?)null : peerValues[peerValues.Count / 2];
                var siteVal = primaryMetric.SiteValue;
                var quartile = peerValues.Count == 0 || !siteVal.HasValue
                    ? (byte?)null
                    : ToQuartile(siteVal.Value, peerValues, primaryMetric.MetricKey);
                var saturation = quartile switch
                {
                    1 => 1.10m,
                    2 => 1.00m,
                    3 => 0.90m,
                    4 => 0.80m,
                    _ => 0.85m,
                };
                var burden = ComputeBurden(siteVal, benchmarkMedian, primaryMetric.MetricKey);
                var whitespace = Math.Round(cluster.AvgNrbPerSite * saturation * burden, 2);

                var priorityCount = cluster.Items.Count(x => priority.Contains(x.InitiativeId));
                var priorityFraction = cluster.Items.Count == 0 ? 0m : (decimal)priorityCount / cluster.Items.Count;
                var anchorMatch = deployingSites.Contains(primaryMetric.AnchorCosma ?? string.Empty, StringComparer.OrdinalIgnoreCase)
                    ? "cosma"
                    : deployingSites.Contains(primaryMetric.AnchorArchetype ?? string.Empty, StringComparer.OrdinalIgnoreCase)
                        ? "archetype"
                        : deployingSites.Contains(primaryMetric.AnchorSubgroup ?? string.Empty, StringComparer.OrdinalIgnoreCase)
                            ? "subgroup"
                            : null;
                var evidence = ClassifyEvidence(deploymentCount, anchorMatch, priorityFraction);
                var confidence = Math.Min(1m, (deploymentCount / 10m) + (priorityFraction * 0.4m) + (anchorMatch != null ? 0.2m : 0m));

                siteRows.Add(new PnlRecommendation
                {
                    Workstream = "Cosma",
                    Site = site,
                    Archetype = siteDims.TryGetValue(site, out var dim) ? dim.Archetype : null,
                    InitiativeId = cluster.Items.FirstOrDefault()?.InitiativeId,
                    RecommendationText = $"{cluster.Lever}: {cluster.SubLever}".Trim(':', ' '),
                    OpportunityAmount = whitespace,
                    PriorityRank = 99,
                    IsActive = true,
                    SpendCategory = cluster.SpendCategory,
                    PrimaryDriver = primaryMetric.MetricKey,
                    SiteValue = siteVal,
                    BenchmarkMedian = benchmarkMedian,
                    Quartile = quartile,
                    WhitespaceEstimate = whitespace,
                    DeploymentCount = deploymentCount,
                    DeployingDivisions = deployingSites,
                    AnchorMatch = anchorMatch,
                    PriorityCount = priorityCount,
                    PriorityFraction = Math.Round(priorityFraction, 4),
                    EvidenceStrength = evidence,
                    Confidence = Math.Round(confidence, 4),
                    Rationale = $"Peer row {cluster.SpendCategory} > {cluster.MfgProcess} > {cluster.Lever} > {cluster.SubLever}",
                    ComputedAtUtc = now
                });
            }

            var ranked = siteRows
                .OrderByDescending(x => x.WhitespaceEstimate ?? 0)
                .ThenByDescending(x => x.Confidence ?? 0)
                .Take(3)
                .ToList();
            for (var i = 0; i < ranked.Count; i++)
            {
                ranked[i].PriorityRank = i + 1;
                outRows.Add(ranked[i]);
            }
        }

        await _db.PnlRecommendations.ExecuteDeleteAsync(ct);
        await _db.PnlRecommendations.AddRangeAsync(outRows, ct);
        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("P&L recommendations recompute complete: {Count} rows.", outRows.Count);
    }

    private static byte ToQuartile(decimal siteValue, IReadOnlyList<decimal> peers, string metricKey)
    {
        var ordered = peers.ToList();
        ordered.Sort();
        var p25 = ordered[(int)Math.Floor((ordered.Count - 1) * 0.25)];
        var p50 = ordered[(int)Math.Floor((ordered.Count - 1) * 0.50)];
        var p75 = ordered[(int)Math.Floor((ordered.Count - 1) * 0.75)];
        var lowerBetter = metricKey != "profitability";
        if (lowerBetter)
        {
            if (siteValue <= p25) return 1;
            if (siteValue <= p50) return 2;
            if (siteValue <= p75) return 3;
            return 4;
        }
        if (siteValue >= p75) return 1;
        if (siteValue >= p50) return 2;
        if (siteValue >= p25) return 3;
        return 4;
    }

    private static decimal ComputeBurden(decimal? siteValue, decimal? peerMedian, string metricKey)
    {
        if (!siteValue.HasValue || !peerMedian.HasValue || siteValue.Value == 0 || peerMedian.Value == 0)
            return 1m;
        var lowerBetter = metricKey != "profitability";
        var raw = lowerBetter
            ? siteValue.Value / peerMedian.Value
            : peerMedian.Value / siteValue.Value;
        return Math.Clamp(raw, 0.5m, 2.0m);
    }

    private static string ClassifyEvidence(int deploymentCount, string? anchorMatch, decimal priorityFraction)
    {
        if (deploymentCount >= 6 && anchorMatch is not null && priorityFraction > 0.2m) return "Strong";
        if (deploymentCount >= 3 && (anchorMatch is not null || priorityFraction > 0)) return "Moderate";
        return "Emerging";
    }

    private sealed record Cluster(
        string SpendCategory,
        string MfgProcess,
        string Lever,
        string SubLever,
        IReadOnlyList<CosmaWaveInitiative> Items,
        IReadOnlyList<string> ImplementingSites,
        decimal AvgNrbPerSite);
}
