import React, { useState, useEffect } from "react";
import {
  getSites, createSite, deleteSite,
  getSalles, createSalle, deleteSalle,
  getRacks, createRack, deleteRack,
  getOdfs, createOdf, deleteOdf,
  getSlots, createSlot, deleteSlot,
} from "../supabase.js";
import { Btn, Inp, Confirm } from "./common/UI.jsx";

// MANAGE INFRA — CRUD Sites / Salles / Racks / ODFs / Slots
// ═══════════════════════════════════════════════════════════════════════════
export default function ManageInfra({ t, TH }) {
  const [tab, setTab] = useState(0);
  const tabs = t.infraTabs;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", gap: "4px", padding: "12px 20px", borderBottom: `1px solid ${TH.border}`, flexShrink: 0 }}>
        {tabs.map((lb, i) => (
          <button 
            key={i} 
            onClick={() => setTab(i)} 
            style={{
              padding: "6px 14px", 
              borderRadius: "8px",
              background: tab === i ? TH.blue : "transparent", 
              color: tab === i ? "#fff" : TH.text2,
              border: `1px solid ${tab === i ? TH.blue : TH.border}`, 
              fontSize: "12px", 
              fontWeight: 600, 
              cursor: "pointer"
            }}>
            {lb}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: "hidden" }}>
        {tab === 0 && <SitesCRUD t={t} TH={TH} />}
        {tab === 1 && <SallesCRUD t={t} TH={TH} />}
        {tab === 2 && <RacksCRUD t={t} TH={TH} />}
        {tab === 3 && <OdfsCRUD t={t} TH={TH} />}
        {tab === 4 && <SlotsCRUD t={t} TH={TH} />}
      </div>
    </div>
  );
}

// Generic CRUD list component (ID texte)
function CrudList({ items, idKey, nameKey, subKey, onAdd, onDelete, addLabel, addLabel2, t, TH, extraBefore, renderItem }) {
  const [val1, setVal1] = useState("");
  const [val2, setVal2] = useState("");
  const [confirm, setConfirm] = useState(null);
  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "20px" }}>
      <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
        {extraBefore}
        {addLabel2 && <Inp value={val2} onChange={setVal2} placeholder={addLabel2} TH={TH} style={{ flex: 1, maxWidth: "140px" }} />}
        <Inp value={val1} onChange={setVal1} placeholder={addLabel} TH={TH} style={{ flex: 1, maxWidth: "240px" }} />
        <Btn onClick={() => { if (val1.trim()) { onAdd(val1.trim(), val2.trim()); setVal1(""); setVal2(""); } }} TH={TH}>+ {t.add}</Btn>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {items.map(item => (
          <div 
            key={item[idKey]} 
            style={{
              display: "flex", 
              alignItems: "center", 
              justifyContent: "space-between",
              background: TH.bgCard, 
              border: `1px solid ${TH.border}`, 
              borderRadius: "10px", 
              padding: "12px 16px"
            }}>
            {renderItem
              ? renderItem(item)
              : <div>
                  <span className="font-mono" style={{ color: TH.text1, fontSize: "13px", fontWeight: 600 }}>{item[nameKey]}</span>
                  {subKey && <span style={{ color: TH.text3, fontSize: "11px", marginLeft: "10px" }}>{item[idKey]}</span>}
                </div>
            }
            <Btn onClick={() => setConfirm(item[idKey])} variant="danger" size="sm" TH={TH}>✕</Btn>
          </div>
        ))}
        {!items.length && <div style={{ textAlign: "center", color: TH.text3, paddingTop: "30px" }}>{t.noData}</div>}
      </div>
      {confirm && <Confirm message={t.confirmDelete} onYes={() => { onDelete(confirm); setConfirm(null); }} onNo={() => setConfirm(null)} TH={TH} t={t} />}
    </div>
  );
}

function SitesCRUD({ t, TH }) {
  const [items, setItems] = useState([]);
  const load = () => getSites().then(r => setItems(r.data || []));
  useEffect(() => { load(); }, []);
  return (
    <CrudList 
      items={items} 
      idKey="id" 
      nameKey="name" 
      subKey
      onAdd={(name, code) => createSite({ id: code.toUpperCase() || name.slice(0, 3).toUpperCase(), name }).then(load)}
      onDelete={id => deleteSite(id).then(load)}
      addLabel={t.siteName} 
      addLabel2="Code (ex: RDK)" 
      t={t} 
      TH={TH} 
    />
  );
}

