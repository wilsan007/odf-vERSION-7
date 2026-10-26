-- ═══════════════════════════════════════════════════════════════════════════════
-- ODF Manager V9u — Correctif fn_sync_odf_type_from_cables
--
-- Problème : fn_sync_odf_type_from_cables copie cables_fibre.type_lien
-- directement dans odfs.odf_type, mais type_lien peut valoir 'JARRETIERE'
-- ou 'EQUIPEMENT', valeurs refusées par la contrainte :
--   odf_type IN ('EXTERNE','INTERNE') OR odf_type IS NULL
--
-- → INSERT sur cables_fibre → trigger → UPDATE odfs SET odf_type='JARRETIERE'
-- → violation de contrainte → 400/422 côté client.
--
-- Correction : appliquer le même mapping que fn_auto_port_actif :
--   'EXTERNE'              → 'EXTERNE'
--   'INTERNE'|'JARRETIERE' → 'INTERNE'
--   tout autre (EQUIPEMENT…) → NULL
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_sync_odf_type_from_cables()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_port_id  TEXT;
  v_odf_id   TEXT;
  v_raw_type TEXT;
  v_odf_type TEXT;
BEGIN
  FOR v_port_id IN
    SELECT DISTINCT p_id
    FROM (
      SELECT CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.port_source_id END AS p_id
      UNION ALL
      SELECT CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.port_dest_id   END
      UNION ALL
      SELECT CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.port_source_id END
      UNION ALL
      SELECT CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.port_dest_id   END
    ) t
    WHERE p_id IS NOT NULL
  LOOP
    SELECT odf_id INTO v_odf_id FROM public.ports WHERE id = v_port_id;

    IF v_odf_id IS NOT NULL THEN
      -- Recalculer le type_lien brut depuis les câbles connectés à cet ODF
      SELECT c.type_lien INTO v_raw_type
      FROM public.cables_fibre c
      JOIN public.ports p ON p.id IN (c.port_source_id, c.port_dest_id)
      WHERE p.odf_id = v_odf_id
      LIMIT 1;

      -- ── Mapping type_lien → odf_type (valeurs autorisées) ──────────────────
      v_odf_type := CASE v_raw_type
        WHEN 'EXTERNE'    THEN 'EXTERNE'
        WHEN 'INTERNE'    THEN 'INTERNE'
        WHEN 'JARRETIERE' THEN 'INTERNE'
        ELSE NULL          -- EQUIPEMENT, NULL, ou autre valeur future
      END;

      UPDATE public.odfs
      SET odf_type = v_odf_type
      WHERE id = v_odf_id;
    END IF;
  END LOOP;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;
