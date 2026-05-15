SET NOCOUNT ON;
GO

IF OBJECT_ID('readacross.MagnaDivisionAliases', 'U') IS NULL
BEGIN
    CREATE TABLE readacross.MagnaDivisionAliases
    (
        MagnaDivisionAliasId BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_MagnaDivisionAliases PRIMARY KEY,
        MagnaDivision        NVARCHAR(64) NOT NULL,
        DivisionAlias        NVARCHAR(64) NOT NULL,
        IsActive             BIT          NOT NULL CONSTRAINT DF_MagnaDivisionAliases_IsActive DEFAULT (1),
        UpdatedAtUtc         DATETIME2(0) NOT NULL CONSTRAINT DF_MagnaDivisionAliases_UpdatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT UQ_MagnaDivisionAliases_MagnaDivision UNIQUE (MagnaDivision)
    );
END;
GO

IF OBJECT_ID('readacross.MagnaDivisionAliases', 'U') IS NOT NULL
   AND COL_LENGTH('readacross.MagnaDivisionAliases', 'WorkstreamName') IS NOT NULL
BEGIN
    EXEC sp_rename 'readacross.MagnaDivisionAliases.WorkstreamName', 'MagnaDivision', 'COLUMN';
END;
GO

IF OBJECT_ID('readacross.MagnaDivisionAliases', 'U') IS NOT NULL
   AND COL_LENGTH('readacross.MagnaDivisionAliases', 'Slug') IS NOT NULL
BEGIN
    EXEC sp_rename 'readacross.MagnaDivisionAliases.Slug', 'DivisionAlias', 'COLUMN';
END;
GO

IF OBJECT_ID('readacross.CosmaSubgroupMap', 'U') IS NULL
BEGIN
    CREATE TABLE readacross.CosmaSubgroupMap
    (
        CosmaSubgroupMapId BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CosmaSubgroupMap PRIMARY KEY,
        SiteName           NVARCHAR(128) NOT NULL,
        Subgroup           NVARCHAR(64)  NOT NULL,
        IsActive           BIT           NOT NULL CONSTRAINT DF_CosmaSubgroupMap_IsActive DEFAULT (1),
        UpdatedAtUtc       DATETIME2(0)  NOT NULL CONSTRAINT DF_CosmaSubgroupMap_UpdatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT UQ_CosmaSubgroupMap_SiteName UNIQUE (SiteName)
    );
END;
GO

IF OBJECT_ID('readacross.ArchetypeMfgAllowed', 'U') IS NULL
BEGIN
    CREATE TABLE readacross.ArchetypeMfgAllowed
    (
        ArchetypeMfgAllowedId BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ArchetypeMfgAllowed PRIMARY KEY,
        ArchetypeKey          NVARCHAR(128) NOT NULL,
        MfgProcess            NVARCHAR(64)  NOT NULL,
        IsActive              BIT           NOT NULL CONSTRAINT DF_ArchetypeMfgAllowed_IsActive DEFAULT (1),
        UpdatedAtUtc          DATETIME2(0)  NOT NULL CONSTRAINT DF_ArchetypeMfgAllowed_UpdatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT UQ_ArchetypeMfgAllowed UNIQUE (ArchetypeKey, MfgProcess)
    );
END;
GO

IF OBJECT_ID('readacross.SpendCategoryMetricMap', 'U') IS NULL
BEGIN
    CREATE TABLE readacross.SpendCategoryMetricMap
    (
        SpendCategoryMetricMapId BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SpendCategoryMetricMap PRIMARY KEY,
        SpendCategory            NVARCHAR(64) NOT NULL,
        MetricKey                NVARCHAR(64) NOT NULL,
        IsActive                 BIT          NOT NULL CONSTRAINT DF_SpendCategoryMetricMap_IsActive DEFAULT (1),
        UpdatedAtUtc             DATETIME2(0) NOT NULL CONSTRAINT DF_SpendCategoryMetricMap_UpdatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT UQ_SpendCategoryMetricMap UNIQUE (SpendCategory, MetricKey)
    );
END;
GO

IF OBJECT_ID('readacross.RecommendationScoring', 'U') IS NULL
BEGIN
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
END;
GO

-- Backfill renamed tables from legacy UiRuntime* names when present.
IF OBJECT_ID('readacross.UiRuntimeWorkstreamSlugs', 'U') IS NOT NULL
BEGIN
    INSERT INTO readacross.MagnaDivisionAliases (MagnaDivision, DivisionAlias, IsActive, UpdatedAtUtc)
    SELECT s.WorkstreamName, s.Slug, s.IsActive, s.UpdatedAtUtc
    FROM readacross.UiRuntimeWorkstreamSlugs s
    WHERE NOT EXISTS (
        SELECT 1 FROM readacross.MagnaDivisionAliases t
        WHERE t.MagnaDivision = s.WorkstreamName
    );
END;
GO

