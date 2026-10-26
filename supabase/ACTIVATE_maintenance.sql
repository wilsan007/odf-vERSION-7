-- ═══════════════════════════════════════════════════════════════════════════
-- ACTIVATION MODULE MAINTENANCE + CALENDRIER — script unique à coller
-- (Éditeur SQL Supabase). Prérequis : inventaire v10 déjà appliqué + peuplé.
-- Crée la table référente `maintenances` + colonnes de localisation, puis
-- injecte des données de démo pour le calendrier. Idempotent (re-exécutable).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. TABLES / COLONNES RÉFÉRENTES (DDL idempotent) ─────────────────────────
ALTER TABLE public.inventaire_items ADD COLUMN IF NOT EXISTS emp_salle    TEXT;
ALTER TABLE public.inventaire_items ADD COLUMN IF NOT EXISTS emp_halle    TEXT;
ALTER TABLE public.inventaire_items ADD COLUMN IF NOT EXISTS emp_niveau   TEXT;
ALTER TABLE public.inventaire_items ADD COLUMN IF NOT EXISTS emp_rack     TEXT;
ALTER TABLE public.inventaire_items ADD COLUMN IF NOT EXISTS emp_chassis  TEXT;
ALTER TABLE public.inventaire_items ADD COLUMN IF NOT EXISTS emp_position TEXT;
ALTER TABLE public.inventaire_items ADD COLUMN IF NOT EXISTS port_id TEXT
  REFERENCES public.ports(id) ON DELETE SET NULL;
ALTER TABLE public.inventaire_items ADD COLUMN IF NOT EXISTS emp_updated_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_inv_items_port ON public.inventaire_items (port_id);

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
  date_prevue   DATE NOT NULL,
  date_realisee DATE,
  titre         TEXT,
  description   TEXT,
  assigne       TEXT,
  port_id       TEXT REFERENCES public.ports(id) ON DELETE SET NULL,
  service_cid   TEXT,
  service_label TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  created_by    TEXT
);
CREATE INDEX IF NOT EXISTS idx_maint_item   ON public.maintenances (item_id);
CREATE INDEX IF NOT EXISTS idx_maint_statut ON public.maintenances (statut);
CREATE INDEX IF NOT EXISTS idx_maint_date   ON public.maintenances (date_prevue);

ALTER TABLE public.maintenances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all" ON public.maintenances;
CREATE POLICY "allow_all" ON public.maintenances FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON public.maintenances TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.maintenances_id_seq TO anon, authenticated, service_role;

CREATE OR REPLACE VIEW public.vue_maintenances AS
SELECT m.*,
  i.description AS item_description, i.part_number AS item_part_number,
  i.serial_nr AS item_serial, i.categorie AS item_categorie,
  (m.statut IN ('PLANIFIE','EN_COURS') AND m.date_prevue < CURRENT_DATE) AS en_retard
FROM public.maintenances m
LEFT JOIN public.inventaire_items i ON i.id = m.item_id;
GRANT SELECT ON public.vue_maintenances TO anon, authenticated, service_role;

-- ── 2. DONNÉES DE DÉMO ───────────────────────────────────────────────────────
DELETE FROM public.maintenances WHERE created_by = 'SEED';

-- Localisation de quelques pièces
UPDATE public.inventaire_items SET emp_salle='Salle SLTE', emp_halle='Hall A', emp_niveau='Niveau 1',
  emp_rack='Baie 020114.05', emp_chassis='Ciena Shelf Sh.01', emp_position='Slot 3', emp_updated_at=NOW()
WHERE id IN (SELECT id FROM public.inventaire_items WHERE station='Djibouti' AND categorie='SLTE' ORDER BY id LIMIT 10);
UPDATE public.inventaire_items SET emp_salle='Salle PFE', emp_halle='Hall B', emp_niveau='Niveau 0',
  emp_rack='Converter Bay', emp_position='Slot 5', emp_updated_at=NOW()
WHERE id IN (SELECT id FROM public.inventaire_items WHERE station='Djibouti' AND categorie='PFE' ORDER BY id LIMIT 6);
UPDATE public.inventaire_items SET emp_salle='Salle NOC', emp_halle='Hall A', emp_niveau='Niveau 1',
  emp_rack='TEMS Bay', emp_chassis='24x24', emp_updated_at=NOW()
