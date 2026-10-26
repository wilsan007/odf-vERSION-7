-- ═══════════════════════════════════════════════════════════════════════════════
-- ODF Manager V9t — Correctif RLS pour les tables équipements
--
-- Problème : equipements / equipement_slots / equipement_ports ont été créés
-- sans ENABLE ROW LEVEL SECURITY ni policy → Supabase bloque tous les INSERT
-- (erreur 401 / "new row violates row-level security policy").
--
-- Correction : aligner sur le reste du schéma avec policy "allow_all".
--
-- Bonus : étendre la contrainte ports_count à 256 (cartes DWDM denses).
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. RLS : equipements ─────────────────────────────────────────────────────
ALTER TABLE public.equipements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all" ON public.equipements;
CREATE POLICY "allow_all" ON public.equipements FOR ALL USING (true) WITH CHECK (true);

-- ─── 2. RLS : equipement_slots ───────────────────────────────────────────────
ALTER TABLE public.equipement_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all" ON public.equipement_slots;
CREATE POLICY "allow_all" ON public.equipement_slots FOR ALL USING (true) WITH CHECK (true);

-- ─── 3. RLS : equipement_ports ───────────────────────────────────────────────
ALTER TABLE public.equipement_ports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all" ON public.equipement_ports;
CREATE POLICY "allow_all" ON public.equipement_ports FOR ALL USING (true) WITH CHECK (true);

-- ─── 4. Étendre la limite ports_count de 96 → 256 ────────────────────────────
-- Certaines cartes DWDM/OTN ont plus de 96 ports (ex. mux 128 canaux).
ALTER TABLE public.equipement_slots
  DROP CONSTRAINT IF EXISTS equipement_slots_ports_count_check;

ALTER TABLE public.equipement_slots
  ADD CONSTRAINT equipement_slots_ports_count_check
  CHECK (ports_count BETWEEN 1 AND 256);

COMMIT;

-- ─── Vérification ─────────────────────────────────────────────────────────────
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('equipements','equipement_slots','equipement_ports');
