-- ═══════════════════════════════════════════════════════════════════════════
--  v16 — Ports duplex : chaque port = une paire de fibres (TX/RX)
-- ═══════════════════════════════════════════════════════════════════════════
--  • nouvelle colonne ports.type_port ('DUPLEX' | 'SIMPLEX')
--  • défaut 'DUPLEX' pour tous les ports créés à partir de maintenant, donc aussi
--    ceux générés par le trigger de cascade (12 ports par slot) : aucune fonction
--    à modifier
--  • rattrapage : tous les slots d'Omega Tech ont 12 ports, tous en DUPLEX
--  • les ports existants des autres entreprises ne sont pas modifiés (NULL)
--  Rejouable sans effet de bord.
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_tid uuid;
  sl    record;
  p     int;
  v_add int := 0;
BEGIN
  ALTER TABLE public.ports ADD COLUMN IF NOT EXISTS type_port text;
  ALTER TABLE public.ports DROP CONSTRAINT IF EXISTS ports_type_port_check;
  ALTER TABLE public.ports ADD CONSTRAINT ports_type_port_check
    CHECK (type_port IS NULL OR type_port IN ('DUPLEX', 'SIMPLEX'));
  -- Défaut posé APRÈS l'ajout de la colonne : il ne touche que les futures lignes
  ALTER TABLE public.ports ALTER COLUMN type_port SET DEFAULT 'DUPLEX';

  SELECT id INTO v_tid FROM public.tenants WHERE slug = 'omega-tech';
  IF v_tid IS NULL THEN
    RAISE NOTICE 'v16 : entreprise omega-tech absente, colonne et défaut créés seulement';
    RETURN;
  END IF;
  PERFORM set_config('app.tenant_id', v_tid::text, true);

  -- Slots incomplets : on crée les ports manquants (1..12)
  FOR sl IN SELECT id, odf_id, slot_num, name FROM public.slots WHERE tenant_id = v_tid LOOP
    FOR p IN 1..12 LOOP
      INSERT INTO public.ports (tenant_id, id, slot_id, odf_id, slot_port, slot, port, statut, type_port)
      VALUES (v_tid, sl.odf_id || '_' || sl.name || 'P' || LPAD(p::text, 2, '0'), sl.id, sl.odf_id,
              sl.name || 'P' || LPAD(p::text, 2, '0'), sl.slot_num, p, 'LIBRE', 'DUPLEX')
      ON CONFLICT (tenant_id, id) DO NOTHING;
      IF FOUND THEN v_add := v_add + 1; END IF;
    END LOOP;
  END LOOP;

  UPDATE public.ports SET type_port = 'DUPLEX' WHERE tenant_id = v_tid AND type_port IS DISTINCT FROM 'DUPLEX';

  RAISE NOTICE 'v16 : % slots, % ports (dont % créés), tous DUPLEX, pour Omega Tech',
    (SELECT count(*) FROM public.slots WHERE tenant_id = v_tid),
    (SELECT count(*) FROM public.ports WHERE tenant_id = v_tid), v_add;
END $$;

NOTIFY pgrst, 'reload schema';
