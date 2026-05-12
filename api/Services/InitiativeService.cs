using MagnaReadAcross.Api.Data;
using MagnaReadAcross.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace MagnaReadAcross.Api.Services;

/// <summary>
/// Reads the three Wave tables and harmonizes them into a single
/// <see cref="InitiativeDto"/> list — the schema the Angular client expects.
/// </summary>
public class InitiativeService : IInitiativeService
{
    private static readonly string[] Workstreams = { "Cosma", "Powertrain", "Exteriors" };

    private readonly MagnaDbContext _db;
    public InitiativeService(MagnaDbContext db) => _db = db;

    public async Task<IReadOnlyList<InitiativeDto>> GetAllAsync(
        IReadOnlyCollection<string>? workstreams = null,
        IReadOnlyCollection<string>? spendCategories = null,
        IReadOnlyCollection<string>? stages = null,
        IReadOnlyCollection<string>? subgroups = null,
        IReadOnlyCollection<string>? archetypes = null,
        CancellationToken ct = default)
    {
        var wantsAll = workstreams is null or { Count: 0 };

        var list = new List<InitiativeDto>();

        if (wantsAll || workstreams!.Contains("Cosma", StringComparer.OrdinalIgnoreCase))
        {
            var cosma = await _db.CosmaWaveInitiatives.AsNoTracking().ToListAsync(ct);
            list.AddRange(cosma.Select(c => new InitiativeDto
            {
                Id            = c.InitiativeId,
                Name          = c.Name,
                Description   = c.Description,
                Workstream    = "Cosma",
                Site          = c.Site,
                Subgroup      = SubgroupInferer.Coalesce(c.Subgroup, c.Site, "Cosma"),
                Owner         = c.InitiativeOwner,
                Stage         = c.Stage,
                Access        = c.Access,
                Nrb           = c.Nrb ?? 0,
                SpendCategory = c.SpendCategory,
                MfgProcess    = c.MfgProcess,
                Lever         = c.Lever,
                SubLever      = c.SubLever,
                IsCategorized = c.IsCategorized,
                Archetypes    = SplitCsv(c.Archetypes),
            }));
        }

        if (wantsAll || workstreams!.Contains("Powertrain", StringComparer.OrdinalIgnoreCase))
        {
            var pt = await _db.PowertrainWaveInitiatives.AsNoTracking().ToListAsync(ct);
            list.AddRange(pt.Select(p => new InitiativeDto
            {
                Id            = p.InitiativeId,
                Name          = p.Name,
                Description   = p.Description,
                Workstream    = "Powertrain",
                Site          = p.Site,
                Subgroup      = SubgroupInferer.Coalesce(p.Subgroup, p.Site, "Powertrain"),
                Owner         = p.InitiativeOwner,
                Stage         = p.Stage,
                Access        = p.Access,
                Nrb           = p.Nrb ?? 0,
                SpendCategory = p.SpendCategory,
                MfgProcess    = p.MfgProcess,
                Lever         = p.Lever,
                SubLever      = p.SubLever,
                IsCategorized = p.IsCategorized,
            }));
        }

        if (wantsAll || workstreams!.Contains("Exteriors", StringComparer.OrdinalIgnoreCase))
        {
            var ext = await _db.ExteriorsWaveInitiatives.AsNoTracking().ToListAsync(ct);
            list.AddRange(ext.Select(e => new InitiativeDto
            {
                Id            = e.InitiativeId,
                Name          = e.Name,
                Description   = e.Description,
                Workstream    = "Exteriors",
                Site          = e.Division,
                Subgroup      = SubgroupInferer.Coalesce(e.Subgroup, e.Division, "Exteriors"),
                Owner         = e.InitiativeOwner,
                Stage         = e.Stage,
                Access        = e.Access,
                Nrb           = e.Nrb ?? 0,
                SpendCategory = e.SpendCategory,
                MfgProcess    = e.MfgProcess,
                Lever         = e.Lever,
                SubLever      = e.SubLever,
                IsCategorized = e.IsCategorized,
            }));
        }

        // ── In-memory filters (small N — fine for the harmonized list) ──
        IEnumerable<InitiativeDto> q = list;

        if (spendCategories is { Count: > 0 })
            q = q.Where(i => i.SpendCategory is not null
                          && spendCategories.Contains(i.SpendCategory, StringComparer.OrdinalIgnoreCase));

        if (stages is { Count: > 0 })
            q = q.Where(i => i.Stage is not null
                          && stages.Any(s => i.Stage!.Contains(s, StringComparison.OrdinalIgnoreCase)));

        if (subgroups is { Count: > 0 })
            q = q.Where(i => i.Subgroup is not null
                          && subgroups.Contains(i.Subgroup, StringComparer.OrdinalIgnoreCase));

        if (archetypes is { Count: > 0 })
            q = q.Where(i => i.Archetypes.Any(a =>
                          archetypes.Contains(a, StringComparer.OrdinalIgnoreCase)));

        return q.ToList();
    }

    public async Task<FilterOptionsDto> GetFilterOptionsAsync(CancellationToken ct = default)
    {
        var all = await GetAllAsync(ct: ct);

        return new FilterOptionsDto
        {
            Workstreams     = Workstreams,
            SpendCategories = all.Select(i => i.SpendCategory).Where(s => !string.IsNullOrWhiteSpace(s))
                                .Cast<string>().Distinct(StringComparer.OrdinalIgnoreCase).OrderBy(s => s).ToList(),
            Stages          = all.Select(i => i.Stage).Where(s => !string.IsNullOrWhiteSpace(s))
                                .Cast<string>().Distinct(StringComparer.OrdinalIgnoreCase).OrderBy(s => s).ToList(),
            Subgroups       = all.Select(i => i.Subgroup).Where(s => !string.IsNullOrWhiteSpace(s))
                                .Cast<string>().Distinct(StringComparer.OrdinalIgnoreCase).OrderBy(s => s).ToList(),
            Archetypes      = all.SelectMany(i => i.Archetypes).Distinct(StringComparer.OrdinalIgnoreCase).OrderBy(s => s).ToList(),
            Sites           = all.Select(i => i.Site).Where(s => !string.IsNullOrWhiteSpace(s))
                                .Cast<string>().Distinct(StringComparer.OrdinalIgnoreCase).OrderBy(s => s).ToList(),
        };
    }

    public async Task<IReadOnlyList<SubgroupDto>> GetSubgroupsAsync(CancellationToken ct = default)
    {
        var all = await GetAllAsync(ct: ct);

        // DB values are already canonical (the SQL backfill normalizes them),
        // so plain ordinal grouping is safe and avoids needing a custom
        // IEqualityComparer<TKey> for the anonymous-type composite key.
        return all
            .Where(i => !string.IsNullOrWhiteSpace(i.Subgroup))
            .GroupBy(i => new { Subgroup = i.Subgroup!, i.Workstream })
            .Select(g => new SubgroupDto
            {
                Subgroup        = g.Key.Subgroup,
                Workstream      = g.Key.Workstream,
                InitiativeCount = g.Count(),
                Sites           = g.Select(i => i.Site)
                                   .Where(s => !string.IsNullOrWhiteSpace(s))
                                   .Cast<string>()
                                   .Distinct(StringComparer.OrdinalIgnoreCase)
                                   .OrderBy(s => s)
                                   .ToList(),
            })
            .OrderBy(s => s.Workstream).ThenBy(s => s.Subgroup)
            .ToList();
    }

    private static IReadOnlyList<string> SplitCsv(string? csv) =>
        string.IsNullOrWhiteSpace(csv)
            ? Array.Empty<string>()
            : csv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
}
