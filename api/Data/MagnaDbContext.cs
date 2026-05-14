using MagnaReadAcross.Api.Entities;
using Microsoft.EntityFrameworkCore;

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
    public DbSet<KnowledgeCenterAsset>      KnowledgeCenterAssets     { get => Set<KnowledgeCenterAsset>(); }
    public DbSet<VideoLibraryAsset>         VideoLibraryAssets        { get => Set<VideoLibraryAsset>(); }
    public DbSet<DashboardSnapshot>         DashboardSnapshots        { get => Set<DashboardSnapshot>(); }
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
    }
}
