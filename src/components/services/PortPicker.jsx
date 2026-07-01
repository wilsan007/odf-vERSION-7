import React, { useState, useEffect } from "react";
import { Sel } from "../common/UI.jsx";

// ═══════════════════════════════════════════════════════════════════════════
// PORT PICKER — sélection en cascade Site → Salle → Rack → ODF → Port
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Sélecteur de port hiérarchique (Site → Salle → Rack → ODF → Port).
 *
 * @param {object}   props
 * @param {string}   props.value    - ID du port actuellement sélectionné
 * @param {Function} props.onChange - Callback appelé avec l'ID du port choisi
 * @param {Array}    props.ports    - Liste complète des ports (avec relations imbriquées)
 * @param {object}   props.TH      - Thème de couleurs
 * @param {string}   [props.accent] - Couleur de bordure gauche (optionnel)
 */
export function PortPicker({ value, onChange, ports, TH, accent }) {
  const portOf = (id) => ports.find(p => p.id === id);
  const init   = portOf(value);

  const [siteId,  setSiteId]  = useState(init?.slots?.odfs?.racks?.salles?.sites?.id || "");
  const [salleId, setSalleId] = useState(init?.slots?.odfs?.racks?.salles?.id || "");
  const [rackId,  setRackId]  = useState(init?.slots?.odfs?.racks?.id || "");
  const [odfId,   setOdfId]   = useState(init?.slots?.odfs?.id || "");

  // Synchronise les niveaux de la cascade si la valeur externe change
  useEffect(() => {
    if (!value) return;
    const p = portOf(value);
    if (p) {
      setSiteId(p.slots?.odfs?.racks?.salles?.sites?.id  || "");
      setSalleId(p.slots?.odfs?.racks?.salles?.id || "");
      setRackId(p.slots?.odfs?.racks?.id         || "");
      setOdfId(p.slots?.odfs?.id                 || "");
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Déduplique une liste de ports sur un critère de sélection et trie par nom. */
  const uniq = (arr, sel) => {
    const m = new Map();
    arr.forEach(p => {
      const o = sel(p);
      if (o?.id && !m.has(o.id)) m.set(o.id, o);
    });
    return [...m.values()].sort((a, b) => String(a.name).localeCompare(String(b.name)));
  };

  const sites   = uniq(ports, p => p.slots?.odfs?.racks?.salles?.sites);
  const salles  = uniq(
    ports.filter(p => p.slots?.odfs?.racks?.sites?.id === siteId),
    p => p.slots?.odfs?.racks?.salles
  );
  const racks   = uniq(
    ports.filter(p => p.slots?.odfs?.racks?.salles?.id === salleId),
    p => p.slots?.odfs?.racks
  );
  const odfs    = uniq(
    ports.filter(p => p.slots?.odfs?.racks?.id === rackId),
    p => p.slots?.odfs
  );
  const portList = ports
    .filter(p => p.slots?.odfs?.id === odfId)
    .sort((a, b) => String(a.slot_port).localeCompare(String(b.slot_port)));

  const accCol = accent || TH.blue;

  const onSite  = v => { setSiteId(v);  setSalleId(""); setRackId(""); setOdfId(""); onChange(""); };
  const onSalle = v => { setSalleId(v); setRackId(""); setOdfId("");  onChange(""); };
  const onRack  = v => { setRackId(v);  setOdfId(""); onChange(""); };
  const onOdf   = v => { setOdfId(v);   onChange(""); };

  return (
    <div style={{
      border:       `1px solid ${TH.border}`,
      borderLeft:   `3px solid ${accCol}`,
      borderRadius: "10px",
      padding:      "10px",
      display:      "flex",
      flexDirection:"column",
      gap:          "6px",
      background:   TH.bgInput,
    }}>
      <Sel value={siteId}  onChange={onSite}  TH={TH} style={{ fontSize: "11px" }}>
        <option value="">— Site —</option>
        {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </Sel>

      <Sel value={salleId} onChange={onSalle} TH={TH} style={{ fontSize: "11px" }}>
        <option value="">{siteId  ? "— Salle —"       : "· choisir un site"}</option>
        {salles.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </Sel>

      <Sel value={rackId}  onChange={onRack}  TH={TH} style={{ fontSize: "11px" }}>
        <option value="">{salleId ? "— Rack —"         : "· choisir une salle"}</option>
        {racks.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
      </Sel>

      <Sel value={odfId}   onChange={onOdf}   TH={TH} style={{ fontSize: "11px" }}>
        <option value="">{rackId  ? "— ODF —"          : "· choisir un rack"}</option>
        {odfs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
      </Sel>

      <Sel
        value={value || ""}
        onChange={onChange}
        TH={TH}
        style={{ fontSize: "11px", fontFamily: "'JetBrains Mono', monospace" }}
      >
        <option value="">{odfId ? "— Port —" : "· choisir un ODF"}</option>
        {portList.map(p => (
          <option key={p.id} value={p.id}>
            {p.slot_port || p.id}
            {p.statut && p.statut !== "LIBRE" ? ` · ${p.statut}` : ""}
          </option>
        ))}
      </Sel>
    </div>
  );
}
