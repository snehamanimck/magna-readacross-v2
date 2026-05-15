/*
================================================================================
 Magna Read-Across v2 — Azure SQL schema
--------------------------------------------------------------------------------
 Tables:
   dbo.PnlEntries                Hyperion-style P&L cube fact rows
   dbo.CosmaWaveInitiatives      Cosma Wave initiative export
   dbo.PowertrainWaveInitiatives Powertrain Wave initiative export
   dbo.ExteriorsWaveInitiatives  Exteriors Wave initiative export

 Notes:
   - Mirrors the cube schema from the source PNL extract:
       Cube, Entity, Parent, Cons, Scenario, Time, View, Account, Origin, IC,
       UD1..UD8, Amount, HasData, Annotation, Assumptions, AuditComm, Footnote,
       VarianceExp
   - Wave tables mirror the Excel exports the legacy ETL pulled from
     (`# / Stage / Access / Initiative Owner / Description / Name`) plus the
     enrichment columns the dashboard needs (NRB, taxonomy, site/division).
   - Designed for Azure SQL with AAD / Managed Identity. No SQL logins required.
================================================================================
*/

IF SCHEMA_ID('readacross') IS NULL
    EXEC('CREATE SCHEMA readacross AUTHORIZATION dbo');
GO

/* ──────────────────────────────────────────────────────────────────────────
   PNL cube fact table
   ────────────────────────────────────────────────────────────────────────── */
IF OBJECT_ID('readacross.PnlEntries', 'U') IS NOT NULL
    DROP TABLE readacross.PnlEntries;
GO

CREATE TABLE readacross.PnlEntries
(
    PnlEntryId    BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_PnlEntries PRIMARY KEY,
    Cube          NVARCHAR(64)   NOT NULL,
    Entity        NVARCHAR(128)  NOT NULL,
    Parent        NVARCHAR(128)  NULL,
    Cons          NVARCHAR(32)   NULL,
    Scenario      NVARCHAR(64)   NOT NULL,
    [Time]        NVARCHAR(32)   NOT NULL,
    [View]        NVARCHAR(32)   NULL,
    Account       NVARCHAR(128)  NOT NULL,
    Origin        NVARCHAR(64)   NULL,
    IC            NVARCHAR(64)   NULL,
    UD1           NVARCHAR(128)  NULL,
    UD2           NVARCHAR(128)  NULL,
    UD3           NVARCHAR(128)  NULL,
    UD4           NVARCHAR(128)  NULL,
    UD5           NVARCHAR(128)  NULL,
    UD6           NVARCHAR(128)  NULL,
    UD7           NVARCHAR(128)  NULL,
    UD8           NVARCHAR(128)  NULL,
    Amount        DECIMAL(20,4)  NOT NULL CONSTRAINT DF_PnlEntries_Amount DEFAULT (0),
    HasData       BIT            NOT NULL CONSTRAINT DF_PnlEntries_HasData DEFAULT (1),
    Annotation    NVARCHAR(MAX)  NULL,
    Assumptions   NVARCHAR(MAX)  NULL,
    AuditComm     NVARCHAR(MAX)  NULL,
    Footnote      NVARCHAR(MAX)  NULL,
    VarianceExp   NVARCHAR(MAX)  NULL,
    LoadedAtUtc   DATETIME2(0)   NOT NULL CONSTRAINT DF_PnlEntries_LoadedAt DEFAULT (SYSUTCDATETIME())
);
GO

CREATE INDEX IX_PnlEntries_Cube_Entity_Time   ON readacross.PnlEntries (Cube, Entity, [Time]);
CREATE INDEX IX_PnlEntries_Scenario_Account   ON readacross.PnlEntries (Scenario, Account);
CREATE INDEX IX_PnlEntries_Account            ON readacross.PnlEntries (Account);
GO

/* ──────────────────────────────────────────────────────────────────────────
   Cosma Wave
   ────────────────────────────────────────────────────────────────────────── */
