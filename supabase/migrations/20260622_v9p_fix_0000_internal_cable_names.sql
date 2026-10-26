-- ═══════════════════════════════════════════════════════════════════════════════
-- ODF Manager V9p — Correction des câbles internes ayant "0000"
--
-- Remplace le "0000" généré par erreur par un nombre aléatoire à 4 chiffres.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
    v_cable RECORD;
    v_new_ref TEXT;
BEGIN
    FOR v_cable IN 
        SELECT id, cable_reference
        FROM public.cables_fibre
        WHERE type_lien = 'INTERNE' AND cable_reference LIKE '%-0000-%'
    LOOP
        -- Remplacer "-0000-" par un nombre aléatoire à 4 chiffres, ex: "-8432-"
        v_new_ref := regexp_replace(
            v_cable.cable_reference, 
            '-0000-', 
            '-' || lpad((floor(random() * 10000))::int::text, 4, '0') || '-'
        );
        
        UPDATE public.cables_fibre SET cable_reference = v_new_ref WHERE id = v_cable.id;
    END LOOP;
END;
$$;

COMMIT;
