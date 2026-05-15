SET NOCOUNT ON;
GO

/* ──────────────────────────────────────────────────────────────────────────
   P&L calculation support schema
   ────────────────────────────────────────────────────────────────────────── */

IF OBJECT_ID('readacross.PnlAccountMap', 'U') IS NULL
BEGIN
    CREATE TABLE readacross.PnlAccountMap
    (
        PnlAccountMapId     BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_PnlAccountMap PRIMARY KEY,
        Cube                NVARCHAR(64)   NULL,
        AccountKey          NVARCHAR(64)   NOT NULL,
        AccountLabelPattern NVARCHAR(128)  NOT NULL,
        InternalKey         NVARCHAR(64)   NOT NULL,
        Sign                SMALLINT       NOT NULL CONSTRAINT DF_PnlAccountMap_Sign DEFAULT (1),
        IsActive            BIT            NOT NULL CONSTRAINT DF_PnlAccountMap_IsActive DEFAULT (1),
        UpdatedAtUtc        DATETIME2(0)   NOT NULL CONSTRAINT DF_PnlAccountMap_UpdatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT UQ_PnlAccountMap UNIQUE (Cube, AccountKey, InternalKey)
    );
END;
GO

IF OBJECT_ID('readacross.PnlSiteDim', 'U') IS NULL
BEGIN
    CREATE TABLE readacross.PnlSiteDim
    (
        PnlSiteDimId      BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_PnlSiteDim PRIMARY KEY,
        Entity            NVARCHAR(128) NOT NULL,
        DisplayName       NVARCHAR(128) NULL,
        Workstream        NVARCHAR(64)  NOT NULL,
        Region            NVARCHAR(128) NULL,
        Archetype         NVARCHAR(128) NULL,
        Subgroup          NVARCHAR(64)  NULL,
        IsAnchorEligible  BIT           NOT NULL CONSTRAINT DF_PnlSiteDim_IsAnchorEligible DEFAULT (1),
        UpdatedAtUtc      DATETIME2(0)  NOT NULL CONSTRAINT DF_PnlSiteDim_UpdatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT UQ_PnlSiteDim_Entity UNIQUE (Entity)
    );

    CREATE INDEX IX_PnlSiteDim_Workstream ON readacross.PnlSiteDim (Workstream);
END;
GO

IF OBJECT_ID('readacross.PnlSiteBenchmarks', 'U') IS NULL
BEGIN
    CREATE TABLE readacross.PnlSiteBenchmarks
    (
        PnlSiteBenchmarkId          BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_PnlSiteBenchmarks PRIMARY KEY,
        Site                        NVARCHAR(128) NOT NULL,
        MetricKey                   NVARCHAR(64)  NOT NULL,
        SiteValue                   DECIMAL(20,10) NULL,
        BestCosma                   DECIMAL(20,10) NULL,
        BestArchetype               DECIMAL(20,10) NULL,
        BestSubgroup                DECIMAL(20,10) NULL,
        OppVsCosma                  DECIMAL(20,2)  NULL,
        OppVsArchetype              DECIMAL(20,2)  NULL,
        OppVsSubgroup               DECIMAL(20,2)  NULL,
        Trailing3mProductionRevenue DECIMAL(20,4)  NULL,
        AnchorCosma                 NVARCHAR(128)  NULL,
        AnchorArchetype             NVARCHAR(128)  NULL,
        AnchorSubgroup              NVARCHAR(128)  NULL,
        ComputedAtUtc               DATETIME2(0)   NOT NULL CONSTRAINT DF_PnlSiteBenchmarks_Computed DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT UQ_PnlSiteBenchmarks_Site_Metric UNIQUE (Site, MetricKey)
    );

    CREATE INDEX IX_PnlSiteBenchmarks_Metric ON readacross.PnlSiteBenchmarks (MetricKey);
END;
GO