IF OBJECT_ID('readacross.UiRuntimeCosmaSubgroupMap', 'U') IS NOT NULL
BEGIN
    INSERT INTO readacross.CosmaSubgroupMap (SiteName, Subgroup, IsActive, UpdatedAtUtc)
    SELECT s.SiteName, s.Subgroup, s.IsActive, s.UpdatedAtUtc
    FROM readacross.UiRuntimeCosmaSubgroupMap s
    WHERE NOT EXISTS (
        SELECT 1 FROM readacross.CosmaSubgroupMap t
        WHERE t.SiteName = s.SiteName
    );
END;
GO

IF OBJECT_ID('readacross.UiRuntimeArchetypeMfgAllowed', 'U') IS NOT NULL
BEGIN
    INSERT INTO readacross.ArchetypeMfgAllowed (ArchetypeKey, MfgProcess, IsActive, UpdatedAtUtc)
    SELECT s.ArchetypeKey, s.MfgProcess, s.IsActive, s.UpdatedAtUtc
    FROM readacross.UiRuntimeArchetypeMfgAllowed s
    WHERE NOT EXISTS (
        SELECT 1 FROM readacross.ArchetypeMfgAllowed t
        WHERE t.ArchetypeKey = s.ArchetypeKey AND t.MfgProcess = s.MfgProcess
    );
END;
GO

IF OBJECT_ID('readacross.UiRuntimeSpendCategoryMetricMap', 'U') IS NOT NULL
BEGIN
    INSERT INTO readacross.SpendCategoryMetricMap (SpendCategory, MetricKey, IsActive, UpdatedAtUtc)
    SELECT s.SpendCategory, s.MetricKey, s.IsActive, s.UpdatedAtUtc
    FROM readacross.UiRuntimeSpendCategoryMetricMap s
    WHERE NOT EXISTS (
        SELECT 1 FROM readacross.SpendCategoryMetricMap t
        WHERE t.SpendCategory = s.SpendCategory AND t.MetricKey = s.MetricKey
    );
END;
GO

IF OBJECT_ID('readacross.UiRuntimeScoring', 'U') IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM readacross.RecommendationScoring)
BEGIN
    INSERT INTO readacross.RecommendationScoring
    (
        CostBaseTrailingMonths,
        CostBaseAnnualizationFactor,
        MaxDrilldownItems,
        MaxSiteRecommendations,
        MinPeerSites,
        PeerNrbRelevanceScale,
        OpportunityWhitespaceFactor,
        OpportunityUnderrepresentedFactor,
        OpportunityTopPeerMinCount,
        OpportunityTopPeerFraction,
        BestPeersCount,
        OpportunityWeight,
        PnlRelevanceWeight,
        NrbShortfallWeight,
        ArchetypeMatchWeight,
        RegionMatchWeight,
        WhitespaceBonusWeight,
        PnlGapScaleFactor,
        IsActive,
        UpdatedAtUtc
    )
    SELECT
        s.CostBaseTrailingMonths,
        s.CostBaseAnnualizationFactor,
        s.MaxDrilldownItems,
        s.MaxSiteRecommendations,
        s.MinPeerSites,
        s.PeerNrbRelevanceScale,
        s.OpportunityWhitespaceFactor,
        s.OpportunityUnderrepresentedFactor,
        s.OpportunityTopPeerMinCount,
        s.OpportunityTopPeerFraction,
        s.BestPeersCount,
        s.OpportunityWeight,
        s.PnlRelevanceWeight,
        s.NrbShortfallWeight,
        s.ArchetypeMatchWeight,
        s.RegionMatchWeight,
        s.WhitespaceBonusWeight,
        s.PnlGapScaleFactor,
        s.IsActive,
        s.UpdatedAtUtc
    FROM readacross.UiRuntimeScoring s;
END;
GO

-- Drop legacy runtime tables after successful backfill so only the
-- canonical table names remain visible/maintainable.
IF OBJECT_ID('readacross.UiRuntimeWorkstreamSlugs', 'U') IS NOT NULL
    DROP TABLE readacross.UiRuntimeWorkstreamSlugs;
GO

IF OBJECT_ID('readacross.UiRuntimeCosmaSubgroupMap', 'U') IS NOT NULL
    DROP TABLE readacross.UiRuntimeCosmaSubgroupMap;
GO

IF OBJECT_ID('readacross.UiRuntimeArchetypeMfgAllowed', 'U') IS NOT NULL
    DROP TABLE readacross.UiRuntimeArchetypeMfgAllowed;
GO

IF OBJECT_ID('readacross.UiRuntimeSpendCategoryMetricMap', 'U') IS NOT NULL
    DROP TABLE readacross.UiRuntimeSpendCategoryMetricMap;
GO

IF OBJECT_ID('readacross.UiRuntimeScoring', 'U') IS NOT NULL
    DROP TABLE readacross.UiRuntimeScoring;
GO

PRINT 'Runtime mapping/scoring tables ensured, backfilled, and legacy UiRuntime* tables removed.';
GO
