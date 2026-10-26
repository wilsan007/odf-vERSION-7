-- ═══════════════════════════════════════════════════════════════════════════
--  v15 — Multi-tenant (plusieurs entreprises) + durcissement sécurité
-- ═══════════════════════════════════════════════════════════════════════════
--  Modèle : base partagée, colonne tenant_id sur chaque table métier,
--  isolation par RLS. Les IDs texte lisibles ('ALP-S1-R1-ODF1_S01P01') restent
--  inchangés : toutes les PK / UNIQUE / FK deviennent (tenant_id, ...), donc deux
--  entreprises peuvent chacune avoir un site 'ALP'.
--
--  Entreprise active d'une requête = en-tête HTTP `x-tenant-id` envoyé par le
--  client, VALIDÉ contre tenant_members (un en-tête forgé vers une entreprise
--  dont on n'est pas membre donne NULL → aucune ligne visible/écrivable).
--
--  Rôles par entreprise : admin (tout + gestion des membres),
--  technicien (lecture/écriture), lecture (lecture seule).
--
--  Ce qui change aussi :
--   • suppression des politiques allow_all ; plus AUCUN accès pour `anon`
--   • vues en security_invoker (elles respectent la RLS)
--   • fonctions : SECURITY INVOKER + search_path figé
--   • history : append-only, auteur (user_id/user_email) imposé côté serveur
--   • services.created_by/updated_by imposés depuis le JWT
--
--  Idempotente : rejouable sans effet de bord. Scripts techniques (service_role
--  / postgres) : `SET app.tenant_id = '<uuid>'` avant d'insérer, ou passer
--  tenant_id explicitement.
--
--  ⚠ Nouvelle table métier ajoutée plus tard → appeler
--    SELECT public.mt_enable_tenant_isolation('public.ma_table');
--    puis rejouer la phase FK (bloc « 4 ») si elle référence d'autres tables.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ───────────────────────────────────────────────────────────────────────────
-- 1. Tables plateforme
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tenants (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 120),
  slug       text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,40}$'),
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenant_members (
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id)     ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('admin', 'technicien', 'lecture')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  PRIMARY KEY (tenant_id, user_id)
);
CREATE INDEX IF NOT EXISTS tenant_members_user_id_idx ON public.tenant_members (user_id);

CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Entreprise historique : toutes les données existantes lui sont rattachées
INSERT INTO public.tenants (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'Djibouti Telecom', 'djibouti-telecom')
ON CONFLICT (id) DO NOTHING;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. Résolution du tenant / du rôle (SECURITY DEFINER, search_path vide)
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_hdr text;
  v_tid uuid;
BEGIN
  IF v_uid IS NULL THEN
    -- anon : jamais de tenant. Rôles techniques : tenant explicite via GUC.
    IF coalesce(auth.role(), '') IN ('anon', 'authenticated') THEN
      RETURN NULL;
    END IF;
    BEGIN
      RETURN nullif(current_setting('app.tenant_id', true), '')::uuid;
    EXCEPTION WHEN others THEN
      RETURN NULL;
    END;
  END IF;

  BEGIN
    v_hdr := nullif(current_setting('request.headers', true), '')::json ->> 'x-tenant-id';
  EXCEPTION WHEN others THEN
    v_hdr := NULL;
  END;

  IF nullif(v_hdr, '') IS NOT NULL THEN
    IF v_hdr !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RETURN NULL;
    END IF;
    SELECT m.tenant_id INTO v_tid
    FROM public.tenant_members m
    JOIN public.tenants t ON t.id = m.tenant_id
    WHERE m.user_id = v_uid AND m.tenant_id = v_hdr::uuid AND t.is_active;
    RETURN v_tid;   -- NULL si non membre
  END IF;

  -- Pas d'en-tête : accepté seulement si l'utilisateur n'a qu'une entreprise
  SELECT CASE WHEN count(*) = 1 THEN (array_agg(m.tenant_id))[1] END INTO v_tid
  FROM public.tenant_members m
  JOIN public.tenants t ON t.id = m.tenant_id
  WHERE m.user_id = v_uid AND t.is_active;
  RETURN v_tid;
END;
$$;

