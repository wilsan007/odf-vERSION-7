-- ═══════════════════════════════════════════════════════════════════════════
--  Omega Tech : tous les ports LIBRES et tous les ODF inactifs
--  • ports : statut LIBRE, CID / OT / capacité / propriétaire / destination /
--    remarques / câble effacés
--  • câbles : tous supprimés (sinon leurs ports resteraient occupés)
--  • ODF : inactifs, sans type, sans CID, sans libellé de route
--  La structure (sites, racks, ODF, slots, ports) est conservée.
--  Les autres entreprises ne sont pas touchées. Atomique et rejouable.
--  Pour retrouver les données d'exemple : supprimer les sites SA, SB, SC puis
--  relancer supabase/import_omega_tech_anonymise.sql.
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_tid uuid;
  v_cab int; v_prt int; v_odf int;
BEGIN
  SELECT id INTO v_tid FROM public.tenants WHERE slug = 'omega-tech';
  IF v_tid IS NULL THEN RAISE EXCEPTION 'Entreprise omega-tech introuvable'; END IF;
  PERFORM set_config('app.tenant_id', v_tid::text, true);

  -- Services éventuels de l'entreprise : ils référencent des câbles / ports
  DELETE FROM public.services WHERE tenant_id = v_tid;

  DELETE FROM public.cables_fibre WHERE tenant_id = v_tid;
  GET DIAGNOSTICS v_cab = ROW_COUNT;

  UPDATE public.ports
  SET statut = 'LIBRE', cid = NULL, ot_num = NULL, capacite = NULL, owner = NULL,
      destination = NULL, date_activ = NULL, remarques = NULL, cable_id = NULL
  WHERE tenant_id = v_tid;
  GET DIAGNOSTICS v_prt = ROW_COUNT;

  UPDATE public.odfs
  SET is_active = false, odf_type = NULL, cid = NULL, activated_at = NULL,
      cable_id = NULL, route = NULL
  WHERE tenant_id = v_tid;
  GET DIAGNOSTICS v_odf = ROW_COUNT;

  RAISE NOTICE 'Omega Tech : % câbles supprimés, % ports libérés, % ODF remis à zéro', v_cab, v_prt, v_odf;
END $$;
