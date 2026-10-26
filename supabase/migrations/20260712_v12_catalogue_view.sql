-- ═══════════════════════════════════════════════════════════════════════════
-- v12 — MODULE B : CATALOGUE MATÉRIEL (références / part numbers)
-- ═══════════════════════════════════════════════════════════════════════════
-- Agrège l'inventaire (v10) par part number → catalogue dédoublonné : quantité
-- installée, rechanges, nombre de séries distinctes, familles, stations.
-- Vue calculée à la lecture (contourne max_rows). Aucune table nouvelle.
-- Idempotent : CREATE OR REPLACE VIEW.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW public.vue_catalogue_pieces AS
SELECT
  part_number,
  categorie,
  mode() WITHIN GROUP (ORDER BY description)                 AS description,
  -- Fabricant estimé d'après le préfixe de référence (best-effort)
  CASE
    WHEN part_number ILIKE 'NTK%' OR part_number ILIKE '160-%' THEN 'Ciena'
    WHEN part_number ILIKE 'OT-%' OR part_number ILIKE 'CPA%'
      OR part_number ILIKE '407%' OR part_number ~ '^[0-9]{3}[A-Z]{2}[0-9]' THEN 'SubCom'
    WHEN part_number ILIKE 'CP-%' OR part_number ILIKE 'FL%' THEN 'Cisco'
    ELSE NULL
  END                                                        AS fabricant,
  COUNT(*)                                                   AS quantite,
  COUNT(*) FILTER (WHERE is_spare)                           AS rechanges,
  COUNT(DISTINCT NULLIF(serial_nr, ''))
    FILTER (WHERE upper(COALESCE(serial_nr, '')) NOT IN ('N/A','NA','UNAVAIL','')) AS series,
  COUNT(DISTINCT station)                                    AS nb_stations,
  string_agg(DISTINCT station, ', ' ORDER BY station)        AS stations
FROM public.inventaire_items
WHERE part_number IS NOT NULL
  AND btrim(part_number) <> ''
  AND upper(part_number) NOT IN ('N/A', 'NA', 'UNAVAIL')
GROUP BY part_number, categorie;

GRANT SELECT ON public.vue_catalogue_pieces TO anon, authenticated, service_role;
