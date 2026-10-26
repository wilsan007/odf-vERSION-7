-- ═══════════════════════════════════════════════════════════════════════════
--  v15b — Djibouti Telecom : remplace l'UUID fixe 00000000-…-0001 par un UUID
--  aléatoire (gen_random_uuid), dans tenants et dans TOUTES les tables qui
--  portent tenant_id.
-- ═══════════════════════════════════════════════════════════════════════════
--  Pour une base où la v15 d'origine a déjà été appliquée. Sans effet si
--  l'UUID fixe n'existe pas (base neuve, ou v15b déjà passée) : rejouable.
--
--  Un seul bloc DO, donc atomique, même dans l'éditeur SQL Supabase :
--   1. mémorise puis retire les FK qui portent sur tenant_id / tenants
--   2. désactive les triggers métier (sinon updated_at, statuts, auteurs…
--      seraient modifiés par le simple changement de tenant_id)
--   3. remplace l'UUID partout
--   4. réactive les triggers, recrée les FK (revalidées sur les données)
--   5. corrige mt_enable_tenant_isolation, qui contenait l'UUID fixe
--
--  Après coup : retrouver l'UUID par le slug, jamais en dur :
--    SELECT id FROM public.tenants WHERE slug = 'djibouti-telecom';
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_old uuid := '00000000-0000-0000-0000-000000000001';
  v_new uuid := gen_random_uuid();
  v_fks jsonb;
  v_trg jsonb;
  r     record;
  v_def text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = v_old) THEN
    RAISE NOTICE 'v15b : UUID fixe absent, rien à faire';
    RETURN;
  END IF;

  -- définitions FK réexécutées telles quelles : on fige le search_path
  PERFORM set_config('search_path', 'public', true);

  -- 1. FK vers tenants, ou dont les colonnes incluent tenant_id
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'rel', c.conrelid::regclass::text,
           'conname', c.conname,
           'def', pg_get_constraintdef(c.oid))), '[]') INTO v_fks
  FROM pg_constraint c
  WHERE c.contype = 'f'
    AND c.connamespace = 'public'::regnamespace
    AND (c.confrelid = 'public.tenants'::regclass
         OR EXISTS (SELECT 1 FROM pg_attribute a
                    WHERE a.attrelid = c.conrelid AND a.attname = 'tenant_id'
                      AND a.attnum = ANY (c.conkey)));

  FOR r IN SELECT * FROM jsonb_to_recordset(v_fks) AS x(rel text, conname text, def text) LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.rel, r.conname);
  END LOOP;

  -- 2. triggers utilisateur actifs sur les tables à tenant_id
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'rel', t.tgrelid::regclass::text, 'tg', t.tgname)), '[]') INTO v_trg
  FROM pg_trigger t
  JOIN pg_class cl ON cl.oid = t.tgrelid AND cl.relnamespace = 'public'::regnamespace
  JOIN pg_attribute a ON a.attrelid = t.tgrelid AND a.attname = 'tenant_id' AND NOT a.attisdropped
  WHERE NOT t.tgisinternal AND t.tgenabled <> 'D';

  FOR r IN SELECT * FROM jsonb_to_recordset(v_trg) AS x(rel text, tg text) LOOP
    EXECUTE format('ALTER TABLE %s DISABLE TRIGGER %I', r.rel, r.tg);
  END LOOP;

  -- 3. nouvel UUID partout
  UPDATE public.tenants SET id = v_new WHERE id = v_old;
  FOR r IN
    SELECT a.attrelid::regclass AS rel
    FROM pg_attribute a
    JOIN pg_class cl ON cl.oid = a.attrelid
    WHERE cl.relnamespace = 'public'::regnamespace AND cl.relkind = 'r'
      AND a.attname = 'tenant_id' AND NOT a.attisdropped
  LOOP
    EXECUTE format('UPDATE %s SET tenant_id = $1 WHERE tenant_id = $2', r.rel) USING v_new, v_old;
  END LOOP;

  -- 4. triggers puis FK
  FOR r IN SELECT * FROM jsonb_to_recordset(v_trg) AS x(rel text, tg text) LOOP
    EXECUTE format('ALTER TABLE %s ENABLE TRIGGER %I', r.rel, r.tg);
  END LOOP;
  FOR r IN SELECT * FROM jsonb_to_recordset(v_fks) AS x(rel text, conname text, def text) LOOP
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s', r.rel, r.conname, r.def);
  END LOOP;

  -- 5. l'outil d'isolation des futures tables ne doit plus contenir l'UUID fixe
  SELECT pg_get_functiondef('public.mt_enable_tenant_isolation(regclass)'::regprocedure) INTO v_def;
  IF position(v_old::text IN v_def) > 0 THEN
    EXECUTE replace(v_def, quote_literal(v_old::text),
                    '(SELECT id::text FROM public.tenants WHERE slug = ''djibouti-telecom'')');
  END IF;

  RAISE NOTICE 'v15b : Djibouti Telecom a désormais l''id %', v_new;
END $$;

NOTIFY pgrst, 'reload schema';
