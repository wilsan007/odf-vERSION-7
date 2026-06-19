-- =============================================================================
--  ODF MANAGER V6 — Schema + Demo Data Seed (OPTIMIZED & CORRECTED)
--  Execute this in your Supabase SQL Editor
--  
--  Changes:
--  ✓ Added missing FK constraints (site_a, site_b, cid)
--  ✓ Fixed date_activ type (text → timestamptz)
--  ✓ Added performance indexes
--  ✓ Added auto-update triggers for timestamps
--  ✓ Added unique constraints on ports
--  ✓ Improved RLS policies (demo-mode note)
-- =============================================================================

-- ============================================================================
-- 1. DROP EXISTING TRIGGERS & FUNCTIONS (safe cleanup)
-- ============================================================================
DROP TRIGGER IF EXISTS ports_update_timestamp ON public.ports;
DROP FUNCTION IF EXISTS update_ports_timestamp();
DROP TRIGGER IF EXISTS service_port_count_trigger ON public.ports;
DROP FUNCTION IF EXISTS update_service_port_count();


-- ============================================================================
-- 2. CREATE TABLES WITH IMPROVED SCHEMA
-- ============================================================================

-- Sites (base entity)
CREATE TABLE IF NOT EXISTS public.sites (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Racks (belong to sites)
CREATE TABLE IF NOT EXISTS public.racks (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ODFs (optical distribution frames)
CREATE TABLE IF NOT EXISTS public.odfs (
  id TEXT PRIMARY KEY,
  rack_id TEXT NOT NULL REFERENCES public.racks(id) ON DELETE CASCADE,
  site_a TEXT REFERENCES public.sites(id) ON DELETE SET NULL,  -- FIX: Added ON DELETE SET NULL
  site_b TEXT REFERENCES public.sites(id) ON DELETE SET NULL,  -- FIX: Added ON DELETE SET NULL
  odf_type TEXT NOT NULL DEFAULT 'EXTERNE' CHECK (odf_type IN ('EXTERNE', 'INTERNE')),
  route TEXT,
  cable TEXT,
  slots INT DEFAULT 6 CHECK (slots > 0),
  ports_per_slot INT DEFAULT 12 CHECK (ports_per_slot > 0),
  is_active BOOLEAN DEFAULT FALSE,
  odf_number TEXT,
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ports (finest granularity)
CREATE TABLE IF NOT EXISTS public.ports (
  id TEXT PRIMARY KEY,
  odf_id TEXT NOT NULL REFERENCES public.odfs(id) ON DELETE CASCADE,
  slot_port TEXT NOT NULL,
  slot INT NOT NULL CHECK (slot > 0),
  port INT NOT NULL CHECK (port > 0),
  statut TEXT DEFAULT 'LIBRE' CHECK (statut IN ('LIBRE', 'ACTIF', 'RESERVE', 'MAINTENANCE')),
  cid TEXT REFERENCES public.services(id) ON DELETE SET NULL,  -- FIX: Added FK constraint
  ot_num TEXT,
  capacite TEXT,
  owner TEXT,
  source_client TEXT,
  end_client TEXT,
  destination TEXT,
  peer_odf_id TEXT,
  peer_slot_port TEXT,
  date_activ TIMESTAMPTZ,  -- FIX: Changed from TEXT to TIMESTAMPTZ
  remarques TEXT,
  updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- FIX: Add unique constraint to prevent duplicate ports per ODF
  UNIQUE(odf_id, slot_port)
);

-- Services (billing/provisioning layer)
CREATE TABLE IF NOT EXISTS public.services (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  capacite TEXT,
  source_client TEXT,
  end_client TEXT,
  owner TEXT,
  remarques TEXT,
  port_count INT DEFAULT 0 CHECK (port_count >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================================
-- 3. CREATE PERFORMANCE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_racks_site_id ON public.racks(site_id);
CREATE INDEX IF NOT EXISTS idx_odfs_rack_id ON public.odfs(rack_id);
CREATE INDEX IF NOT EXISTS idx_odfs_site_a ON public.odfs(site_a);
CREATE INDEX IF NOT EXISTS idx_odfs_site_b ON public.odfs(site_b);
CREATE INDEX IF NOT EXISTS idx_odfs_is_active ON public.odfs(is_active);
CREATE INDEX IF NOT EXISTS idx_ports_odf_id ON public.ports(odf_id);
CREATE INDEX IF NOT EXISTS idx_ports_cid ON public.ports(cid);
CREATE INDEX IF NOT EXISTS idx_ports_statut ON public.ports(statut);
CREATE INDEX IF NOT EXISTS idx_ports_slot_port ON public.ports(odf_id, slot_port);


-- ============================================================================
-- 4. CREATE TRIGGER FUNCTIONS
-- ============================================================================

-- Auto-update timestamp on ports modification
CREATE OR REPLACE FUNCTION update_ports_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ports_update_timestamp
BEFORE UPDATE ON public.ports
FOR EACH ROW
EXECUTE FUNCTION update_ports_timestamp();


-- Update service port count when ports are added/removed
CREATE OR REPLACE FUNCTION update_service_port_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.cid IS NOT NULL THEN
    UPDATE public.services 
    SET port_count = port_count + 1, updated_at = NOW()
    WHERE id = NEW.cid;
  ELSIF TG_OP = 'DELETE' AND OLD.cid IS NOT NULL THEN
    UPDATE public.services 
    SET port_count = port_count - 1, updated_at = NOW()
    WHERE id = OLD.cid;
  ELSIF TG_OP = 'UPDATE' THEN
    -- If cid changed, update both old and new service counts
    IF COALESCE(OLD.cid, '') != COALESCE(NEW.cid, '') THEN
      IF OLD.cid IS NOT NULL THEN
        UPDATE public.services 
        SET port_count = port_count - 1, updated_at = NOW()
        WHERE id = OLD.cid;
      END IF;
      IF NEW.cid IS NOT NULL THEN
        UPDATE public.services 
        SET port_count = port_count + 1, updated_at = NOW()
        WHERE id = NEW.cid;
      END IF;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER service_port_count_trigger
AFTER INSERT OR DELETE OR UPDATE ON public.ports
FOR EACH ROW
EXECUTE FUNCTION update_service_port_count();


-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.racks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.odfs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- DEMO MODE: Allow all. Replace with role-based policies for production.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sites' AND policyname='allow_all') THEN
    CREATE POLICY allow_all ON public.sites FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='racks' AND policyname='allow_all') THEN
    CREATE POLICY allow_all ON public.racks FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='odfs' AND policyname='allow_all') THEN
    CREATE POLICY allow_all ON public.odfs FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ports' AND policyname='allow_all') THEN
    CREATE POLICY allow_all ON public.ports FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='services' AND policyname='allow_all') THEN
    CREATE POLICY allow_all ON public.services FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;


-- ============================================================================
-- 6. DEMO DATA — Sites
-- ============================================================================

INSERT INTO public.sites (id, name, description) VALUES
  ('RDK', 'Ras-Dika', 'Cable Landing Station (côté Mosquée)'),
  ('YAC', 'YAC', 'Site YAC — bâtiment côté ville'),
  ('HAR', 'Haramous', 'Station Haramous (via Siesta)'),
  ('DDC', 'DDC', 'Data Center Djibouti')
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- 7. DEMO DATA — Racks
-- ============================================================================

INSERT INTO public.racks (id, site_id, name, description) VALUES
  ('RDK-R1', 'RDK', 'R1', 'Main Management Room'),
  ('RDK-R2', 'RDK', 'R2', 'Rack secondaire'),
  ('YAC-R1', 'YAC', 'R1', 'Salle technique YAC'),
  ('HAR-R1', 'HAR', 'R1', 'Salle technique Haramous')
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- 8. DEMO DATA — ODFs
-- ============================================================================

INSERT INTO public.odfs (id, rack_id, site_a, site_b, odf_type, route, cable, slots, ports_per_slot, is_active) VALUES
  ('RDK-R1-ODF1', 'RDK-R1', 'RDK', 'YAC', 'EXTERNE', 'Ras-Dika <-> YAC (côté Mosquée)', 'Câble 144 Fibres', 6, 12, false),
  ('RDK-R1-ODF2', 'RDK-R1', 'RDK', 'YAC', 'EXTERNE', 'Ras-Dika -> YAC — IODF CIENA', 'CIENA Shelf', 6, 12, false),
  ('RDK-R1-ODF3', 'RDK-R1', 'RDK', 'RDK', 'INTERNE', 'Ras-Dika MMR <-> ODF L2', '48 Fibres', 6, 12, false),
  ('RDK-R1-ODF4', 'RDK-R1', 'RDK', 'YAC', 'EXTERNE', 'Ras-Dika -> YAC (BACK, Mosquée)', 'Câble 144 Fibres', 6, 12, false),
  ('RDK-R1-ODF5', 'RDK-R1', 'RDK', 'HAR', 'EXTERNE', 'Ras-Dika <-> Haramous (Siesta)', '96 Fibres', 6, 12, false),
  ('RDK-R1-ODF6', 'RDK-R1', 'RDK', 'YAC', 'EXTERNE', 'Ras-Dika -> YAC-B (BACK cable)', 'Câble 144 Fibres', 6, 12, false),
  ('RDK-R1-ODF7', 'RDK-R1', 'RDK', 'YAC', 'EXTERNE', 'Ras-Dika -> YAC — Backhaul TEJAS', 'Backhaul TEJAS', 6, 12, false),
  ('RDK-R1-ODF8', 'RDK-R1', 'RDK', 'HAR', 'EXTERNE', 'Ras-Dika <-> Haramous — CIENA 2', 'CIENA SHELF 2', 6, 12, false)
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- 9. DEMO DATA — Ports (mass insert with PL/pgSQL loop)
-- ============================================================================

DO $$
DECLARE
  odf_ids TEXT[] := ARRAY['RDK-R1-ODF1','RDK-R1-ODF2','RDK-R1-ODF3','RDK-R1-ODF4','RDK-R1-ODF5','RDK-R1-ODF6','RDK-R1-ODF7','RDK-R1-ODF8'];
  odf_id TEXT;
  s INT;
  p INT;
  sp TEXT;
  pid TEXT;
BEGIN
  FOREACH odf_id IN ARRAY odf_ids LOOP
    FOR s IN 1..6 LOOP
      FOR p IN 1..12 LOOP
        sp := 'S' || LPAD(s::TEXT, 2, '0') || 'P' || LPAD(p::TEXT, 2, '0');
        pid := odf_id || '_' || sp;
        INSERT INTO public.ports (id, odf_id, slot_port, slot, port, statut)
        VALUES (pid, odf_id, sp, s, p, 'LIBRE')
        ON CONFLICT (id) DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;
  RAISE NOTICE '% ports seeded successfully', (6 * 12 * ARRAY_LENGTH(odf_ids, 1));
END $$;


-- ============================================================================
-- 10. DEMO DATA — Services (Insert BEFORE updating ports)
-- ============================================================================

INSERT INTO public.services (id, label, capacite, source_client, end_client, owner) VALUES
  ('DJT-20260531000001', 'Transit IP SEACOM', '100G', '2AF / MTN', 'SEACOM', 'DT')
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- 11. DEMO DATA — Active Ports Linked to Services
-- ============================================================================

UPDATE public.ports 
SET 
  statut = 'ACTIF',
  cid = 'DJT-20260531000001',
  capacite = '100G',
  source_client = '2AF / MTN',
  destination = 'SEACOM',
  date_activ = NOW()
WHERE id = 'RDK-R1-ODF1_S01P05';


-- ============================================================================
-- 12. VERIFICATION & STATUS
-- ============================================================================

DO $$
DECLARE
  site_count INT;
  rack_count INT;
  odf_count INT;
  port_count INT;
  service_count INT;
BEGIN
  SELECT COUNT(*) INTO site_count FROM public.sites;
  SELECT COUNT(*) INTO rack_count FROM public.racks;
  SELECT COUNT(*) INTO odf_count FROM public.odfs;
  SELECT COUNT(*) INTO port_count FROM public.ports;
  SELECT COUNT(*) INTO service_count FROM public.services;
  
  RAISE NOTICE 'V6 OPTIMIZED SEED COMPLETED ✓';
  RAISE NOTICE '  Sites: % | Racks: % | ODFs: % | Ports: % | Services: %',
    site_count, rack_count, odf_count, port_count, service_count;
END $$;

SELECT 'V6 Demo Data seeded successfully (OPTIMIZED)!' AS status;
