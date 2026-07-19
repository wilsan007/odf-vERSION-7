-- ═══════════════════════════════════════════════════════════════════════════
-- SEED DÉMO — Localisation + Maintenances (pour peupler le calendrier)
-- À exécuter APRÈS 20260712_v13_maintenance_module.sql ET le seed inventaire.
-- Idempotent : purge les maintenances marquées created_by='SEED' avant réinsertion.
-- Les dates sont RELATIVES à CURRENT_DATE → le calendrier est toujours peuplé
-- autour du mois courant, quelle que soit la date d'exécution.
-- ═══════════════════════════════════════════════════════════════════════════
BEGIN;

DELETE FROM public.maintenances WHERE created_by = 'SEED';

-- ── Localisation de quelques pièces (démo) ───────────────────────────────────
UPDATE public.inventaire_items SET
  emp_salle='Salle SLTE', emp_halle='Hall A', emp_niveau='Niveau 1',
  emp_rack='Baie 020114.05', emp_chassis='Ciena Shelf Sh.01', emp_position='Slot 3', emp_updated_at=NOW()
WHERE id IN (SELECT id FROM public.inventaire_items WHERE station='Djibouti' AND categorie='SLTE' ORDER BY id LIMIT 10);

UPDATE public.inventaire_items SET
  emp_salle='Salle PFE', emp_halle='Hall B', emp_niveau='Niveau 0',
  emp_rack='Converter Bay', emp_chassis='—', emp_position='Slot 5', emp_updated_at=NOW()
WHERE id IN (SELECT id FROM public.inventaire_items WHERE station='Djibouti' AND categorie='PFE' ORDER BY id LIMIT 6);

UPDATE public.inventaire_items SET
  emp_salle='Salle NOC', emp_halle='Hall A', emp_niveau='Niveau 1',
  emp_rack='TEMS Bay', emp_chassis='24x24', emp_position='—', emp_updated_at=NOW()
WHERE id IN (SELECT id FROM public.inventaire_items WHERE station='Djibouti' AND categorie='TEMS' ORDER BY id LIMIT 5);

UPDATE public.inventaire_items SET
  emp_salle='Salle SLTE', emp_halle='Hall A', emp_niveau='Niveau 1', emp_rack='Baie principale', emp_updated_at=NOW()
WHERE id IN (SELECT id FROM public.inventaire_items WHERE station IN ('Bosaso','Mombasa','Mogadishu') AND categorie='SLTE' ORDER BY id LIMIT 12);

-- ── Maintenances de démo (dates relatives à aujourd'hui) ─────────────────────
-- Helper pattern : INSERT ... SELECT une pièce par (station, catégorie, OFFSET).

-- En retard (dépassées, non terminées)
INSERT INTO public.maintenances (item_id, station, type, statut, priorite, date_prevue, titre, description, assigne, service_cid, created_by)
SELECT id, station, 'REMPLACEMENT','PLANIFIE','CRITIQUE', CURRENT_DATE-5, 'Remplacement carte LME défaillante', 'Alarme persistante — spare requis.', 'Omar A.', 'DJT-20260112093000','SEED'
FROM public.inventaire_items WHERE station='Djibouti' AND categorie='SLTE' ORDER BY id LIMIT 1 OFFSET 4;

INSERT INTO public.maintenances (item_id, station, type, statut, priorite, date_prevue, titre, description, assigne, created_by)
SELECT id, station, 'INSPECTION','EN_COURS','NORMALE', CURRENT_DATE-2, 'Inspection ventilation', 'Contrôle température baie.', 'Fatouma H.','SEED'
FROM public.inventaire_items WHERE station='Djibouti' AND categorie='SLTE' ORDER BY id LIMIT 1 OFFSET 6;

INSERT INTO public.maintenances (item_id, station, type, statut, priorite, date_prevue, titre, description, assigne, service_cid, created_by)
SELECT id, station, 'RETRAIT','EN_COURS','CRITIQUE', CURRENT_DATE-1, 'Retrait module HS', 'Module en défaut — desservait un service.', 'Ali M.', 'DJT-20260105140000','SEED'
FROM public.inventaire_items WHERE station='Bosaso' AND categorie='SLTE' ORDER BY id LIMIT 1 OFFSET 3;

-- Aujourd'hui / à venir
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

-- Réalisées (historique)
INSERT INTO public.maintenances (item_id, station, type, statut, priorite, date_prevue, date_realisee, titre, description, assigne, created_by)
SELECT id, station, 'MAINTENANCE','FAIT','NORMALE', CURRENT_DATE-12, CURRENT_DATE-11, 'Maintenance réalisée', 'Nettoyage effectué, RAS.', 'Omar A.','SEED'
FROM public.inventaire_items WHERE station='Djibouti' AND categorie='SLTE' ORDER BY id LIMIT 1 OFFSET 11;

INSERT INTO public.maintenances (item_id, station, type, statut, priorite, date_prevue, date_realisee, titre, description, assigne, created_by)
SELECT id, station, 'REMPLACEMENT','FAIT','HAUTE', CURRENT_DATE-8, CURRENT_DATE-8, 'Carte remplacée', 'Spare installé, service rétabli.', 'Ali M.','SEED'
FROM public.inventaire_items WHERE station='Bosaso' AND categorie='SLTE' ORDER BY id LIMIT 1 OFFSET 6;

INSERT INTO public.maintenances (item_id, station, type, statut, priorite, date_prevue, titre, description, assigne, created_by)
SELECT id, station, 'MODIFICATION','PLANIFIE','HAUTE', CURRENT_DATE+2, 'Mise à niveau firmware', 'Upgrade planifié hors service.', 'Nadia K.','SEED'
FROM public.inventaire_items WHERE station='Mombasa' AND categorie='TEMS' ORDER BY id LIMIT 1 OFFSET 0;

COMMIT;

-- Récap
SELECT statut, COUNT(*) FROM public.maintenances WHERE created_by='SEED' GROUP BY statut ORDER BY statut;
