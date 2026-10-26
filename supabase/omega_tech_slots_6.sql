-- ═══════════════════════════════════════════════════════════════════════════
--  Omega Tech : tous les ODF ont 6 slots (12 ports chacun)
--  La connexion « par ODF entier » de l'application exige le même nombre de slots
--  des deux côtés. Les ODF importés des trays à 5 cassettes (A-E) n'avaient que
--  5 slots : on ajoute le slot manquant, vide, pour que toutes les liaisons soient
--  possibles. Les slots existants et leurs ports ne sont pas modifiés.
--  Atomique et rejouable.
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_tid uuid;
  o record;
  s int;
  v_new int := 0;
BEGIN
  SELECT id INTO v_tid FROM public.tenants WHERE slug = 'omega-tech';
  IF v_tid IS NULL THEN RAISE EXCEPTION 'Entreprise omega-tech introuvable'; END IF;
  PERFORM set_config('app.tenant_id', v_tid::text, true);

  FOR o IN SELECT id FROM public.odfs WHERE tenant_id = v_tid LOOP
    FOR s IN 1..6 LOOP
      INSERT INTO public.slots (tenant_id, id, odf_id, slot_num, name)
      VALUES (v_tid, o.id || '_S' || LPAD(s::text, 2, '0'), o.id, s, 'S' || LPAD(s::text, 2, '0'))
      ON CONFLICT (tenant_id, id) DO NOTHING;
      IF FOUND THEN v_new := v_new + 1; END IF;
    END LOOP;
  END LOOP;
  UPDATE public.odfs SET slots = 6 WHERE tenant_id = v_tid;

  RAISE NOTICE 'Omega Tech : % slots ajoutés ; ODF avec un nombre de slots différent de 6 : %',
    v_new,
    (SELECT count(*) FROM (SELECT odf_id FROM public.slots WHERE tenant_id = v_tid
                           GROUP BY odf_id HAVING count(*) <> 6) x);
END $$;
