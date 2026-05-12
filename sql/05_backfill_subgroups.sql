/*
================================================================================
 Magna Read-Across v2 — Subgroup backfill (idempotent)
--------------------------------------------------------------------------------
 Populates the `Subgroup` column on the three Wave initiative tables when the
 row was loaded without one. The Wave Excel exports do not currently track
 subgroup, so we derive it deterministically from `(Site, Workstream)` using
 the same mapping the legacy offline dashboard uses
 (`magna-readacross/public/index.html` → `inferGroup`).

 Run this AFTER 03_seed_wave.sql or any `make ingest` reload.

   Cosma     → curated site→subgroup map (USA East / Canada / Mexico /
               Cosma EU / Casting and UK / USA South / Brazil / Cosma APAC /
               USA West).
   Powertrain → site is "<APAC|EU|NA> - <Site>" → "PT - <prefix>".
   Exteriors  → site is "<AP|EU|NA> - <Site>" → "Ext - <prefix>".

 Idempotency:
   - Each UPDATE only touches rows whose Subgroup is currently NULL or empty,
     so re-running is a no-op for already-classified rows.
   - To force a full rebuild, run:
       UPDATE readacross.CosmaWaveInitiatives      SET Subgroup = NULL;
       UPDATE readacross.PowertrainWaveInitiatives SET Subgroup = NULL;
       UPDATE readacross.ExteriorsWaveInitiatives  SET Subgroup = NULL;
     before this script.
================================================================================
*/

SET NOCOUNT ON;
GO

/* ──────────────────────────────────────────────────────────────────────────
   Cosma — explicit site → subgroup map
   ────────────────────────────────────────────────────────────────────────── */
IF OBJECT_ID('tempdb..#CosmaSubgroupMap') IS NOT NULL DROP TABLE #CosmaSubgroupMap;
CREATE TABLE #CosmaSubgroupMap (Site NVARCHAR(128) NOT NULL PRIMARY KEY, Subgroup NVARCHAR(64) NOT NULL);

INSERT INTO #CosmaSubgroupMap (Site, Subgroup) VALUES
    -- USA East
    (N'Eagle Bend', N'USA East'), (N'BGM', N'USA East'), (N'Vehtek', N'USA East'),
    (N'CBAM', N'USA East'), (N'Autolaunch', N'USA East'),
    -- Canada
    (N'Formet', N'Canada'), (N'Karmax', N'Canada'), (N'Modatek', N'Canada'),
    (N'Presstran', N'Canada'), (N'MBCM', N'Canada'), (N'P&F', N'Canada'),
    (N'Deco', N'Canada'), (N'Magna Structures Meadowvale', N'Canada'),
    -- Mexico
    (N'Formex', N'Mexico'), (N'San Luis Metal Forming', N'Mexico'),
    (N'Autotek', N'Mexico'), (N'Estampados', N'Mexico'),
    (N'Sonora', N'Mexico'), (N'CSL', N'Mexico'),
    -- Cosma EU
    (N'Salzgitter', N'Cosma EU'), (N'Heavy Stamping', N'Cosma EU'),
    (N'Formpol', N'Cosma EU'), (N'Heiligenstadt', N'Cosma EU'),
    (N'Cartech', N'Cosma EU'), (N'Spain', N'Cosma EU'), (N'Stity', N'Cosma EU'),
    (N'Presstec', N'Cosma EU'), (N'MLE', N'Cosma EU'), (N'Hungary', N'Cosma EU'),
    -- Casting and UK
    (N'BDW Markt Schwaben', N'Casting and UK'), (N'CCUK', N'Casting and UK'),
    (N'Telford', N'Casting and UK'), (N'Kamtek Casting', N'Casting and UK'),
    (N'BDW Soest', N'Casting and UK'), (N'CCMi', N'Casting and UK'),
    (N'Magna Casting Poland', N'Casting and UK'),
    -- USA South
    (N'Drive', N'USA South'), (N'Kamtek', N'USA South'),
    -- Brazil
    (N'SJP', N'Brazil'), (N'SAP', N'Brazil'),
    (N'Joinville', N'Brazil'), (N'Ibirite', N'Brazil'),
    -- Cosma APAC
    (N'Shanghai', N'Cosma APAC'), (N'Xingqiao', N'Cosma APAC'),
    (N'Shenyang', N'Cosma APAC'), (N'Changsha', N'Cosma APAC'),
    (N'Hefei', N'Cosma APAC'), (N'Chongqing', N'Cosma APAC'),
    (N'Tianjin', N'Cosma APAC'), (N'Guangzhou', N'Cosma APAC'),
    (N'Changchun', N'Cosma APAC'), (N'Xingqiaorui', N'Cosma APAC'),
    (N'MPJ', N'Cosma APAC'),
    -- USA West
    (N'LMV', N'USA West'), (N'MEVS', N'USA West'),
    (N'Williamsburg', N'USA West');
