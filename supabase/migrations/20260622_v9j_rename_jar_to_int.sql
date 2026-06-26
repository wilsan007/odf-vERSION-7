-- ═══════════════════════════════════════════════════════════════════════════════
-- ODF Manager V9j — Renommer les références JAR- en INT- et finaliser INTERNE
--
-- Contexte : le préfixe "JAR" (jarretière) servait historiquement à nommer les
-- câbles internes créés entre salles/racks d'un même site. Ces câbles sont en
-- réalité de type_lien = 'INTERNE'. Cette migration :
--   1. Renomme tous les cable_reference commençant par 'JAR-' en 'INT-'.
--   2. Convertit les dernières lignes encore en type_lien = 'JARRETIERE' vers
--      'INTERNE' (le flux applicatif ne crée plus de JARRETIERE désormais).
-- Idempotente : sans effet si rejouée (regexp ancré sur '^JAR-', filtre sur
-- type_lien = 'JARRETIERE').
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- 1. Basculer les dernières connexions JARRETIERE vers INTERNE.
UPDATE public.cables_fibre
SET type_lien = 'INTERNE'
WHERE type_lien = 'JARRETIERE';

-- 2. Renommer le préfixe de référence JAR- en INT- (toutes occurrences restantes).
UPDATE public.cables_fibre
SET cable_reference = regexp_replace(cable_reference, '^JAR-', 'INT-')
WHERE cable_reference ~ '^JAR-';

COMMIT;

-- ─── Vérification visuelle ───────────────────────────────────────────────────
SELECT cable_reference, nom, type_lien
FROM public.cables_fibre
WHERE cable_reference ~ '^(JAR|INT)-'
ORDER BY cable_reference;
