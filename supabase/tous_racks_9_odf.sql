-- ═══════════════════════════════════════════════════════════════════════════
--  Omega Tech : tous les racks existants ont ODF1…ODF9
--  Complète chaque rack jusqu'à 9 ODF ; les nouveaux ODF ont 6 slots × 12 ports.
--  Les ODF déjà présents (importés ou créés à la main) ne sont jamais modifiés.
--  Atomique (un seul bloc DO) et rejouable : à relancer après avoir ajouté un rack.
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_tid  uuid;
  rk     record;
  v_odf  text;
  o int; s int;
  v_new  int := 0;
BEGIN
  SELECT id INTO v_tid FROM public.tenants WHERE slug = 'omega-tech';
  IF v_tid IS NULL THEN RAISE EXCEPTION 'Entreprise omega-tech introuvable'; END IF;
  PERFORM set_config('app.tenant_id', v_tid::text, true);

  FOR rk IN SELECT id FROM public.racks WHERE tenant_id = v_tid ORDER BY id LOOP
    FOR o IN 1..9 LOOP
      v_odf := rk.id || '-ODF' || o;
      IF NOT EXISTS (SELECT 1 FROM public.odfs WHERE tenant_id = v_tid AND rack_id = rk.id AND name = 'ODF' || o) THEN
        INSERT INTO public.odfs (tenant_id, id, rack_id, name, slots)
        VALUES (v_tid, v_odf, rk.id, 'ODF' || o, 6)
        ON CONFLICT (tenant_id, id) DO NOTHING;
        v_new := v_new + 1;
      END IF;

      -- ODF vide (seul le slot S01 créé automatiquement) : complété à 6 slots
      IF (SELECT count(*) FROM public.slots WHERE tenant_id = v_tid AND odf_id = v_odf) = 1 THEN
        FOR s IN 2..6 LOOP
          INSERT INTO public.slots (tenant_id, id, odf_id, slot_num, name)
          VALUES (v_tid, v_odf || '_S' || LPAD(s::text, 2, '0'), v_odf, s, 'S' || LPAD(s::text, 2, '0'))
          ON CONFLICT (tenant_id, id) DO NOTHING;
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Omega Tech : % racks, % ODF (% ODF créés)',
    (SELECT count(*) FROM public.racks WHERE tenant_id = v_tid),
    (SELECT count(*) FROM public.odfs  WHERE tenant_id = v_tid), v_new;
END $$;
