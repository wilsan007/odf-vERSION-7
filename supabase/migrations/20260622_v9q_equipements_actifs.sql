-- ═══════════════════════════════════════════════════════════════════════════════
-- ODF Manager V9q — Équipements actifs (CIENA/TEJAS…) + cross-connect vers ODF
--
-- Contexte : jusqu'ici cables_fibre.type_lien acceptait déjà la valeur
-- 'EQUIPEMENT' ("cross-connect via un équipement (CIENA/TEJAS…)") mais aucune
-- table ne modélisait l'équipement actif lui-même (shelf/slot/port). Cette
-- migration introduit cette hiérarchie, parallèle à sites→salles→racks→odfs :
--
--   racks → equipements → equipement_slots → equipement_ports
--
-- Convention IDs (même esprit que les ODF) :
--   equipement      : '{rack_id}-EQ{n}'      ex. 'ALP-S1-R1-EQ1'
--   equipement_slot : '{equipement_id}_SL{NN}' ex. 'ALP-S1-R1-EQ1_SL05'
--   equipement_port : '{equipement_id}_{slot_port}' ex. 'ALP-S1-R1-EQ1_SL05P11'
--
-- Différence clé avec les slots ODF : le nombre de ports par slot n'est PAS
-- fixé à 12 (les cartes DWDM ont des nombres de ports variables) — il est
-- choisi à la création du slot via la colonne ports_count.
--
-- Un câble type_lien='EQUIPEMENT' relie un port ODF existant (port_source_id,
-- table ports) à un port équipement (equipement_port_id, nouvelle colonne).
-- port_dest_id reste NULL dans ce cas — la contrainte chk_equipement_link le
-- garantit.
--
-- Idempotente : CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS,
-- CREATE OR REPLACE FUNCTION, DROP TRIGGER/CONSTRAINT IF EXISTS avant recréation.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ───────────────────────────────────────────────────────────────────────────
-- 1. TABLES
-- ───────────────────────────────────────────────────────────────────────────

