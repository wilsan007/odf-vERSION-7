import React, { useState, useEffect } from "react";
import { supabase, getSites, getRacks, getEquipements, getEquipementSlots } from "../../supabase.js";

function Sel({ value, onChange, children, TH, style = {}, disabled = false }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
      style={{
        width: "100%", background: TH.bgInput, border: `1px solid ${disabled ? TH.border : TH.border2}`,
        borderRadius: "8px", padding: "9px 12px", color: disabled ? TH.text3 : TH.text1,
        fontSize: "13px", cursor: disabled ? "not-allowed" : "pointer", outline: "none",
        opacity: disabled ? 0.6 : 1, ...style
      }}>
      {children}
    </select>
  );
}

function Label({ children, TH }) {
  return <label style={{ display: "block", color: TH.text2, fontSize: "11px", fontWeight: 600, marginBottom: "5px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{children}</label>;
}

// Sélecteur d'un port équipement unique (site → rack → équipement → slot → port libre)
// Miroir d'InfraSelector mais pour la hiérarchie equipements/equipement_slots/equipement_ports.
export function EquipementSelector({ label, color, onChange, TH }) {
  const [sites, setSites] = useState([]);
  const [racks, setRacks] = useState([]);
  const [equipements, setEquipements] = useState([]);
  const [slots, setSlots] = useState([]);
  const [ports, setPorts] = useState([]);

  const [site, setSite] = useState("");
  const [rack, setRack] = useState("");
  const [equipement, setEquipement] = useState("");
  const [slot, setSlot] = useState("");
  const [port, setPort] = useState("");

  useEffect(() => { getSites().then(r => setSites(r.data || [])); }, []);

  // CASCADE site → racks
  useEffect(() => {
    setRack(""); setEquipement(""); setSlot(""); setPort("");
    setRacks([]); setEquipements([]); setSlots([]); setPorts([]);
    if (site) getRacks(site, null).then(r => setRacks(r.data || []));
  }, [site]);

  // CASCADE rack → équipements
  useEffect(() => {
    setEquipement(""); setSlot(""); setPort("");
    setEquipements([]); setSlots([]); setPorts([]);
    if (rack) getEquipements(rack).then(r => setEquipements(r.data || []));
  }, [rack]);

  // CASCADE équipement → slots
  useEffect(() => {
    setSlot(""); setPort("");
    setSlots([]); setPorts([]);
    if (equipement) getEquipementSlots(equipement).then(r => setSlots(r.data || []));
  }, [equipement]);

  // CASCADE slot → ports libres
  useEffect(() => {
    setPort("");
    setPorts([]);
    if (slot) {
      supabase.from("equipement_ports").select("id,slot_port,statut,type_module,frequence_dwdm")
        .eq("slot_id", slot).order("slot_port")
        .then(r => setPorts((r.data || []).filter(p => p.statut === "LIBRE")));
    }
  }, [slot]);

  useEffect(() => {
    onChange({ site, rack, equipement, slot, port });
  }, [site, rack, equipement, slot, port]);

  const g = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" };

  return (
    <div style={{ borderLeft: `3px solid ${color}`, paddingLeft: "14px" }}>
      <div style={{ fontSize: "12px", fontWeight: 700, color, marginBottom: "10px", textTransform: "uppercase", letterSpacing: "1px" }}>
        {label}
      </div>
      <div style={g}>
        <div>
          <Label TH={TH}>Site</Label>
          <Sel value={site} onChange={setSite} TH={TH}>
            <option value="">— Sélectionner un site —</option>
            {sites.map(s => <option key={s.id} value={s.id}>{s.name} ({s.id})</option>)}
          </Sel>
        </div>
        <div>
          <Label TH={TH}>Rack</Label>
          <Sel value={rack} onChange={setRack} TH={TH} disabled={!site}>
            <option value="">— Sélectionner un rack —</option>
            {racks.map(r => <option key={r.id} value={r.id}>{r.name} ({r.id})</option>)}
          </Sel>
        </div>
        <div>
          <Label TH={TH}>Équipement</Label>
          <Sel value={equipement} onChange={setEquipement} TH={TH} disabled={!rack}>
            <option value="">— Sélectionner un équipement —</option>
            {equipements.map(e => <option key={e.id} value={e.id}>{e.name}{e.type ? ` (${e.type})` : ""}</option>)}
          </Sel>
        </div>
        <div>
          <Label TH={TH}>Slot</Label>
          <Sel value={slot} onChange={setSlot} TH={TH} disabled={!equipement}>
            <option value="">— Sélectionner un slot —</option>
            {slots.map(s => <option key={s.id} value={s.id}>{s.name} ({s.ports_count} ports)</option>)}
          </Sel>
        </div>
        <div style={{ gridColumn: "1/-1" }}>
          <Label TH={TH}>Port libre</Label>
          <Sel value={port} onChange={setPort} TH={TH} disabled={!slot}>
            <option value="">{slot ? "— Sélectionner un port —" : "— Sélectionner un slot d'abord —"}</option>
            {ports.map(p => <option key={p.id} value={p.id}>{p.slot_port}</option>)}
          </Sel>
        </div>
      </div>
      {slot && ports.length === 0 && (
        <div style={{ marginTop: "10px", fontSize: "11px", color: TH.text3 }}>⚠ Aucun port libre dans ce slot.</div>
      )}
    </div>
  );
}