function SallesCRUD({ t, TH }) {
  const [items, setItems] = useState([]);
  const [sites, setSites] = useState([]);
  const [selSite, setSelSite] = useState("");
  useEffect(() => { getSites().then(r => setSites(r.data || [])); }, []);
  const load = () => getSalles(selSite || null).then(r => setItems(r.data || []));
  useEffect(() => { load(); }, [selSite]);
  return (
    <CrudList 
      items={items} 
      idKey="id" 
      nameKey="name" 
      subKey
      onAdd={name => {
        if (!selSite) return;
        const id = `${selSite}-${name.toUpperCase()}`;
        createSalle({ id, site_id: selSite, name: name.toUpperCase() }).then(res => {
          if (res.error) alert("Erreur lors de la création de la salle: " + res.error.message);
          else load();
        });
      }}
      onDelete={id => deleteSalle(id).then(res => {
        if (res.error) alert("Erreur lors de la suppression de la salle: " + res.error.message);
        else load();
      })}
      addLabel={`${t.salleName || "Salle"} (ex: S2)`} 
      t={t} 
      TH={TH}
      extraBefore={
        <select 
          value={selSite} 
          onChange={e => setSelSite(e.target.value)}
          style={{ background: TH.bgInput, border: `1px solid ${TH.border}`, borderRadius: "8px", padding: "7px 10px", color: TH.text1, fontSize: "12px" }}>
          <option value="">{t.allSites}</option>
          {sites.map(s => <option key={s.id} value={s.id}>{s.name} ({s.id})</option>)}
        </select>
      } 
    />
  );
}

function RacksCRUD({ t, TH }) {
  const [items, setItems] = useState([]);
  const [sites, setSites] = useState([]);
  const [salles, setSalles] = useState([]);
  const [selSite, setSelSite] = useState("");
  const [selSalle, setSelSalle] = useState("");
  useEffect(() => { getSites().then(r => setSites(r.data || [])); }, []);
  useEffect(() => {
    if (selSite) getSalles(selSite).then(r => setSalles(r.data || []));
    else setSalles([]);
    setSelSalle("");
  }, [selSite]);
  const load = () => getRacks(selSite || null, selSalle || null).then(r => setItems(r.data || []));
  useEffect(() => { load(); }, [selSite, selSalle]);
  return (
    <CrudList 
      items={items} 
      idKey="id" 
      nameKey="name" 
      subKey
      onAdd={name => {
        if (!selSite) return;
        const salleAbbr = selSalle ? salles.find(s => s.id === selSalle)?.name || selSalle.split('-').slice(1).join('-') : null;
        const baseRack = name.toUpperCase();
        const rackName = baseRack;
        const rackId = salleAbbr ? `${selSite}-${salleAbbr}-${baseRack}` : `${selSite}-${baseRack}`;
        createRack({ id: rackId, site_id: selSite, salle_id: selSalle || null, name: rackName }).then(res => {
          if (res.error) alert("Erreur création rack: " + res.error.message);
          else load();
        });
      }}
      onDelete={id => deleteRack(id).then(res => {
        if (res.error) alert("Erreur suppression rack: " + res.error.message);
        else load();
      })}
      addLabel={`${t.rackName} (ex: R2)`} 
      t={t} 
      TH={TH}
      renderItem={(item) => (
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span className="font-mono" style={{ color: TH.text1, fontSize: "13px", fontWeight: 600 }}>{item.name}</span>
          <span style={{ color: TH.text3, fontSize: "11px" }}>{item.id}</span>
          {item.salles?.name && <span style={{ background: `${TH.cyan}22`, color: TH.cyan, border: `1px solid ${TH.cyan}44`, borderRadius: "6px", padding: "1px 7px", fontSize: "10px", fontWeight: 600 }}>Salle {item.salles.name}</span>}
          {item.sites?.name && <span style={{ color: TH.text3, fontSize: "10px" }}>{item.sites.name}</span>}
        </div>
      )}
      extraBefore={
        <>
          <select 
            value={selSite} 
            onChange={e => setSelSite(e.target.value)}
            style={{ background: TH.bgInput, border: `1px solid ${TH.border}`, borderRadius: "8px", padding: "7px 10px", color: TH.text1, fontSize: "12px" }}>
            <option value="">{t.allSites}</option>
            {sites.map(s => <option key={s.id} value={s.id}>{s.name} ({s.id})</option>)}
          </select>
          <select 
            value={selSalle} 
            onChange={e => setSelSalle(e.target.value)}
            style={{ background: TH.bgInput, border: `1px solid ${TH.border}`, borderRadius: "8px", padding: "7px 10px", color: selSalle ? TH.cyan : TH.text1, fontSize: "12px", fontWeight: selSalle ? 700 : 400 }}>
            <option value="">⚠ Salle (obligatoire pour éviter conflits)</option>
            {salles.map(s => <option key={s.id} value={s.id}>{s.name} — {s.id}</option>)}
          </select>
        </>
      } 
    />
  );
}

