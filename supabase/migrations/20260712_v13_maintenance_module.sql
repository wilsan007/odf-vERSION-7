-- ═══════════════════════════════════════════════════════════════════════════
-- v13 — MODULE E : LOCALISATION PHYSIQUE & MAINTENANCE PLANIFIÉE (GMAO)
-- ═══════════════════════════════════════════════════════════════════════════
-- 1) Localisation : où est physiquement installée chaque pièce d'inventaire
--    (salle / halle / niveau / rack / châssis / position) + lien optionnel vers
--    un port ODF → permet de récupérer le CID du service desservi.
-- 2) Maintenances : planning d'opérations (remplacement, retrait, modification,
--    inspection, maintenance) sur une pièce, avec date prévue obligatoire,
--    statut, priorité, et CID du service impacté figé au moment du planning.
--
-- IDEMPOTENT : ADD COLUMN IF NOT EXISTS, CREATE TABLE IF NOT EXISTS,
-- DROP POLICY IF EXISTS.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Localisation physique sur les pièces d'inventaire ─────────────────────
ALTER TABLE public.inventaire_items ADD COLUMN IF NOT EXISTS emp_salle    TEXT;
ALTER TABLE public.inventaire_items ADD COLUMN IF NOT EXISTS emp_halle    TEXT;
ALTER TABLE public.inventaire_items ADD COLUMN IF NOT EXISTS emp_niveau   TEXT;
ALTER TABLE public.inventaire_items ADD COLUMN IF NOT EXISTS emp_rack     TEXT;
ALTER TABLE public.inventaire_items ADD COLUMN IF NOT EXISTS emp_chassis  TEXT;
ALTER TABLE public.inventaire_items ADD COLUMN IF NOT EXISTS emp_position TEXT;
-- Lien optionnel vers un port ODF (pour récupérer le service/CID desservi)
ALTER TABLE public.inventaire_items ADD COLUMN IF NOT EXISTS port_id TEXT
  REFERENCES public.ports(id) ON DELETE SET NULL;
ALTER TABLE public.inventaire_items ADD COLUMN IF NOT EXISTS emp_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_inv_items_port ON public.inventaire_items (port_id);

-- ── 2. Table des maintenances planifiées ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.maintenances (
  id            BIGSERIAL PRIMARY KEY,
  item_id       BIGINT REFERENCES public.inventaire_items(id) ON DELETE CASCADE,
  station       TEXT,
  type          TEXT NOT NULL DEFAULT 'MAINTENANCE'
                  CHECK (type IN ('MAINTENANCE','REMPLACEMENT','RETRAIT','MODIFICATION','INSPECTION')),
  statut        TEXT NOT NULL DEFAULT 'PLANIFIE'
                  CHECK (statut IN ('PLANIFIE','EN_COURS','FAIT','ANNULE')),
  priorite      TEXT NOT NULL DEFAULT 'NORMALE'
                  CHECK (priorite IN ('BASSE','NORMALE','HAUTE','CRITIQUE')),
  date_prevue   DATE NOT NULL,                 -- planning amont OBLIGATOIRE
  date_realisee DATE,
  titre         TEXT,
  description   TEXT,
  assigne       TEXT,                          -- technicien assigné
  port_id       TEXT REFERENCES public.ports(id) ON DELETE SET NULL,
  service_cid   TEXT,                          -- CID du service impacté (figé)
  service_label TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  created_by    TEXT
);

CREATE INDEX IF NOT EXISTS idx_maint_item   ON public.maintenances (item_id);
CREATE INDEX IF NOT EXISTS idx_maint_statut ON public.maintenances (statut);
CREATE INDEX IF NOT EXISTS idx_maint_date   ON public.maintenances (date_prevue);

-- ── RLS (même pattern : allow_all) ───────────────────────────────────────────
ALTER TABLE public.maintenances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all" ON public.maintenances;
CREATE POLICY "allow_all" ON public.maintenances FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.maintenances TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.maintenances_id_seq TO anon, authenticated, service_role;

-- ── Vue : maintenances enrichies (pièce + retard calculé) ────────────────────
CREATE OR REPLACE VIEW public.vue_maintenances AS
SELECT
  m.*,
  i.description  AS item_description,
  i.part_number  AS item_part_number,
  i.serial_nr    AS item_serial,
  i.categorie    AS item_categorie,
  (m.statut IN ('PLANIFIE','EN_COURS') AND m.date_prevue < CURRENT_DATE) AS en_retard
FROM public.maintenances m
LEFT JOIN public.inventaire_items i ON i.id = m.item_id;

GRANT SELECT ON public.vue_maintenances TO anon, authenticated, service_role;