IF OBJECT_ID('readacross.PnlAnchors', 'U') IS NULL
BEGIN
    CREATE TABLE readacross.PnlAnchors
    (
        PnlAnchorId      BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_PnlAnchors PRIMARY KEY,
        ScopeKind        NVARCHAR(32)  NOT NULL,
        ScopeValue       NVARCHAR(128) NOT NULL,
        MetricKey        NVARCHAR(64)  NOT NULL,
        AnchorEntity     NVARCHAR(128) NOT NULL,
        AnchorValue      DECIMAL(20,10) NULL,
        ComputedAtUtc    DATETIME2(0)   NOT NULL CONSTRAINT DF_PnlAnchors_Computed DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT UQ_PnlAnchors_Scope_Metric UNIQUE (ScopeKind, ScopeValue, MetricKey)
    );

    CREATE INDEX IX_PnlAnchors_Entity ON readacross.PnlAnchors (AnchorEntity);
END;
GO

IF OBJECT_ID('readacross.PnlRankings', 'U') IS NULL
BEGIN
    CREATE TABLE readacross.PnlRankings
    (
        PnlRankingId     BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_PnlRankings PRIMARY KEY,
        ScopeKind        NVARCHAR(32)  NOT NULL,
        ScopeValue       NVARCHAR(128) NOT NULL,
        MetricKey        NVARCHAR(64)  NOT NULL,
        Rank             INT           NOT NULL,
        Entity           NVARCHAR(128) NOT NULL,
        Value            DECIMAL(20,10) NULL,
        ComputedAtUtc    DATETIME2(0)  NOT NULL CONSTRAINT DF_PnlRankings_Computed DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT UQ_PnlRankings_Scope_Metric_Rank UNIQUE (ScopeKind, ScopeValue, MetricKey, Rank),
        CONSTRAINT UQ_PnlRankings_Scope_Metric_Entity UNIQUE (ScopeKind, ScopeValue, MetricKey, Entity)
    );

    CREATE INDEX IX_PnlRankings_Entity ON readacross.PnlRankings (Entity);
END;
GO

/* ──────────────────────────────────────────────────────────────────────────
   Enrich PnlRecommendations to hold full legacy recommendation payload
   ────────────────────────────────────────────────────────────────────────── */
IF COL_LENGTH('readacross.PnlRecommendations', 'SpendCategory') IS NULL
    ALTER TABLE readacross.PnlRecommendations ADD SpendCategory NVARCHAR(64) NULL;
IF COL_LENGTH('readacross.PnlRecommendations', 'PrimaryDriver') IS NULL
    ALTER TABLE readacross.PnlRecommendations ADD PrimaryDriver NVARCHAR(64) NULL;
IF COL_LENGTH('readacross.PnlRecommendations', 'SiteValue') IS NULL
    ALTER TABLE readacross.PnlRecommendations ADD SiteValue DECIMAL(20,6) NULL;
IF COL_LENGTH('readacross.PnlRecommendations', 'BenchmarkMedian') IS NULL
    ALTER TABLE readacross.PnlRecommendations ADD BenchmarkMedian DECIMAL(20,6) NULL;
IF COL_LENGTH('readacross.PnlRecommendations', 'Quartile') IS NULL
    ALTER TABLE readacross.PnlRecommendations ADD Quartile TINYINT NULL;
IF COL_LENGTH('readacross.PnlRecommendations', 'WhitespaceEstimate') IS NULL
    ALTER TABLE readacross.PnlRecommendations ADD WhitespaceEstimate DECIMAL(20,2) NULL;
IF COL_LENGTH('readacross.PnlRecommendations', 'DeploymentCount') IS NULL
    ALTER TABLE readacross.PnlRecommendations ADD DeploymentCount INT NULL;
IF COL_LENGTH('readacross.PnlRecommendations', 'DeployingDivisions') IS NULL
    ALTER TABLE readacross.PnlRecommendations ADD DeployingDivisions NVARCHAR(MAX) NULL;
IF COL_LENGTH('readacross.PnlRecommendations', 'AnchorMatch') IS NULL
    ALTER TABLE readacross.PnlRecommendations ADD AnchorMatch NVARCHAR(64) NULL;
IF COL_LENGTH('readacross.PnlRecommendations', 'PriorityCount') IS NULL
    ALTER TABLE readacross.PnlRecommendations ADD PriorityCount INT NULL;
IF COL_LENGTH('readacross.PnlRecommendations', 'PriorityFraction') IS NULL
    ALTER TABLE readacross.PnlRecommendations ADD PriorityFraction DECIMAL(6,4) NULL;
