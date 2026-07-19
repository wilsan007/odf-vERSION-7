import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ─── Auth helpers ────────────────────────────────────────────────────────────
export const signIn = (email, password) =>
  supabase.auth.signInWithPassword({ email, password })

export const signOut = () => supabase.auth.signOut()

export const getSession = () => supabase.auth.getSession()

// ─── Sites ───────────────────────────────────────────────────────────────────
// id  : 'RDK', 'YAC', ...
export const getSites = () =>
  supabase.from('sites').select('*').order('name')

export const createSite = (data) =>
  supabase.from('sites').insert(data).select().single()

export const deleteSite = (id) =>
  supabase.from('sites').delete().eq('id', id)

// ─── Salles ──────────────────────────────────────────────────────────────────
// id  : 'RDK-S1', ...
export const getSalles = (siteId) => {
  let q = supabase.from('salles').select('*, sites(name)').order('name')
  if (siteId) q = q.eq('site_id', siteId)
  return q
}

export const createSalle = (data) =>
  supabase.from('salles').insert(data).select().single()

export const deleteSalle = (id) =>
  supabase.from('salles').delete().eq('id', id)

// ─── Racks ───────────────────────────────────────────────────────────────────
// id  : 'RDK-R1', ...
export const getRacks = (siteId, salleId) => {
  let q = supabase.from('racks').select('*, sites(name), salles(name)').order('name')
  if (siteId) q = q.eq('site_id', siteId)
  if (salleId) q = q.eq('salle_id', salleId)
  return q
}

export const createRack = (data) =>
  supabase.from('racks').insert(data).select().single()

export const deleteRack = (id) =>
  supabase.from('racks').delete().eq('id', id)

// ─── ODFs ────────────────────────────────────────────────────────────────────
// id  : 'RDK-R1-ODF1', ...
export const getOdfs = (rackId) => {
  let q = supabase.from('odfs')
    .select('*, racks(name, sites(name)), cables_fibre(id, cable_reference, nom, nombre_fibres)')
    .order('name')
  if (rackId) q = q.eq('rack_id', rackId)
  return q
}

export const createOdf = (data) =>
  supabase.from('odfs').insert(data).select().single()

export const deleteOdf = (id) =>
  supabase.from('odfs').delete().eq('id', id)

// ─── Slots ───────────────────────────────────────────────────────────────────
// id  : 'RDK-R1-ODF1_S01', ...
// name: 'S01', 'S02', ...
export const getSlots = (odfId) => {
  let q = supabase.from('slots').select('*').order('slot_num')
  if (odfId) q = q.eq('odf_id', odfId)
  return q
}

export const createSlot = (data) =>
  supabase.from('slots').insert(data).select().single()

export const deleteSlot = (id) =>
  supabase.from('slots').delete().eq('id', id)

// ─── Technologies réseau (WDM, SDH, OTN…) ────────────────────────────────────
export const getTechnologies = () =>
  supabase.from('technologies').select('id, name, description').order('ordre')

// ─── Catalogue des modèles de cartes ─────────────────────────────────────────
export const getCarteModeles = (technologieId) => {
  let q = supabase
    .from('carte_modeles')
    .select('id, nom, fabricant, technologie_id, ports_count, description')
    .order('fabricant').order('nom')
  if (technologieId) q = q.eq('technologie_id', technologieId)
  return q
}

export const createCarteModele = (data) =>
  supabase.from('carte_modeles').insert(data).select().single()

// ─── Cartes physiques (stock / installées) ────────────────────────────────────
export const getCartes = (etat) => {
  let q = supabase
    .from('cartes')
    .select('*, carte_modeles(nom, fabricant, technologie_id, ports_count)')
    .order('created_at', { ascending: false })
  if (etat) q = q.eq('etat', etat)
  return q
}

export const createCarte = (data) =>
  supabase.from('cartes').insert(data).select('id').single()

export const updateCarte = (id, data) =>
  supabase.from('cartes').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id).select().single()

// ─── Lots de réception ────────────────────────────────────────────────────────
export const getLots = () =>
  supabase.from('lots').select('*, fournisseurs(nom)').order('date_reception', { ascending: false })