CREATE OR REPLACE FUNCTION public.current_tenant_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT m.role FROM public.tenant_members m
  WHERE m.tenant_id = public.current_tenant_id() AND m.user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.tenant_can_write()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT coalesce(public.current_tenant_role() IN ('admin', 'technicien'), false);
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.my_tenant_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid();
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. Isolation d'une table : colonne tenant_id + PK/UNIQUE composites + RLS
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mt_enable_tenant_isolation(p_table regclass)
RETURNS void
LANGUAGE plpgsql SET search_path = public, pg_temp
AS $$
DECLARE
  v_rel   text := p_table::text;
  v_name  text := (SELECT relname FROM pg_class WHERE oid = p_table);
  r       record;
  v_def   text;
  v_pol   text;
  v_tenant_check text := 'tenant_id = (SELECT public.current_tenant_id())';
  v_write_check  text := v_tenant_check || ' AND (SELECT public.tenant_can_write())';
BEGIN
  -- a) colonne, rattachement des lignes existantes, défaut, NOT NULL, FK tenants
  --    (défaut constant à l'ajout : pas d'UPDATE, donc aucun trigger métier déclenché)
  EXECUTE format('ALTER TABLE %s ADD COLUMN IF NOT EXISTS tenant_id uuid NOT NULL DEFAULT %L',
                 v_rel, '00000000-0000-0000-0000-000000000001');
  EXECUTE format('ALTER TABLE %s ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id()', v_rel);
  EXECUTE format('ALTER TABLE %s ALTER COLUMN tenant_id SET NOT NULL', v_rel);
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = p_table AND conname = v_name || '_tenant_id_fkey') THEN
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (tenant_id) '
                   'REFERENCES public.tenants(id) ON DELETE RESTRICT',
                   v_rel, v_name || '_tenant_id_fkey');
  END IF;

  -- b) PK / UNIQUE → (tenant_id, …)   (les FK entrantes doivent déjà être retirées)
  FOR r IN
    SELECT conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint
    WHERE conrelid = p_table AND contype IN ('p', 'u')
      AND NOT (SELECT attnum FROM pg_attribute
               WHERE attrelid = p_table AND attname = 'tenant_id') = ANY (conkey)
  LOOP
    v_def := regexp_replace(r.def, '\(', '(tenant_id, ');
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', v_rel, r.conname);
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s', v_rel, r.conname, v_def);
  END LOOP;

  -- c) index UNIQUE hors contraintes
  FOR r IN
    SELECT ic.relname AS idx, pg_get_indexdef(i.indexrelid) AS def
    FROM pg_index i
    JOIN pg_class ic ON ic.oid = i.indexrelid
    WHERE i.indrelid = p_table AND i.indisunique
      AND NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conindid = i.indexrelid)
      AND NOT (SELECT attnum FROM pg_attribute
               WHERE attrelid = p_table AND attname = 'tenant_id') = ANY (i.indkey::int2[])
  LOOP
    v_def := regexp_replace(r.def, ' USING (\w+) \(', ' USING \1 (tenant_id, ');
    EXECUTE format('DROP INDEX %I.%I', 'public', r.idx);
    EXECUTE v_def;
  END LOOP;

  -- d) RLS stricte : on repart de zéro
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', v_rel);
  FOR v_pol IN SELECT policyname FROM pg_policies
               WHERE schemaname = 'public' AND tablename = v_name LOOP
    EXECUTE format('DROP POLICY %I ON %s', v_pol, v_rel);
  END LOOP;

  EXECUTE format('CREATE POLICY tenant_select ON %s FOR SELECT TO authenticated USING (%s)',
                 v_rel, v_tenant_check);
  EXECUTE format('CREATE POLICY tenant_insert ON %s FOR INSERT TO authenticated WITH CHECK (%s)',
                 v_rel, v_write_check);
  -- history : journal d'audit en ajout seul
  IF v_name <> 'history' THEN
    EXECUTE format('CREATE POLICY tenant_update ON %s FOR UPDATE TO authenticated '
                   'USING (%s) WITH CHECK (%s)', v_rel, v_write_check, v_write_check);
    EXECUTE format('CREATE POLICY tenant_delete ON %s FOR DELETE TO authenticated USING (%s)',
                   v_rel, v_write_check);
  END IF;

  EXECUTE format('REVOKE ALL ON %s FROM anon, authenticated', v_rel);
  IF v_name = 'history' THEN
    EXECUTE format('GRANT SELECT, INSERT ON %s TO authenticated', v_rel);
  ELSE
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %s TO authenticated', v_rel);
  END IF;
