-- ═══════════════════════════════════════════════════════════════════════════════
-- ODF Manager V9r — Table de référence des technologies réseau
--
-- Objectif : remplacer le champ "type" texte libre dans equipements par une FK
-- vers une table de référence technologies (WDM, SDH, OTN, …).
--
-- Changements :
--   1. Nouvelle table  public.technologies (id, name, description, ordre)
--   2. Colonne FK      equipements.technologie_id → technologies(id)
--   3. Données de base (idempotentes via ON CONFLICT DO NOTHING)
--   4. RLS             allow_all (cohérent avec le reste du schéma)
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. TABLE technologies ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.technologies (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  ordre       INT  NOT NULL DEFAULT 99,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 2. COLONNE FK dans equipements ──────────────────────────────────────────
ALTER TABLE public.equipements
  ADD COLUMN IF NOT EXISTS technologie_id TEXT
    REFERENCES public.technologies(id) ON DELETE SET NULL;

-- ─── 3. DONNÉES DE BASE ───────────────────────────────────────────────────────
INSERT INTO public.technologies (id, name, description, ordre) VALUES
  ('WDM',    'WDM / DWDM',   'Dense Wavelength Division Multiplexing — transport optique multi-longueur d''onde',  1),
  ('CWDM',   'CWDM',         'Coarse Wavelength Division Multiplexing — multiplexage optique espacement large',    2),
  ('ROADM',  'OADM / ROADM', 'Optical Add-Drop Multiplexer — commutation optique reconfigurable',                 3),
  ('OTN',    'OTN',          'Optical Transport Network — encapsulation et transport numérique optique (G.709)',   4),
  ('SDH',    'SDH / SONET',  'Synchronous Digital Hierarchy — transmission numérique synchrone (G.707)',          5),
  ('PDH',    'PDH',          'Plesiochronous Digital Hierarchy — transport plésiochrone (E1/E3)',                  6),
  ('IPMLS',  'IP / MPLS',    'Routage IP avec commutation par étiquettes MPLS',                                   7),
  ('ETH',    'Ethernet',     'Commutation Ethernet L2 / L3',                                                      8),
  ('PASSIF', 'Passif',       'Équipement passif — répartiteur, splitteur, coupleur optique',                      9)
ON CONFLICT (id) DO NOTHING;

-- ─── 4. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE public.technologies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all" ON public.technologies;
CREATE POLICY "allow_all" ON public.technologies FOR ALL USING (true) WITH CHECK (true);

COMMIT;

-- ─── Vérification visuelle ────────────────────────────────────────────────────
SELECT id, name, ordre FROM public.technologies ORDER BY ordre;
