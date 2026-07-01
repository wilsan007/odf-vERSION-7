-- ============================================================
-- SUPPRESSION DE CÂBLES SÉLECTIONNÉS
-- Date : 2026-06-30
-- 18 enregistrements ciblés dans cables_fibre
-- ============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 1 : Vérification des jonctions de service liées (lecture seule)
--           Si des jonctions existent, la suppression échouera sans ON DELETE CASCADE.
--           Exécutez ce SELECT avant le DELETE pour vérifier.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT sj.id AS jonction_id, sj.cable_id, cf.cable_reference
FROM service_jonctions sj
JOIN cables_fibre cf ON cf.id = sj.cable_id
WHERE sj.cable_id IN (
  '7a8b7946-23ef-4def-bb2e-e72df9b8bef1',
  '4a130895-0d3b-4372-9a34-677069d52fbc',
  '78ba45b5-7405-4770-818d-da49222e0422',
  '959e252b-1855-4ecb-bde9-ce500338e447',
  'CBL-ALP-SEA-01',
  'CBL-ALP-AAE-01',
  'CBL-ALP-DEL-01',
  '2e0eca08-5135-4db6-b36c-2fe4c3d04868',
  'e4feaaad-9ab9-4cd1-a2e4-3923a798a83f',
  'a03d5d16-9bba-4bc0-a330-9a0f304ae3f5',
  '177befc3-f894-47a3-9c64-dd9237e63acc',
  '198d3c81-6e3a-4d03-9bb5-2cf2c7f1b78a',
  '9eafc1a1-3026-4fe0-897c-fcc63a8bb6d9',
  '0378be22-5149-4d8f-9092-948a8b0c8561',
  '23903f17-588a-49a5-b98c-cb26f1c55992',
  'e07574fa-ef4a-4b60-b221-3c83e26884c4',
  'cb7ad116-98c7-4a51-ad20-1c38556a775f',
  '5966764e-5d13-4f76-b59a-377a3826ac5b'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 2 : Suppression des jonctions liées (si elles existent)
-- ─────────────────────────────────────────────────────────────────────────────
DELETE FROM service_jonctions
WHERE cable_id IN (
  '7a8b7946-23ef-4def-bb2e-e72df9b8bef1',
  '4a130895-0d3b-4372-9a34-677069d52fbc',
  '78ba45b5-7405-4770-818d-da49222e0422',
  '959e252b-1855-4ecb-bde9-ce500338e447',
  'CBL-ALP-SEA-01',
  'CBL-ALP-AAE-01',
  'CBL-ALP-DEL-01',
  '2e0eca08-5135-4db6-b36c-2fe4c3d04868',
  'e4feaaad-9ab9-4cd1-a2e4-3923a798a83f',
  'a03d5d16-9bba-4bc0-a330-9a0f304ae3f5',
  '177befc3-f894-47a3-9c64-dd9237e63acc',
  '198d3c81-6e3a-4d03-9bb5-2cf2c7f1b78a',
  '9eafc1a1-3026-4fe0-897c-fcc63a8bb6d9',
  '0378be22-5149-4d8f-9092-948a8b0c8561',
  '23903f17-588a-49a5-b98c-cb26f1c55992',
  'e07574fa-ef4a-4b60-b221-3c83e26884c4',
  'cb7ad116-98c7-4a51-ad20-1c38556a775f',
  '5966764e-5d13-4f76-b59a-377a3826ac5b'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 3 : Suppression des câbles
-- ─────────────────────────────────────────────────────────────────────────────
DELETE FROM cables_fibre
WHERE id IN (
  -- Jarretières internes ALP (port-à-port)
  '7a8b7946-23ef-4def-bb2e-e72df9b8bef1',  -- INT-ALP-S06P01-S02P02
  '4a130895-0d3b-4372-9a34-677069d52fbc',  -- INT-ALP-S05P01-S01P02
  '78ba45b5-7405-4770-818d-da49222e0422',  -- INT-ALP-ALP-7949-S03P01-S06P01
  '959e252b-1855-4ecb-bde9-ce500338e447',  -- INT-ALP-ALP-2055-S02P01-S03P01
  '23903f17-588a-49a5-b98c-cb26f1c55992',  -- INT-ALP-ALP-2181-S01P01-S01P01
  -- Liaisons externes ALP
  'CBL-ALP-SEA-01',                         -- EXT-ALP-SEA-01
  'CBL-ALP-AAE-01',                         -- EXT-ALP-AAE-01
  'CBL-ALP-DEL-01',                         -- EXT-ALP-DEL-01
  -- Jarretières internes ZET (port-à-port)
  '2e0eca08-5135-4db6-b36c-2fe4c3d04868',  -- INT-ZET-ZET-9951-S05P01-S04P01
  'e4feaaad-9ab9-4cd1-a2e4-3923a798a83f',  -- INT-ZET-ZET-0644-S05P01-S05P01
  'a03d5d16-9bba-4bc0-a330-9a0f304ae3f5',  -- INT-ZET-ZET-8573-S04P01-S03P01
  '177befc3-f894-47a3-9c64-dd9237e63acc',  -- INT-ZET-ZET-8705-S04P01-S04P01
  '198d3c81-6e3a-4d03-9bb5-2cf2c7f1b78a',  -- INT-ZET-ZET-8548-S03P01-S02P01
  '9eafc1a1-3026-4fe0-897c-fcc63a8bb6d9',  -- INT-ZET-ZET-6230-S03P01-S03P01
  '0378be22-5149-4d8f-9092-948a8b0c8561',  -- INT-ZET-ZET-3033-S02P01-S02P01
  -- Jarretières internes BET (port-à-port)
  'e07574fa-ef4a-4b60-b221-3c83e26884c4',  -- INT-BET-BET-5610-S01P02-S01P01
  'cb7ad116-98c7-4a51-ad20-1c38556a775f',  -- INT-BET-BET-7840-S01P01-S01P02
  -- Câble ODF EPS-GAM
  '5966764e-5d13-4f76-b59a-377a3826ac5b'   -- EPS-GAM/S2-R1-ODF1_S2-R1-ODF1-S06
);

-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 4 : Vérification — doit retourner 0 ligne
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  remaining INT;
BEGIN
  SELECT COUNT(*) INTO remaining
  FROM cables_fibre
  WHERE id IN (
    '7a8b7946-23ef-4def-bb2e-e72df9b8bef1',
    '4a130895-0d3b-4372-9a34-677069d52fbc',
    '78ba45b5-7405-4770-818d-da49222e0422',
    '959e252b-1855-4ecb-bde9-ce500338e447',
    'CBL-ALP-SEA-01', 'CBL-ALP-AAE-01', 'CBL-ALP-DEL-01',
    '2e0eca08-5135-4db6-b36c-2fe4c3d04868',
    'e4feaaad-9ab9-4cd1-a2e4-3923a798a83f',
    'a03d5d16-9bba-4bc0-a330-9a0f304ae3f5',
    '177befc3-f894-47a3-9c64-dd9237e63acc',
    '198d3c81-6e3a-4d03-9bb5-2cf2c7f1b78a',
    '9eafc1a1-3026-4fe0-897c-fcc63a8bb6d9',
    '0378be22-5149-4d8f-9092-948a8b0c8561',
    '23903f17-588a-49a5-b98c-cb26f1c55992',
    'e07574fa-ef4a-4b60-b221-3c83e26884c4',
    'cb7ad116-98c7-4a51-ad20-1c38556a775f',
    '5966764e-5d13-4f76-b59a-377a3826ac5b'
  );

  IF remaining > 0 THEN
    RAISE EXCEPTION 'ERREUR : % câble(s) n''ont pas été supprimés.', remaining;
  ELSE
    RAISE NOTICE 'OK : 18 câbles supprimés avec succès.';
  END IF;
END $$;

COMMIT;
