-- ═══════════════════════════════════════════════════════════════════════════════
-- ODF Manager V9o — Harmonisation du format des câbles internes (INT)
--
-- Format cible :
-- Par slot (et port-à-port) : INT-ZET-ZET-XXXX-SXXPXX-SXXPXX ou INT-ZET-ZET-XXXX-SXX-SYY
-- Par ODF : INT-ZET-ZET-XXXX-SXX (regroupé dans l'UI)
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
    v_cable RECORD;
    v_source_slot TEXT;
    v_dest_slot TEXT;
    v_new_ref TEXT;
BEGIN
    FOR v_cable IN 
        SELECT id, cable_reference, port_source_id, port_dest_id
        FROM public.cables_fibre
        WHERE type_lien = 'INTERNE'
    LOOP
        v_new_ref := v_cable.cable_reference;

        -- 1. Cas port-à-port existants : INT-ZET-S05P01-S05P01 -> INT-ZET-ZET-XXXX-S05P01-S05P01
        IF v_new_ref ~ '^INT-[A-Z]+-S\d+P\d+-S\d+P\d+$' THEN
            v_new_ref := regexp_replace(v_new_ref, '^INT-([A-Z]+)-(S\d+P\d+)-(S\d+P\d+)$', 'INT-\1-\1-' || lpad((floor(random() * 10000))::int::text, 4, '0') || '-\2-\3');
        END IF;

        -- 2. Cas site unique à dupliquer : INT-ZET-1234... -> INT-ZET-ZET-1234...
        IF v_new_ref ~ '^INT-[A-Z]+-\d{4}' THEN
            v_new_ref := regexp_replace(v_new_ref, '^INT-([A-Z]+)-(\d{4})(.*)$', 'INT-\1-\1-\2\3');
        END IF;

        -- 3. Cas connexion par slot manquante de slots : INT-ZET-ZET-1234 (sans rien derrière)
        -- On lui ajoute les slots source et dest
        IF v_new_ref ~ '^INT-[A-Z]+-[A-Z]+-\d{4}$' THEN
            -- Récupérer les noms des slots
            SELECT s.name INTO v_source_slot 
            FROM public.ports p JOIN public.slots s ON p.slot_id = s.id 
            WHERE p.id = v_cable.port_source_id;
            
            SELECT s.name INTO v_dest_slot 
            FROM public.ports p JOIN public.slots s ON p.slot_id = s.id 
            WHERE p.id = v_cable.port_dest_id;
            
            IF v_source_slot IS NOT NULL AND v_dest_slot IS NOT NULL THEN
                v_new_ref := v_new_ref || '-' || v_source_slot || '-' || v_dest_slot;
            END IF;
        END IF;

        -- Mettre à jour si nécessaire
        IF v_new_ref <> v_cable.cable_reference THEN
            UPDATE public.cables_fibre SET cable_reference = v_new_ref WHERE id = v_cable.id;
        END IF;
    END LOOP;
END;
$$;

COMMIT;
