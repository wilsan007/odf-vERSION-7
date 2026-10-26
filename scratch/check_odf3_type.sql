-- Vérifier le type d'ODF3 sur Alpha S1 et S2
SELECT id, name, odf_type, rack_id
FROM public.odfs
WHERE id IN ('ALP-S1-R1-ODF3', 'ALP-S2-R1-ODF3');
