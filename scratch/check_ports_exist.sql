-- Vérifier si les ports du câble intersalle existent dans la table ports
SELECT id, slot_id, odf_id
FROM public.ports
WHERE id IN (
  'ALP-S1-R1-ODF3_S05P01',
  'ALP-S2-R1-ODF3_S05P01',
  'ALP-S1-R1-ODF3_S01P01',
  'ALP-S2-R1-ODF3_S01P01'
);
