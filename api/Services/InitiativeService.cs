using MagnaReadAcross.Api.Data;
using MagnaReadAcross.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace MagnaReadAcross.Api.Services;

/// <summary>
/// Reads the four Wave tables (Cosma, Powertrain, Exteriors, Seating) and
/// harmonizes them into a single <see cref="InitiativeDto"/> list — the
/// schema the Angular client expects.
/// </summary>
public class InitiativeService : IInitiativeService
{
    private static readonly string[] Workstreams = { "Cosma", "Powertrain", "Exteriors", "Seating" };

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
        var subgroupLookup = await LoadSubgroupLookupAsync(ct);

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
                Subgroup      = SubgroupInferer.Coalesce(c.Subgroup, c.Site, "Cosma", subgroupLookup),
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
                Subgroup      = SubgroupInferer.Coalesce(p.Subgroup, p.Site, "Powertrain", subgroupLookup),
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
                Subgroup      = SubgroupInferer.Coalesce(e.Subgroup, e.Division, "Exteriors", subgroupLookup),
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

        if (wantsAll || workstreams!.Contains("Seating", StringComparer.OrdinalIgnoreCase))
        {
            var seating = await _db.SeatingWaveInitiatives.AsNoTracking().ToListAsync(ct);
            list.AddRange(seating.Select(s => new InitiativeDto
            {
                Id            = s.InitiativeId,
                Name          = s.Name,
                Description   = s.Description,
                Workstream    = "Seating",
                Site          = s.Site,
                Subgroup      = SubgroupInferer.Coalesce(s.Subgroup, s.Site, "Seating", subgroupLookup),
                Owner         = s.InitiativeOwner,
                Stage         = s.Stage,
                Access        = s.Access,
                Nrb           = s.Nrb ?? 0,
                SpendCategory = s.SpendCategory,
                MfgProcess    = s.MfgProcess,
                Lever         = s.Lever,
                SubLever      = s.SubLever,
                IsCategorized = s.IsCategorized,
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

    public async Task<IReadOnlyList<SubgroupCoverageDto>> GetSubgroupCoverageAsync(CancellationToken ct = default)
    {
        var subgroupLookup = await LoadSubgroupLookupAsync(ct);

        var cosmaRows = await _db.CosmaWaveInitiatives
            .AsNoTracking()
            .Select(x => new { Entity = x.Site, x.Subgroup })
            .ToListAsync(ct);

        var powertrainRows = await _db.PowertrainWaveInitiatives
            .AsNoTracking()
            .Select(x => new { Entity = x.Site, x.Subgroup })
            .ToListAsync(ct);

        var exteriorsRows = await _db.ExteriorsWaveInitiatives
            .AsNoTracking()
            .Select(x => new { Entity = x.Division, x.Subgroup })
            .ToListAsync(ct);

        var seatingRows = await _db.SeatingWaveInitiatives
            .AsNoTracking()
            .Select(x => new { Entity = x.Site, x.Subgroup })
            .ToListAsync(ct);

        return new List<SubgroupCoverageDto>
        {
            BuildCoverage("Cosma", cosmaRows, subgroupLookup, r => r.Entity, r => r.Subgroup),
            BuildCoverage("Powertrain", powertrainRows, subgroupLookup, r => r.Entity, r => r.Subgroup),
            BuildCoverage("Exteriors", exteriorsRows, subgroupLookup, r => r.Entity, r => r.Subgroup),
            BuildCoverage("Seating", seatingRows, subgroupLookup, r => r.Entity, r => r.Subgroup)
        };
    }

    private static IReadOnlyList<string> SplitCsv(string? csv) =>
        string.IsNullOrWhiteSpace(csv)
            ? Array.Empty<string>()
            : csv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    private async Task<Dictionary<string, string>> LoadSubgroupLookupAsync(CancellationToken ct)
    {
        var rows = await _db.SubgroupEntityMap
            .AsNoTracking()
            .Where(x => x.IsActive)
            .ToListAsync(ct);

        var lookup = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var row in rows)
        {
            lookup[SubgroupInferer.BuildKey(row.Workstream, row.EntityName)] = row.Subgroup;
        }

        return lookup;
    }

    private static SubgroupCoverageDto BuildCoverage<TRow>(
        string workstream,
        IEnumerable<TRow> rows,
        IReadOnlyDictionary<string, string> subgroupLookup,
        Func<TRow, string?> entitySelector,
        Func<TRow, string?> subgroupSelector)
    {
        var buffered = rows
            .Select(r => (Entity: entitySelector(r), Subgroup: subgroupSelector(r)))
            .ToList();

        var missingStored = buffered.Count(r => string.IsNullOrWhiteSpace(r.Subgroup));

        var unresolved = buffered
            .Where(r =>
            {
                var effective = SubgroupInferer.Coalesce(r.Subgroup, r.Entity, workstream, subgroupLookup);
                return string.IsNullOrWhiteSpace(effective);
            })
            .ToList();

        var unmappedEntities = unresolved
            .Select(r => r.Entity)
            .Where(e => !string.IsNullOrWhiteSpace(e))
            .Cast<string>()
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(e => e)
            .Take(50)
            .ToList();

        return new SubgroupCoverageDto
        {
            Workstream = workstream,
            TotalRows = buffered.Count,
            MissingStoredSubgroupRows = missingStored,
            MissingEffectiveSubgroupRows = unresolved.Count,
            UnmappedEntities = unmappedEntities
        };
    }
}
