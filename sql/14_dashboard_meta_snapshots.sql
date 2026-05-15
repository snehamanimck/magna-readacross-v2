SET NOCOUNT ON;
GO

IF OBJECT_ID('readacross.DashboardMetaSnapshots', 'U') IS NULL
BEGIN
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

    CREATE INDEX IX_DashboardMetaSnapshots_Section_Generated
        ON readacross.DashboardMetaSnapshots (SectionKey, GeneratedAtUtc DESC);
END;
GO

IF OBJECT_ID('readacross.DashboardSnapshots', 'U') IS NOT NULL
BEGIN
    INSERT INTO readacross.DashboardMetaSnapshots (SectionKey, GeneratedAtUtc, SourceFile, PayloadJson)
    SELECT s.SectionKey, s.GeneratedAtUtc, s.SourceFile, s.PayloadJson
    FROM readacross.DashboardSnapshots s
    WHERE s.SectionKey IN (
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
    )
      AND NOT EXISTS (
          SELECT 1
          FROM readacross.DashboardMetaSnapshots t
          WHERE t.SectionKey = s.SectionKey
            AND t.GeneratedAtUtc = s.GeneratedAtUtc
      );
END;
GO

PRINT 'DashboardMetaSnapshots ensured and backfilled from DashboardSnapshots.';
GO