IF OBJECT_ID('readacross.CosmaWaveInitiatives', 'U') IS NOT NULL
    DROP TABLE readacross.CosmaWaveInitiatives;
GO

CREATE TABLE readacross.CosmaWaveInitiatives
(
    InitiativeId          NVARCHAR(64)   NOT NULL CONSTRAINT PK_CosmaWave PRIMARY KEY,
    Name                  NVARCHAR(512)  NULL,
    Description           NVARCHAR(MAX)  NULL,
    Stage                 NVARCHAR(64)   NULL,
    Access                NVARCHAR(64)   NULL,
    InitiativeOwner       NVARCHAR(256)  NULL,
    Site                  NVARCHAR(128)  NULL,
    Subgroup              NVARCHAR(64)   NULL,
    SpendCategory         NVARCHAR(64)   NULL,  -- DL / IDL / Material Conveyance / VOH
    MfgProcess            NVARCHAR(64)   NULL,
    Lever                 NVARCHAR(256)  NULL,
    SubLever              NVARCHAR(256)  NULL,
    Nrb                   DECIMAL(20,2)  NULL,
    IsCategorized         BIT            NOT NULL CONSTRAINT DF_CosmaWave_IsCat DEFAULT (1),
    Archetypes            NVARCHAR(512)  NULL,  -- comma-delimited
    LoadedAtUtc           DATETIME2(0)   NOT NULL CONSTRAINT DF_CosmaWave_LoadedAt DEFAULT (SYSUTCDATETIME())
);
GO

CREATE INDEX IX_CosmaWave_SpendCategory ON readacross.CosmaWaveInitiatives (SpendCategory);
CREATE INDEX IX_CosmaWave_Site          ON readacross.CosmaWaveInitiatives (Site);
GO

/* ──────────────────────────────────────────────────────────────────────────
   Powertrain Wave
   ────────────────────────────────────────────────────────────────────────── */
IF OBJECT_ID('readacross.PowertrainWaveInitiatives', 'U') IS NOT NULL
    DROP TABLE readacross.PowertrainWaveInitiatives;
GO

CREATE TABLE readacross.PowertrainWaveInitiatives
(
    InitiativeId          NVARCHAR(64)   NOT NULL CONSTRAINT PK_PowertrainWave PRIMARY KEY,
    Name                  NVARCHAR(512)  NULL,
    Description           NVARCHAR(MAX)  NULL,
    Stage                 NVARCHAR(64)   NULL,
    Access                NVARCHAR(64)   NULL,
    InitiativeOwner       NVARCHAR(256)  NULL,
    Site                  NVARCHAR(128)  NULL,
    Subgroup              NVARCHAR(64)   NULL,    -- PT - APAC / PT - EU / PT - NA
    SpendCategory         NVARCHAR(64)   NULL,
    MfgProcess            NVARCHAR(64)   NULL,
    Lever                 NVARCHAR(256)  NULL,
    SubLever              NVARCHAR(256)  NULL,
    Nrb                   DECIMAL(20,2)  NULL,
    IsCategorized         BIT            NOT NULL CONSTRAINT DF_PowertrainWave_IsCat DEFAULT (1),
    LoadedAtUtc           DATETIME2(0)   NOT NULL CONSTRAINT DF_PowertrainWave_LoadedAt DEFAULT (SYSUTCDATETIME())
);
GO

CREATE INDEX IX_PowertrainWave_SpendCategory ON readacross.PowertrainWaveInitiatives (SpendCategory);
CREATE INDEX IX_PowertrainWave_Site          ON readacross.PowertrainWaveInitiatives (Site);
GO

/* ──────────────────────────────────────────────────────────────────────────
   Exteriors Wave
   ────────────────────────────────────────────────────────────────────────── */
IF OBJECT_ID('readacross.ExteriorsWaveInitiatives', 'U') IS NOT NULL
    DROP TABLE readacross.ExteriorsWaveInitiatives;
GO