-- ÉQUIPEMENTS  (matériel actif : CIENA, TEJAS, etc.)
CREATE TABLE IF NOT EXISTS public.equipements (
  id          TEXT PRIMARY KEY,
  rack_id     TEXT NOT NULL REFERENCES public.racks(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  type        TEXT,                 -- ex. 'CIENA SLTE', 'TEJAS'
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_by  TEXT,
  raison      TEXT,
  UNIQUE (rack_id, name)
);

-- SLOTS ÉQUIPEMENT (ports_count variable, contrairement aux slots ODF)
CREATE TABLE IF NOT EXISTS public.equipement_slots (
  id            TEXT PRIMARY KEY,
  equipement_id TEXT NOT NULL REFERENCES public.equipements(id) ON DELETE CASCADE,
  slot_num      INT  NOT NULL,
  name          TEXT NOT NULL,
  ports_count   INT  NOT NULL DEFAULT 12 CHECK (ports_count BETWEEN 1 AND 96),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_by    TEXT,
  raison        TEXT,
  UNIQUE (equipement_id, slot_num)
);

-- PORTS ÉQUIPEMENT
-- type_module    : type de module optique (ex. 'PSFP', 'PQSFP', 'QSFP') — libre
-- frequence_dwdm : canal DWDM (ex. '194.0062THz') — libre, optionnel
CREATE TABLE IF NOT EXISTS public.equipement_ports (
  id             TEXT PRIMARY KEY,
  slot_id        TEXT NOT NULL REFERENCES public.equipement_slots(id) ON DELETE CASCADE,
  equipement_id  TEXT NOT NULL REFERENCES public.equipements(id)      ON DELETE CASCADE,
  slot_port      TEXT NOT NULL,
  slot           INT  NOT NULL,
  port           INT  NOT NULL,
  statut         TEXT NOT NULL DEFAULT 'LIBRE'
                   CHECK (statut IN ('LIBRE','OCCUPE','MAUVAIS')),
  type_module    TEXT,
  frequence_dwdm TEXT,
  remarques      TEXT,
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_by     TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (equipement_id, slot_port)
);

-- ───────────────────────────────────────────────────────────────────────────
-- 2. CÂBLES FIBRE : bout "équipement" pour type_lien = 'EQUIPEMENT'
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE public.cables_fibre
  ADD COLUMN IF NOT EXISTS equipement_port_id TEXT
    REFERENCES public.equipement_ports(id) ON DELETE SET NULL;

ALTER TABLE public.cables_fibre DROP CONSTRAINT IF EXISTS chk_equipement_link;
ALTER TABLE public.cables_fibre ADD CONSTRAINT chk_equipement_link
  CHECK (
    type_lien <> 'EQUIPEMENT'
    OR (port_source_id IS NOT NULL AND equipement_port_id IS NOT NULL AND port_dest_id IS NULL)
  );

-- ───────────────────────────────────────────────────────────────────────────
-- 3. TRIGGERS
-- ───────────────────────────────────────────────────────────────────────────

-- 3a. updated_at automatique sur equipement_ports (réutilise fn_set_updated_at)
DROP TRIGGER IF EXISTS trg_equipement_ports_updated_at ON public.equipement_ports;
CREATE TRIGGER trg_equipement_ports_updated_at
  BEFORE UPDATE ON public.equipement_ports
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- 3b. Slot équipement → génère ports_count ports (P01..PNN)
CREATE OR REPLACE FUNCTION fn_after_equipement_slot_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  p  INT;
  sp TEXT;
BEGIN
  FOR p IN 1..GREATEST(NEW.ports_count, 1) LOOP
    sp := NEW.name || 'P' || LPAD(p::TEXT, 2, '0');
    INSERT INTO public.equipement_ports (id, slot_id, equipement_id, slot_port, slot, port, statut)
    VALUES (NEW.equipement_id || '_' || sp, NEW.id, NEW.equipement_id, sp, NEW.slot_num, p, 'LIBRE')
    ON CONFLICT (id) DO NOTHING;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_after_equipement_slot_insert ON public.equipement_slots;
CREATE TRIGGER trg_after_equipement_slot_insert
  AFTER INSERT ON public.equipement_slots
  FOR EACH ROW EXECUTE FUNCTION fn_after_equipement_slot_insert();

-- 3c. Étendre fn_auto_port_actif / fn_auto_port_actif_update pour basculer
--     aussi equipement_ports.statut quand un câble EQUIPEMENT est créé/modifié.
--     (CREATE OR REPLACE : les triggers existants trg_cables_fibre_insert /
--     trg_cables_fibre_update pointent déjà vers ces fonctions, pas besoin
--     de les recréer.)
CREATE OR REPLACE FUNCTION fn_auto_port_actif()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_odf_type TEXT;
BEGIN
  -- 1. Mettre les ports ODF en OCCUPE
  UPDATE public.ports SET statut = 'OCCUPE', updated_at = NOW()
  WHERE id IN (NEW.port_source_id, NEW.port_dest_id);

  -- 1b. Mettre le port équipement en OCCUPE (lien EQUIPEMENT)
  IF NEW.equipement_port_id IS NOT NULL THEN
    UPDATE public.equipement_ports SET statut = 'OCCUPE', updated_at = NOW()
    WHERE id = NEW.equipement_port_id;
  END IF;

  -- 2. Déterminer le type d'ODF à propager
  IF NEW.type_lien = 'EXTERNE' THEN
    v_odf_type := 'EXTERNE';
  ELSIF NEW.type_lien IN ('INTERNE', 'JARRETIERE') THEN
    v_odf_type := 'INTERNE';
  ELSE
    v_odf_type := NULL;
  END IF;

  -- 3. Propager le type de lien aux ODFs correspondants
  IF v_odf_type IS NOT NULL THEN
    UPDATE public.odfs
    SET odf_type = v_odf_type
    WHERE id IN (
      SELECT odf_id FROM public.ports WHERE id IN (NEW.port_source_id, NEW.port_dest_id)
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION fn_auto_port_actif_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_odf_type TEXT;
BEGIN
  IF NEW.type_lien IS DISTINCT FROM OLD.type_lien
     OR NEW.port_source_id IS DISTINCT FROM OLD.port_source_id
     OR NEW.port_dest_id IS DISTINCT FROM OLD.port_dest_id
     OR NEW.equipement_port_id IS DISTINCT FROM OLD.equipement_port_id THEN

    IF NEW.equipement_port_id IS NOT NULL THEN
      UPDATE public.equipement_ports SET statut = 'OCCUPE', updated_at = NOW()
      WHERE id = NEW.equipement_port_id;
    END IF;

    IF NEW.type_lien = 'EXTERNE' THEN
      v_odf_type := 'EXTERNE';
    ELSIF NEW.type_lien IN ('INTERNE', 'JARRETIERE') THEN
      v_odf_type := 'INTERNE';
    ELSE
      v_odf_type := NULL;
    END IF;

    IF v_odf_type IS NOT NULL THEN
      UPDATE public.odfs
      SET odf_type = v_odf_type
      WHERE id IN (
        SELECT odf_id FROM public.ports WHERE id IN (NEW.port_source_id, NEW.port_dest_id)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;

-- ─── Vérification visuelle ───────────────────────────────────────────────────
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('equipements','equipement_slots','equipement_ports');