END;
$$;

-- Ensemble des tables métier : toutes les tables de public sauf la plateforme
CREATE TEMP TABLE mt_scoped ON COMMIT DROP AS
SELECT c.oid::regclass AS rel
FROM pg_class c
WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
  AND c.relname NOT IN ('tenants', 'tenant_members', 'platform_admins');

-- ───────────────────────────────────────────────────────────────────────────
-- 4. FK entre tables métier → (tenant_id, col) REFERENCES t(tenant_id, col)
--    On mémorise, on retire, on réécrit PK/UNIQUE, puis on recrée.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TEMP TABLE mt_fks ON COMMIT DROP AS
SELECT c.conrelid::regclass AS rel, c.conname, pg_get_constraintdef(c.oid) AS def
FROM pg_constraint c
WHERE c.contype = 'f'
  AND c.conrelid  IN (SELECT rel FROM mt_scoped)
  AND c.confrelid IN (SELECT rel FROM mt_scoped)
  AND pg_get_constraintdef(c.oid) !~ '^FOREIGN KEY \(tenant_id,';

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM mt_fks LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.rel, r.conname);
  END LOOP;
END $$;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT rel FROM mt_scoped LOOP
    PERFORM public.mt_enable_tenant_isolation(r.rel);
  END LOOP;
END $$;

DO $$
DECLARE
  r      record;
  v_cols text;
  v_def  text;
BEGIN
  FOR r IN SELECT * FROM mt_fks LOOP
    v_cols := (regexp_match(r.def, '^FOREIGN KEY \(([^)]*)\)'))[1];
    v_def  := regexp_replace(r.def,
                '^FOREIGN KEY \(([^)]*)\) REFERENCES ([^(]+)\(([^)]*)\)',
                'FOREIGN KEY (tenant_id, \1) REFERENCES \2(tenant_id, \3)');
    IF v_def ~ 'ON UPDATE SET (NULL|DEFAULT)' THEN
      RAISE EXCEPTION 'FK % : ON UPDATE SET NULL/DEFAULT non géré', r.conname;
    END IF;
    -- SET NULL ne doit pas vider tenant_id (NOT NULL) : on limite aux colonnes métier
    v_def := regexp_replace(v_def, 'ON DELETE SET (NULL|DEFAULT)(?! \()',
                            'ON DELETE SET \1 (' || v_cols || ')');
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s', r.rel, r.conname, v_def);
  END LOOP;
END $$;

-- ───────────────────────────────────────────────────────────────────────────
-- 5. Vues : respecter la RLS de l'appelant
-- ───────────────────────────────────────────────────────────────────────────
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT c.oid::regclass AS v FROM pg_class c
           WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'v' LOOP
    EXECUTE format('ALTER VIEW %s SET (security_invoker = true)', r.v);
    EXECUTE format('REVOKE ALL ON %s FROM anon, authenticated', r.v);
    EXECUTE format('GRANT SELECT ON %s TO authenticated', r.v);
  END LOOP;
END $$;

-- ───────────────────────────────────────────────────────────────────────────
-- 6. Auteur imposé côté serveur (non falsifiable par le client)
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_history_stamp_actor()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.user_id    := auth.uid();
    NEW.user_email := coalesce(auth.email(), NEW.user_email);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_history_stamp_actor ON public.history;
CREATE TRIGGER trg_history_stamp_actor
  BEFORE INSERT ON public.history
  FOR EACH ROW EXECUTE FUNCTION public.fn_history_stamp_actor();

CREATE OR REPLACE FUNCTION public.fn_services_stamp_actor()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF TG_OP = 'INSERT' THEN
      NEW.created_by := coalesce(auth.email(), NEW.created_by);
    ELSE
      NEW.created_by := OLD.created_by;
    END IF;
    NEW.updated_by := coalesce(auth.email(), NEW.updated_by);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_services_stamp_actor ON public.services;
