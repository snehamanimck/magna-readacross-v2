/*
================================================================================
 Magna Read-Across v2 — Subgroup backfill (idempotent)
--------------------------------------------------------------------------------
 Populates the `Subgroup` column on the three Wave initiative tables when the
 row was loaded without one. The Wave Excel exports do not currently track
subgroup, so we derive it deterministically from `(Site|Division, Workstream)`.

Run this AFTER 03_seed_wave.sql or any `make ingest` reload.
Seed/maintain readacross.SubgroupEntityMap first (see sql/07_seed_subgroup_entity_map.sql).

  Cosma      → lookup in readacross.SubgroupEntityMap (Workstream='Cosma').
  Powertrain → 1) explicit lookup (if maintained in SubgroupEntityMap)
               2) fallback "<APAC|EU|NA> - <Site>" → "PT - <prefix>".
  Exteriors  → 1) explicit lookup (if maintained in SubgroupEntityMap)
               2) fallback "<AP|EU|NA> - <Division>" → "Ext - <prefix>".
  Seating    → 1) explicit lookup (if maintained in SubgroupEntityMap)
               2) fallback "<NA|EU|CN*> - <Site>" → "Seat - <region>".

 Idempotency:
   - Each UPDATE only touches rows whose Subgroup is currently NULL or empty,
     so re-running is a no-op for already-classified rows.
   - To force a full rebuild, run:
       UPDATE readacross.CosmaWaveInitiatives      SET Subgroup = NULL;
       UPDATE readacross.PowertrainWaveInitiatives SET Subgroup = NULL;
       UPDATE readacross.ExteriorsWaveInitiatives  SET Subgroup = NULL;
       UPDATE readacross.SeatingWaveInitiatives    SET Subgroup = NULL;
     before this script.
================================================================================
*/

SET NOCOUNT ON;
GO

IF OBJECT_ID('readacross.SubgroupEntityMap', 'U') IS NULL
BEGIN
    THROW 51000, 'readacross.SubgroupEntityMap not found. Run sql/01_schema.sql first.', 1;
END;
GO

/* ──────────────────────────────────────────────────────────────────────────
   Cosma — explicit lookup from managed mapping table
   ────────────────────────────────────────────────────────────────────────── */
UPDATE c
SET    c.Subgroup = m.Subgroup
FROM   readacross.CosmaWaveInitiatives c
JOIN   readacross.SubgroupEntityMap m
       ON  m.Workstream = N'Cosma'
       AND m.IsActive = 1
       AND m.EntityName = c.Site
WHERE  c.Subgroup IS NULL OR c.Subgroup = N'';

DECLARE @cosmaUpdated INT = @@ROWCOUNT;
PRINT N'Cosma — subgroup backfilled rows: ' + CAST(@cosmaUpdated AS NVARCHAR(16));
GO

/* ──────────────────────────────────────────────────────────────────────────
   Powertrain — explicit map first, then prefix fallback
   ────────────────────────────────────────────────────────────────────────── */
UPDATE p
SET    p.Subgroup = m.Subgroup
FROM   readacross.PowertrainWaveInitiatives p
JOIN   readacross.SubgroupEntityMap m
       ON  m.Workstream = N'Powertrain'
       AND m.IsActive = 1
       AND m.EntityName = p.Site
WHERE  p.Subgroup IS NULL OR p.Subgroup = N'';

DECLARE @ptMapped INT = @@ROWCOUNT;
PRINT N'Powertrain — explicit-map backfilled rows: ' + CAST(@ptMapped AS NVARCHAR(16));
GO

UPDATE p
SET    p.Subgroup =
       N'PT - ' + LEFT(p.Site, CHARINDEX(N' - ', p.Site) - 1)
FROM   readacross.PowertrainWaveInitiatives p
WHERE  (p.Subgroup IS NULL OR p.Subgroup = N'')
  AND  p.Site IS NOT NULL
  AND  CHARINDEX(N' - ', p.Site) > 1
  AND  LEFT(p.Site, CHARINDEX(N' - ', p.Site) - 1) IN (N'APAC', N'EU', N'NA');

DECLARE @ptPrefixed INT = @@ROWCOUNT;
PRINT N'Powertrain — prefix backfilled rows: ' + CAST(@ptPrefixed AS NVARCHAR(16));
GO

/* ──────────────────────────────────────────────────────────────────────────
   Exteriors — explicit map first, then prefix fallback
   ────────────────────────────────────────────────────────────────────────── */