CREATE TABLE readacross.ExteriorsWaveInitiatives
(
    InitiativeId          NVARCHAR(64)   NOT NULL CONSTRAINT PK_ExteriorsWave PRIMARY KEY,
    Name                  NVARCHAR(512)  NULL,
    Description           NVARCHAR(MAX)  NULL,
    Stage                 NVARCHAR(64)   NULL,
    Access                NVARCHAR(64)   NULL,
    InitiativeOwner       NVARCHAR(256)  NULL,
    Division              NVARCHAR(128)  NULL,  -- maps to "site" in dashboard
    Subgroup              NVARCHAR(64)   NULL,  -- Ext - AP / Ext - EU / Ext - NA
    SpendCategory         NVARCHAR(64)   NULL,
    MfgProcess            NVARCHAR(64)   NULL,
    Lever                 NVARCHAR(256)  NULL,
    SubLever              NVARCHAR(256)  NULL,
    Nrb                   DECIMAL(20,2)  NULL,
    IsCategorized         BIT            NOT NULL CONSTRAINT DF_ExteriorsWave_IsCat DEFAULT (1),
    LoadedAtUtc           DATETIME2(0)   NOT NULL CONSTRAINT DF_ExteriorsWave_LoadedAt DEFAULT (SYSUTCDATETIME())
);
GO

CREATE INDEX IX_ExteriorsWave_SpendCategory ON readacross.ExteriorsWaveInitiatives (SpendCategory);
CREATE INDEX IX_ExteriorsWave_Division      ON readacross.ExteriorsWaveInitiatives (Division);
GO

/* ──────────────────────────────────────────────────────────────────────────
   Seating Wave (parity with legacy /magna-readacross/public/index.html)
   ────────────────────────────────────────────────────────────────────────── */
IF OBJECT_ID('readacross.SeatingWaveInitiatives', 'U') IS NOT NULL
    DROP TABLE readacross.SeatingWaveInitiatives;
GO

CREATE TABLE readacross.SeatingWaveInitiatives
(
    InitiativeId          NVARCHAR(64)   NOT NULL CONSTRAINT PK_SeatingWave PRIMARY KEY,
    Name                  NVARCHAR(512)  NULL,
    Description           NVARCHAR(MAX)  NULL,
    Stage                 NVARCHAR(64)   NULL,
    Access                NVARCHAR(64)   NULL,
    InitiativeOwner       NVARCHAR(256)  NULL,
    Site                  NVARCHAR(128)  NULL,  -- "<NA|EU|CN*> - <Site>"
    Subgroup              NVARCHAR(64)   NULL,  -- Seat - NA / Seat - EU / Seat - CN
    SpendCategory         NVARCHAR(64)   NULL,
    MfgProcess            NVARCHAR(64)   NULL,
    Lever                 NVARCHAR(256)  NULL,
    SubLever              NVARCHAR(256)  NULL,
    Nrb                   DECIMAL(20,2)  NULL,
    IsCategorized         BIT            NOT NULL CONSTRAINT DF_SeatingWave_IsCat DEFAULT (1),
    LoadedAtUtc           DATETIME2(0)   NOT NULL CONSTRAINT DF_SeatingWave_LoadedAt DEFAULT (SYSUTCDATETIME())
);
GO

CREATE INDEX IX_SeatingWave_SpendCategory ON readacross.SeatingWaveInitiatives (SpendCategory);
CREATE INDEX IX_SeatingWave_Site          ON readacross.SeatingWaveInitiatives (Site);
GO

/* ──────────────────────────────────────────────────────────────────────────
   Subgroup mapping table (self-maintained source for hierarchy alignment)
   ────────────────────────────────────────────────────────────────────────── */
IF OBJECT_ID('readacross.SubgroupEntityMap', 'U') IS NOT NULL
    DROP TABLE readacross.SubgroupEntityMap;
GO

