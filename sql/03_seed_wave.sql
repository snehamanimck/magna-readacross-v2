/*
================================================================================
 Seed: Wave initiative tables (Cosma, Powertrain, Exteriors)
 Sample rows representative of the legacy Wave Excel exports.
================================================================================
*/
SET NOCOUNT ON;

DELETE FROM readacross.CosmaWaveInitiatives;
DELETE FROM readacross.PowertrainWaveInitiatives;
DELETE FROM readacross.ExteriorsWaveInitiatives;

/* ── Cosma ─────────────────────────────────────────────────────────────── */
INSERT INTO readacross.CosmaWaveInitiatives
 (InitiativeId, Name, Description, Stage, Access, InitiativeOwner, Site, Subgroup,
  SpendCategory, MfgProcess, Lever, SubLever, Nrb, IsCategorized, Archetypes)
VALUES
 ('CO-1001', 'Robotic weld cell rebalance — Brazil L2',
             'Rebalance robotic weld cells to improve OEE on Class A panels.',
             'L3', 'Open', 'A. Souza', 'Cosma Brazil', 'Cosma LATAM',
             'DL', 'Assembly', '(Automation) Utilization and man-machine ratio', '',
             1250000, 1, 'Framing,Assembly'),
 ('CO-1002', 'Press cycle time reduction — USA East 02',
             'Optimize press tool changeover and cycle time on cold stamp lines.',
             'L4', 'Open', 'M. Patel', 'Cosma USA East', 'Cosma NA',
             'DL', 'Cold stamp', 'Cycle time', '',
             845000, 1, 'Framing'),
 ('CO-1003', 'IDL maintenance crew right-sizing — EU PL01',
             'Re-baseline maintenance headcount to industry benchmark.',
             'L3', 'Open', 'K. Nowak', 'Cosma EU PL01', 'Cosma EU',
             'IDL', '', 'Maintenance', '',
             612000, 1, 'Framing,Large Class A Facilities'),
 ('CO-1004', 'Forklift consolidation — APAC TH01',
             'Reduce powered industrial truck fleet via routing optimization.',
             'L2', 'Open', 'P. Wong', 'Cosma APAC TH01', 'Cosma APAC',
             'Material Conveyance', '', 'Logistics / warehouse', 'Consumption - freight',
             280000, 1, 'Assembly'),
 ('CO-1005', 'VOH energy efficiency — Brazil',
             'Compressed-air leak audit and chiller scheduling optimization.',
             'L3', 'Open', 'R. Santos', 'Cosma Brazil', 'Cosma LATAM',
             'VOH', '', 'Utilities / energy / sustainability', '',
             455000, 1, 'Casting'),
 ('CO-1006', 'Casting OEE step-up — USA East 01',
             'Address top 3 unplanned downtime drivers on hot-form line.',
             'L4', 'Open', 'D. Reed', 'Cosma USA East', 'Cosma NA',
             'DL', 'Casting', 'OEE', '',
             1010000, 1, 'Casting'),
 ('CO-1007', 'Cross-cutting indirect functions consolidation',
             'Consolidate quality + production overhead across NA region.',
             'L2', 'Restricted', 'L. Garcia', 'Cosma USA East', 'Cosma NA',
             'IDL', '', 'Cross-cutting functions', '',
             390000, 1, 'Assembly'),
 ('CO-1008', 'Tooling utilization — APAC',
             'Increase tool runtime via SMED on Class B parts.',
             'L3', 'Open', 'H. Lin', 'Cosma APAC TH01', 'Cosma APAC',
             'DL', 'Hot form', '(Non-automation) Utilization and man-machine ratio', '',
             520000, 1, 'Tooling');

/* ── Powertrain ────────────────────────────────────────────────────────── */
INSERT INTO readacross.PowertrainWaveInitiatives
 (InitiativeId, Name, Description, Stage, Access, InitiativeOwner, Site, Subgroup,
  SpendCategory, MfgProcess, Lever, SubLever, Nrb, IsCategorized)
VALUES
 ('PT-2001', 'AC01 e-axle line OEE improvement',
             'Address top downtime drivers on e-axle assembly cell.',
             'L4', 'Open', 'B. Schmidt', 'PT AC01', 'PT - NA',
             'DL', 'Assembly', 'OEE', '',
             1820000, 1),
 ('PT-2002', 'DE03 maintenance contractor reduction',
             'In-source select maintenance scopes; reduce contractor spend.',
             'L3', 'Open', 'F. Becker', 'PT DE03', 'PT - EU',
             'IDL', '', 'Contractors / consultants', '',
             710000, 1),
 ('PT-2003', 'CN05 logistics route optimization',
             'Re-bid LTL lanes; consolidate cross-docks for inbound.',
             'L2', 'Open', 'Q. Zhao', 'PT CN05', 'PT - APAC',
             'Material Conveyance', '', '(Non automation) route/payload optimization', '',
             340000, 1),
 ('PT-2004', 'AC01 utilities — chiller staging',
             'Sequence chiller plants to load profile.',
             'L3', 'Open', 'B. Schmidt', 'PT AC01', 'PT - NA',
             'VOH', '', 'Utilities / energy / sustainability', '',
             265000, 1);

/* ── Exteriors ─────────────────────────────────────────────────────────── */
INSERT INTO readacross.ExteriorsWaveInitiatives
 (InitiativeId, Name, Description, Stage, Access, InitiativeOwner, Division, Subgroup,
  SpendCategory, MfgProcess, Lever, SubLever, Nrb, IsCategorized)
VALUES
 ('EX-3001', 'Troy paint line cycle time',
             'Reduce flash time and bake duration on bumper paint line.',
             'L4', 'Open', 'J. Hayes', 'Troy USA', 'Ext - NA',
             'DL', 'E-coat', 'Cycle time', '',
             980000, 1),
 ('EX-3002', 'Bremen IDL planner consolidation',
             'Combine production planning across two adjacent cells.',
             'L3', 'Open', 'S. Müller', 'Bremen DE', 'Ext - EU',
             'IDL', '', 'Production overhead (e.g., supervisor, team lead, planner)', '',
             420000, 1),
 ('EX-3003', 'Shanghai material handling',
             'Replace manual handling with AGV on injection molding output.',
             'L2', 'Open', 'Y. Chen', 'Shanghai CN', 'Ext - AP',
             'Material Conveyance', '', 'Logistics / warehouse', '',
             310000, 1),
 ('EX-3004', 'Troy automation utilization step-up',
             'Increase robot utilization on assembly cell via re-programming.',
             'L3', 'Open', 'J. Hayes', 'Troy USA', 'Ext - NA',
             'DL', 'Assembly', '(Automation) Utilization and man-machine ratio', '',
             750000, 1);

DECLARE @cosmaRows INT = (SELECT COUNT(*) FROM readacross.CosmaWaveInitiatives);
DECLARE @ptRows INT = (SELECT COUNT(*) FROM readacross.PowertrainWaveInitiatives);
DECLARE @extRows INT = (SELECT COUNT(*) FROM readacross.ExteriorsWaveInitiatives);

PRINT CONCAT('Cosma rows: ', @cosmaRows);
PRINT CONCAT('Powertrain rows: ', @ptRows);
PRINT CONCAT('Exteriors rows: ', @extRows);
GO