CREATE TRIGGER trg_services_stamp_actor
  BEFORE INSERT OR UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.fn_services_stamp_actor();

-- ───────────────────────────────────────────────────────────────────────────
-- 7. Fonctions existantes : SECURITY INVOKER (RLS appliquée), search_path figé
-- ───────────────────────────────────────────────────────────────────────────
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS f
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace AND p.prokind = 'f'
      AND p.proname NOT IN ('current_tenant_id', 'current_tenant_role', 'tenant_can_write',
                            'is_platform_admin', 'my_tenant_ids')
      AND p.proname NOT LIKE 'tenant\_%' AND p.proname NOT LIKE 'platform\_%'
      AND p.proname <> 'my_tenants'
      AND NOT EXISTS (SELECT 1 FROM pg_depend d
                      WHERE d.objid = p.oid AND d.deptype = 'e')   -- extensions
  LOOP
    EXECUTE format('ALTER FUNCTION %s SECURITY INVOKER', r.f);
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', r.f);
  END LOOP;
END $$;

-- Les triggers de cascade font `ON CONFLICT (id)` : la cible doit désormais
-- correspondre à la clé composite → `ON CONFLICT (tenant_id, id)`.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid, pg_get_functiondef(p.oid) AS def
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace AND p.prokind = 'f'
      AND pg_get_functiondef(p.oid) ~* 'ON CONFLICT \((?!\s*tenant_id)'
  LOOP
    EXECUTE regexp_replace(r.def, 'ON CONFLICT \((?!\s*tenant_id)', 'ON CONFLICT (tenant_id, ', 'gi');
  END LOOP;
END $$;