CREATE TABLE readacross.SubgroupEntityMap
(
    SubgroupEntityMapId BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SubgroupEntityMap PRIMARY KEY,
    Workstream          NVARCHAR(64)  NOT NULL,   -- Cosma / Powertrain / Exteriors
    EntityName          NVARCHAR(128) NOT NULL,   -- Site (Cosma/PT) or Division (Exteriors)
    Subgroup            NVARCHAR(64)  NOT NULL,
    IsActive            BIT           NOT NULL CONSTRAINT DF_SubgroupEntityMap_IsActive DEFAULT (1),
    Notes               NVARCHAR(256) NULL,
    UpdatedAtUtc        DATETIME2(0)  NOT NULL CONSTRAINT DF_SubgroupEntityMap_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_SubgroupEntityMap_Workstream_Entity UNIQUE (Workstream, EntityName)
);
GO

CREATE INDEX IX_SubgroupEntityMap_Workstream_Subgroup
    ON readacross.SubgroupEntityMap (Workstream, Subgroup)
    WHERE IsActive = 1;
GO

/* ──────────────────────────────────────────────────────────────────────────
   Mapping + Insights support tables (align to original ETL outputs)
   ────────────────────────────────────────────────────────────────────────── */
IF OBJECT_ID('readacross.ArchetypeDefinitions', 'U') IS NOT NULL
    DROP TABLE readacross.ArchetypeDefinitions;
GO

CREATE TABLE readacross.ArchetypeDefinitions
(
    ArchetypeKey   NVARCHAR(128) NOT NULL CONSTRAINT PK_ArchetypeDefinitions PRIMARY KEY,
    DisplayName    NVARCHAR(128) NOT NULL,
    Workstream     NVARCHAR(64)  NOT NULL,
    [Description]  NVARCHAR(MAX) NULL,
    IsActive       BIT           NOT NULL CONSTRAINT DF_ArchetypeDefinitions_IsActive DEFAULT (1)
);
GO

IF OBJECT_ID('readacross.SiteArchetypes', 'U') IS NOT NULL
    DROP TABLE readacross.SiteArchetypes;
GO

CREATE TABLE readacross.SiteArchetypes
(
    SiteArchetypeId BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SiteArchetypes PRIMARY KEY,
    SiteName        NVARCHAR(128) NOT NULL,
    ArchetypeKey    NVARCHAR(128) NOT NULL,
    Workstream      NVARCHAR(64)  NOT NULL,
    CONSTRAINT FK_SiteArchetypes_ArchetypeDefinitions
        FOREIGN KEY (ArchetypeKey) REFERENCES readacross.ArchetypeDefinitions (ArchetypeKey)
);
GO

CREATE INDEX IX_SiteArchetypes_Site_Workstream ON readacross.SiteArchetypes (SiteName, Workstream);
GO

IF OBJECT_ID('readacross.PriorityInitiatives', 'U') IS NOT NULL
    DROP TABLE readacross.PriorityInitiatives;
GO

CREATE TABLE readacross.PriorityInitiatives
(
    InitiativeId NVARCHAR(64) NOT NULL CONSTRAINT PK_PriorityInitiatives PRIMARY KEY,
    PriorityLabel NVARCHAR(128) NOT NULL,
    Workstream NVARCHAR(64) NULL
);
GO

IF OBJECT_ID('readacross.ThoughtStarters', 'U') IS NOT NULL
    DROP TABLE readacross.ThoughtStarters;
GO

CREATE TABLE readacross.ThoughtStarters
(
    ThoughtStarterId   BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ThoughtStarters PRIMARY KEY,
    SpendCategory      NVARCHAR(64)   NULL,
    MfgProcess         NVARCHAR(64)   NULL,
    Lever              NVARCHAR(256)  NULL,
    SubLever           NVARCHAR(256)  NULL,
    [Text]             NVARCHAR(MAX)  NOT NULL,
    AdvancedAutomation NVARCHAR(128)  NULL,  -- legacy: free-text label such as "Cobot load/unload" or "Camera inspect"
    IsActive           BIT            NOT NULL CONSTRAINT DF_ThoughtStarters_IsActive DEFAULT (1),
    SortOrder          INT            NOT NULL CONSTRAINT DF_ThoughtStarters_Sort DEFAULT (100)
);
GO

