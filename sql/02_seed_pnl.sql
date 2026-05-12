/*
================================================================================
 Seed: P&L cube fact rows
 Mirrors the sample row format:
   Cube=Cosma | Entity=COSMABRAZILIUM | Cons=USD | Scenario=Budget26
   Time=2025M1 | View=Periodic | Account=Top | UD8=Adjusted_USI | Amount=330
================================================================================
*/
SET NOCOUNT ON;

DELETE FROM readacross.PnlEntries;

DECLARE @rows TABLE
(
    Cube NVARCHAR(64), Entity NVARCHAR(128), Parent NVARCHAR(128), Cons NVARCHAR(32),
    Scenario NVARCHAR(64), [Time] NVARCHAR(32), [View] NVARCHAR(32),
    Account NVARCHAR(128), Origin NVARCHAR(64), IC NVARCHAR(64),
    UD1 NVARCHAR(128), UD2 NVARCHAR(128), UD3 NVARCHAR(128), UD4 NVARCHAR(128),
    UD5 NVARCHAR(128), UD6 NVARCHAR(128), UD7 NVARCHAR(128), UD8 NVARCHAR(128),
    Amount DECIMAL(20,4), HasData BIT
);

INSERT INTO @rows VALUES
 ('Cosma',      'COSMABRAZILIUM',   'COSMA_LATAM',     'USD', 'Budget26', '2025M1',  'Periodic', 'Top',                       'Top','Top','Top','Top','Top','Top','Top','Top','Top','Adjusted_USI', 330,        1),
 ('Cosma',      'COSMABRAZILIUM',   'COSMA_LATAM',     'USD', 'Budget26', '2025M1',  'Periodic', 'Direct Labor (DL)',         'Top','Top','Top','Top','Top','Top','Top','Top','Top','Adjusted_USI', 435223.7879,1),
 ('Cosma',      'COSMABRAZILIUM',   'COSMA_LATAM',     'USD', 'Budget26', '2025M1',  'Periodic', 'Indirect Labor (IDL)',      'Top','Top','Top','Top','Top','Top','Top','Top','Top','Adjusted_USI', 198450.51,  1),
 ('Cosma',      'COSMABRAZILIUM',   'COSMA_LATAM',     'USD', 'Budget26', '2025M1',  'Periodic', 'Material Conveyance (MC)',  'Top','Top','Top','Top','Top','Top','Top','Top','Top','Adjusted_USI', 88210.00,   1),
 ('Cosma',      'COSMABRAZILIUM',   'COSMA_LATAM',     'USD', 'Budget26', '2025M1',  'Periodic', 'Variable Overhead (VOH)',   'Top','Top','Top','Top','Top','Top','Top','Top','Top','Adjusted_USI', 154890.25,  1),
 ('Cosma',      'COSMAUSAEAST01',   'COSMA_NA',        'USD', 'Budget26', '2025M1',  'Periodic', 'Top',                       'Top','Top','Top','Top','Top','Top','Top','Top','Top','Adjusted_USI', 1245.00,    1),
 ('Cosma',      'COSMAUSAEAST01',   'COSMA_NA',        'USD', 'Budget26', '2025M1',  'Periodic', 'Direct Labor (DL)',         'Top','Top','Top','Top','Top','Top','Top','Top','Top','Adjusted_USI', 612000.00,  1),
 ('Cosma',      'COSMAUSAEAST01',   'COSMA_NA',        'USD', 'Budget26', '2025M1',  'Periodic', 'Indirect Labor (IDL)',      'Top','Top','Top','Top','Top','Top','Top','Top','Top','Adjusted_USI', 295000.00,  1),
 ('Cosma',      'COSMAUSAEAST01',   'COSMA_NA',        'USD', 'Budget26', '2025M1',  'Periodic', 'Variable Overhead (VOH)',   'Top','Top','Top','Top','Top','Top','Top','Top','Top','Adjusted_USI', 218400.00,  1),
 ('Cosma',      'COSMAEU_PL01',     'COSMA_EU',        'EUR', 'Budget26', '2025M1',  'Periodic', 'Direct Labor (DL)',         'Top','Top','Top','Top','Top','Top','Top','Top','Top','Adjusted_USI', 487120.00,  1),
 ('Cosma',      'COSMAEU_PL01',     'COSMA_EU',        'EUR', 'Budget26', '2025M1',  'Periodic', 'Indirect Labor (IDL)',      'Top','Top','Top','Top','Top','Top','Top','Top','Top','Adjusted_USI', 219000.00,  1),
 ('Powertrain', 'PT_AC01',          'PT_NA',           'USD', 'Budget26', '2025M1',  'Periodic', 'Direct Labor (DL)',         'Top','Top','Top','Top','Top','Top','Top','Top','Top','Adjusted_USI', 712450.00,  1),
 ('Powertrain', 'PT_AC01',          'PT_NA',           'USD', 'Budget26', '2025M1',  'Periodic', 'Indirect Labor (IDL)',      'Top','Top','Top','Top','Top','Top','Top','Top','Top','Adjusted_USI', 312900.00,  1),
 ('Powertrain', 'PT_DE03',          'PT_EU',           'EUR', 'Budget26', '2025M1',  'Periodic', 'Direct Labor (DL)',         'Top','Top','Top','Top','Top','Top','Top','Top','Top','Adjusted_USI', 555000.00,  1),
 ('Exteriors',  'EXT_USA_TROY',     'EXT_NA',          'USD', 'Budget26', '2025M1',  'Periodic', 'Direct Labor (DL)',         'Top','Top','Top','Top','Top','Top','Top','Top','Top','Adjusted_USI', 405000.00,  1),
 ('Exteriors',  'EXT_DE_BREMEN',    'EXT_EU',          'EUR', 'Budget26', '2025M1',  'Periodic', 'Direct Labor (DL)',         'Top','Top','Top','Top','Top','Top','Top','Top','Top','Adjusted_USI', 369000.00,  1),
 ('Cosma',      'COSMABRAZILIUM',   'COSMA_LATAM',     'USD', 'Actual25', '2025M1',  'Periodic', 'Direct Labor (DL)',         'Top','Top','Top','Top','Top','Top','Top','Top','Top','Adjusted_USI', 451900.00,  1),
 ('Cosma',      'COSMAUSAEAST01',   'COSMA_NA',        'USD', 'Actual25', '2025M1',  'Periodic', 'Direct Labor (DL)',         'Top','Top','Top','Top','Top','Top','Top','Top','Top','Adjusted_USI', 599000.00,  1);

INSERT INTO readacross.PnlEntries
    (Cube, Entity, Parent, Cons, Scenario, [Time], [View], Account, Origin, IC,
     UD1, UD2, UD3, UD4, UD5, UD6, UD7, UD8, Amount, HasData)
SELECT
    Cube, Entity, Parent, Cons, Scenario, [Time], [View], Account, Origin, IC,
    UD1, UD2, UD3, UD4, UD5, UD6, UD7, UD8, Amount, HasData
FROM @rows;

PRINT CONCAT('Seeded ', @@ROWCOUNT, ' P&L rows.');
GO
