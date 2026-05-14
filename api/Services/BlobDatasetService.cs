using System.Text.Json;
using Azure.Identity;
using Azure.Storage.Blobs;
using Azure.Storage.Sas;
using MagnaReadAcross.Api.Models;
using Microsoft.Extensions.Options;

namespace MagnaReadAcross.Api.Services;

public sealed class BlobDatasetService : IBlobDatasetService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly BlobDatasetOptions _options;
    private readonly ILogger<BlobDatasetService> _logger;

    public BlobDatasetService(IOptions<BlobDatasetOptions> options, ILogger<BlobDatasetService> logger)
    {
        _options = options.Value;
        _logger = logger;
    }

    public async Task<DatasetManifestDto> GetManifestAsync(CancellationToken ct = default)
    {
        if (!HasBlobConfig())
        {
            return LocalManifest();
        }

        var client = ContainerClient();
        var blob = client.GetBlobClient($"{Prefix()}/manifest.json");
        await using var stream = await blob.OpenReadAsync(cancellationToken: ct);
        return await JsonSerializer.DeserializeAsync<DatasetManifestDto>(stream, JsonOptions, ct)
               ?? LocalManifest();
    }

    public async Task<SlidesIndexDto> GetSlidesIndexAsync(CancellationToken ct = default)
    {
        if (!HasBlobConfig())
        {
            return new SlidesIndexDto(
                [new SlideAssetDto("slide-001", "Read-across overview", "slides/overview.png", "image/png", 1)],
                [new VideoAssetDto("video-001", "Read-across walkthrough", "videos/overview.mp4", "video/mp4", 1)]);
        }

        var client = ContainerClient();
        var blob = client.GetBlobClient($"{Prefix()}/slides_index.json");
        await using var stream = await blob.OpenReadAsync(cancellationToken: ct);
        return await JsonSerializer.DeserializeAsync<SlidesIndexDto>(stream, JsonOptions, ct)
               ?? new SlidesIndexDto(Array.Empty<SlideAssetDto>(), Array.Empty<VideoAssetDto>());
    }

    public async Task<MediaSasDto> IssueReadSasAsync(string assetId, CancellationToken ct = default)
    {
        var expiresAt = DateTimeOffset.UtcNow.AddMinutes(Math.Max(1, _options.MediaSasMinutes));
        if (!HasBlobConfig())
        {
            return new MediaSasDto(assetId, $"/dev-blob/{Uri.EscapeDataString(assetId)}", expiresAt, GuessMime(assetId));
        }

        var client = ContainerClient();
        var blobName = $"{Prefix()}/{assetId.TrimStart('/')}";
        var blob = client.GetBlobClient(blobName);

        // User delegation SAS works with managed identity and avoids account keys.
        var service = new BlobServiceClient(new Uri(_options.AccountUrl), new DefaultAzureCredential());
        var delegationKey = await service.GetUserDelegationKeyAsync(DateTimeOffset.UtcNow.AddMinutes(-5), expiresAt, ct);
        var sas = new BlobSasBuilder
        {
            BlobContainerName = _options.Container,
            BlobName = blobName,
            Resource = "b",
            ExpiresOn = expiresAt,
        };
        sas.SetPermissions(BlobSasPermissions.Read);
        var query = sas.ToSasQueryParameters(delegationKey.Value, service.AccountName).ToString();
        var uri = new UriBuilder(blob.Uri) { Query = query }.Uri.ToString();
        _logger.LogInformation("Issued read SAS for media asset {AssetId} until {ExpiresAt}", assetId, expiresAt);
        return new MediaSasDto(assetId, uri, expiresAt, GuessMime(assetId));
    }

    private bool HasBlobConfig() =>
        !string.IsNullOrWhiteSpace(_options.AccountUrl) && !string.IsNullOrWhiteSpace(_options.Container);

    private BlobContainerClient ContainerClient() =>
        new(new Uri($"{_options.AccountUrl.TrimEnd('/')}/{_options.Container}"), new DefaultAzureCredential());

    private string Prefix() => _options.DatasetPrefix.Trim('/');

    private static string? GuessMime(string assetId)
    {
        if (assetId.EndsWith(".mp4", StringComparison.OrdinalIgnoreCase)) return "video/mp4";
        if (assetId.EndsWith(".png", StringComparison.OrdinalIgnoreCase)) return "image/png";
        if (assetId.EndsWith(".jpg", StringComparison.OrdinalIgnoreCase) || assetId.EndsWith(".jpeg", StringComparison.OrdinalIgnoreCase)) return "image/jpeg";
        if (assetId.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase)) return "application/pdf";
        return null;
    }

    private static DatasetManifestDto LocalManifest() =>
        new(
            1,
            "local-dev",
            DateTimeOffset.UtcNow,
            [
                new DatasetShardDto("core", "core.json", "json", "application/json", "core", null, 0),
                new DatasetShardDto("initiatives.cosma", "initiatives.cosma.parquet", "parquet", "application/octet-stream", "initiatives", null, 0),
                new DatasetShardDto("initiatives.powertrain", "initiatives.powertrain.parquet", "parquet", "application/octet-stream", "initiatives", null, 0),
                new DatasetShardDto("initiatives.exteriors", "initiatives.exteriors.parquet", "parquet", "application/octet-stream", "initiatives", null, 0),
                new DatasetShardDto("slides_index", "slides_index.json", "json", "application/json", "media-index", null, 0),
                new DatasetShardDto("pnl.recommendations", "pnl/recommendations.xlsx", "xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "pnl-source", null, 0),
            ]);
}
