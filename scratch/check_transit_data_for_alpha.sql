-- Requête qui imite exactement ce que getTransitData('ALP') retourne
-- pour les câbles INTERNES du site Alpha.

WITH site_racks AS (
  SELECT id, salle_id FROM public.racks WHERE site_id = 'ALP'
),
site_odfs AS (
  SELECT o.id, o.name, o.odf_type, o.rack_id
  FROM public.odfs o
  JOIN site_racks r ON o.rack_id = r.id
),
site_slots AS (
  SELECT s.id, s.odf_id, s.slot_num
  FROM public.slots s
  JOIN site_odfs o ON s.odf_id = o.id
),
site_ports AS (
  SELECT p.id FROM public.ports p JOIN site_slots s ON p.slot_id = s.id
)
SELECT
  c.id,
  c.cable_reference,
  c.nom,
  c.type_lien,
  c.port_source_id,
  c.port_dest_id
FROM public.cables_fibre c
WHERE c.type_lien = 'INTERNE'
  AND c.port_source_id IN (SELECT id FROM site_ports)
  AND c.port_dest_id IN (SELECT id FROM site_ports)
ORDER BY c.cable_reference;
