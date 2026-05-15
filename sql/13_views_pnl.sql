SET NOCOUNT ON;
GO

IF OBJECT_ID('readacross.v_PnlSiteMonthlyDerived', 'V') IS NOT NULL
    DROP VIEW readacross.v_PnlSiteMonthlyDerived;
GO
IF OBJECT_ID('readacross.v_PnlSiteMonthlyAccount', 'V') IS NOT NULL
    DROP VIEW readacross.v_PnlSiteMonthlyAccount;
GO
IF OBJECT_ID('readacross.fn_PnlSiteTrailing', 'IF') IS NOT NULL
    DROP FUNCTION readacross.fn_PnlSiteTrailing;
GO

CREATE VIEW readacross.v_PnlSiteMonthlyAccount
AS
SELECT
    Workstream = p.[Cube],
    Site       = p.Entity,
    Region     = COALESCE(dim.Region, p.Parent),
    Archetype  = dim.Archetype,
    Subgroup   = dim.Subgroup,
    InternalKey = pam.InternalKey,
    MonthCode  = p.[Time],
    Amount     = SUM(p.Amount * pam.Sign)
FROM readacross.PnlEntries p
INNER JOIN readacross.PnlAccountMap pam
    ON pam.IsActive = 1
   AND (pam.[Cube] IS NULL OR pam.[Cube] = p.[Cube])
   AND (pam.AccountLabelPattern = p.Account OR pam.AccountKey = p.Account)
LEFT JOIN readacross.PnlSiteDim dim
    ON dim.Entity = p.Entity
WHERE p.HasData = 1
  AND p.Scenario LIKE 'Actual%'
  AND p.[View] = 'Periodic'
GROUP BY
    p.[Cube],
    p.Entity,
    COALESCE(dim.Region, p.Parent),
    dim.Archetype,
    dim.Subgroup,
    pam.InternalKey,
    p.[Time];
GO

CREATE VIEW readacross.v_PnlSiteMonthlyDerived
AS
WITH base AS (
    SELECT Workstream, Site, Region, Archetype, Subgroup, InternalKey, MonthCode, Amount
    FROM readacross.v_PnlSiteMonthlyAccount
),
derived AS (
    SELECT Workstream, Site, Region, Archetype, Subgroup, InternalKey, MonthCode, Amount
    FROM base
    UNION ALL
    SELECT Workstream, Site, Region, Archetype, Subgroup, N'VOH', MonthCode, SUM(Amount)
    FROM base
    WHERE InternalKey IN (N'VOH_variable', N'VOH_fixed')
    GROUP BY Workstream, Site, Region, Archetype, Subgroup, MonthCode
    UNION ALL
    SELECT Workstream, Site, Region, Archetype, Subgroup, N'SGA_total', MonthCode, SUM(Amount)
    FROM base
    WHERE InternalKey IN (N'SGA_fixed', N'SGA_labour')
    GROUP BY Workstream, Site, Region, Archetype, Subgroup, MonthCode
    UNION ALL
    SELECT Workstream, Site, Region, Archetype, Subgroup, N'wages', MonthCode, SUM(Amount)
    FROM base
    WHERE InternalKey IN (N'IDL', N'SGA_fixed', N'SGA_labour')
    GROUP BY Workstream, Site, Region, Archetype, Subgroup, MonthCode
)
SELECT Workstream, Site, Region, Archetype, Subgroup, InternalKey, MonthCode, Amount
FROM derived;
GO

CREATE FUNCTION readacross.fn_PnlSiteTrailing(@months INT = 3)
RETURNS TABLE
AS
RETURN
WITH ranked AS (
    SELECT
        Workstream,
        Site,
        Region,
        Archetype,
        Subgroup,
        InternalKey,
        MonthCode,
        Amount,
        rn = ROW_NUMBER() OVER (
            PARTITION BY Site, InternalKey
            ORDER BY TRY_CONVERT(INT, LEFT(MonthCode, 4)) DESC,
                     TRY_CONVERT(INT, SUBSTRING(MonthCode, 6, 2)) DESC,
                     MonthCode DESC)
    FROM readacross.v_PnlSiteMonthlyDerived
),
windowed AS (
    SELECT *
    FROM ranked
    WHERE rn <= CASE WHEN @months IS NULL OR @months < 1 THEN 3 ELSE @months END
)
SELECT
    Workstream,
    Site,
    Region,
    Archetype,
    Subgroup,
    InternalKey,
    TrailingAvg = AVG(CAST(Amount AS DECIMAL(20,10))),
    MonthsUsed  = COUNT_BIG(*)
FROM windowed
GROUP BY Workstream, Site, Region, Archetype, Subgroup, InternalKey;
GO

PRINT 'P&L views/functions created: v_PnlSiteMonthlyAccount, v_PnlSiteMonthlyDerived, fn_PnlSiteTrailing.';
GO
