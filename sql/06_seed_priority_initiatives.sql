/*
================================================================================
 Magna Read-Across v2 — PriorityInitiatives demo seed (idempotent)
--------------------------------------------------------------------------------
 The Wave exports do not flag rows as "Best Practice Candidate" or
 "Benchmark Candidate" — that classification lives in offline workshop
 notes. Until the workshop output is integrated, surface a deterministic
 dev-time seed: the top 5 categorized rows by NRB per workstream, labelled
 "Best Practice Candidate". This is enough for the Insights P&L
 Recommendation cards to show the green priority chip and for
 `DashboardChromeService.isPriority(id)` to return true on a real subset.

 Replace this with the real workshop list once available — the API contract
 for `PriorityInitiativeDto` is already production-ready.

 Idempotent: TRUNCATE before INSERT.
================================================================================
*/

SET NOCOUNT ON;
GO

TRUNCATE TABLE readacross.PriorityInitiatives;
GO

/* Cosma top 5 by NRB ──────────────────────────────────────────────────── */
INSERT INTO readacross.PriorityInitiatives (InitiativeId, PriorityLabel, Workstream)
SELECT TOP 5 InitiativeId, N'Best Practice Candidate', N'Cosma'
FROM   readacross.CosmaWaveInitiatives
WHERE  IsCategorized = 1 AND Nrb IS NOT NULL
ORDER  BY Nrb DESC;
GO

/* Powertrain top 5 by NRB ─────────────────────────────────────────────── */
INSERT INTO readacross.PriorityInitiatives (InitiativeId, PriorityLabel, Workstream)
SELECT TOP 5 InitiativeId, N'Best Practice Candidate', N'Powertrain'
FROM   readacross.PowertrainWaveInitiatives
WHERE  IsCategorized = 1 AND Nrb IS NOT NULL
ORDER  BY Nrb DESC;
GO

/* Exteriors top 5 by NRB ──────────────────────────────────────────────── */
INSERT INTO readacross.PriorityInitiatives (InitiativeId, PriorityLabel, Workstream)
SELECT TOP 5 InitiativeId, N'Best Practice Candidate', N'Exteriors'
FROM   readacross.ExteriorsWaveInitiatives
WHERE  IsCategorized = 1 AND Nrb IS NOT NULL
ORDER  BY Nrb DESC;
GO

/* Report ──────────────────────────────────────────────────────────────── */
SELECT Workstream, PriorityLabel, COUNT(*) AS [Count]
FROM   readacross.PriorityInitiatives
GROUP  BY Workstream, PriorityLabel
ORDER  BY Workstream;
GO
