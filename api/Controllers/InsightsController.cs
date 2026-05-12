using MagnaReadAcross.Api.Models;
using MagnaReadAcross.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace MagnaReadAcross.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class InsightsController : ControllerBase
{
    private readonly IInsightsService _insights;
    private readonly IDashboardConfigService _dashboardConfig;

    public InsightsController(IInsightsService insights, IDashboardConfigService dashboardConfig)
    {
        _insights = insights;
        _dashboardConfig = dashboardConfig;
    }

    /// <summary>
    /// Static-ish dashboard configuration the SPA pulls once at boot
    /// (feedback recipient, Wave deep-link base URLs, per-workstream
    /// data-quality summaries). Mirrors the offline dashboard's top-level
    /// <c>__OFFLINE_DASHBOARD_DATA__</c> chrome.
    /// </summary>
    [HttpGet("dashboard-config")]
    public async Task<ActionResult<DashboardConfigDto>> DashboardConfig(CancellationToken ct)
        => Ok(await _dashboardConfig.GetAsync(ct));

    [HttpGet("thought-starters")]
    public async Task<ActionResult<IReadOnlyList<ThoughtStarterDto>>> ThoughtStarters(CancellationToken ct)
        => Ok(await _insights.GetThoughtStartersAsync(ct));

    [HttpGet("pnl-recommendations")]
    public async Task<ActionResult<IReadOnlyList<PnlRecommendationDto>>> PnlRecommendations(CancellationToken ct)
        => Ok(await _insights.GetPnlRecommendationsAsync(ct));

    [HttpGet("knowledge-center")]
    public async Task<ActionResult<IReadOnlyList<KnowledgeCenterAssetDto>>> KnowledgeCenter(CancellationToken ct)
        => Ok(await _insights.GetKnowledgeCenterAssetsAsync(ct));

    [HttpGet("video-library")]
    public async Task<ActionResult<IReadOnlyList<VideoLibraryAssetDto>>> VideoLibrary(CancellationToken ct)
        => Ok(await _insights.GetVideoLibraryAssetsAsync(ct));

    [HttpGet("archetypes")]
    public async Task<ActionResult<IReadOnlyList<ArchetypeDefinitionDto>>> Archetypes(CancellationToken ct)
        => Ok(await _insights.GetArchetypeDefinitionsAsync(ct));

    [HttpGet("site-archetypes")]
    public async Task<ActionResult<IReadOnlyList<SiteArchetypeDto>>> SiteArchetypes(CancellationToken ct)
        => Ok(await _insights.GetSiteArchetypesAsync(ct));

    [HttpGet("priority-initiatives")]
    public async Task<ActionResult<IReadOnlyList<PriorityInitiativeDto>>> PriorityInitiatives(CancellationToken ct)
        => Ok(await _insights.GetPriorityInitiativesAsync(ct));
}