CREATE INDEX IX_ThoughtStarters_Taxonomy ON readacross.ThoughtStarters (SpendCategory, MfgProcess, Lever, SubLever);
GO

IF OBJECT_ID('readacross.PnlRecommendations', 'U') IS NOT NULL
    DROP TABLE readacross.PnlRecommendations;
GO

CREATE TABLE readacross.PnlRecommendations
(
    PnlRecommendationId BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_PnlRecommendations PRIMARY KEY,
    Workstream          NVARCHAR(64)  NOT NULL,
    Site                NVARCHAR(128) NOT NULL,
    Archetype           NVARCHAR(128) NULL,
    InitiativeId        NVARCHAR(64)  NULL,
    RecommendationText  NVARCHAR(MAX) NOT NULL,
    OpportunityAmount   DECIMAL(20,2) NULL,
    PriorityRank        INT           NOT NULL CONSTRAINT DF_PnlRecommendations_Rank DEFAULT (99),
    IsActive            BIT           NOT NULL CONSTRAINT DF_PnlRecommendations_IsActive DEFAULT (1)
);
GO

CREATE INDEX IX_PnlRecommendations_Site_Rank ON readacross.PnlRecommendations (Site, PriorityRank);
GO

IF OBJECT_ID('readacross.KnowledgeCenterAssets', 'U') IS NOT NULL
    DROP TABLE readacross.KnowledgeCenterAssets;
GO

CREATE TABLE readacross.KnowledgeCenterAssets
(
    KnowledgeAssetId BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_KnowledgeCenterAssets PRIMARY KEY,
    Title            NVARCHAR(256) NOT NULL,
    SpendCategory    NVARCHAR(64)  NULL,
    Workstream       NVARCHAR(64)  NULL,
    [Description]    NVARCHAR(MAX) NULL,
    SlideUrl         NVARCHAR(1024) NOT NULL,
    ThumbnailUrl     NVARCHAR(1024) NULL,
    SortOrder        INT           NOT NULL CONSTRAINT DF_KnowledgeCenterAssets_Sort DEFAULT (100),
    IsActive         BIT           NOT NULL CONSTRAINT DF_KnowledgeCenterAssets_IsActive DEFAULT (1)
);
GO

CREATE INDEX IX_KnowledgeCenterAssets_Category ON readacross.KnowledgeCenterAssets (SpendCategory, Workstream);
GO

IF OBJECT_ID('readacross.VideoLibraryAssets', 'U') IS NOT NULL
    DROP TABLE readacross.VideoLibraryAssets;
GO

CREATE TABLE readacross.VideoLibraryAssets
(
    VideoAssetId      BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_VideoLibraryAssets PRIMARY KEY,
    Title             NVARCHAR(256) NOT NULL,
    SpendCategory     NVARCHAR(64)  NULL,
    Workstream        NVARCHAR(64)  NULL,
    [Description]     NVARCHAR(MAX) NULL,
    VideoUrl          NVARCHAR(1024) NOT NULL,
    ThumbnailUrl      NVARCHAR(1024) NULL,
    DurationSeconds   INT           NULL,
    SortOrder         INT           NOT NULL CONSTRAINT DF_VideoLibraryAssets_Sort DEFAULT (100),
    IsActive          BIT           NOT NULL CONSTRAINT DF_VideoLibraryAssets_IsActive DEFAULT (1)
);
GO

CREATE INDEX IX_VideoLibraryAssets_Category ON readacross.VideoLibraryAssets (SpendCategory, Workstream);
GO

/* ──────────────────────────────────────────────────────────────────────────
   DashboardMetaSnapshots — landing table for dashboard metadata blocks
   consumed by DashboardConfigService (generated + per-workstream meta +
   optional taxonomy helper sections).
   ────────────────────────────────────────────────────────────────────────── */
IF OBJECT_ID('readacross.DashboardMetaSnapshots', 'U') IS NOT NULL
    DROP TABLE readacross.DashboardMetaSnapshots;
GO

