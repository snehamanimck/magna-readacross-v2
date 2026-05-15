using MagnaReadAcross.Api.Data;
using MagnaReadAcross.Api.Entities;
using MagnaReadAcross.Api.Models;
using MagnaReadAcross.Api.Services;
using MagnaReadAcross.Api.Services.Pnl;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MagnaReadAcross.Api.Controllers;

/// <summary>
/// Read access to the P&amp;L cube fact table (<c>readacross.PnlEntries</c>)
/// plus the curated benchmarks blob that powers the SPA's P&amp;L Benchmarking
/// view (full Cosma / Powertrain / Exteriors site rankings).
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class PnlController : ControllerBase
{
    private readonly MagnaDbContext        _db;
    private readonly IPnlBenchmarkService  _benchmarks;
    private readonly IAccessPolicyService  _accessPolicy;
    private readonly IPnlCalculationEngine _calcEngine;
    private readonly IPnlRecommendationEngine _recEngine;
    private readonly IPnlEbitOverlayService _ebitOverlay;
    private readonly ILogger<PnlController> _logger;

    public PnlController(
        MagnaDbContext db,
        IPnlBenchmarkService benchmarks,
        IAccessPolicyService accessPolicy,
        IPnlCalculationEngine calcEngine,
        IPnlRecommendationEngine recEngine,
        IPnlEbitOverlayService ebitOverlay,
        ILogger<PnlController> logger)
    {
        _db         = db;
        _benchmarks = benchmarks;
        _accessPolicy = accessPolicy;
        _calcEngine = calcEngine;
        _recEngine = recEngine;
        _ebitOverlay = ebitOverlay;
        _logger = logger;
    }

    /// <summary>
    /// Curated P&amp;L benchmarks for every Cosma / PT / Exteriors site —
    /// drives the Insights → P&amp;L Benchmarking page (KPI summary tiles,
    /// Strengths / Opportunity Areas, Full Ranking, Site Comparison).
    /// </summary>
    [HttpGet("benchmarks")]
    [ProducesResponseType(typeof(PnlBenchmarksDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<PnlBenchmarksDto>> Benchmarks(CancellationToken ct = default)
    {
        if (!await CanReadPnlAsync(ct))
        {
            return Forbid();
        }
        return Ok(await _benchmarks.GetAllAsync(ct));
    }

    /// <summary>Filterable, paginated raw fact rows.</summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<PnlEntry>>> Get(
        [FromQuery] string?  cube     = null,
        [FromQuery] string?  entity   = null,
        [FromQuery] string?  scenario = null,
        [FromQuery] string?  time     = null,
        [FromQuery] string?  account  = null,
        [FromQuery] int      take     = 500,
        [FromQuery] int      skip     = 0,
        CancellationToken ct = default)
    {
        if (!await CanReadPnlAsync(ct))
        {
            return Forbid();
        }

        IQueryable<PnlEntry> q = _db.PnlEntries.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(cube))     q = q.Where(p => p.Cube     == cube);
        if (!string.IsNullOrWhiteSpace(entity))   q = q.Where(p => p.Entity   == entity);
        if (!string.IsNullOrWhiteSpace(scenario)) q = q.Where(p => p.Scenario == scenario);
        if (!string.IsNullOrWhiteSpace(time))     q = q.Where(p => p.Time     == time);
        if (!string.IsNullOrWhiteSpace(account))  q = q.Where(p => p.Account  == account);

        var rows = await q.OrderBy(p => p.Cube).ThenBy(p => p.Entity).ThenBy(p => p.Time)
                          .Skip(skip).Take(Math.Clamp(take, 1, 5000))
                          .ToListAsync(ct);
        return Ok(rows);
    }

    /// <summary>
    /// Recompute SQL-backed P&amp;L benchmarks/recommendations from PnlEntries.
    /// Admin-only operation.
    /// </summary>
    [HttpPost("recompute")]
    public async Task<ActionResult<object>> Recompute(CancellationToken ct = default)
    {
        if (!await CanReadPnlAsync(ct))
        {
            return Forbid();
        }

        var started = DateTime.UtcNow;
        await _calcEngine.RecomputeAllAsync(ct);
        await _recEngine.RecomputeAllAsync(ct);
        await _ebitOverlay.ApplyAsync(ct);
        var elapsedMs = (DateTime.UtcNow - started).TotalMilliseconds;

        var benchmarkCount = await _db.PnlSiteBenchmarks.CountAsync(ct);
        var recommendationCount = await _db.PnlRecommendations.CountAsync(ct);
        _logger.LogInformation("P&L recompute finished in {Ms} ms", elapsedMs);
        return Ok(new
        {
            durationMs = Math.Round(elapsedMs, 2),
            benchmarkCount,
            recommendationCount
        });
    }

    /// <summary>Cube/Entity/Scenario/Time/Account rollup — drives benchmark cards.</summary>
    [HttpGet("summary")]
    public async Task<ActionResult<IReadOnlyList<PnlSummaryRow>>> Summary(
        [FromQuery] string?  cube     = null,
        [FromQuery] string?  scenario = null,
        [FromQuery] string?  time     = null,
        CancellationToken ct = default)
    {
        if (!await CanReadPnlAsync(ct))
        {
            return Forbid();
        }

        IQueryable<PnlEntry> q = _db.PnlEntries.AsNoTracking().Where(p => p.HasData);

        if (!string.IsNullOrWhiteSpace(cube))     q = q.Where(p => p.Cube     == cube);
        if (!string.IsNullOrWhiteSpace(scenario)) q = q.Where(p => p.Scenario == scenario);
        if (!string.IsNullOrWhiteSpace(time))     q = q.Where(p => p.Time     == time);

        var rows = await q
            .GroupBy(p => new { p.Cube, p.Entity, p.Scenario, p.Time, p.Account })
            .Select(g => new PnlSummaryRow
            {
                Cube     = g.Key.Cube,
                Entity   = g.Key.Entity,
                Scenario = g.Key.Scenario,
                Time     = g.Key.Time,
                Account  = g.Key.Account,
                Amount   = g.Sum(x => x.Amount),
            })
            .OrderBy(r => r.Cube).ThenBy(r => r.Entity).ThenBy(r => r.Account)
            .ToListAsync(ct);

        return Ok(rows);
    }

    private async Task<bool> CanReadPnlAsync(CancellationToken ct)
    {
        var access = await _accessPolicy.GetEffectiveAccessAsync(User, ct);
        return access.AllowedItems.Contains(SecuredItems.TabPnl, StringComparer.OrdinalIgnoreCase);
    }
}