-- ───────────────────────────────────────────────────────────────────────────
-- 8. RPC plateforme / gestion des membres (seul chemin d'écriture sur ces tables)
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.my_tenants()
RETURNS TABLE (tenant_id uuid, name text, slug text, role text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT t.id, t.name, t.slug, m.role
  FROM public.tenant_members m
  JOIN public.tenants t ON t.id = m.tenant_id
  WHERE m.user_id = auth.uid() AND t.is_active
  ORDER BY t.name;
$$;

CREATE OR REPLACE FUNCTION public.tenant_assert_admin()
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_tid uuid := public.current_tenant_id();
BEGIN
  IF v_tid IS NULL OR public.current_tenant_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Accès refusé : administrateur de l''entreprise requis'
      USING ERRCODE = '42501';
  END IF;
  RETURN v_tid;
END;
$$;

CREATE OR REPLACE FUNCTION public.tenant_members_list()
RETURNS TABLE (user_id uuid, email text, role text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_tid uuid := public.tenant_assert_admin();
BEGIN
  RETURN QUERY
    SELECT m.user_id, u.email::text, m.role, m.created_at
    FROM public.tenant_members m
    JOIN auth.users u ON u.id = m.user_id
    WHERE m.tenant_id = v_tid
    ORDER BY u.email;
END;
$$;

CREATE OR REPLACE FUNCTION public.tenant_member_add(p_email text, p_role text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_tid uuid := public.tenant_assert_admin();
  v_uid uuid;
BEGIN
  IF p_role NOT IN ('admin', 'technicien', 'lecture') THEN
    RAISE EXCEPTION 'Rôle invalide : %', p_role USING ERRCODE = '22023';
  END IF;
  SELECT id INTO v_uid FROM auth.users WHERE lower(email) = lower(btrim(p_email));
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Aucun compte pour cet e-mail : invitez d''abord l''utilisateur'
      USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.tenant_members (tenant_id, user_id, role, created_by)
  VALUES (v_tid, v_uid, p_role, auth.uid())
  ON CONFLICT (tenant_id, user_id) DO NOTHING;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cet utilisateur est déjà membre' USING ERRCODE = '23505';
  END IF;
  RETURN v_uid;
END;
$$;

CREATE OR REPLACE FUNCTION public.tenant_member_set_role(p_user_id uuid, p_role text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_tid uuid := public.tenant_assert_admin();
BEGIN
  IF p_role NOT IN ('admin', 'technicien', 'lecture') THEN
    RAISE EXCEPTION 'Rôle invalide : %', p_role USING ERRCODE = '22023';
  END IF;
  -- verrou pour éviter deux rétrogradations concurrentes du dernier admin
  PERFORM 1 FROM public.tenant_members WHERE tenant_id = v_tid FOR UPDATE;
  IF p_role <> 'admin'
     AND (SELECT role FROM public.tenant_members WHERE tenant_id = v_tid AND user_id = p_user_id) = 'admin'
     AND (SELECT count(*) FROM public.tenant_members WHERE tenant_id = v_tid AND role = 'admin') <= 1 THEN
    RAISE EXCEPTION 'Impossible : il doit rester au moins un administrateur' USING ERRCODE = '23514';
  END IF;
  UPDATE public.tenant_members SET role = p_role WHERE tenant_id = v_tid AND user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membre introuvable' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.tenant_member_remove(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_tid uuid := public.tenant_assert_admin();
BEGIN
  PERFORM 1 FROM public.tenant_members WHERE tenant_id = v_tid FOR UPDATE;
  IF (SELECT role FROM public.tenant_members WHERE tenant_id = v_tid AND user_id = p_user_id) = 'admin'
     AND (SELECT count(*) FROM public.tenant_members WHERE tenant_id = v_tid AND role = 'admin') <= 1 THEN
    RAISE EXCEPTION 'Impossible : il doit rester au moins un administrateur' USING ERRCODE = '23514';
  END IF;
  DELETE FROM public.tenant_members WHERE tenant_id = v_tid AND user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membre introuvable' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_create_tenant(p_name text, p_slug text, p_admin_email text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_tid uuid;
  v_uid uuid;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Accès refusé : administrateur plateforme requis' USING ERRCODE = '42501';
  END IF;
  SELECT id INTO v_uid FROM auth.users WHERE lower(email) = lower(btrim(p_admin_email));
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Aucun compte pour cet e-mail : invitez d''abord l''utilisateur'
      USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.tenants (name, slug) VALUES (btrim(p_name), lower(btrim(p_slug)))
  RETURNING id INTO v_tid;
  INSERT INTO public.tenant_members (tenant_id, user_id, role, created_by)
  VALUES (v_tid, v_uid, 'admin', auth.uid());
  RETURN v_tid;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 9. RLS + droits des tables plateforme (lecture seule ; écriture via RPC)
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE public.tenants         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenants_select ON public.tenants;
CREATE POLICY tenants_select ON public.tenants FOR SELECT TO authenticated
  USING (id IN (SELECT public.my_tenant_ids()) OR (SELECT public.is_platform_admin()));

DROP POLICY IF EXISTS tenant_members_select ON public.tenant_members;
CREATE POLICY tenant_members_select ON public.tenant_members FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS platform_admins_select ON public.platform_admins;
CREATE POLICY platform_admins_select ON public.platform_admins FOR SELECT TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON public.tenants, public.tenant_members, public.platform_admins FROM anon, authenticated;
GRANT SELECT ON public.tenants, public.tenant_members, public.platform_admins TO authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- 10. Droits globaux : rien pour anon, y compris sur les objets futurs
-- ───────────────────────────────────────────────────────────────────────────
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon, PUBLIC;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
-- outils internes de migration : jamais exposés à l'API
REVOKE EXECUTE ON FUNCTION public.mt_enable_tenant_isolation(regclass) FROM authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, PUBLIC;

COMMIT;

-- Recharger le cache de schéma de PostgREST (nouvelles clés composites)
NOTIFY pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════════════
--  AMORÇAGE (à faire une fois, après avoir créé/invité ton compte dans
--  Supabase › Authentication) : remplace l'e-mail puis exécute.
-- ═══════════════════════════════════════════════════════════════════════════
-- INSERT INTO public.platform_admins (user_id)
--   SELECT id FROM auth.users WHERE email = 'ton-email@exemple.com'
--   ON CONFLICT DO NOTHING;
-- INSERT INTO public.tenant_members (tenant_id, user_id, role)
--   SELECT '00000000-0000-0000-0000-000000000001', id, 'admin'
--   FROM auth.users WHERE email = 'ton-email@exemple.com'
--   ON CONFLICT DO NOTHING;