CREATE TABLE readacross.DashboardMetaSnapshots
(
    SnapshotId       BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_DashboardMetaSnapshots PRIMARY KEY,
    SectionKey       NVARCHAR(64)    NOT NULL
        CONSTRAINT CK_DashboardMetaSnapshots_SectionKey
        CHECK (SectionKey IN (
            N'generated',
            N'cosma_meta',
            N'powertrain_meta',
            N'exteriors_meta',
            N'seating_meta',
            N'filter_options',
            N'archetypes',
            N'site_archetypes',
            N'harmonization_notes',
            N'priority_ids'
        )),
    GeneratedAtUtc   DATETIME2(0)    NOT NULL CONSTRAINT DF_DashboardMetaSnapshots_Gen DEFAULT (SYSUTCDATETIME()),
    SourceFile       NVARCHAR(512)   NULL,
    PayloadJson      NVARCHAR(MAX)   NOT NULL,
    LoadedAtUtc      DATETIME2(0)    NOT NULL CONSTRAINT DF_DashboardMetaSnapshots_Loaded DEFAULT (SYSUTCDATETIME())
);
GO

CREATE INDEX IX_DashboardMetaSnapshots_Section_Generated
    ON readacross.DashboardMetaSnapshots (SectionKey, GeneratedAtUtc DESC);
GO

/* ──────────────────────────────────────────────────────────────────────────
   Runtime mapping/scoring tables — SQL-backed runtime knobs used by
   dashboard-config:
   MagnaDivisionAliases, CosmaSubgroupMap, ArchetypeMfgAllowed,
   SpendCategoryMetricMap, and RecommendationScoring.
   ────────────────────────────────────────────────────────────────────────── */
IF OBJECT_ID('readacross.MagnaDivisionAliases', 'U') IS NOT NULL
    DROP TABLE readacross.MagnaDivisionAliases;
GO

CREATE TABLE readacross.MagnaDivisionAliases
(
    MagnaDivisionAliasId BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_MagnaDivisionAliases PRIMARY KEY,
    MagnaDivision        NVARCHAR(64) NOT NULL,
    DivisionAlias        NVARCHAR(64) NOT NULL,
    IsActive             BIT          NOT NULL CONSTRAINT DF_MagnaDivisionAliases_IsActive DEFAULT (1),
    UpdatedAtUtc         DATETIME2(0) NOT NULL CONSTRAINT DF_MagnaDivisionAliases_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_MagnaDivisionAliases_MagnaDivision UNIQUE (MagnaDivision)
);
GO

IF OBJECT_ID('readacross.CosmaSubgroupMap', 'U') IS NOT NULL
    DROP TABLE readacross.CosmaSubgroupMap;
GO

CREATE TABLE readacross.CosmaSubgroupMap
(
    CosmaSubgroupMapId BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CosmaSubgroupMap PRIMARY KEY,
    SiteName           NVARCHAR(128) NOT NULL,
    Subgroup           NVARCHAR(64)  NOT NULL,
    IsActive           BIT           NOT NULL CONSTRAINT DF_CosmaSubgroupMap_IsActive DEFAULT (1),
    UpdatedAtUtc       DATETIME2(0)  NOT NULL CONSTRAINT DF_CosmaSubgroupMap_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_CosmaSubgroupMap_SiteName UNIQUE (SiteName)
);
GO

IF OBJECT_ID('readacross.ArchetypeMfgAllowed', 'U') IS NOT NULL
    DROP TABLE readacross.ArchetypeMfgAllowed;
GO

CREATE TABLE readacross.ArchetypeMfgAllowed
(
    ArchetypeMfgAllowedId BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ArchetypeMfgAllowed PRIMARY KEY,
    ArchetypeKey          NVARCHAR(128) NOT NULL,
    MfgProcess            NVARCHAR(64)  NOT NULL,
    IsActive              BIT           NOT NULL CONSTRAINT DF_ArchetypeMfgAllowed_IsActive DEFAULT (1),
    UpdatedAtUtc          DATETIME2(0)  NOT NULL CONSTRAINT DF_ArchetypeMfgAllowed_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_ArchetypeMfgAllowed UNIQUE (ArchetypeKey, MfgProcess)
);
GO