export const createLot = (data) =>
  supabase.from('lots').insert(data).select().single()

// ─── Équipements actifs (CIENA/TEJAS…) ───────────────────────────────────────
// id  : 'RDK-R1-EQ1', ...
export const getEquipements = (rackId) => {
  let q = supabase.from('equipements')
    .select('*, racks(name, sites(name))')
    .order('name')
  if (rackId) q = q.eq('rack_id', rackId)
  return q
}

export const createEquipement = (data) =>
  supabase.from('equipements').insert(data).select().single()

export const deleteEquipement = (id) =>
  supabase.from('equipements').delete().eq('id', id)

// ─── Slots équipement ────────────────────────────────────────────────────────
// id  : 'RDK-R1-EQ1_SL05', ... (ports_count variable, contrairement aux slots ODF)
export const getEquipementSlots = (equipementId) => {
  let q = supabase.from('equipement_slots').select('*').order('slot_num')
  if (equipementId) q = q.eq('equipement_id', equipementId)
  return q
}

export const createEquipementSlot = (data) =>
  supabase.from('equipement_slots').insert(data).select().single()

export const deleteEquipementSlot = (id) =>
  supabase.from('equipement_slots').delete().eq('id', id)

// ─── Ports équipement ─────────────────────────────────────────────────────────
// id        : 'RDK-R1-EQ1_SL05P11', ...
// slot_port : 'SL05P11'
export const getEquipementPorts = (slotId) => {
  let q = supabase.from('equipement_ports').select('*').order('slot_port')
  if (slotId) q = q.eq('slot_id', slotId)
  return q
}

export const getEquipementPortsByEquipement = (equipementId) =>
  supabase.from('equipement_ports').select('*, equipement_slots(name, slot_num)')
    .eq('equipement_id', equipementId).order('slot_port')

export const updateEquipementPort = (id, data) =>
  supabase.from('equipement_ports').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id).select().single()

// ─── Ports ───────────────────────────────────────────────────────────────────
// id        : 'RDK-R1-ODF1_S01P01', ...
// slot_port : 'S01P01'
export const getPorts = (slotId) => {
  let q = supabase.from('ports').select(`
    *,
    slots(name, odf_id,
      odfs(name, rack_id,
        racks(name, site_id, salle_id,
          salles(name),
          sites(name))))
  `).order('slot_port')
  if (slotId) q = q.eq('slot_id', slotId)
  return q
}

export const getPortsByOdf = (odfId) =>
  supabase.from('ports').select('*, slots(name, odf_id)')
    .eq('odf_id', odfId).order('slot_port')

export const updatePort = (id, data) =>
  supabase.from('ports').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id).select().single()

export const getPortsFlat = () =>
  supabase.from('ports').select(`
    id, slot_port, statut, cid, ot_num, owner, capacite, destination, remarques, updated_at, odf_id,
    slots(id, name, odf_id,
      odfs(id, name, rack_id,
        racks(id, name, site_id, salle_id,
          salles(id, name),
          sites(id, name))))
  `).order('updated_at', { ascending: false })

// ─── Fournisseurs ─────────────────────────────────────────────────────────────
// id : 'SEACOM', 'AAE1', ...
export const getFournisseurs = () =>
  supabase.from('fournisseurs').select('*').order('nom')

export const createFournisseur = (data) =>
  supabase.from('fournisseurs').insert(data).select().single()

export const deleteFournisseur = (id) =>
  supabase.from('fournisseurs').delete().eq('id', id)

// ─── Clients ──────────────────────────────────────────────────────────────────
// id : 'MTN', 'AIRTEL', ...
export const getClients = () =>
  supabase.from('clients').select('*').order('nom')

export const createClient = (data) =>
  supabase.from('clients').insert(data).select().single()

export const deleteClient = (id) =>
  supabase.from('clients').delete().eq('id', id)