IF COL_LENGTH('readacross.PnlRecommendations', 'EvidenceStrength') IS NULL
    ALTER TABLE readacross.PnlRecommendations ADD EvidenceStrength NVARCHAR(16) NULL;
IF COL_LENGTH('readacross.PnlRecommendations', 'Confidence') IS NULL
    ALTER TABLE readacross.PnlRecommendations ADD Confidence DECIMAL(6,4) NULL;
IF COL_LENGTH('readacross.PnlRecommendations', 'Rationale') IS NULL
    ALTER TABLE readacross.PnlRecommendations ADD Rationale NVARCHAR(MAX) NULL;
IF COL_LENGTH('readacross.PnlRecommendations', 'ComputedAtUtc') IS NULL
    ALTER TABLE readacross.PnlRecommendations
        ADD ComputedAtUtc DATETIME2(0) NOT NULL CONSTRAINT DF_PnlRecommendations_ComputedAt DEFAULT (SYSUTCDATETIME());
GO

/* ──────────────────────────────────────────────────────────────────────────
   Seed default account mapping rows (idempotent)
   ────────────────────────────────────────────────────────────────────────── */
MERGE readacross.PnlAccountMap AS tgt
USING (VALUES
    (NULL, N'DL',             N'Direct Labor (DL)',          N'DL',               CAST(1 AS SMALLINT)),
    (NULL, N'IDL',            N'Indirect Labor (IDL)',       N'IDL',              CAST(1 AS SMALLINT)),
    (NULL, N'VOH',            N'Variable Overhead (VOH)',    N'VOH_variable',     CAST(1 AS SMALLINT)),
    (NULL, N'VOH_FIXED',      N'Fixed Overhead (FOH)',       N'VOH_fixed',        CAST(1 AS SMALLINT)),
    (NULL, N'MATERIALS',      N'Production Materials',       N'materials',        CAST(1 AS SMALLINT)),
    (NULL, N'MC',             N'Material Conveyance (MC)',   N'MC',               CAST(1 AS SMALLINT)),
    (NULL, N'SALES_TOTAL',    N'Total Sales',                N'revenue',          CAST(1 AS SMALLINT)),
    (NULL, N'SALES_PROD',     N'Production Sales',           N'production_sales', CAST(1 AS SMALLINT)),
    (NULL, N'EBITDA',         N'EBITDA',                     N'EBITDA',           CAST(1 AS SMALLINT)),
    (NULL, N'EBIT',           N'EBIT',                       N'EBIT',             CAST(1 AS SMALLINT)),
    (NULL, N'SCRAP',          N'Scrap (303122)',             N'scrap_expense',    CAST(1 AS SMALLINT)),
    (NULL, N'DL_HC',          N'DL Headcount',               N'DL_HC',            CAST(1 AS SMALLINT)),
    (NULL, N'IDL_HC',         N'IDL Headcount',              N'IDL_HC',           CAST(1 AS SMALLINT)),
    (NULL, N'SGA_HC',         N'SGA Headcount',              N'SGA_HC',           CAST(1 AS SMALLINT)),
    (NULL, N'TOTAL_HC',       N'Total Headcount',            N'total_HC',         CAST(1 AS SMALLINT)),
    (NULL, N'TEMP_HC',        N'Temp Headcount',             N'temp_HC',          CAST(1 AS SMALLINT))
) AS src (Cube, AccountKey, AccountLabelPattern, InternalKey, Sign)
ON tgt.Cube = src.Cube AND tgt.AccountKey = src.AccountKey AND tgt.InternalKey = src.InternalKey
WHEN NOT MATCHED THEN
    INSERT (Cube, AccountKey, AccountLabelPattern, InternalKey, Sign, IsActive)
    VALUES (src.Cube, src.AccountKey, src.AccountLabelPattern, src.InternalKey, src.Sign, 1);
GO

PRINT 'P&L calc support schema ensured (account map/site dim/benchmarks/anchors/rankings).';
GO

/* One-time cleanup: P&L blocks are now served from SQL tables, not snapshot JSON. */
DELETE FROM readacross.DashboardSnapshots
WHERE SectionKey IN ('pnl_benchmarking', 'pnl_peer_summary', 'pnl_recommendations', 'pnl_rec_dl_mfg_policy');
GO