IF OBJECT_ID('readacross.SpendCategoryMetricMap', 'U') IS NOT NULL
    DROP TABLE readacross.SpendCategoryMetricMap;
GO

CREATE TABLE readacross.SpendCategoryMetricMap
(
    SpendCategoryMetricMapId BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SpendCategoryMetricMap PRIMARY KEY,
    SpendCategory            NVARCHAR(64) NOT NULL,
    MetricKey                NVARCHAR(64) NOT NULL,
    IsActive                 BIT          NOT NULL CONSTRAINT DF_SpendCategoryMetricMap_IsActive DEFAULT (1),
    UpdatedAtUtc             DATETIME2(0) NOT NULL CONSTRAINT DF_SpendCategoryMetricMap_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_SpendCategoryMetricMap UNIQUE (SpendCategory, MetricKey)
);
GO

IF OBJECT_ID('readacross.RecommendationScoring', 'U') IS NOT NULL
    DROP TABLE readacross.RecommendationScoring;
GO

CREATE TABLE readacross.RecommendationScoring
(
    RecommendationScoringId           BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_RecommendationScoring PRIMARY KEY,
    CostBaseTrailingMonths            INT NOT NULL CONSTRAINT DF_RecommendationScoring_CostBaseTrailingMonths DEFAULT (3),
    CostBaseAnnualizationFactor       DECIMAL(18,6) NOT NULL CONSTRAINT DF_RecommendationScoring_CostBaseAnnualizationFactor DEFAULT (12),
    MaxDrilldownItems                 INT NOT NULL CONSTRAINT DF_RecommendationScoring_MaxDrilldownItems DEFAULT (25),
    MaxSiteRecommendations            INT NOT NULL CONSTRAINT DF_RecommendationScoring_MaxSiteRecommendations DEFAULT (3),
    MinPeerSites                      INT NOT NULL CONSTRAINT DF_RecommendationScoring_MinPeerSites DEFAULT (2),
    PeerNrbRelevanceScale             DECIMAL(18,6) NOT NULL CONSTRAINT DF_RecommendationScoring_PeerNrbRelevanceScale DEFAULT (500000),
    OpportunityWhitespaceFactor       DECIMAL(18,6) NOT NULL CONSTRAINT DF_RecommendationScoring_OpportunityWhitespaceFactor DEFAULT (0.6),
    OpportunityUnderrepresentedFactor DECIMAL(18,6) NOT NULL CONSTRAINT DF_RecommendationScoring_OpportunityUnderrepresentedFactor DEFAULT (0.4),
    OpportunityTopPeerMinCount        INT NOT NULL CONSTRAINT DF_RecommendationScoring_OpportunityTopPeerMinCount DEFAULT (3),
    OpportunityTopPeerFraction        DECIMAL(18,6) NOT NULL CONSTRAINT DF_RecommendationScoring_OpportunityTopPeerFraction DEFAULT (0.3),
    BestPeersCount                    INT NOT NULL CONSTRAINT DF_RecommendationScoring_BestPeersCount DEFAULT (5),
    OpportunityWeight                 DECIMAL(18,6) NOT NULL CONSTRAINT DF_RecommendationScoring_OpportunityWeight DEFAULT (0.35),
    PnlRelevanceWeight                DECIMAL(18,6) NOT NULL CONSTRAINT DF_RecommendationScoring_PnlRelevanceWeight DEFAULT (0.2),
    NrbShortfallWeight                DECIMAL(18,6) NOT NULL CONSTRAINT DF_RecommendationScoring_NrbShortfallWeight DEFAULT (0.15),
    ArchetypeMatchWeight              DECIMAL(18,6) NOT NULL CONSTRAINT DF_RecommendationScoring_ArchetypeMatchWeight DEFAULT (0.15),
    RegionMatchWeight                 DECIMAL(18,6) NOT NULL CONSTRAINT DF_RecommendationScoring_RegionMatchWeight DEFAULT (0.1),
    WhitespaceBonusWeight             DECIMAL(18,6) NOT NULL CONSTRAINT DF_RecommendationScoring_WhitespaceBonusWeight DEFAULT (0.05),
    PnlGapScaleFactor                 DECIMAL(18,6) NOT NULL CONSTRAINT DF_RecommendationScoring_PnlGapScaleFactor DEFAULT (5),
    IsActive                          BIT NOT NULL CONSTRAINT DF_RecommendationScoring_IsActive DEFAULT (1),
    UpdatedAtUtc                      DATETIME2(0) NOT NULL CONSTRAINT DF_RecommendationScoring_UpdatedAt DEFAULT (SYSUTCDATETIME())
);
GO