// ─── Câbles Fibre (capacité) ───────────────────────────────────────────────────
export const getCables = () =>
  supabase.from('cables_fibre').select(`
    *,
    fournisseurs(id, nom),
    port_source:ports!cables_fibre_port_source_id_fkey(id, slot_port, slots(name, odfs(name, racks(name, sites(name))))),
    port_dest:ports!cables_fibre_port_dest_id_fkey(id, slot_port, slots(name, odfs(name, racks(name, sites(name)))))
  `).order('cable_reference')

export const createCable = (data) =>
  supabase.from('cables_fibre').insert(data).select().single()

export const updateCable = (id, data) =>
  supabase.from('cables_fibre').update(data).eq('id', id).select().single()

export const deleteCable = (id) =>
  supabase.from('cables_fibre').delete().eq('id', id)

// ─── Câbles inter-sites (EXTERNE uniquement, pour le wizard de routage) ──────────
// Retourne les câbles avec port_source et port_dest résolus (id + slot_port).
// Ne filtre PAS sur capacite_disponible > 0 ici — le wizard affiche tous les câbles
// avec leur capacité restante et laisse l'utilisateur choisir en connaissance de cause.
export const getCablesInterSites = () =>
  supabase.from('cables_fibre').select(`
    id, cable_reference, nom, type_lien, fournisseur_id,
    port_source_id, port_dest_id,
    fournisseurs(id, nom),
    port_source:ports!cables_fibre_port_source_id_fkey(id, slot_port, statut, odf_id, slot_id),
    port_dest:ports!cables_fibre_port_dest_id_fkey(id, slot_port, statut, odf_id, slot_id)
  `)
  .eq('type_lien', 'EXTERNE')
  .order('cable_reference')

// Vérifie la topologie : retourne les liaisons inter-sites avec le nombre de câbles dispo
// Utile pour l'avertissement "site non connecté" au chargement de l'app
export const checkTopologie = async () => {
  const { data: cables } = await supabase.from('cables_fibre')
    .select('id, port_source_id, port_dest_id')
    .eq('type_lien', 'EXTERNE')
  if (!cables) return { ok: false, liaisons: [] }

  // Extraire le site depuis un port_id : les chars avant le premier '-' (ex: RDK)
  const siteOf = (portId) => portId ? portId.split('-')[0] : null

  // Agréger par paire de sites
  const liaisons = {}
  for (const c of cables) {
    const s1 = siteOf(c.port_source_id)
    const s2 = siteOf(c.port_dest_id)
    if (!s1 || !s2 || s1 === s2) continue
    const key = [s1, s2].sort().join('|')
    if (!liaisons[key]) liaisons[key] = { sites: [s1, s2], total: 0 }
    liaisons[key].total++
  }

  const list = Object.values(liaisons)
  const ok = list.every(l => l.total >= 12)
  return { ok, liaisons: list }
}

// ─── Services ──────────────────────────────────────────────────────────────────
// La capacité est gérée automatiquement par le trigger trg_service_capacity.
// createService peut échouer si la capacité disponible du câble est insuffisante.
export const getServices = () =>
  supabase.from('services').select(`
    *,
    cables_fibre(id, cable_reference, nom, type_lien),
    clients(id, nom),
    fournisseurs(id, nom),
    ports!services_port_id_fkey(id, slot_port),
    service_jonctions(id, ordre, cable_id, port_entree_id, port_sortie_id)
  `).order('created_at', { ascending: false })

// Le CID est généré automatiquement par le trigger trg_service_cid si non fourni.
// Peut échouer si la capacité disponible du câble primaire est insuffisante.
export const createService = (data) =>
  supabase.from('services').insert(data).select().single()

export const updateService = (id, data) =>
  supabase.from('services').update(data).eq('id', id).select().single()

export const deleteService = (id) =>
  supabase.from('services').delete().eq('id', id)

// Routes dynamiques (vue calculée : route reconstruite à la lecture)
export const getServiceRoutes = () =>
  supabase.from('vue_routes_service').select('*').order('service_id')

// ─── Jonctions de service (chemin ordonné du service jusqu'au client final) ────
export const getServiceJonctions = (serviceId) =>
  supabase.from('service_jonctions')
    .select('*, cables_fibre(id, cable_reference, nom, type_lien)')
    .eq('service_id', serviceId).order('ordre')