UPDATE e
SET    e.Subgroup = m.Subgroup
FROM   readacross.ExteriorsWaveInitiatives e
JOIN   readacross.SubgroupEntityMap m
       ON  m.Workstream = N'Exteriors'
       AND m.IsActive = 1
       AND m.EntityName = e.Division
WHERE  e.Subgroup IS NULL OR e.Subgroup = N'';

DECLARE @extMapped INT = @@ROWCOUNT;
PRINT N'Exteriors — explicit-map backfilled rows: ' + CAST(@extMapped AS NVARCHAR(16));
GO

UPDATE e
SET    e.Subgroup =
       N'Ext - ' + LEFT(e.Division, CHARINDEX(N' - ', e.Division) - 1)
FROM   readacross.ExteriorsWaveInitiatives e
WHERE  (e.Subgroup IS NULL OR e.Subgroup = N'')
  AND  e.Division IS NOT NULL
  AND  CHARINDEX(N' - ', e.Division) > 1
  AND  LEFT(e.Division, CHARINDEX(N' - ', e.Division) - 1) IN (N'AP', N'EU', N'NA');

DECLARE @extPrefixed INT = @@ROWCOUNT;
PRINT N'Exteriors — prefix backfilled rows: ' + CAST(@extPrefixed AS NVARCHAR(16));
GO

/* ──────────────────────────────────────────────────────────────────────────
   Seating — explicit map first, then prefix fallback (NA / EU / CN*)
   ────────────────────────────────────────────────────────────────────────── */
IF OBJECT_ID('readacross.SeatingWaveInitiatives', 'U') IS NOT NULL
BEGIN
    UPDATE s
    SET    s.Subgroup = m.Subgroup
    FROM   readacross.SeatingWaveInitiatives s
    JOIN   readacross.SubgroupEntityMap m
           ON  m.Workstream = N'Seating'
           AND m.IsActive = 1
           AND m.EntityName = s.Site
    WHERE  s.Subgroup IS NULL OR s.Subgroup = N'';

    DECLARE @seatMapped INT = @@ROWCOUNT;
    PRINT N'Seating — explicit-map backfilled rows: ' + CAST(@seatMapped AS NVARCHAR(16));

    -- Prefix fallback. NA → "Seat - NA", EU → "Seat - EU", CN* → "Seat - CN".
    UPDATE s
    SET    s.Subgroup =
           CASE
               WHEN LEFT(s.Site, CHARINDEX(N' - ', s.Site) - 1) = N'NA' THEN N'Seat - NA'
               WHEN LEFT(s.Site, CHARINDEX(N' - ', s.Site) - 1) = N'EU' THEN N'Seat - EU'
               WHEN LEFT(s.Site, CHARINDEX(N' - ', s.Site) - 1) LIKE N'CN%' THEN N'Seat - CN'
           END
    FROM   readacross.SeatingWaveInitiatives s
    WHERE  (s.Subgroup IS NULL OR s.Subgroup = N'')
      AND  s.Site IS NOT NULL
      AND  CHARINDEX(N' - ', s.Site) > 1
      AND  (
              LEFT(s.Site, CHARINDEX(N' - ', s.Site) - 1) IN (N'NA', N'EU')
           OR LEFT(s.Site, CHARINDEX(N' - ', s.Site) - 1) LIKE N'CN%'
           );

    DECLARE @seatPrefixed INT = @@ROWCOUNT;
    PRINT N'Seating — prefix backfilled rows: ' + CAST(@seatPrefixed AS NVARCHAR(16));
END
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
FROM   readacross.ExteriorsWaveInitiatives
UNION ALL
SELECT 'Seating',
       CASE WHEN OBJECT_ID('readacross.SeatingWaveInitiatives','U') IS NULL THEN 0
            ELSE (SELECT COUNT(*) FROM readacross.SeatingWaveInitiatives) END,
       CASE WHEN OBJECT_ID('readacross.SeatingWaveInitiatives','U') IS NULL THEN 0
            ELSE (SELECT SUM(CASE WHEN Subgroup IS NULL OR Subgroup = N'' THEN 1 ELSE 0 END)
                  FROM readacross.SeatingWaveInitiatives) END,
       CASE WHEN OBJECT_ID('readacross.SeatingWaveInitiatives','U') IS NULL THEN 0
            ELSE (SELECT COUNT(DISTINCT Subgroup) FROM readacross.SeatingWaveInitiatives) END;
GO