/* ──────────────────────────────────────────────────────────────────────────
   DashboardSnapshots (legacy) — retained for backward compatibility only.
   Runtime config/metadata now uses DashboardMetaSnapshots.
   ────────────────────────────────────────────────────────────────────────── */
IF OBJECT_ID('readacross.DashboardSnapshots', 'U') IS NOT NULL
    DROP TABLE readacross.DashboardSnapshots;
GO

CREATE TABLE readacross.DashboardSnapshots
(
    SnapshotId       BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_DashboardSnapshots PRIMARY KEY,
    SectionKey       NVARCHAR(64)    NOT NULL,
    GeneratedAtUtc   DATETIME2(0)    NOT NULL CONSTRAINT DF_DashboardSnapshots_Gen DEFAULT (SYSUTCDATETIME()),
    SourceFile       NVARCHAR(512)   NULL,
    PayloadJson      NVARCHAR(MAX)   NOT NULL,
    LoadedAtUtc      DATETIME2(0)    NOT NULL CONSTRAINT DF_DashboardSnapshots_Loaded DEFAULT (SYSUTCDATETIME())
);
GO

CREATE INDEX IX_DashboardSnapshots_Section_Generated
    ON readacross.DashboardSnapshots (SectionKey, GeneratedAtUtc DESC);
GO

/* ──────────────────────────────────────────────────────────────────────────
   AccessPolicyAssignments — drives the per-tab access gate enforced by
   `AccessPolicyService` / `[Authorize]` controllers (most importantly the
   P&L Benchmarking endpoints). One row per Azure AD group that has been
   granted any non-default tabs. The Admin group is configured separately
   via `appsettings.json:AccessControl.AdminGroupObjectId` and is not
   stored here. A missing table caused the entire `/api/Pnl/*` surface to
   500 with `Invalid object name 'readacross.AccessPolicyAssignments'`,
   so the schema MUST always create it (even if empty).
   ────────────────────────────────────────────────────────────────────────── */
IF OBJECT_ID('readacross.AccessPolicyAssignments', 'U') IS NOT NULL
    DROP TABLE readacross.AccessPolicyAssignments;
GO

CREATE TABLE readacross.AccessPolicyAssignments
(
    GroupObjectId   NVARCHAR(64)   NOT NULL CONSTRAINT PK_AccessPolicyAssignments PRIMARY KEY,
    DisplayName     NVARCHAR(256)  NOT NULL CONSTRAINT DF_AccessPolicyAssignments_DisplayName DEFAULT (N''),
    AllowedTabsJson NVARCHAR(MAX)  NOT NULL CONSTRAINT DF_AccessPolicyAssignments_AllowedTabs DEFAULT (N'[]'),
    UpdatedBy       NVARCHAR(256)  NOT NULL CONSTRAINT DF_AccessPolicyAssignments_UpdatedBy DEFAULT (N'system'),
    UpdatedAt       DATETIMEOFFSET NOT NULL CONSTRAINT DF_AccessPolicyAssignments_UpdatedAt DEFAULT (SYSDATETIMEOFFSET())
);
GO

PRINT 'Schema readacross created with Pnl/Wave + subgroup/mapping/insights + snapshot + access-policy tables.';
GO
