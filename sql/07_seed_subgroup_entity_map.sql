/*
================================================================================
 Magna Read-Across v2 — baseline subgroup entity mapping seed (idempotent)
--------------------------------------------------------------------------------
 Seeds the managed subgroup mapping table used by sql/05_backfill_subgroups.sql.

 This script inserts the legacy Cosma site → subgroup relationships as a
 starting point and does not overwrite existing rows. Teams can then maintain
 this table directly as hierarchy changes occur.
================================================================================
*/

SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
GO

;WITH SeedRows AS
(
    SELECT Workstream, EntityName, Subgroup
    FROM (VALUES
        -- USA East
        (N'Cosma', N'Eagle Bend', N'USA East'),
        (N'Cosma', N'BGM', N'USA East'),
        (N'Cosma', N'Vehtek', N'USA East'),
        (N'Cosma', N'CBAM', N'USA East'),
        (N'Cosma', N'Autolaunch', N'USA East'),

        -- Canada
        (N'Cosma', N'Formet', N'Canada'),
        (N'Cosma', N'Karmax', N'Canada'),
        (N'Cosma', N'Modatek', N'Canada'),
        (N'Cosma', N'Presstran', N'Canada'),
        (N'Cosma', N'MBCM', N'Canada'),
        (N'Cosma', N'P&F', N'Canada'),
        (N'Cosma', N'Deco', N'Canada'),
        (N'Cosma', N'Magna Structures Meadowvale', N'Canada'),

        -- Mexico
        (N'Cosma', N'Formex', N'Mexico'),
        (N'Cosma', N'San Luis Metal Forming', N'Mexico'),
        (N'Cosma', N'Autotek', N'Mexico'),
        (N'Cosma', N'Estampados', N'Mexico'),
        (N'Cosma', N'Sonora', N'Mexico'),
        (N'Cosma', N'CSL', N'Mexico'),

        -- Cosma EU
        (N'Cosma', N'Salzgitter', N'Cosma EU'),
        (N'Cosma', N'Heavy Stamping', N'Cosma EU'),
        (N'Cosma', N'Formpol', N'Cosma EU'),
        (N'Cosma', N'Heiligenstadt', N'Cosma EU'),
        (N'Cosma', N'Cartech', N'Cosma EU'),
        (N'Cosma', N'Spain', N'Cosma EU'),
        (N'Cosma', N'Stity', N'Cosma EU'),
        (N'Cosma', N'Presstec', N'Cosma EU'),
        (N'Cosma', N'MLE', N'Cosma EU'),
        (N'Cosma', N'Hungary', N'Cosma EU'),

        -- Casting and UK
        (N'Cosma', N'BDW Markt Schwaben', N'Casting and UK'),
        (N'Cosma', N'CCUK', N'Casting and UK'),
        (N'Cosma', N'Telford', N'Casting and UK'),
        (N'Cosma', N'Kamtek Casting', N'Casting and UK'),
        (N'Cosma', N'BDW Soest', N'Casting and UK'),
        (N'Cosma', N'CCMi', N'Casting and UK'),
        (N'Cosma', N'Magna Casting Poland', N'Casting and UK'),

        -- USA South
        (N'Cosma', N'Drive', N'USA South'),
        (N'Cosma', N'Kamtek', N'USA South'),

        -- Brazil
        (N'Cosma', N'SJP', N'Brazil'),
        (N'Cosma', N'SAP', N'Brazil'),
        (N'Cosma', N'Joinville', N'Brazil'),
        (N'Cosma', N'Ibirite', N'Brazil'),

        -- Cosma APAC
        (N'Cosma', N'Shanghai', N'Cosma APAC'),
        (N'Cosma', N'Xingqiao', N'Cosma APAC'),
        (N'Cosma', N'Shenyang', N'Cosma APAC'),
        (N'Cosma', N'Changsha', N'Cosma APAC'),
        (N'Cosma', N'Hefei', N'Cosma APAC'),
        (N'Cosma', N'Chongqing', N'Cosma APAC'),
        (N'Cosma', N'Tianjin', N'Cosma APAC'),
        (N'Cosma', N'Guangzhou', N'Cosma APAC'),
        (N'Cosma', N'Changchun', N'Cosma APAC'),
        (N'Cosma', N'Xingqiaorui', N'Cosma APAC'),
        (N'Cosma', N'MPJ', N'Cosma APAC'),

        -- USA West
        (N'Cosma', N'LMV', N'USA West'),
        (N'Cosma', N'MEVS', N'USA West'),
        (N'Cosma', N'Williamsburg', N'USA West')
    ) v(Workstream, EntityName, Subgroup)
)
MERGE readacross.SubgroupEntityMap AS target
USING SeedRows AS source
    ON  target.Workstream = source.Workstream
    AND target.EntityName = source.EntityName
WHEN NOT MATCHED BY TARGET THEN
    INSERT (Workstream, EntityName, Subgroup, IsActive, Notes)
    VALUES (source.Workstream, source.EntityName, source.Subgroup, 1, N'Baseline seed from legacy mapping');
GO

SELECT Workstream,
       COUNT(*) AS MappingRows,
       COUNT(DISTINCT Subgroup) AS DistinctSubgroups
FROM readacross.SubgroupEntityMap
WHERE IsActive = 1
GROUP BY Workstream
ORDER BY Workstream;
GO