// Crée les jonctions d'un service en une fois (tableau ordonné de hops)
export const addServiceJonctions = (rows) =>
  supabase.from('service_jonctions').insert(rows).select()

export const deleteServiceJonctions = (serviceId) =>
  supabase.from('service_jonctions').delete().eq('service_id', serviceId)

// ─── Historique ──────────────────────────────────────────────────────────────
export const addHistory = (data) =>
  supabase.from('history').insert(data)

export const getHistory = (limit = 100) =>
  supabase.from('history').select('*').order('created_at', { ascending: false }).limit(limit)

// ─── Inventaire d'actifs / As-Built (module v10) ─────────────────────────────
// Documents (une révision d'inventaire par station)
export const getInventaireDocuments = () =>
  supabase.from('inventaire_documents').select('*').order('station')

// Upsert d'un document (remplace la révision existante du même id)
export const upsertInventaireDocument = (data) =>
  supabase.from('inventaire_documents')
    .upsert({ ...data, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    .select().single()

export const deleteInventaireDocument = (id) =>
  supabase.from('inventaire_documents').delete().eq('id', id)

// Items d'inventaire — filtrés par station (chaque station < 250 lignes,
// on reste donc sous la limite max_rows de PostgREST)
export const getInventaireItems = (station) => {
  let q = supabase.from('inventaire_items').select('*').order('id')
  if (station) q = q.eq('station', station)
  return q
}

// Items d'un document précis (une révision) — pour la comparaison inter-révisions
export const getInventaireItemsByDocument = (documentId) =>
  supabase.from('inventaire_items').select('*').eq('document_id', documentId).order('id')

// Statistiques agrégées par station (vue → contourne max_rows)
export const getInventaireStats = () =>
  supabase.from('vue_inventaire_stats').select('*').order('station')

// Catalogue matériel : références dédoublonnées (module B / vue v12)
export const getCataloguePieces = () =>
  supabase.from('vue_catalogue_pieces').select('*').order('part_number')

// ─── Localisation & Maintenance (module E / v13) ─────────────────────────────
// Met à jour la localisation physique + le port relié d'une pièce d'inventaire
export const updateItemLocation = (id, data) =>
  supabase.from('inventaire_items')
    .update({ ...data, emp_updated_at: new Date().toISOString() })
    .eq('id', id).select().single()

// Résout le service (CID) desservi par un port ODF donné.
// Cherche : service.port_id → jonction (entrée/sortie) → port.cid en dernier recours.
export const getServiceForPort = async (portId) => {
  if (!portId) return { data: null }
  const s1 = await supabase.from('services')
    .select('cid, label, statut').eq('port_id', portId).limit(1)
  if (s1.data && s1.data.length) return { data: s1.data[0] }

  const j = await supabase.from('service_jonctions')
    .select('service_id').or(`port_entree_id.eq.${portId},port_sortie_id.eq.${portId}`).limit(1)
  if (j.data && j.data.length) {
    const s2 = await supabase.from('services')
      .select('cid, label, statut').eq('id', j.data[0].service_id).limit(1)
    if (s2.data && s2.data.length) return { data: s2.data[0] }
  }

  const p = await supabase.from('ports').select('cid, statut').eq('id', portId).limit(1)
  if (p.data && p.data.length && p.data[0].cid) return { data: { cid: p.data[0].cid, label: null, statut: p.data[0].statut } }
  return { data: null }
}

// Maintenances (vue enrichie : pièce + retard calculé)
export const getMaintenances = () =>
  supabase.from('vue_maintenances').select('*').order('date_prevue')

// Uniquement les maintenances ouvertes (pour badges/signalement) — colonnes légères
export const getOpenMaintenances = () =>
  supabase.from('maintenances').select('id, item_id, statut, date_prevue, type, priorite')
    .in('statut', ['PLANIFIE', 'EN_COURS'])

export const createMaintenance = (data) =>
  supabase.from('maintenances').insert(data).select().single()

export const updateMaintenance = (id, data) =>
  supabase.from('maintenances').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id).select().single()

export const deleteMaintenance = (id) =>
  supabase.from('maintenances').delete().eq('id', id)

// Supprime tous les items d'un document (avant réimport de la même révision)
export const deleteInventaireItemsByDocument = (documentId) =>
  supabase.from('inventaire_items').delete().eq('document_id', documentId)

// Insertion en lot par paquets de 500 (évite les payloads trop volumineux)
export const bulkInsertInventaireItems = async (rows) => {
  const CHUNK = 500
  let inserted = 0
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK)
    const { error } = await supabase.from('inventaire_items').insert(slice)
    if (error) return { error, inserted }
    inserted += slice.length
  }
  return { error: null, inserted }
}