GO

UPDATE c
SET    c.Subgroup = m.Subgroup
FROM   readacross.CosmaWaveInitiatives c
JOIN   #CosmaSubgroupMap m ON m.Site = c.Site
WHERE  c.Subgroup IS NULL OR c.Subgroup = N'';

DECLARE @cosmaUpdated INT = @@ROWCOUNT;
PRINT N'Cosma — subgroup backfilled rows: ' + CAST(@cosmaUpdated AS NVARCHAR(16));
GO

/* ──────────────────────────────────────────────────────────────────────────
   Powertrain — prefix-derived subgroup ("APAC - Foo" → "PT - APAC")
   ────────────────────────────────────────────────────────────────────────── */
UPDATE p
SET    p.Subgroup =
       N'PT - ' + LEFT(p.Site, CHARINDEX(N' - ', p.Site) - 1)
FROM   readacross.PowertrainWaveInitiatives p
WHERE  (p.Subgroup IS NULL OR p.Subgroup = N'')
  AND  p.Site IS NOT NULL
  AND  CHARINDEX(N' - ', p.Site) > 1
  AND  LEFT(p.Site, CHARINDEX(N' - ', p.Site) - 1) IN (N'APAC', N'EU', N'NA');

DECLARE @ptUpdated INT = @@ROWCOUNT;
PRINT N'Powertrain — subgroup backfilled rows: ' + CAST(@ptUpdated AS NVARCHAR(16));
GO

/* ──────────────────────────────────────────────────────────────────────────
   Exteriors — prefix-derived subgroup ("AP - Bar" → "Ext - AP")
   ────────────────────────────────────────────────────────────────────────── */
UPDATE e
SET    e.Subgroup =
       N'Ext - ' + LEFT(e.Division, CHARINDEX(N' - ', e.Division) - 1)
FROM   readacross.ExteriorsWaveInitiatives e
WHERE  (e.Subgroup IS NULL OR e.Subgroup = N'')
  AND  e.Division IS NOT NULL
  AND  CHARINDEX(N' - ', e.Division) > 1
  AND  LEFT(e.Division, CHARINDEX(N' - ', e.Division) - 1) IN (N'AP', N'EU', N'NA');

DECLARE @extUpdated INT = @@ROWCOUNT;
PRINT N'Exteriors — subgroup backfilled rows: ' + CAST(@extUpdated AS NVARCHAR(16));
GO

/* ──────────────────────────────────────────────────────────────────────────
   Coverage report
   ────────────────────────────────────────────────────────────────────────── */
SELECT 'Cosma'      AS Workstream,
       COUNT(*)                                                                  AS Total,
       SUM(CASE WHEN Subgroup IS NULL OR Subgroup = N'' THEN 1 ELSE 0 END)        AS Unmapped,
       COUNT(DISTINCT Subgroup)                                                  AS DistinctSubgroups
FROM   readacross.CosmaWaveInitiatives
UNION ALL
SELECT 'Powertrain', COUNT(*),
       SUM(CASE WHEN Subgroup IS NULL OR Subgroup = N'' THEN 1 ELSE 0 END),
       COUNT(DISTINCT Subgroup)
FROM   readacross.PowertrainWaveInitiatives
UNION ALL
SELECT 'Exteriors',  COUNT(*),
       SUM(CASE WHEN Subgroup IS NULL OR Subgroup = N'' THEN 1 ELSE 0 END),
       COUNT(DISTINCT Subgroup)
FROM   readacross.ExteriorsWaveInitiatives;
GO

DROP TABLE #CosmaSubgroupMap;
GO
