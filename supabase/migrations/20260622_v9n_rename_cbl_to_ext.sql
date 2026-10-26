-- ═══════════════════════════════════════════════════════════════════════════════
-- ODF Manager V9n — Changement de nommage des câbles externes (CBL/CBLX -> EXT)
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- 1. Remplacer le préfixe CBLX- par EXT-
UPDATE public.cables_fibre
SET cable_reference = regexp_replace(cable_reference, '^CBLX-', 'EXT-')
WHERE cable_reference LIKE 'CBLX-%';

-- 2. Remplacer le préfixe CBL- par EXT-
UPDATE public.cables_fibre
SET cable_reference = regexp_replace(cable_reference, '^CBL-', 'EXT-')
WHERE cable_reference LIKE 'CBL-%';

COMMIT;