// Import complet d'un document parsé : upsert doc → purge items → réinsertion
export const importInventaireDocument = async ({ document, items }) => {
  const { error: docErr } = await upsertInventaireDocument(document)
  if (docErr) return { error: docErr, inserted: 0 }
  const { error: delErr } = await deleteInventaireItemsByDocument(document.id)
  if (delErr) return { error: delErr, inserted: 0 }
  return bulkInsertInventaireItems(items)
}

// ─── Topologie DARE1 : Segments / Line Pairs (module v11) ────────────────────
export const getTopoSegments = () =>
  supabase.from('topo_segments').select('*').order('systeme').order('nom')

export const createTopoSegment = (data) =>
  supabase.from('topo_segments').insert(data).select().single()

export const updateTopoSegment = (id, data) =>
  supabase.from('topo_segments').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id).select().single()

export const deleteTopoSegment = (id) =>
  supabase.from('topo_segments').delete().eq('id', id)

export const getTopoLinePairs = (segmentId) => {
  let q = supabase.from('topo_line_pairs').select('*').order('numero')
  if (segmentId) q = q.eq('segment_id', segmentId)
  return q
}

export const createTopoLinePair = (data) =>
  supabase.from('topo_line_pairs').insert(data).select().single()

export const updateTopoLinePair = (id, data) =>
  supabase.from('topo_line_pairs').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id).select().single()

export const deleteTopoLinePair = (id) =>
  supabase.from('topo_line_pairs').delete().eq('id', id)

// Upsert en lot (utilisé par « Générer depuis l'inventaire »)
export const upsertTopoSegments = (rows) =>
  supabase.from('topo_segments').upsert(rows, { onConflict: 'id', ignoreDuplicates: true }).select()

export const upsertTopoLinePairs = (rows) =>
  supabase.from('topo_line_pairs').upsert(rows, { onConflict: 'id', ignoreDuplicates: true }).select()

// Pont : ce qui est réellement installé, agrégé par (station, segment, line_pair)
export const getTopoInventaire = () =>
  supabase.from('vue_topo_inventaire').select('*').order('station')

// ─── Stats dashboard ─────────────────────────────────────────────────────────
// Statistiques agrégées par site via vue_stats_par_site (contourne max_rows=1000)
export const getSiteStats = () =>
  supabase.from('vue_stats_par_site').select('*').order('site_name')

export const getStats = async () => {
  const [sites, racks, odfs, ports] = await Promise.all([
    supabase.from('sites').select('id', { count: 'exact' }),
    supabase.from('racks').select('id', { count: 'exact' }),
    supabase.from('odfs').select('id, odf_type, is_active', { count: 'exact' }),
    supabase.from('ports').select('id, statut', { count: 'exact' }),
  ])
  const statusCounts = {}
  ;(ports.data || []).forEach(p => {
    statusCounts[p.statut] = (statusCounts[p.statut] || 0) + 1
  })
  const odfList = odfs.data || []
  return {
    totalSites:       sites.count || 0,
    totalRacks:       racks.count || 0,
    totalOdfs:        odfs.count  || 0,
    totalOdfsActive:  odfList.filter(o => o.is_active).length,
    totalOdfsExterne: odfList.filter(o => o.odf_type === 'EXTERNE').length,
    totalOdfsInterne: odfList.filter(o => o.odf_type === 'INTERNE').length,
    totalPorts:       ports.count || 0,
    statusCounts,
  }
}

