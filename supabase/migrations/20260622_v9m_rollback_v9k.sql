-- ═══════════════════════════════════════════════════════════════════════════════
-- ODF Manager V9m — Rollback de la fonction create_service_with_jonctions_atomic
--
-- Restauration de la logique d'origine :
--   - Occupe port_entree_id ET port_sortie_id pour chaque jonction.
--   - Assure l'occupation du port principal p_port_id à la fin.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- Supprimer les éventuelles surcharges existantes
DROP FUNCTION IF EXISTS public.create_service_with_jonctions_atomic
  (TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT);
DROP FUNCTION IF EXISTS public.create_service_with_jonctions_atomic
  (TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_service_with_jonctions_atomic
  (TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, NUMERIC);

-- ─────────────────────────────────────────────────────────────────────────────
-- Restauration de la fonction avec la logique avant v9k
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_service_with_jonctions_atomic(
  p_service_id TEXT,
  p_cid TEXT,
  p_label TEXT,
  p_cable_id TEXT,
  p_client_id TEXT,
  p_fournisseur_id TEXT,
  p_port_id TEXT,
  p_jonctions JSONB,
  p_history_action TEXT,
  p_created_by TEXT DEFAULT NULL,
  p_capacite_gbps NUMERIC DEFAULT 0
) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_jonction RECORD;
  v_final_cid TEXT := p_cid;
BEGIN
  -- A. Générer un CID si non fourni
  IF v_final_cid IS NULL OR v_final_cid = '' THEN
    v_final_cid := 'DJT-' || to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYYMMDDHH24MISS');
    WHILE EXISTS (SELECT 1 FROM public.services WHERE cid = v_final_cid) LOOP
      v_final_cid := 'DJT-' || to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYYMMDDHH24MISS')
                     || LPAD((floor(random()*100))::INT::TEXT, 2, '0');
    END LOOP;
  END IF;

  -- B. Créer le Service
  INSERT INTO public.services (id, cid, label, cable_id, client_id, fournisseur_id, port_id, capacite_gbps, statut, created_by, updated_by)
  VALUES (
    p_service_id, 
    v_final_cid, 
    p_label, 
    p_cable_id, 
    p_client_id, 
    p_fournisseur_id, 
    p_port_id, 
    COALESCE(p_capacite_gbps, 0),
    'ACTIF',
    p_created_by,
    p_created_by
  );

  -- C. Insérer les Jonctions de Service (s'il y en a)
  IF p_jonctions IS NOT NULL AND jsonb_array_length(p_jonctions) > 0 THEN
    FOR v_jonction IN SELECT * FROM jsonb_to_recordset(p_jonctions) 
      AS x(ordre INT, cable_id TEXT, port_entree_id TEXT, port_sortie_id TEXT)
    LOOP
      INSERT INTO public.service_jonctions (service_id, ordre, cable_id, port_entree_id, port_sortie_id)
      VALUES (p_service_id, v_jonction.ordre, v_jonction.cable_id, v_jonction.port_entree_id, v_jonction.port_sortie_id);
      
      -- D. Occuper les ports de la jonction avec le bon CID
      IF v_jonction.port_entree_id IS NOT NULL THEN
        UPDATE public.ports SET statut = 'OCCUPE', cid = v_final_cid WHERE id = v_jonction.port_entree_id;
      END IF;
      IF v_jonction.port_sortie_id IS NOT NULL THEN
        UPDATE public.ports SET statut = 'OCCUPE', cid = v_final_cid WHERE id = v_jonction.port_sortie_id;
      END IF;
    END LOOP;
  END IF;

  -- E. Assurer l'occupation du port d'entrée principal avec le bon CID
  IF p_port_id IS NOT NULL THEN
    UPDATE public.ports SET statut = 'OCCUPE', cid = v_final_cid WHERE id = p_port_id;
  END IF;

  -- F. Ajouter l'historique
  IF p_history_action IS NOT NULL AND p_history_action <> '' THEN
    INSERT INTO public.history (action, entity_type, entity_id, user_email)
    VALUES (p_history_action, 'service', p_service_id, p_created_by);
  END IF;

  RETURN p_service_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erreur de transaction lors de la création du service : %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_service_with_jonctions_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, NUMERIC) TO anon, authenticated, service_role;

COMMIT;
