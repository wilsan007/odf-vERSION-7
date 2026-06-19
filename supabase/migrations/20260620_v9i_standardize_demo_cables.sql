-- ═══════════════════════════════════════════════════════════════════════════
-- ODF Manager V9i — Harmonisation du format des 3 premiers câbles de démo
--
-- Cette migration remplace les identifiants et références 'CBL-SEACOM-01', 
-- 'CBL-AAE1-01' et 'CBL-WIOCC-01' par des formats homogènes à la structure 
-- générale du backhaul : CBL-{SITE_SOURCE}-{SITE_DEST}-{NUM}.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- 1. Insérer les nouveaux câbles harmonisés s'ils n'existent pas
INSERT INTO public.cables_fibre (id, cable_reference, nom, fournisseur_id, type_fibre, nombre_fibres, route, type_lien, capacite_totale_gbps, capacite_disponible_gbps, port_source_id)
VALUES
  ('CBL-ALP-SEA-01', 'CBL-ALP-SEA-01', 'Liaison ALP-SEA Fibre 01', 'SEACOM', 'Monomode', 144, 'Site Alpha → SEACOM', 'EXTERNE', 400, 400, 'ALP-S1-R1-ODF1_S01P05'),
  ('CBL-ALP-AAE-01', 'CBL-ALP-AAE-01', 'Liaison ALP-AAE Fibre 01', 'AAE1',   'Monomode', 96,  'Site Alpha → AAE1',   'EXTERNE', 300, 300, 'ALP-S1-R1-ODF1_S01P06'),
  ('CBL-ALP-DEL-01', 'CBL-ALP-DEL-01', 'Liaison ALP-DEL Fibre 01', 'WIOCC',  'Monomode', 48,  'Site Alpha → DEL',    'EXTERNE', 200, 200, 'ALP-S1-R1-ODF2_S01P01')
ON CONFLICT (id) DO UPDATE SET
  cable_reference = EXCLUDED.cable_reference,
  nom = EXCLUDED.nom,
  fournisseur_id = EXCLUDED.fournisseur_id,
  type_fibre = EXCLUDED.type_fibre,
  nombre_fibres = EXCLUDED.nombre_fibres,
  route = EXCLUDED.route,
  type_lien = EXCLUDED.type_lien,
  capacite_totale_gbps = EXCLUDED.capacite_totale_gbps,
  port_source_id = EXCLUDED.port_source_id;

-- 2. Mettre à jour les références sur les services existants
UPDATE public.services SET cable_id = 'CBL-ALP-SEA-01' WHERE cable_id = 'CBL-SEACOM-01';
UPDATE public.services SET cable_id = 'CBL-ALP-AAE-01' WHERE cable_id = 'CBL-AAE1-01';
UPDATE public.services SET cable_id = 'CBL-ALP-DEL-01' WHERE cable_id = 'CBL-WIOCC-01';

-- 3. Mettre à jour les références dans les jonctions de services
UPDATE public.service_jonctions SET cable_id = 'CBL-ALP-SEA-01' WHERE cable_id = 'CBL-SEACOM-01';
UPDATE public.service_jonctions SET cable_id = 'CBL-ALP-AAE-01' WHERE cable_id = 'CBL-AAE1-01';
UPDATE public.service_jonctions SET cable_id = 'CBL-ALP-DEL-01' WHERE cable_id = 'CBL-WIOCC-01';

-- 4. Mettre à jour les références sur les ODFs
UPDATE public.odfs SET cable_id = 'CBL-ALP-SEA-01' WHERE cable_id = 'CBL-SEACOM-01';
UPDATE public.odfs SET cable_id = 'CBL-ALP-DEL-01' WHERE cable_id = 'CBL-WIOCC-01';

-- 5. Mettre à jour les références sur les ports
UPDATE public.ports SET cable_id = 'CBL-ALP-SEA-01' WHERE cable_id = 'CBL-SEACOM-01';
UPDATE public.ports SET cable_id = 'CBL-ALP-AAE-01' WHERE cable_id = 'CBL-AAE1-01';
UPDATE public.ports SET cable_id = 'CBL-ALP-DEL-01' WHERE cable_id = 'CBL-WIOCC-01';

-- 6. Mettre à jour les logs d'historique s'il y en a
UPDATE public.history SET entity_id = 'CBL-ALP-SEA-01' WHERE entity_id = 'CBL-SEACOM-01' AND entity_type = 'cable';
UPDATE public.history SET entity_id = 'CBL-ALP-AAE-01' WHERE entity_id = 'CBL-AAE1-01' AND entity_type = 'cable';
UPDATE public.history SET entity_id = 'CBL-ALP-DEL-01' WHERE entity_id = 'CBL-WIOCC-01' AND entity_type = 'cable';

-- 7. Supprimer les anciens câbles devenus orphelins
DELETE FROM public.cables_fibre WHERE id IN ('CBL-SEACOM-01', 'CBL-AAE1-01', 'CBL-WIOCC-01');

COMMIT;
