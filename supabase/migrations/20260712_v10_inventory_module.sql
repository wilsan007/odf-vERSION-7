-- ═══════════════════════════════════════════════════════════════════════════
-- v10 — MODULE INVENTAIRE D'ACTIFS / AS-BUILT (DARE1 Station Inventory)
-- ═══════════════════════════════════════════════════════════════════════════
-- Ajoute la gestion de l'inventaire matériel physique des stations de câble
-- sous-marin (SubCom / Ciena / PFE / TEMS), alimenté par import des fichiers
-- Excel "Station Inventory" (un fichier par station : Djibouti, Mombasa,
-- Bosaso, Mogadishu…).
--
-- Modèle : chaque LIGNE d'un onglet inventaire = un composant (circuit pack,
-- carte, module, accessoire) rattaché à une baie / tiroir / slot, avec son
-- numéro de série et son part number. La colonne `raw` conserve la ligne
-- source intégrale (aucune perte de donnée). Un document = une révision
-- (Issue) d'inventaire pour une station.
--
-- IDEMPOTENT : CREATE TABLE IF NOT EXISTS, DROP POLICY IF EXISTS avant CREATE.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Documents d'inventaire (une révision As-Built par station) ───────────────
CREATE TABLE IF NOT EXISTS public.inventaire_documents (
  id             TEXT PRIMARY KEY,            -- ex. 'DARE1-DJIBOUTI-I2'
  systeme        TEXT DEFAULT 'DARE1',        -- système câble
  station        TEXT NOT NULL,               -- Djibouti / Mombasa / Bosaso / Mogadishu
  issue          TEXT,                        -- '1.0', '2.0'…
  issue_date     DATE,
  owner_engineer TEXT,
  approver       TEXT,
  reason         TEXT,                        -- Reason for Change
  filename       TEXT,
  item_count     INT DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  created_by     TEXT
);

-- ── Lignes d'inventaire (composants) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inventaire_items (
  id                BIGSERIAL PRIMARY KEY,
  document_id       TEXT REFERENCES public.inventaire_documents(id) ON DELETE CASCADE,
  systeme           TEXT,
  station           TEXT NOT NULL,
  categorie         TEXT,          -- SLTE / LTE / PFE / TEMS / PSB / AUTRE
  sheet_name        TEXT,          -- onglet source
  segment           TEXT,          -- Seg (ex. 'S1')
  line_pair         TEXT,          -- LP  (ex. '1-3', '2')
  equip_type        TEXT,          -- 'G4 SLTE', 'Ciena LTE', 'PFE', 'TEMS Bay'…
  equip_location    TEXT,          -- R.01, A2, Sh.01…
  bay_sn            TEXT,          -- Bay S/N
  shelf_descrip     TEXT,          -- Common Shelf, Ciena Shelf, CONVERTER BAY…
  shelf_sn          TEXT,          -- Shelf S/N
  tems_shelf_id     TEXT,
  loc_bay           TEXT,          -- Location : Bay
  loc_shelf         TEXT,          -- Location : Shelf
  loc_slot          TEXT,          -- Location : Slot (ex. '5-6', '7-8 PT. 29')
  description       TEXT,          -- libellé du composant
  part_number       TEXT,
  version           TEXT,
  serial_nr         TEXT,
  statut_inventaire TEXT NOT NULL DEFAULT 'EQUIPE'
                      CHECK (statut_inventaire IN ('EQUIPE','UNEQUIPPED','MISSING','NA','UNAVAIL')),
  is_spare          BOOLEAN NOT NULL DEFAULT FALSE,
  remarques         TEXT,
  raw               JSONB,         -- ligne source intégrale (header → valeur)
  row_index         INT,           -- index de ligne dans l'onglet source
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_items_document ON public.inventaire_items (document_id);
CREATE INDEX IF NOT EXISTS idx_inv_items_station  ON public.inventaire_items (station);
CREATE INDEX IF NOT EXISTS idx_inv_items_cat      ON public.inventaire_items (categorie);
CREATE INDEX IF NOT EXISTS idx_inv_items_part     ON public.inventaire_items (part_number);
CREATE INDEX IF NOT EXISTS idx_inv_items_serial   ON public.inventaire_items (serial_nr);

-- ── RLS (même pattern que le reste de l'app : allow_all) ─────────────────────
ALTER TABLE public.inventaire_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all" ON public.inventaire_documents;
CREATE POLICY "allow_all" ON public.inventaire_documents FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.inventaire_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all" ON public.inventaire_items;
CREATE POLICY "allow_all" ON public.inventaire_items FOR ALL USING (true) WITH CHECK (true);

-- Accès roles Supabase (lecture/écriture via clé anon + authenticated)
GRANT ALL ON public.inventaire_documents TO anon, authenticated, service_role;
GRANT ALL ON public.inventaire_items      TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.inventaire_items_id_seq TO anon, authenticated, service_role;

-- ── Vue agrégée par station (contourne max_rows pour le tableau de bord) ─────
CREATE OR REPLACE VIEW public.vue_inventaire_stats AS
SELECT
  station,
  COUNT(*)                                         AS total_items,
  COUNT(*) FILTER (WHERE is_spare)                 AS total_spares,
  COUNT(DISTINCT NULLIF(bay_sn,''))                AS total_bays,
  COUNT(*) FILTER (WHERE serial_nr IS NOT NULL
                     AND serial_nr <> ''
                     AND upper(serial_nr) NOT IN ('N/A','NA','UNAVAIL')) AS total_serials,
  COUNT(*) FILTER (WHERE categorie = 'PFE')        AS total_pfe,
  COUNT(*) FILTER (WHERE categorie = 'TEMS')       AS total_tems,
  COUNT(*) FILTER (WHERE categorie IN ('SLTE','LTE','PSB')) AS total_slte
FROM public.inventaire_items
GROUP BY station;

GRANT SELECT ON public.vue_inventaire_stats TO anon, authenticated, service_role;
