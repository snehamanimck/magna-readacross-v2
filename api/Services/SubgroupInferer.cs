using System.Collections.Frozen;

namespace MagnaReadAcross.Api.Services;

/// <summary>
/// Defense-in-depth fallback for the per-initiative <c>Subgroup</c> field
/// that the SPA's filter rail and P&amp;L benchmarking peer-set use.
///
/// The authoritative source is now the <c>Subgroup</c> column on each Wave
/// table — populated by <c>sql/05_backfill_subgroups.sql</c> (run after
/// each <c>make ingest</c>). This helper is only consulted when a row was
/// loaded without a stored Subgroup value, so the API stays usable while
/// the backfill is being re-applied or for newly ingested rows that have
/// not yet flowed through the SQL script.
///
/// The inference rules below mirror the legacy offline dashboard
/// (see <c>magna-readacross/public/index.html</c> — <c>inferGroup()</c>):
/// <list type="bullet">
///   <item>Cosma sites use a curated site → subgroup map (USA East, Canada,
///         Mexico, Cosma EU, Casting and UK, USA South, Brazil, Cosma APAC,
///         USA West).</item>
///   <item>Powertrain sites are <c>"APAC|EU|NA - Site"</c> — the prefix
///         becomes <c>"PT - APAC"</c> / <c>"PT - EU"</c> / <c>"PT - NA"</c>.</item>
///   <item>Exteriors sites are <c>"AP|EU|NA - Site"</c> — the prefix
///         becomes <c>"Ext - AP"</c> / <c>"Ext - EU"</c> / <c>"Ext - NA"</c>.</item>
///   <item>Anything that does not match any rule returns <c>null</c> so the
///         filter aggregation skips it (we never want an "Unmapped" pill).</item>
/// </list>
/// </summary>
public static class SubgroupInferer
{
    private static readonly FrozenDictionary<string, string> CosmaSiteMap =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["Eagle Bend"]   = "USA East",
            ["BGM"]          = "USA East",
            ["Vehtek"]       = "USA East",
            ["CBAM"]         = "USA East",
            ["Autolaunch"]   = "USA East",

            ["Formet"]                       = "Canada",
            ["Karmax"]                       = "Canada",
            ["Modatek"]                      = "Canada",
            ["Presstran"]                    = "Canada",
            ["MBCM"]                         = "Canada",
            ["P&F"]                          = "Canada",
            ["Deco"]                         = "Canada",
            ["Magna Structures Meadowvale"]  = "Canada",

            ["Formex"]                  = "Mexico",
            ["San Luis Metal Forming"]  = "Mexico",
            ["Autotek"]                 = "Mexico",
            ["Estampados"]              = "Mexico",
            ["Sonora"]                  = "Mexico",
            ["CSL"]                     = "Mexico",

            ["Salzgitter"]      = "Cosma EU",
            ["Heavy Stamping"]  = "Cosma EU",
            ["Formpol"]         = "Cosma EU",
            ["Heiligenstadt"]   = "Cosma EU",
            ["Cartech"]         = "Cosma EU",
            ["Spain"]           = "Cosma EU",
            ["Stity"]           = "Cosma EU",
            ["Presstec"]        = "Cosma EU",
            ["MLE"]             = "Cosma EU",
            ["Hungary"]         = "Cosma EU",

            ["BDW Markt Schwaben"]    = "Casting and UK",
            ["CCUK"]                  = "Casting and UK",
            ["Telford"]               = "Casting and UK",
            ["Kamtek Casting"]        = "Casting and UK",
            ["BDW Soest"]             = "Casting and UK",
            ["CCMi"]                  = "Casting and UK",
            ["Magna Casting Poland"]  = "Casting and UK",

            ["Drive"]   = "USA South",
            ["Kamtek"]  = "USA South",

            ["SJP"]        = "Brazil",
            ["SAP"]        = "Brazil",
            ["Joinville"]  = "Brazil",
            ["Ibirite"]    = "Brazil",

            ["Shanghai"]    = "Cosma APAC",
            ["Xingqiao"]    = "Cosma APAC",
            ["Shenyang"]    = "Cosma APAC",
            ["Changsha"]    = "Cosma APAC",
            ["Hefei"]       = "Cosma APAC",
            ["Chongqing"]   = "Cosma APAC",
            ["Tianjin"]     = "Cosma APAC",
            ["Guangzhou"]   = "Cosma APAC",
            ["Changchun"]   = "Cosma APAC",
            ["Xingqiaorui"] = "Cosma APAC",
            ["MPJ"]         = "Cosma APAC",

            ["LMV"]           = "USA West",
            ["MEVS"]          = "USA West",
            ["Williamsburg"]  = "USA West",
        }.ToFrozenDictionary(StringComparer.OrdinalIgnoreCase);

    private static readonly FrozenSet<string> PowertrainPrefixes =
        new[] { "APAC", "EU", "NA" }.ToFrozenSet(StringComparer.OrdinalIgnoreCase);

    private static readonly FrozenSet<string> ExteriorsPrefixes =
        new[] { "AP", "EU", "NA" }.ToFrozenSet(StringComparer.OrdinalIgnoreCase);

    /// <summary>
    /// Returns the inferred subgroup for <paramref name="site"/> within the
    /// supplied <paramref name="workstream"/>, or <c>null</c> when no rule
    /// applies. The caller should overlay this only when the underlying
    /// row's stored Subgroup is empty.
    /// </summary>
    public static string? Infer(string? site, string? workstream)
    {
        if (string.IsNullOrWhiteSpace(site)) return null;
        var ws = workstream?.Trim() ?? string.Empty;

        if (string.Equals(ws, "Powertrain", StringComparison.OrdinalIgnoreCase))
            return InferPrefixed(site, PowertrainPrefixes, "PT - ");

        if (string.Equals(ws, "Exteriors", StringComparison.OrdinalIgnoreCase))
            return InferPrefixed(site, ExteriorsPrefixes, "Ext - ");

        // Cosma (default): curated site map only — anything else is unmapped.
        return CosmaSiteMap.TryGetValue(site.Trim(), out var sg) ? sg : null;
    }

    /// <summary>
    /// Convenience: returns <paramref name="stored"/> when present, otherwise
    /// the inferred value. Keeps any future row-level Subgroup data
    /// authoritative without losing the inference fallback today.
    /// </summary>
    public static string? Coalesce(string? stored, string? site, string? workstream)
        => string.IsNullOrWhiteSpace(stored) ? Infer(site, workstream) : stored;

    private static string? InferPrefixed(string site, FrozenSet<string> validPrefixes, string outputPrefix)
    {
        var dashIdx = site.IndexOf(" - ", StringComparison.Ordinal);
        if (dashIdx <= 0) return null;
        var prefix = site[..dashIdx];
        return validPrefixes.Contains(prefix) ? outputPrefix + prefix : null;
    }
}
