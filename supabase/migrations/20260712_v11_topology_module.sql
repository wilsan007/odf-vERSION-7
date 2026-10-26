-- ═══════════════════════════════════════════════════════════════════════════
-- v11 — MODULE C : TOPOLOGIE CÂBLE SOUS-MARIN (DARE1 Segments / Line Pairs)
-- ═══════════════════════════════════════════════════════════════════════════
-- Modélise le « wet plant » : les SEGMENTS de câble entre stations (spans) et
-- les LINE PAIRS (paires de fibres) qui y circulent. Fait le pont avec le
-- module Inventaire (v10) : les composants inventoriés portent déjà des colonnes
-- Seg (segment) et LP (line pair) → la vue vue_topo_inventaire agrège ce qui est
-- réellement installé par (station, segment, line_pair).
--
-- IDEMPOTENT : CREATE TABLE IF NOT EXISTS, DROP POLICY IF EXISTS.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Segments (span de câble entre deux stations / BU) ────────────────────────
CREATE TABLE IF NOT EXISTS public.topo_segments (
  id            TEXT PRIMARY KEY,            -- ex. 'SEG-DJIBOUTI-BOSASO'
  systeme       TEXT DEFAULT 'DARE1',
  nom           TEXT,                        -- libellé (ex. 'S1', 'Djibouti–Bosaso')
  station_a     TEXT NOT NULL,
  station_b     TEXT,
  longueur_km   NUMERIC(10,2),
  nombre_fibres INT,
  statut        TEXT NOT NULL DEFAULT 'ACTIF'
                  CHECK (statut IN ('ACTIF','PLANIFIE','HS')),
  remarques     TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  created_by    TEXT
);

-- ── Line pairs (paires de fibres portées par un segment) ─────────────────────
CREATE TABLE IF NOT EXISTS public.topo_line_pairs (
  id            TEXT PRIMARY KEY,            -- ex. 'SEG-DJIBOUTI-BOSASO-LP1-3'
  segment_id    TEXT NOT NULL REFERENCES public.topo_segments(id) ON DELETE CASCADE,
  systeme       TEXT DEFAULT 'DARE1',
  numero        TEXT NOT NULL,              -- '1-3', '2', '1-2'…
  station_a     TEXT,
  station_b     TEXT,
  statut        TEXT NOT NULL DEFAULT 'ACTIF'
                  CHECK (statut IN ('ACTIF','RESERVE','HS')),
  capacite_gbps NUMERIC(12,2),
  remarques     TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (segment_id, numero)
);

CREATE INDEX IF NOT EXISTS idx_topo_lp_segment ON public.topo_line_pairs (segment_id);

-- ── RLS (même pattern : allow_all) ───────────────────────────────────────────
ALTER TABLE public.topo_segments   ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all" ON public.topo_segments;
CREATE POLICY "allow_all" ON public.topo_segments   FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.topo_line_pairs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all" ON public.topo_line_pairs;
CREATE POLICY "allow_all" ON public.topo_line_pairs FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.topo_segments   TO anon, authenticated, service_role;
GRANT ALL ON public.topo_line_pairs TO anon, authenticated, service_role;

-- ── Pont Inventaire → Topologie ──────────────────────────────────────────────
-- Agrège ce qui est réellement installé par (station, segment, line_pair).
-- Robuste à l'absence de la table inventaire (v10 non appliquée) : renvoie vide.
CREATE OR REPLACE VIEW public.vue_topo_inventaire AS
SELECT
  station,
  NULLIF(segment, '')   AS segment,
  NULLIF(line_pair, '') AS line_pair,
  COUNT(*)                                                  AS total_items,
  COUNT(*) FILTER (WHERE categorie IN ('SLTE','LTE','PSB')) AS total_slte,
  COUNT(*) FILTER (WHERE categorie = 'PFE')                AS total_pfe,
  COUNT(*) FILTER (WHERE categorie = 'TEMS')               AS total_tems
FROM public.inventaire_items
WHERE NULLIF(segment, '') IS NOT NULL
GROUP BY station, NULLIF(segment, ''), NULLIF(line_pair, '');

GRANT SELECT ON public.vue_topo_inventaire TO anon, authenticated, service_role;
