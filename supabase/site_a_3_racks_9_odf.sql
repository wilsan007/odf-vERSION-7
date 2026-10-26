-- ═══════════════════════════════════════════════════════════════════════════
--  Site A (Omega Tech) : salle 1 = 3 racks × 9 ODF
--  Ajoute le rack R3 et complète chaque rack jusqu'à ODF1…ODF9 (6 slots × 12 ports
--  pour les nouveaux ODF). Les ODF déjà importés ne sont pas modifiés.
--  Un seul bloc DO : atomique, rejouable sans effet.
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_tid  uuid;
  v_rack text;
  v_odf  text;
  r int; o int; s int;
BEGIN
  SELECT id INTO v_tid FROM public.tenants WHERE slug = 'omega-tech';
  IF v_tid IS NULL OR NOT EXISTS (SELECT 1 FROM public.sites WHERE tenant_id = v_tid AND id = 'SA') THEN
    RAISE EXCEPTION 'Site A introuvable dans Omega Tech : lancer d''abord l''import';
  END IF;
  PERFORM set_config('app.tenant_id', v_tid::text, true);

  FOR r IN 1..3 LOOP
    v_rack := 'SA-S1-R' || r;
    INSERT INTO public.racks (tenant_id, id, site_id, salle_id, name, description)
    VALUES (v_tid, v_rack, 'SA', 'SA-S1', 'R' || r, 'Baie ' || r)
    ON CONFLICT (tenant_id, id) DO NOTHING;

    FOR o IN 1..9 LOOP
      v_odf := v_rack || '-ODF' || o;
      INSERT INTO public.odfs (tenant_id, id, rack_id, name, slots)
      VALUES (v_tid, v_odf, v_rack, 'ODF' || o, 6)
      ON CONFLICT (tenant_id, id) DO NOTHING;

      -- ODF vide (seul le slot S01 créé automatiquement) : on le complète à 6 slots.
      -- Un ODF déjà importé (5 ou 6 slots) n'est jamais touché.
      IF (SELECT count(*) FROM public.slots WHERE tenant_id = v_tid AND odf_id = v_odf) = 1 THEN
        FOR s IN 2..6 LOOP
          INSERT INTO public.slots (tenant_id, id, odf_id, slot_num, name)
          VALUES (v_tid, v_odf || '_S' || LPAD(s::text, 2, '0'), v_odf, s, 'S' || LPAD(s::text, 2, '0'))
          ON CONFLICT (tenant_id, id) DO NOTHING;
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;

  UPDATE public.sites SET description = 'Site A — salle 1 : 3 racks × 9 ODF'
  WHERE tenant_id = v_tid AND id = 'SA';

  RAISE NOTICE 'Site A : % racks, % ODF',
    (SELECT count(*) FROM public.racks WHERE tenant_id = v_tid AND site_id = 'SA'),
    (SELECT count(*) FROM public.odfs o2 JOIN public.racks r2 ON r2.id = o2.rack_id AND r2.tenant_id = o2.tenant_id
      WHERE o2.tenant_id = v_tid AND r2.site_id = 'SA');
END $$;
