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
    public DbSet<ArchetypeDefinition>       ArchetypeDefinitions      { get => Set<ArchetypeDefinition>(); }
    public DbSet<SiteArchetype>             SiteArchetypes            { get => Set<SiteArchetype>(); }
    public DbSet<PriorityInitiative>        PriorityInitiatives       { get => Set<PriorityInitiative>(); }
    public DbSet<ThoughtStarter>            ThoughtStarters           { get => Set<ThoughtStarter>(); }
    public DbSet<PnlRecommendation>         PnlRecommendations        { get => Set<PnlRecommendation>(); }
    public DbSet<KnowledgeCenterAsset>      KnowledgeCenterAssets     { get => Set<KnowledgeCenterAsset>(); }
    public DbSet<VideoLibraryAsset>         VideoLibraryAssets        { get => Set<VideoLibraryAsset>(); }
    public DbSet<DashboardSnapshot>         DashboardSnapshots        { get => Set<DashboardSnapshot>(); }

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);
        b.HasDefaultSchema("readacross");
    }
}
