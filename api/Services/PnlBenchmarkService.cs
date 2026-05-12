using System.Text.Json;
using MagnaReadAcross.Api.Models;

namespace MagnaReadAcross.Api.Services;

/// <summary>
/// Loads and serves the static P&amp;L benchmarks blob (sourced from
/// <c>Resources/pnl-benchmarks.json</c>).
///
/// The blob is parsed once at startup and cached for the lifetime of the
/// process — it's small (~160 KB), read-only, and shared across requests.
/// When the source data warehouse is wired up, swap this implementation for
/// one that streams the same DTO shape from SQL without changing callers.
/// </summary>
public interface IPnlBenchmarkService
{
    Task<PnlBenchmarksDto> GetAllAsync(CancellationToken ct = default);
}

public class PnlBenchmarkService : IPnlBenchmarkService
{
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<PnlBenchmarkService> _logger;
    private PnlBenchmarksDto? _cache;

    /// <summary>
    /// JSON options for the source file: snake_case property keys, case-
    /// insensitive matching, allow trailing commas / comments. The wire
    /// response uses the controller's default camelCase policy instead.
    /// </summary>
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web)
    {
        PropertyNamingPolicy        = JsonNamingPolicy.SnakeCaseLower,
        PropertyNameCaseInsensitive = true,
    };

    public PnlBenchmarkService(IWebHostEnvironment env, ILogger<PnlBenchmarkService> logger)
    {
        _env    = env;
        _logger = logger;
    }

    public async Task<PnlBenchmarksDto> GetAllAsync(CancellationToken ct = default)
    {
        if (_cache is not null) return _cache;

        var path = Path.Combine(AppContext.BaseDirectory, "Resources", "pnl-benchmarks.json");
        if (!File.Exists(path))
        {
            _logger.LogWarning("pnl-benchmarks.json missing at {Path}; returning empty dataset.", path);
            _cache = new PnlBenchmarksDto();
            return _cache;
        }

        await using var stream = File.OpenRead(path);
        var dto = await JsonSerializer.DeserializeAsync<PnlBenchmarksDto>(stream, JsonOpts, ct)
                  ?? new PnlBenchmarksDto();
        _cache = dto;
        _logger.LogInformation(
            "Loaded P&L benchmarks: {Sites} sites, {Scopes} ranking scopes.",
            dto.Benchmarks.Count, dto.Rankings.Count);
        return _cache;
    }
}
