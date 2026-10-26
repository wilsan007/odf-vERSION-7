-- RPC pour charger les données de transit d'un site sans toucher aux limites IN/limit de Supabase
CREATE OR REPLACE FUNCTION public.get_transit_data(p_site_id text)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_rack_ids text[];
  v_odf_ids text[];
  v_slot_ids text[];
  v_ports jsonb;
  v_cables jsonb;
BEGIN
  -- Racks du site
  SELECT array_agg(id) INTO v_rack_ids
  FROM public.racks
  WHERE site_id = p_site_id;

  IF v_rack_ids IS NULL THEN
    RETURN jsonb_build_object('ports', '[]'::jsonb, 'cables', '[]'::jsonb);
  END IF;

  -- ODFs de ces racks
  SELECT array_agg(id) INTO v_odf_ids
  FROM public.odfs
  WHERE rack_id = ANY(v_rack_ids);

  IF v_odf_ids IS NULL THEN
    RETURN jsonb_build_object('ports', '[]'::jsonb, 'cables', '[]'::jsonb);
  END IF;

  -- Slots de ces ODFs
  SELECT array_agg(id) INTO v_slot_ids
  FROM public.slots
  WHERE odf_id = ANY(v_odf_ids);

  IF v_slot_ids IS NULL THEN
    RETURN jsonb_build_object('ports', '[]'::jsonb, 'cables', '[]'::jsonb);
  END IF;

  -- Ports de ces slots avec le type d'ODF
  SELECT jsonb_agg(row_to_json(t))
  INTO v_ports
  FROM (
    SELECT
      p.id,
      p.slot_port,
      p.statut,
      p.slot_id,
      p.odf_id,
      o.odf_type,
      o.name AS odf_name,
      o.rack_id,
      r.salle_id
    FROM public.ports p
    JOIN public.slots s ON s.id = p.slot_id
    JOIN public.odfs o ON o.id = s.odf_id
    JOIN public.racks r ON r.id = o.rack_id
    WHERE p.slot_id = ANY(v_slot_ids)
  ) t;

  -- Câbles internes dont les deux ports appartiennent aux ports du site
  SELECT jsonb_agg(row_to_json(c))
  INTO v_cables
  FROM public.cables_fibre c
  WHERE c.type_lien = 'INTERNE'
    AND c.port_source_id IN (SELECT id FROM public.ports WHERE slot_id = ANY(v_slot_ids))
    AND c.port_dest_id IN (SELECT id FROM public.ports WHERE slot_id = ANY(v_slot_ids));

  RETURN jsonb_build_object(
    'ports', COALESCE(v_ports, '[]'::jsonb),
    'cables', COALESCE(v_cables, '[]'::jsonb)
  );
END;
$$;