// Retourne tous les ports d'un site (via racks.site_id)
// Utilisé pour la sélection de ports de transit dans le wizard service
export const getSitePorts = async (siteId) => {
  // Récupération des ODF → slots → ports pour un site donné
  // On filtre via racks.site_id qui est une FK directe vers sites
  const { data: racks, error: rErr } = await supabase
    .from('racks')
    .select('id')
    .eq('site_id', siteId);

  if (rErr || !racks?.length) return { data: [] };

  const rackIds = racks.map(r => r.id);

  const { data: odfs, error: oErr } = await supabase
    .from('odfs')
    .select('id, name, odf_type')
    .in('rack_id', rackIds);

  if (oErr || !odfs?.length) return { data: [] };

  const odfIds = odfs.map(o => o.id);
  const odfMap = Object.fromEntries(odfs.map(o => [o.id, o]));

  const { data: slots, error: sErr } = await supabase
    .from('slots')
    .select('id, odf_id')
    .in('odf_id', odfIds);

  if (sErr || !slots?.length) return { data: [] };

  const slotIds = slots.map(s => s.id);
  const slotMap = Object.fromEntries(slots.map(s => [s.id, s]));

  const { data: ports, error: pErr } = await supabase
    .from('ports')
    .select('id, slot_port, statut, slot_id, odf_id')
    .in('slot_id', slotIds)
    .order('id');

  if (pErr) return { data: [] };

  // Enrichir chaque port avec le type ODF pour le sélecteur
  const enriched = (ports || []).map(p => {
    const slot = slotMap[p.slot_id];
    const odf = slot ? odfMap[slot.odf_id] : null;
    return {
      ...p,
      slots: slot ? { ...slot, odfs: odf } : null,
    };
  });

  return { data: enriched };
}

// ─── Données de transit pour le wizard de routage ────────────────────────────
// Retourne pour un site donné :
//   - internalPorts : ports sur ODF INTERNE (iODF), enrichis avec odf_type/rack_id/salle_id
//   - externalPorts : ports sur ODF EXTERNE du site
//   - cablesInternes : câbles INTERNE dont les deux ports sont sur ce site
// ─── Résolution salle_id en lot (pour le wizard : déterminer la portée d'une connexion INTERNE) ─────────
// Retourne un Map portId → salle_id en 3 requêtes optimisées (IN) quel que soit le nombre de ports.
// Si un port n'a pas de salle associée, sa valeur est null.
export const getSalleIdsForPorts = async (portIds) => {
  const result = {};
  if (!portIds?.length) return result;

  const { data: ports } = await supabase
    .from('ports')
    .select('id, odf_id')
    .in('id', portIds);
  if (!ports?.length) return result;

  const odfIds = [...new Set(ports.map(p => p.odf_id).filter(Boolean))];
  const { data: odfs } = await supabase
    .from('odfs')
    .select('id, rack_id')
    .in('id', odfIds);
  if (!odfs?.length) return result;

  const rackIds = [...new Set(odfs.map(o => o.rack_id).filter(Boolean))];
  const { data: racks } = await supabase
    .from('racks')
    .select('id, salle_id')
    .in('id', rackIds);

  const odfToRack  = Object.fromEntries((odfs  || []).map(o => [o.id, o.rack_id]));
  const rackToSalle = Object.fromEntries((racks || []).map(r => [r.id, r.salle_id]));

  (ports || []).forEach(p => {
    const rackId = odfToRack[p.odf_id];
    result[p.id] = rackId ? (rackToSalle[rackId] ?? null) : null;
  });
  return result;
};

export const getTransitData = async (siteId) => {
  const empty = { internalPorts: [], externalPorts: [], cablesInternes: [] };

  const { data, error } = await supabase.rpc('get_transit_data', { p_site_id: siteId });
  if (error || !data) return empty;

  const ports = data.ports || [];
  const cablesInternes = data.cables || [];

  return {
    internalPorts: ports.filter(p => p.odf_type === 'INTERNE'),
    externalPorts: ports.filter(p => p.odf_type === 'EXTERNE'),
    cablesInternes,
  };
};

