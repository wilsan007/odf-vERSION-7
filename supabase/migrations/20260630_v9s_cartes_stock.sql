-- ═══════════════════════════════════════════════════════════════════════════════
-- ODF Manager V9s — Catalogue des cartes & base pour la gestion de stock
--
-- Nouvelles tables :
--   1. carte_modeles  — catalogue des types de cartes (référentiel)
--   2. cartes         — cartes physiques avec numéro de série (stock/installé)
--   3. lots           — lots de réception (pour module stock futur)
--
-- Modifications :
--   4. equipement_slots.carte_id  FK → cartes(id)
--
-- Toutes les tables ont RLS "allow_all" cohérent avec le reste du schéma.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. CATALOGUE DES MODÈLES DE CARTES ──────────────────────────────────────
-- Référentiel des types de cartes (sans lien à un équipement physique).
-- Chaque modèle décrit une famille de cartes : fabricant, technologie, nb ports.
CREATE TABLE IF NOT EXISTS public.carte_modeles (
  id              TEXT PRIMARY KEY,               -- ex. 'CIENA-AM-LM100G'
  nom             TEXT NOT NULL,                  -- label affiché
  fabricant       TEXT,                           -- ex. 'CIENA', 'TEJAS', 'HUAWEI'
  technologie_id  TEXT REFERENCES public.technologies(id) ON DELETE SET NULL,
  ports_count     INT  NOT NULL DEFAULT 12
                  CHECK (ports_count BETWEEN 1 AND 256),
  description     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 2. CARTES PHYSIQUES (STOCK) ─────────────────────────────────────────────
-- Chaque ligne = une carte physique réelle avec son numéro de série.
-- Une carte peut être : en stock, installée dans un slot, défaillante ou retirée.
CREATE TABLE IF NOT EXISTS public.cartes (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  modele_id       TEXT NOT NULL REFERENCES public.carte_modeles(id),
  serial_number   TEXT UNIQUE,                    -- saisi manuellement
  etat            TEXT NOT NULL DEFAULT 'EN_STOCK'
                  CHECK (etat IN ('EN_STOCK', 'INSTALLEE', 'DEFAILLANTE', 'RETIREE')),
  lot_id          TEXT,                           -- FK ajoutée après création de lots
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 3. LOTS DE RÉCEPTION (BASE POUR GESTION DE STOCK) ───────────────────────
-- Lot = bon de commande / livraison. Regroupe des cartes et équipements reçus.
-- Table conçue pour accueillir le futur module de stock sans migration lourde.
CREATE TABLE IF NOT EXISTS public.lots (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  reference       TEXT NOT NULL UNIQUE,           -- nº BL / nº commande
  fournisseur_id  TEXT REFERENCES public.fournisseurs(id) ON DELETE SET NULL,
  date_reception  DATE,
  type_contenu    TEXT CHECK (type_contenu IN ('CARTES','EQUIPEMENTS','CABLES','ODF','MIXTE')),
  statut          TEXT NOT NULL DEFAULT 'RECU'
                  CHECK (statut IN ('EN_ATTENTE','RECU','VERIFIE','CLOTURE')),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Lier cartes → lots (après création de la table lots)
ALTER TABLE public.cartes DROP CONSTRAINT IF EXISTS fk_cartes_lot;
ALTER TABLE public.cartes
  ADD CONSTRAINT fk_cartes_lot
  FOREIGN KEY (lot_id) REFERENCES public.lots(id) ON DELETE SET NULL;

-- ─── 4. FK carte_id DANS equipement_slots ────────────────────────────────────
-- Permet de savoir quelle carte physique est installée dans quel slot.
ALTER TABLE public.equipement_slots
  ADD COLUMN IF NOT EXISTS carte_id TEXT
    REFERENCES public.cartes(id) ON DELETE SET NULL;

-- ─── 5. SEED : MODÈLES DE CARTES COURANTS ────────────────────────────────────
-- Données de base pour le catalogue. Idempotentes (ON CONFLICT DO NOTHING).
INSERT INTO public.carte_modeles (id, nom, fabricant, technologie_id, ports_count, description) VALUES
  -- CIENA
  ('CIENA-AM-LM10G',   '10G Line Module',           'CIENA',   'WDM',    2,  'Carte ligne 10G DWDM — CIENA 6500'),
  ('CIENA-AM-LM100G',  '100G Coherent Module',      'CIENA',   'WDM',    2,  'Carte ligne 100G cohérente — CIENA 6500'),
  ('CIENA-AM-MR48',    '48-port Mux/Demux',         'CIENA',   'WDM',   48,  'Multiplex/démultiplex 48 canaux'),
  ('CIENA-AM-OTR10G',  'OTR 10G Tributary',         'CIENA',   'OTN',   10,  'Carte tributaire OTN 10x10G'),
  -- TEJAS
  ('TEJAS-LC-10GE',    '10GE Line Card 12p',        'TEJAS',   'ETH',   12,  'Carte Ethernet 10GE 12 ports'),
  ('TEJAS-LC-1GE24',   '1GE Line Card 24p',         'TEJAS',   'ETH',   24,  'Carte Ethernet 1GE 24 ports'),
  ('TEJAS-LC-OTU2',    'OTU2 Tributary Card 8p',    'TEJAS',   'OTN',    8,  'Carte tributaire OTU2 8 ports'),
  -- HUAWEI
  ('HW-TN52LQM',       'LQM 40G DWDM',              'HUAWEI',  'WDM',    2,  'Carte DWDM 40G — OptiX OSN'),
  ('HW-TN52NS3',       'NS3 8x10G OTN Card',        'HUAWEI',  'OTN',    8,  'Carte OTN 8 ports 10G'),
  -- NOKIA
  ('NOKIA-SFP-1G24',   '24p SFP 1G Card',           'NOKIA',   'ETH',   24,  'Carte 24 ports SFP 1G — Nokia 1830'),
  ('NOKIA-SFP-10G8',   '8p SFP+ 10G Card',          'NOKIA',   'ETH',    8,  'Carte 8 ports SFP+ 10G — Nokia 1830'),
  -- Passif / Générique
  ('PASS-16F',         'Passif 16 fibres',           'GENERIC', 'PASSIF',16,  'Module passif 16 fibres'),
  ('PASS-32F',         'Passif 32 fibres',           'GENERIC', 'PASSIF',32,  'Module passif 32 fibres'),
  ('PASS-48F',         'Passif 48 fibres',           'GENERIC', 'PASSIF',48,  'Module passif 48 fibres')
ON CONFLICT (id) DO NOTHING;

-- ─── 6. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE public.carte_modeles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cartes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lots          ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all" ON public.carte_modeles;
DROP POLICY IF EXISTS "allow_all" ON public.cartes;
DROP POLICY IF EXISTS "allow_all" ON public.lots;

CREATE POLICY "allow_all" ON public.carte_modeles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON public.cartes        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON public.lots          FOR ALL USING (true) WITH CHECK (true);

COMMIT;

-- ─── Vérification ─────────────────────────────────────────────────────────────
SELECT id, nom, fabricant, technologie_id, ports_count FROM public.carte_modeles ORDER BY fabricant, id;
