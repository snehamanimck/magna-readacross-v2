namespace MagnaReadAcross.Api.Models;

public sealed record DatasetManifestDto(
    int SchemaVersion,
    string DatasetId,
    DateTimeOffset Generated,
    IReadOnlyList<DatasetShardDto> Shards);

public sealed record DatasetShardDto(
    string Id,
    string Path,
    string Format,
    string? MimeType,
    string? Role,
    string? Sha256,
    long ByteLength);

public sealed record MediaSasDto(
    string AssetId,
    string Url,
    DateTimeOffset ExpiresAt,
    string? MimeType);

public sealed record SlidesIndexDto(
    IReadOnlyList<SlideAssetDto> Slides,
    IReadOnlyList<VideoAssetDto> Videos);

public sealed record SlideAssetDto(
    string Id,
    string Title,
    string AssetId,
    string MimeType,
    int Order,
    string? Caption = null);

public sealed record VideoAssetDto(
    string Id,
    string Title,
    string AssetId,
    string MimeType,
    int Order,
    string? Description = null,
    string? PosterAssetId = null,
    int? DurationSeconds = null);
