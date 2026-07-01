-- ============================================================
-- MIGRATION : Normalisation des cable_reference
-- Date      : 2026-06-30
--
-- Format cible (câble par slot) :
--   SITE1-SITE2/SalleSrc-RackSrc-ODFSrc_SalleDst-RackDst-ODFDst-Sxx
-- Format cible (câble par ODF entier, sans slot suffix) :
--   SITE1-SITE2/SalleSrc-RackSrc-ODFSrc_SalleDst-RackDst-ODFDst
--
-- Exemples :
--   EXT-ALP-BET-7946-S01       → ALP-BET/S1-R1-ODF1_S1-R2-ODF1-S01
--   INT-BET-BET-4881-S06       → BET-BET/S1-R1-ODF1_S2-R2-ODF1-S06
--   BET-ZET/S1-R1-ODF3_...-S06 → BET-ZET/S1-R1-ODF3_S2-R2-ODF3-S06 (inchangé)
--   DEL-DEL/S1_R1_ODF3-...-S06 → DEL-DEL/S1-R1-ODF3_S2-R2-ODF3-S06
--   ALP-ALP/S1_R1_ODF4-S2_R1_ODF4 → ALP-ALP/S1-R1-ODF4_S2-R1-ODF4
-- ============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 1 : Câbles avec port_source_id ET port_dest_id valides
--           Recalcul automatique depuis les IDs de ports.
--           Cible : câbles [ODF] ou dont la référence contient '/'
--           (exclut les jarretières individuelles INT-xxx, JAR-xxx)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  r       RECORD;
  sp      TEXT;
  dp      TEXT;
  new_ref TEXT;
BEGIN
  FOR r IN
    SELECT id, port_source_id, port_dest_id
    FROM cables_fibre
    WHERE port_source_id IS NOT NULL
      AND port_dest_id   IS NOT NULL
      AND (nom LIKE '[ODF]%' OR cable_reference LIKE '%/%')
  LOOP
    -- Extraire le chemin ODF : SITE-SALLE-RACK-ODF depuis SITE-SALLE-RACK-ODF_SxxPxx
    sp := split_part(r.port_source_id, '_', 1);
    dp := split_part(r.port_dest_id,   '_', 1);

    new_ref :=
      -- Paire de sites : SITE1-SITE2
      split_part(sp, '-', 1) || '-' || split_part(dp, '-', 1)
      || '/'
      -- Chemin source : Salle-Rack-ODF
      || split_part(sp, '-', 2) || '-' || split_part(sp, '-', 3) || '-' || split_part(sp, '-', 4)
      || '_'
      -- Chemin destination : Salle-Rack-ODF
      || split_part(dp, '-', 2) || '-' || split_part(dp, '-', 3) || '-' || split_part(dp, '-', 4)
      -- Slot extrait du port : left('S06P01', 3) → S06
      || '-' || left(split_part(r.port_source_id, '_', 2), 3);

    UPDATE cables_fibre SET cable_reference = new_ref WHERE id = r.id;
  END LOOP;

  RAISE NOTICE 'Étape 1 terminée : câbles avec ports mis à jour.';
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 2a : Câbles INTERSALLE sans ports — AVEC suffixe slot
--            Pattern actuel : SITE-SITE/Sx_Rx_ODFx-Sx_Rx_ODFx-Sxx
--            Cible          : SITE-SITE/Sx-Rx-ODFx_Sx-Rx-ODFx-Sxx
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE cables_fibre
SET cable_reference = regexp_replace(
  cable_reference,
  '^([A-Z0-9]+-[A-Z0-9]+)/([A-Z0-9]+)_([A-Z0-9]+)_([A-Z0-9]+)-([A-Z0-9]+)_([A-Z0-9]+)_([A-Z0-9]+)-([A-Z0-9]+)$',
  '\1/\2-\3-\4_\5-\6-\7-\8'
)
WHERE port_source_id IS NULL
  AND cable_reference ~ '^[A-Z0-9]+-[A-Z0-9]+/[A-Z0-9]+_[A-Z0-9]+_[A-Z0-9]+-[A-Z0-9]+_[A-Z0-9]+_[A-Z0-9]+-S[0-9]+$';

-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 2b : Câbles INTERSALLE sans ports — SANS suffixe slot
--            Pattern actuel : SITE-SITE/Sx_Rx_ODFx-Sx_Rx_ODFx
--            Cible          : SITE-SITE/Sx-Rx-ODFx_Sx-Rx-ODFx
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE cables_fibre
SET cable_reference = regexp_replace(
  cable_reference,
  '^([A-Z0-9]+-[A-Z0-9]+)/([A-Z0-9]+)_([A-Z0-9]+)_([A-Z0-9]+)-([A-Z0-9]+)_([A-Z0-9]+)_([A-Z0-9]+)$',
  '\1/\2-\3-\4_\5-\6-\7'
)
WHERE port_source_id IS NULL
  AND cable_reference ~ '^[A-Z0-9]+-[A-Z0-9]+/[A-Z0-9]+_[A-Z0-9]+_[A-Z0-9]+-[A-Z0-9]+_[A-Z0-9]+_[A-Z0-9]+$';

-- ─────────────────────────────────────────────────────────────────────────────
-- VÉRIFICATION : afficher les références qui contiennent encore des anomalies
-- (anciens préfixes EXT-/INT- ou underscores dans le chemin ODF)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  cnt INTEGER;
BEGIN
  SELECT COUNT(*) INTO cnt
  FROM cables_fibre
  WHERE (nom LIKE '[ODF]%' OR cable_reference LIKE '%/%')
    AND (
      cable_reference ~ '^(EXT|INT)-'
      OR cable_reference ~ '/[^/]*_[^/]*_[^/]*[-_]'
    );

  IF cnt > 0 THEN
    RAISE WARNING '% câble(s) avec référence non normalisée détecté(s). Vérifier manuellement.', cnt;
  ELSE
    RAISE NOTICE 'Toutes les références [ODF] sont normalisées.';
  END IF;
END $$;

COMMIT;
