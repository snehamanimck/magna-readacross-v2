using MagnaReadAcross.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using System.Text.Json;

namespace MagnaReadAcross.Api.Data;

public class MagnaDbContext : DbContext
{
    public MagnaDbContext(DbContextOptions<MagnaDbContext> options) : base(options) { }

    public DbSet<PnlEntry>                  PnlEntries                { get => Set<PnlEntry>(); }
    public DbSet<CosmaWaveInitiative>       CosmaWaveInitiatives      { get => Set<CosmaWaveInitiative>(); }
    public DbSet<PowertrainWaveInitiative>  PowertrainWaveInitiatives { get => Set<PowertrainWaveInitiative>(); }
    public DbSet<ExteriorsWaveInitiative>   ExteriorsWaveInitiatives  { get => Set<ExteriorsWaveInitiative>(); }
    public DbSet<SeatingWaveInitiative>     SeatingWaveInitiatives    { get => Set<SeatingWaveInitiative>(); }
    public DbSet<SubgroupEntityMapRow>      SubgroupEntityMap         { get => Set<SubgroupEntityMapRow>(); }
    public DbSet<ArchetypeDefinition>       ArchetypeDefinitions      { get => Set<ArchetypeDefinition>(); }
    public DbSet<SiteArchetype>             SiteArchetypes            { get => Set<SiteArchetype>(); }
    public DbSet<PriorityInitiative>        PriorityInitiatives       { get => Set<PriorityInitiative>(); }
    public DbSet<ThoughtStarter>            ThoughtStarters           { get => Set<ThoughtStarter>(); }
    public DbSet<PnlRecommendation>         PnlRecommendations        { get => Set<PnlRecommendation>(); }
    public DbSet<PnlAccountMap>             PnlAccountMaps            { get => Set<PnlAccountMap>(); }
    public DbSet<PnlSiteDim>                PnlSiteDims               { get => Set<PnlSiteDim>(); }
    public DbSet<PnlSiteBenchmark>          PnlSiteBenchmarks         { get => Set<PnlSiteBenchmark>(); }
    public DbSet<PnlAnchor>                 PnlAnchors                { get => Set<PnlAnchor>(); }
    public DbSet<PnlRanking>                PnlRankings               { get => Set<PnlRanking>(); }
    public DbSet<KnowledgeCenterAsset>      KnowledgeCenterAssets     { get => Set<KnowledgeCenterAsset>(); }
    public DbSet<VideoLibraryAsset>         VideoLibraryAssets        { get => Set<VideoLibraryAsset>(); }
    public DbSet<DashboardSnapshot>         DashboardSnapshots        { get => Set<DashboardSnapshot>(); }
    public DbSet<DashboardMetaSnapshot>     DashboardMetaSnapshots    { get => Set<DashboardMetaSnapshot>(); }
    public DbSet<MagnaDivisionAlias>        MagnaDivisionAliases      { get => Set<MagnaDivisionAlias>(); }
    public DbSet<CosmaSubgroupMap>          CosmaSubgroupMaps         { get => Set<CosmaSubgroupMap>(); }
    public DbSet<ArchetypeMfgAllowed>       ArchetypeMfgAllowed       { get => Set<ArchetypeMfgAllowed>(); }
    public DbSet<SpendCategoryMetricMap>    SpendCategoryMetricMap    { get => Set<SpendCategoryMetricMap>(); }
    public DbSet<RecommendationScoring>     RecommendationScoring     { get => Set<RecommendationScoring>(); }
    public DbSet<AccessPolicyAssignment>    AccessPolicyAssignments   { get => Set<AccessPolicyAssignment>(); }

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);
        b.HasDefaultSchema("readacross");

        b.Entity<AccessPolicyAssignment>(entity =>
        {
            entity.ToTable("AccessPolicyAssignments");
            entity.Property(x => x.GroupObjectId).HasMaxLength(64);
            entity.Property(x => x.DisplayName).HasMaxLength(256);
            entity.Property(x => x.UpdatedBy).HasMaxLength(256);
            entity.Property(x => x.AllowedTabsJson).HasColumnType("nvarchar(max)");
        });

        var listConverter = new ValueConverter<IReadOnlyList<string>, string>(
            v => JsonSerializer.Serialize(v ?? Array.Empty<string>(), (JsonSerializerOptions?)null),
            v => string.IsNullOrWhiteSpace(v)
                ? Array.Empty<string>()
                : JsonSerializer.Deserialize<IReadOnlyList<string>>(v, (JsonSerializerOptions?)null) ?? Array.Empty<string>());

        b.Entity<PnlRecommendation>(entity =>
        {
            entity.Property(x => x.DeployingDivisions)
                  .HasColumnName("DeployingDivisions")
                  .HasColumnType("nvarchar(max)")
                  .HasConversion(listConverter);
        });
    }
}
