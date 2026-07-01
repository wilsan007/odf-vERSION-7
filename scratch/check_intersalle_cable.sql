-- Requête de diagnostic pour vérifier les câbles intersalle du site Alpha
-- entre la Salle S1 et la Salle S2.

SELECT 
  c.id,
  c.cable_reference,
  c.nom,
  c.type_lien,
  c.port_source_id,
  rs.salle_id AS source_salle,
  c.port_dest_id,
  rd.salle_id AS dest_salle
FROM public.cables_fibre c
LEFT JOIN public.ports ps ON ps.id = c.port_source_id
LEFT JOIN public.ports pd ON pd.id = c.port_dest_id
LEFT JOIN public.slots ss ON ss.id = ps.slot_id
LEFT JOIN public.slots sd ON sd.id = pd.slot_id
LEFT JOIN public.odfs odf_s ON odf_s.id = ss.odf_id
LEFT JOIN public.odfs odf_d ON odf_d.id = sd.odf_id
LEFT JOIN public.racks rs ON rs.id = odf_s.rack_id
LEFT JOIN public.racks rd ON rd.id = odf_d.rack_id
WHERE c.cable_reference = 'ALP-ALP/S1-R1-ODF3_S2-R1-ODF3'
   OR (
     (rs.salle_id = 'S1' AND rd.salle_id = 'S2')
  OR (rs.salle_id = 'S2' AND rd.salle_id = 'S1')
   )
ORDER BY c.cable_reference;
