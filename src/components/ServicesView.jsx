import React, { useState, useEffect, useCallback, useMemo } from "react";
import { supabase, getServices, getServiceRoutes, getCablesInterSites, getClients, getFournisseurs, getSites, addHistory } from "../supabase.js";
import { Btn, Inp, Sel, Spinner } from "./common/UI.jsx";

// Import extracted components
import { ServiceCard } from "./services/ServiceCard.jsx";
import { ServiceWizard } from "./services/ServiceWizard.jsx";
import { ServiceEditModal } from "./services/ServiceEditModal.jsx";
import { ServiceDetailModal } from "./services/ServiceDetailModal.jsx";
import { ServiceDeleteTab } from "./services/ServiceDeleteTab.jsx";
import { PortPicker } from "./services/PortPicker.jsx";

// Re-export PortPicker for backward compatibility
export { PortPicker };

// ═══════════════════════════════════════════════════════════════════════════
// MAIN SERVICES VIEW
// ═══════════════════════════════════════════════════════════════════════════
export default function ServicesView({ t, TH, user }) {
  const userLabel = user?.email || user?.name || "système";

  const [services, setServices] = useState([]);
  const [routes, setRoutes] = useState({});
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [activeTab, setActiveTab] = useState(0);

  // Filtres
  const [search, setSearch] = useState("");
  const [filterClient, setFilterClient] = useState("");
  const [filterCable, setFilterCable] = useState("");
  const [filterCapacite, setFilterCapacite] = useState("");

  // Edit state
  const [editingService, setEditingService] = useState(null);
  const [editLabel, setEditLabel] = useState("");
  const [editClient, setEditClient] = useState("");
  const [editFourn, setEditFourn] = useState("");
  const [editStatut, setEditStatut] = useState("ACTIF");

  const [cablesInterSites, setCablesInterSites] = useState([]);
  const [clients, setClients] = useState([]);
  const [fournisseurs, setFournisseurs] = useState([]);
  const [sitesList, setSitesList] = useState([]);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      getServices(),
      getServiceRoutes(),
    ]).then(([s, r]) => {
      setServices(s.data || []);
      const m = {};
      (r.data || []).forEach(x => { m[x.service_id] = x; });
      setRoutes(m);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    getCablesInterSites().then(r => setCablesInterSites(r.data || []));
    getClients().then(r => setClients(r.data || []));
    getFournisseurs().then(r => setFournisseurs(r.data || []));
    getSites().then(r => setSitesList(r.data || []));
  }, [load]);

  // Options de filtre dérivées des services chargés (pas de requête supplémentaire)
  const cableOptions = useMemo(() => {
    const seen = new Map();
    services.forEach(s => {
      if (s.cable_id && !seen.has(s.cable_id)) {
        seen.set(s.cable_id, s.cables_fibre?.cable_reference || s.cable_id);
      }
    });
    return [...seen.entries()].map(([id, label]) => ({ id, label }));
  }, [services]);

  const capaciteOptions = useMemo(() => (
    [...new Set(services.map(s => s.capacite_gbps).filter(c => c != null))].sort((a, b) => a - b)
  ), [services]);

  const filteredServices = useMemo(() => services.filter(s => {
    if (search && !((s.cid || s.id || "").toLowerCase().includes(search.trim().toLowerCase()))) return false;
    if (filterClient && s.client_id !== filterClient) return false;
    if (filterCable && s.cable_id !== filterCable) return false;
    if (filterCapacite && String(s.capacite_gbps) !== filterCapacite) return false;
    return true;
  }), [services, search, filterClient, filterCable, filterCapacite]);

  const resetFilters = () => {
    setSearch(""); setFilterClient(""); setFilterCable(""); setFilterCapacite("");
  };

  const startEdit = (s) => {
    setEditingService(s);
    setEditLabel(s.label || "");
    setEditClient(s.client_id || "");
    setEditFourn(s.fournisseur_id || "");
    setEditStatut(s.statut || "ACTIF");
  };

  const toggleStatut = async (s) => {
    const newStatut = (s.statut || "ACTIF") === "ACTIF" ? "SUSPENDU" : "ACTIF";
    try {
      const { error } = await supabase.from('services')
        .update({ statut: newStatut, updated_by: userLabel })
        .eq('id', s.id);
      if (error) throw error;

      await addHistory({
        action: `Service ${newStatut === "ACTIF" ? "activé" : "désactivé"} : ${s.cid || s.id} — ${s.label}`,
        entity_type: 'service', entity_id: s.id, user_email: userLabel
      });

      setSelectedService(null);
      load();
    } catch (e) {
      alert("Erreur : " + e.message);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingService) return;
    try {
      const oldStatut = editingService.statut || "ACTIF";
      const newStatut = editStatut;
      const cid = editingService.cid || editingService.id;

      const { error } = await supabase.from('services').update({
        label: editLabel.trim(),
        client_id: editClient || null,
        fournisseur_id: editFourn || null,
        statut: editStatut,
        updated_by: userLabel
      }).eq('id', editingService.id);

      if (error) throw error;

      await addHistory({
        action: `Service modifié : ${cid} — ${editLabel.trim()}`,
        entity_type: 'service', entity_id: editingService.id, user_email: userLabel
      });

      if (oldStatut !== "RESILIE" && newStatut === "RESILIE") {
        await supabase.from('ports').update({ statut: 'LIBRE', cid: null }).eq('cid', cid);
      } else if (oldStatut === "RESILIE" && newStatut !== "RESILIE") {
        const { data: jons } = await supabase.from('service_jonctions').select('port_entree_id, port_sortie_id').eq('service_id', editingService.id);
        const portsToUpdate = [];
        (jons || []).forEach(j => {
          if (j.port_entree_id) portsToUpdate.push(j.port_entree_id);
          if (j.port_sortie_id) portsToUpdate.push(j.port_sortie_id);
        });
        if (portsToUpdate.length > 0) {
          await supabase.from('ports').update({ statut: 'OCCUPE', cid: cid }).in('id', portsToUpdate);
        }
      }

      setEditingService(null);
      setSelectedService(null);
      load();
    } catch (e) {
      alert("Erreur de modification : " + e.message);
    }
  };

  const onWizardDone = () => {
    setShowWizard(false);
    load();
    getCablesInterSites().then(r => setCablesInterSites(r.data || []));
  };

  if (loading) return <Spinner TH={TH} />;

  const serviceTabs = t.serviceTabs || ["Services", "Suppression"];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Barre d'onglets */}
      <div style={{
        display: "flex", gap: "4px", padding: "12px 20px",
        borderBottom: `1px solid ${TH.border}`, flexShrink: 0
      }}>
        {serviceTabs.map((lb, i) => (
          <button
            key={i}
            onClick={() => setActiveTab(i)}
            style={{
              padding: "6px 14px", borderRadius: "8px",
              background: activeTab === i ? TH.blue : "transparent",
              color: activeTab === i ? "#fff" : TH.text2,
              border: `1px solid ${activeTab === i ? TH.blue : TH.border}`,
              fontSize: "12px", fontWeight: 600, cursor: "pointer"
            }}>
            {lb}
          </button>
        ))}
      </div>

      {/* Contenu de l'onglet actif */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        {activeTab === 0 && (
          <div style={{ height: "100%", overflowY: "auto", padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ color: TH.text2, fontSize: "12px" }}>{filteredServices.length} / {services.length} service(s)</div>
              <Btn onClick={() => setShowWizard(true)} TH={TH}>+ {t.add} service</Btn>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr auto", gap: "10px", marginBottom: "16px" }}>
              <Inp value={search} onChange={setSearch} placeholder="Rechercher par CID…" TH={TH} />
              <Sel value={filterClient} onChange={setFilterClient} TH={TH}>
                <option value="">Tous les clients</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </Sel>
              <Sel value={filterCable} onChange={setFilterCable} TH={TH}>
                <option value="">Toutes les sources</option>
                {cableOptions.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </Sel>
              <Sel value={filterCapacite} onChange={setFilterCapacite} TH={TH}>
                <option value="">Toutes les capacités</option>
                {capaciteOptions.map(c => <option key={c} value={c}>{c} Gbps</option>)}
              </Sel>
              <Btn variant="ghost" onClick={resetFilters} TH={TH}>Réinitialiser</Btn>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {filteredServices.map(s => (
                <ServiceCard
                  key={s.id}
                  service={s}
                  onSelect={setSelectedService}
                  onEdit={startEdit}
                  onToggleStatut={toggleStatut}
                  TH={TH}
                />
              ))}
              {!filteredServices.length && (
                <div style={{ textAlign: "center", color: TH.text3, paddingTop: "40px" }}>{t.noData}</div>
              )}
            </div>

            <ServiceWizard
              open={showWizard}
              onClose={() => setShowWizard(false)}
              onDone={onWizardDone}
              sites={sitesList}
              cables={cablesInterSites}
              fournisseurs={fournisseurs}
              clients={clients}
              userLabel={userLabel}
              TH={TH}
              t={t}
            />

            <ServiceEditModal
              editingService={editingService}
              editLabel={editLabel} setEditLabel={setEditLabel}
              editClient={editClient} setEditClient={setEditClient}
              editFourn={editFourn} setEditFourn={setEditFourn}
              editStatut={editStatut} setEditStatut={setEditStatut}
              clients={clients}
              fournisseurs={fournisseurs}
              onClose={() => setEditingService(null)}
              onSave={handleSaveEdit}
              TH={TH}
            />

            <ServiceDetailModal
              service={selectedService}
              routeInfo={selectedService ? routes[selectedService.id] : null}
              onClose={() => setSelectedService(null)}
              TH={TH}
            />
          </div>
        )}

        {activeTab === 1 && (
          <ServiceDeleteTab
            services={services}
            routes={routes}
            user={user}
            userLabel={userLabel}
            onDeleted={load}
            t={t}
            TH={TH}
          />
        )}
      </div>
    </div>
  );
}
