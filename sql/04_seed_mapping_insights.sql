/*
================================================================================
 Seed: mapping + insights support tables
================================================================================
*/
SET NOCOUNT ON;

DELETE FROM readacross.VideoLibraryAssets;
DELETE FROM readacross.KnowledgeCenterAssets;
DELETE FROM readacross.PnlRecommendations;
DELETE FROM readacross.ThoughtStarters;
DELETE FROM readacross.PriorityInitiatives;
DELETE FROM readacross.SiteArchetypes;
DELETE FROM readacross.ArchetypeDefinitions;

/* ── Archetypes and site mappings ───────────────────────────────────────── */
INSERT INTO readacross.ArchetypeDefinitions (ArchetypeKey, DisplayName, Workstream, [Description])
VALUES
('Framing', 'Framing', 'Cosma', 'High automation and BIW framing footprint'),
('Assembly', 'Assembly', 'Cosma', 'Final assembly-heavy operating model'),
('Casting', 'Casting', 'Cosma', 'Casting and foundry-centric operations'),
('Tooling', 'Tooling', 'Cosma', 'Tool and die intensive operations'),
('LargeClassA', 'Large Class A Facilities', 'Cosma', 'Large footprint Class A facilities');

INSERT INTO readacross.SiteArchetypes (SiteName, ArchetypeKey, Workstream)
VALUES
('Cosma Brazil', 'Casting', 'Cosma'),
('Cosma USA East', 'Framing', 'Cosma'),
('Cosma USA East', 'Assembly', 'Cosma'),
('Cosma EU PL01', 'LargeClassA', 'Cosma'),
('Cosma APAC TH01', 'Tooling', 'Cosma');

INSERT INTO readacross.PriorityInitiatives (InitiativeId, PriorityLabel, Workstream)
VALUES
('CO-1001', 'Best Practice Candidate', 'Cosma'),
('CO-1006', 'Best Practice Candidate', 'Cosma'),
('PT-2001', 'Benchmark Candidate', 'Powertrain'),
('EX-3001', 'Benchmark Candidate', 'Exteriors');

/* ── Thought starters ───────────────────────────────────────────────────── */
INSERT INTO readacross.ThoughtStarters
(SpendCategory, MfgProcess, Lever, SubLever, [Text], AdvancedAutomation, SortOrder)
VALUES
('DL', 'Assembly', '(Automation) Utilization and man-machine ratio', '',
 'What would it take to increase robot utilization by 10 points in the top downtime cell?', 1, 10),
('DL', 'Cold stamp', 'Cycle time', '',
 'Can we isolate the top three micro-stoppage causes and run a 30-day Kaizen sprint?', 0, 20),
('IDL', '', 'Maintenance', '',
 'Where can predictive maintenance reduce emergency labor and contractor dependency?', 0, 30),
('Material Conveyance', '', 'Logistics / warehouse', 'Consumption - freight',
 'Could we consolidate inbound lanes and redesign milk-runs to reduce touches per part?', 0, 40),
('VOH', '', 'Utilities / energy / sustainability', '',
 'Which two utility systems have the fastest payback from controls optimization?', 0, 50);

/* ── P&L recommendations ────────────────────────────────────────────────── */
INSERT INTO readacross.PnlRecommendations
(Workstream, Site, Archetype, InitiativeId, RecommendationText, OpportunityAmount, PriorityRank)
VALUES
('Cosma', 'Cosma USA East', 'Framing', 'CO-1006',
 'Scale casting OEE playbook from top-performing line and enforce downtime pareto rituals.', 1250000, 1),
('Cosma', 'Cosma USA East', 'Assembly', 'CO-1002',
 'Accelerate press cycle-time reduction using single-minute exchange of die routines.', 845000, 2),
('Cosma', 'Cosma Brazil', 'Casting', 'CO-1001',
 'Replicate robotic cell rebalance standard work and increase automation uptime.', 980000, 1),
('Powertrain', 'PT AC01', NULL, 'PT-2001',
 'Institutionalize OEE control tower with shift-level escalation for top losses.', 1820000, 1),
('Exteriors', 'Troy USA', NULL, 'EX-3001',
 'Deploy paint-line takt balancing and thermal profile optimization.', 980000, 1);

/* ── Knowledge center assets ────────────────────────────────────────────── */
INSERT INTO readacross.KnowledgeCenterAssets
(Title, SpendCategory, Workstream, [Description], SlideUrl, ThumbnailUrl, SortOrder)
VALUES
('DL Automation Playbook', 'DL', 'Cosma',
 'Reference deck on automation utilization levers and deployment sequencing.',
 'https://example.com/knowledge/dl-automation-playbook.pdf',
 'https://example.com/knowledge/thumbs/dl-automation.png', 10),
('Material Flow Benchmarking Guide', 'Material Conveyance', 'Powertrain',
 'Warehouse and line-feeding benchmark methods for throughput and cost.',
 'https://example.com/knowledge/material-flow-guide.pdf',
 'https://example.com/knowledge/thumbs/material-flow.png', 20),
('VOH Energy Optimization Toolkit', 'VOH', 'Exteriors',
 'Utility load-shaping and compressed-air optimization quick wins.',
 'https://example.com/knowledge/voh-energy-toolkit.pdf',
 'https://example.com/knowledge/thumbs/voh-energy.png', 30);

/* ── Video library assets ───────────────────────────────────────────────── */
INSERT INTO readacross.VideoLibraryAssets
(Title, SpendCategory, Workstream, [Description], VideoUrl, ThumbnailUrl, DurationSeconds, SortOrder)
VALUES
('Robotic Weld Cell Rebalance Walkthrough', 'DL', 'Cosma',
 'Step-by-step execution walkthrough from baseline to stabilized output.',
 'https://example.com/videos/robotic-weld-rebalance.mp4',
 'https://example.com/videos/thumbs/robotic-weld-rebalance.png', 540, 10),
('Press Changeover SMED Sprint', 'DL', 'Cosma',
 'How to run a rapid SMED event in stamping operations.',
 'https://example.com/videos/press-smed-sprint.mp4',
 'https://example.com/videos/thumbs/press-smed.png', 420, 20),
('Utilities Chiller Sequencing', 'VOH', 'Powertrain',
 'Practical controls tuning for chilled-water load balancing.',
 'https://example.com/videos/chiller-sequencing.mp4',
 'https://example.com/videos/thumbs/chiller-sequencing.png', 360, 30);

DECLARE @ts INT = (SELECT COUNT(*) FROM readacross.ThoughtStarters);
DECLARE @recs INT = (SELECT COUNT(*) FROM readacross.PnlRecommendations);
DECLARE @kc INT = (SELECT COUNT(*) FROM readacross.KnowledgeCenterAssets);
DECLARE @vid INT = (SELECT COUNT(*) FROM readacross.VideoLibraryAssets);

PRINT CONCAT('ThoughtStarters rows: ', @ts);
PRINT CONCAT('PnlRecommendations rows: ', @recs);
PRINT CONCAT('KnowledgeCenterAssets rows: ', @kc);
PRINT CONCAT('VideoLibraryAssets rows: ', @vid);
GO
