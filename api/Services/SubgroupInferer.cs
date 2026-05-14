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
/// Fallback order:
/// <list type="bullet">
///   <item>Try the managed mapping dictionary loaded from
///         <c>readacross.SubgroupEntityMap</c>.</item>
///   <item>Powertrain sites are <c>"APAC|EU|NA - Site"</c> — the prefix
///         becomes <c>"PT - APAC"</c> / <c>"PT - EU"</c> / <c>"PT - NA"</c>.</item>
///   <item>Exteriors sites are <c>"AP|EU|NA - Site"</c> — the prefix
///         becomes <c>"Ext - AP"</c> / <c>"Ext - EU"</c> / <c>"Ext - NA"</c>.</item>
///   <item>Seating sites are <c>"NA|EU|CN* - Site"</c> — the prefix
///         becomes <c>"Seat - NA"</c> / <c>"Seat - EU"</c> / <c>"Seat - CN"</c>.</item>
///   <item>Anything that does not match any rule returns <c>null</c> so the
///         filter aggregation skips it (we never want an "Unmapped" pill).</item>
/// </list>
/// </summary>
public static class SubgroupInferer
{
    private static readonly HashSet<string> PowertrainPrefixes =
        new(["APAC", "EU", "NA"], StringComparer.OrdinalIgnoreCase);

    private static readonly HashSet<string> ExteriorsPrefixes =
        new(["AP", "EU", "NA"], StringComparer.OrdinalIgnoreCase);

    /// <summary>
    /// Returns the inferred subgroup for <paramref name="site"/> within the
    /// supplied <paramref name="workstream"/>, or <c>null</c> when no rule
    /// applies. The caller should overlay this only when the underlying
    /// row's stored Subgroup is empty.
    /// </summary>
    public static string? Infer(
        string? site,
        string? workstream,
        IReadOnlyDictionary<string, string>? mappingLookup = null)
    {
        if (string.IsNullOrWhiteSpace(site)) return null;
        var ws = workstream?.Trim() ?? string.Empty;
        var normalizedSite = site.Trim();

        if (mappingLookup is not null
            && mappingLookup.TryGetValue(BuildKey(ws, normalizedSite), out var mapped))
        {
            return mapped;
        }

        if (string.Equals(ws, "Powertrain", StringComparison.OrdinalIgnoreCase))
            return InferPrefixed(normalizedSite, PowertrainPrefixes, "PT - ");

        if (string.Equals(ws, "Exteriors", StringComparison.OrdinalIgnoreCase))
            return InferPrefixed(normalizedSite, ExteriorsPrefixes, "Ext - ");

        if (string.Equals(ws, "Seating", StringComparison.OrdinalIgnoreCase))
            return InferSeating(normalizedSite);

        // Cosma (default): no prefix fallback — relies on explicit mappings.
        return null;
    }

    /// <summary>
    /// Seating uses geographic prefixes <c>NA</c>, <c>EU</c>, and <c>CN*</c>
    /// (e.g. <c>CN</c>, <c>CN-East</c>) ahead of <c>" - "</c>. Mirrors the
    /// legacy <c>inferGroup()</c> rules.
    /// </summary>
    private static string? InferSeating(string site)
    {
        var dashIdx = site.IndexOf(" - ", StringComparison.Ordinal);
        if (dashIdx <= 0) return null;
        var prefix = site[..dashIdx].Trim();
        if (string.Equals(prefix, "NA", StringComparison.OrdinalIgnoreCase)) return "Seat - NA";
        if (string.Equals(prefix, "EU", StringComparison.OrdinalIgnoreCase)) return "Seat - EU";
        if (prefix.StartsWith("CN", StringComparison.OrdinalIgnoreCase)) return "Seat - CN";
        return null;
    }

    /// <summary>
    /// Convenience: returns <paramref name="stored"/> when present, otherwise
    /// the inferred value. Keeps any future row-level Subgroup data
    /// authoritative without losing the inference fallback today.
    /// </summary>
    public static string? Coalesce(
        string? stored,
        string? site,
        string? workstream,
        IReadOnlyDictionary<string, string>? mappingLookup = null)
        => string.IsNullOrWhiteSpace(stored) ? Infer(site, workstream, mappingLookup) : stored;

    public static string BuildKey(string? workstream, string? entityName)
        => $"{(workstream ?? string.Empty).Trim().ToUpperInvariant()}|{(entityName ?? string.Empty).Trim().ToUpperInvariant()}";

    private static string? InferPrefixed(string site, HashSet<string> validPrefixes, string outputPrefix)
    {
        var dashIdx = site.IndexOf(" - ", StringComparison.Ordinal);
        if (dashIdx <= 0) return null;
        var prefix = site[..dashIdx];
        return validPrefixes.Contains(prefix) ? outputPrefix + prefix : null;
    }
}