WHERE id IN (SELECT id FROM public.inventaire_items WHERE station='Djibouti' AND categorie='TEMS' ORDER BY id LIMIT 5);
UPDATE public.inventaire_items SET emp_salle='Salle SLTE', emp_halle='Hall A', emp_niveau='Niveau 1', emp_rack='Baie principale', emp_updated_at=NOW()
WHERE id IN (SELECT id FROM public.inventaire_items WHERE station IN ('Bosaso','Mombasa','Mogadishu') AND categorie='SLTE' ORDER BY id LIMIT 12);

-- Maintenances (dates relatives à aujourd'hui → calendrier toujours peuplé)
INSERT INTO public.maintenances (item_id, station, type, statut, priorite, date_prevue, titre, description, assigne, service_cid, created_by)
SELECT id, station, 'REMPLACEMENT','PLANIFIE','CRITIQUE', CURRENT_DATE-5, 'Remplacement carte LME défaillante', 'Alarme persistante — spare requis.', 'Omar A.', 'DJT-20260112093000','SEED'
FROM public.inventaire_items WHERE station='Djibouti' AND categorie='SLTE' ORDER BY id LIMIT 1 OFFSET 4;
INSERT INTO public.maintenances (item_id, station, type, statut, priorite, date_prevue, titre, description, assigne, created_by)
SELECT id, station, 'INSPECTION','EN_COURS','NORMALE', CURRENT_DATE-2, 'Inspection ventilation', 'Contrôle température baie.', 'Fatouma H.','SEED'
FROM public.inventaire_items WHERE station='Djibouti' AND categorie='SLTE' ORDER BY id LIMIT 1 OFFSET 6;
INSERT INTO public.maintenances (item_id, station, type, statut, priorite, date_prevue, titre, description, assigne, service_cid, created_by)
SELECT id, station, 'RETRAIT','EN_COURS','CRITIQUE', CURRENT_DATE-1, 'Retrait module HS', 'Module en défaut — desservait un service.', 'Ali M.', 'DJT-20260105140000','SEED'
FROM public.inventaire_items WHERE station='Bosaso' AND categorie='SLTE' ORDER BY id LIMIT 1 OFFSET 3;
INSERT INTO public.maintenances (item_id, station, type, statut, priorite, date_prevue, titre, description, assigne, created_by)
SELECT id, station, 'MAINTENANCE','PLANIFIE','HAUTE', CURRENT_DATE, 'Maintenance préventive PFE', 'Nettoyage + contrôle converters.', 'Omar A.','SEED'
FROM public.inventaire_items WHERE station='Djibouti' AND categorie='PFE' ORDER BY id LIMIT 1 OFFSET 2;
INSERT INTO public.maintenances (item_id, station, type, statut, priorite, date_prevue, titre, description, assigne, service_cid, created_by)
SELECT id, station, 'MODIFICATION','PLANIFIE','NORMALE', CURRENT_DATE+1, 'Reconfiguration WSS', 'Ajout canal — impact service à vérifier.', 'Nadia K.', 'DJT-20260110110000','SEED'
FROM public.inventaire_items WHERE station='Djibouti' AND categorie='SLTE' ORDER BY id LIMIT 1 OFFSET 9;
INSERT INTO public.maintenances (item_id, station, type, statut, priorite, date_prevue, titre, description, assigne, created_by)
SELECT id, station, 'REMPLACEMENT','PLANIFIE','HAUTE', CURRENT_DATE+3, 'Remplacement SFP', 'Préventif — fin de vie.', 'Ali M.','SEED'
FROM public.inventaire_items WHERE station='Mombasa' AND categorie='SLTE' ORDER BY id LIMIT 1 OFFSET 5;
INSERT INTO public.maintenances (item_id, station, type, statut, priorite, date_prevue, titre, description, assigne, created_by)
SELECT id, station, 'INSPECTION','PLANIFIE','BASSE', CURRENT_DATE+4, 'Inspection annuelle', 'Vérification générale baie.', 'Fatouma H.','SEED'
FROM public.inventaire_items WHERE station='Bosaso' AND categorie='TEMS' ORDER BY id LIMIT 1 OFFSET 1;
INSERT INTO public.maintenances (item_id, station, type, statut, priorite, date_prevue, titre, description, assigne, service_cid, created_by)
SELECT id, station, 'MAINTENANCE','PLANIFIE','NORMALE', CURRENT_DATE+6, 'Maintenance TEMS', 'Mise à jour serveur supervision.', 'Nadia K.', 'DJT-20260118080000','SEED'
FROM public.inventaire_items WHERE station='Mogadishu' AND categorie='SLTE' ORDER BY id LIMIT 1 OFFSET 2;
INSERT INTO public.maintenances (item_id, station, type, statut, priorite, date_prevue, titre, description, assigne, created_by)
SELECT id, station, 'RETRAIT','PLANIFIE','NORMALE', CURRENT_DATE+7, 'Retrait carte obsolète', 'Décommissionnement planifié.', 'Ali M.','SEED'
FROM public.inventaire_items WHERE station='Djibouti' AND categorie='PFE' ORDER BY id LIMIT 1 OFFSET 4;
INSERT INTO public.maintenances (item_id, station, type, statut, priorite, date_prevue, titre, description, assigne, created_by)
SELECT id, station, 'MAINTENANCE','PLANIFIE','NORMALE', CURRENT_DATE+10, 'Contrôle alimentation', 'Test batteries / redondance.', 'Omar A.','SEED'
FROM public.inventaire_items WHERE station='Djibouti' AND categorie='TEMS' ORDER BY id LIMIT 1 OFFSET 1;
INSERT INTO public.maintenances (item_id, station, type, statut, priorite, date_prevue, titre, description, assigne, created_by)
SELECT id, station, 'REMPLACEMENT','PLANIFIE','CRITIQUE', CURRENT_DATE+14, 'Remplacement amplificateur', 'Dégradation performance mesurée.', 'Nadia K.','SEED'
FROM public.inventaire_items WHERE station='Mombasa' AND categorie='SLTE' ORDER BY id LIMIT 1 OFFSET 8;
INSERT INTO public.maintenances (item_id, station, type, statut, priorite, date_prevue, titre, description, assigne, created_by)
SELECT id, station, 'INSPECTION','PLANIFIE','NORMALE', CURRENT_DATE+18, 'Inspection trimestrielle', 'Ronde de contrôle.', 'Fatouma H.','SEED'
FROM public.inventaire_items WHERE station='Mogadishu' AND categorie='PFE' ORDER BY id LIMIT 1 OFFSET 1;
INSERT INTO public.maintenances (item_id, station, type, statut, priorite, date_prevue, date_realisee, titre, description, assigne, created_by)
SELECT id, station, 'MAINTENANCE','FAIT','NORMALE', CURRENT_DATE-12, CURRENT_DATE-11, 'Maintenance réalisée', 'Nettoyage effectué, RAS.', 'Omar A.','SEED'
FROM public.inventaire_items WHERE station='Djibouti' AND categorie='SLTE' ORDER BY id LIMIT 1 OFFSET 11;
INSERT INTO public.maintenances (item_id, station, type, statut, priorite, date_prevue, date_realisee, titre, description, assigne, created_by)
SELECT id, station, 'REMPLACEMENT','FAIT','HAUTE', CURRENT_DATE-8, CURRENT_DATE-8, 'Carte remplacée', 'Spare installé, service rétabli.', 'Ali M.','SEED'
FROM public.inventaire_items WHERE station='Bosaso' AND categorie='SLTE' ORDER BY id LIMIT 1 OFFSET 6;
INSERT INTO public.maintenances (item_id, station, type, statut, priorite, date_prevue, titre, description, assigne, created_by)
SELECT id, station, 'MODIFICATION','PLANIFIE','HAUTE', CURRENT_DATE+2, 'Mise à niveau firmware', 'Upgrade planifié hors service.', 'Nadia K.','SEED'
FROM public.inventaire_items WHERE station='Mombasa' AND categorie='TEMS' ORDER BY id LIMIT 1 OFFSET 0;

-- Rafraîchit le cache PostgREST (sinon erreur PGRST205 côté app)
NOTIFY pgrst, 'reload schema';

-- Récap
SELECT statut, COUNT(*) AS nb FROM public.maintenances WHERE created_by='SEED' GROUP BY statut ORDER BY statut;