function OdfsCRUD({ t, TH }) {
  const [items, setItems] = useState([]);
  const [racks, setRacks] = useState([]);
  const [selRack, setSelRack] = useState("");

  useEffect(() => { getRacks().then(r => setRacks(r.data || [])); }, []);
  const load = () => getOdfs(selRack || null).then(r => setItems(r.data || []));
  useEffect(() => { load(); }, [selRack]);

  return (
    <CrudList 
      items={items} 
      idKey="id" 
      nameKey="name" 
      subKey
      onAdd={name => {
        if (!selRack) {
          alert("Veuillez sélectionner un rack d'abord.");
          return;
        }
        const odfName = name.toUpperCase();
        createOdf({ id: `${selRack}-${odfName}`, rack_id: selRack, name: odfName, odf_type: null }).then(res => {
          if (res.error) alert("Erreur lors de la création de l'ODF: " + res.error.message);
          else load();
        });
      }}
      onDelete={id => deleteOdf(id).then(res => {
        if (res.error) alert("Erreur lors de la suppression de l'ODF: " + res.error.message);
        else load();
      })}
      addLabel={`${t.odfName} (ex: ODF2)`} 
      t={t} 
      TH={TH}
      renderItem={(item) => (
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span className="font-mono" style={{ color: TH.text1, fontSize: "13px", fontWeight: 600 }}>{item.name}</span>
          <span style={{ color: TH.text3, fontSize: "11px" }}>{item.id}</span>
          <span style={{
            background: item.odf_type === "EXTERNE" ? "rgba(59,130,246,.15)" : item.odf_type === "INTERNE" ? "rgba(167,139,250,.15)" : "rgba(156,163,175,.15)",
            color: item.odf_type === "EXTERNE" ? "#3B82F6" : item.odf_type === "INTERNE" ? "#A78BFA" : "#9CA3AF",
            border: `1px solid ${item.odf_type === "EXTERNE" ? "rgba(59,130,246,.3)" : item.odf_type === "INTERNE" ? "rgba(167,139,250,.3)" : "rgba(156,163,175,.3)"}`,
            borderRadius: "6px", padding: "1px 7px", fontSize: "10px", fontWeight: 600
          }}>
            {item.odf_type || "NON CONFIGURÉ"}
          </span>
        </div>
      )}
      extraBefore={
        <>
          <select 
            value={selRack} 
            onChange={e => setSelRack(e.target.value)}
            style={{ background: TH.bgInput, border: `1px solid ${TH.border}`, borderRadius: "8px", padding: "7px 10px", color: TH.text1, fontSize: "12px" }}>
            <option value="">Tous racks</option>
            {racks.map(r => <option key={r.id} value={r.id}>{r.name} — {r.id}</option>)}
          </select>
        </>
      } 
    />
  );
}

function SlotsCRUD({ t, TH }) {
  const [items, setItems] = useState([]);
  const [odfs, setOdfs] = useState([]);
  const [selOdf, setSelOdf] = useState("");
  useEffect(() => { getOdfs().then(r => setOdfs(r.data || [])); }, []);
  const load = () => getSlots(selOdf || null).then(r => setItems(r.data || []));
  useEffect(() => { load(); }, [selOdf]);
  return (
    <CrudList 
      items={items} 
      idKey="id" 
      nameKey="name" 
      subKey
      onAdd={name => {
        if (!selOdf) return;
        const match = name.match(/\d+/);
        const num = match ? parseInt(match[0], 10) : null;
        if (!num) {
          alert("Veuillez entrer un numéro de slot valide (ex: 2 ou S02)");
          return;
        }
        const slotName = 'S' + String(num).padStart(2, '0');
        createSlot({ id: `${selOdf}_${slotName}`, odf_id: selOdf, slot_num: num, name: slotName }).then(res => {
          if (res.error) alert("Erreur lors de la création du slot: " + res.error.message);
          else load();
        });
      }}
      onDelete={id => deleteSlot(id).then(res => {
        if (res.error) alert("Erreur lors de la suppression du slot: " + res.error.message);
        else load();
      })}
      addLabel={`${t.slotName || "Slot"} (ex: 2 pour S02)`} 
      t={t} 
      TH={TH}
      extraBefore={
        <select 
          value={selOdf} 
          onChange={e => setSelOdf(e.target.value)}
          style={{ background: TH.bgInput, border: `1px solid ${TH.border}`, borderRadius: "8px", padding: "7px 10px", color: TH.text1, fontSize: "12px" }}>
          <option value="">Tous ODFs</option>
          {odfs.map(o => <option key={o.id} value={o.id}>{o.name} — {o.id}</option>)}
        </select>
      } 
    />
  );
}
