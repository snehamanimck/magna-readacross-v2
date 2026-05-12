using System.Text.Json;
using MagnaReadAcross.Api.Data;
using MagnaReadAcross.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace MagnaReadAcross.Api.Services;

/// <summary>
/// Builds <see cref="DashboardConfigDto"/> by combining static configuration
/// (Wave URLs, feedback recipient) with the offline data-quality blocks the
/// ingest pipeline lands in <c>readacross.DashboardSnapshots</c>. When no
/// snapshot row exists for a section the strongly-typed
/// <see cref="DashboardConfigOptions"/> values are used as a fallback so the
/// endpoint always returns a sensible payload.
/// </summary>
public class DashboardConfigService : IDashboardConfigService
{
    // Snapshot payloads were emitted with snake_case keys (matching the
    // source dashboard_data.json). Use a dedicated options bag so the global
    // camelCase API serializer never interferes with reading them.
    private static readonly JsonSerializerOptions SnapshotJsonOpts = new(JsonSerializerDefaults.Web)
    {
        PropertyNamingPolicy        = JsonNamingPolicy.SnakeCaseLower,
        PropertyNameCaseInsensitive = true,
    };

    private readonly DashboardConfigOptions _options;
    private readonly MagnaDbContext _db;

    public DashboardConfigService(IOptions<DashboardConfigOptions> options, MagnaDbContext db)
    {
        _options = options.Value;
        _db      = db;
    }

    public async Task<DashboardConfigDto> GetAsync(CancellationToken ct = default)
    {
        var snapshots = await _db.DashboardSnapshots
            .AsNoTracking()
            .Where(s => s.SectionKey == "cosma_meta"
                     || s.SectionKey == "powertrain_meta"
                     || s.SectionKey == "exteriors_meta"
                     || s.SectionKey == "generated")
            .GroupBy(s => s.SectionKey)
            .Select(g => g.OrderByDescending(x => x.GeneratedAtUtc).First())
            .ToListAsync(ct);

        var bySection = snapshots.ToDictionary(s => s.SectionKey, s => s, StringComparer.OrdinalIgnoreCase);

        var generated = bySection.TryGetValue("generated", out var g)
            ? ParseGenerated(g.PayloadJson)
            : DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ");

        return new DashboardConfigDto
        {
            Generated      = generated,
            FeedbackEmail  = _options.FeedbackEmail,
            WaveBaseUrls   = new Dictionary<string, string>(_options.WaveBaseUrls, StringComparer.OrdinalIgnoreCase),
            CosmaMeta      = MetaFromSnapshot(bySection, "cosma_meta")      ?? ToDto(_options.CosmaMeta),
            PowertrainMeta = MetaFromSnapshot(bySection, "powertrain_meta") ?? ToDto(_options.PowertrainMeta),
            ExteriorsMeta  = MetaFromSnapshot(bySection, "exteriors_meta")  ?? ToDto(_options.ExteriorsMeta),
        };
    }

    private static string ParseGenerated(string payloadJson)
    {
        // The "generated" snapshot stores the raw scalar (string) verbatim.
        try
        {
            var raw = JsonSerializer.Deserialize<string>(payloadJson, SnapshotJsonOpts);
            return string.IsNullOrWhiteSpace(raw)
                ? DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ")
                : raw;
        }
        catch
        {
            return DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ");
        }
    }

    private static WorkstreamMetaDto? MetaFromSnapshot(
        IReadOnlyDictionary<string, Entities.DashboardSnapshot> bySection,
        string key)
    {
        if (!bySection.TryGetValue(key, out var snap) || string.IsNullOrWhiteSpace(snap.PayloadJson))
            return null;

        try
        {
            var raw = JsonSerializer.Deserialize<RawMeta>(snap.PayloadJson, SnapshotJsonOpts);
            if (raw is null) return null;

            // The Cosma block uses `total_working` (post-exclusion) where the
            // PT/Ext blocks expose `total_active`. Treat them as equivalent.
            var totalActive = raw.TotalActive ?? raw.TotalWorking ?? 0;

            return new WorkstreamMetaDto
            {
                TotalRaw           = raw.TotalRaw ?? 0,
                TotalActive        = totalActive,
                TotalCategorized   = raw.TotalCategorized ?? 0,
                TotalUncategorized = raw.TotalUncategorized,
                TotalNeedsReview   = raw.TotalNeedsReview,
                Benchmark          = raw.Benchmark,
                LastValidated      = raw.LastValidated,
                ValidationNotes    = raw.ValidationNotes ?? Array.Empty<string>(),
                ExclusionRules     = raw.ExclusionRules  ?? Array.Empty<string>(),
            };
        }
        catch
        {
            return null;
        }
    }

    private static WorkstreamMetaDto? ToDto(WorkstreamMetaOptions? src) => src is null ? null : new WorkstreamMetaDto
    {
        TotalRaw           = src.TotalRaw,
        TotalActive        = src.TotalActive,
        TotalCategorized   = src.TotalCategorized,
        TotalUncategorized = src.TotalUncategorized,
        TotalNeedsReview   = src.TotalNeedsReview,
        Benchmark          = src.Benchmark,
        LastValidated      = src.LastValidated,
        ValidationNotes    = src.ValidationNotes.ToArray(),
        ExclusionRules     = src.ExclusionRules.ToArray(),
    };

    /// <summary>Mirrors the snake_case shape of the offline meta blocks.</summary>
    private sealed class RawMeta
    {
        public int? TotalRaw           { get; set; }
        public int? TotalActive        { get; set; }
        public int? TotalWorking       { get; set; }
        public int? TotalCategorized   { get; set; }
        public int? TotalUncategorized { get; set; }
        public int? TotalNeedsReview   { get; set; }
        public string? Benchmark       { get; set; }
        public string? LastValidated   { get; set; }
        public IReadOnlyList<string>? ValidationNotes { get; set; }
        public IReadOnlyList<string>? ExclusionRules  { get; set; }
    }
}
