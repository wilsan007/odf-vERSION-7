import React, { useState } from "react";
import { supabase } from "../../supabase.js";

function Sel({ value, onChange, children, TH, style = {}, disabled = false }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
      style={{
        background: TH.bgInput, border: `1px solid ${disabled ? TH.border : TH.border2}`,
        borderRadius: "8px", padding: "9px 12px", color: disabled ? TH.text3 : TH.text1,
        fontSize: "13px", cursor: disabled ? "not-allowed" : "pointer", outline: "none",
        opacity: disabled ? 0.6 : 1, ...style
      }}>
      {children}
    </select>
  );
}

export function ConnectionManager({
  cables,
  loadCablesList,
  loadingCables,
  TH,
  setErr,
  setSuccess,
  setSaving,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState("");
  const [expandedCableId, setExpandedCableId] = useState(null);
  const [expandedPorts, setExpandedPorts] = useState({ src: {}, dst: {} });



  const handleExpand = async (cable) => {
    if (expandedCableId === cable.id) {
      setExpandedCableId(null);
      return;
    }
    
    setExpandedCableId(cable.id);
    setExpandedPorts({ src: {}, dst: {} });

    const srcSlotId = cable.port_source_id ? cable.port_source_id.slice(0, -3) : null;
    const dstSlotId = cable.port_dest_id ? cable.port_dest_id.slice(0, -3) : null;

    if (srcSlotId && dstSlotId) {
      try {
        const [srcPortsRes, dstPortsRes] = await Promise.all([
          supabase.from("ports").select("slot_port, statut, cid").eq("slot_id", srcSlotId),
          supabase.from("ports").select("slot_port, statut, cid").eq("slot_id", dstSlotId)
        ]);

        const srcMap = {};
        (srcPortsRes.data || []).forEach(p => {
          srcMap[p.slot_port.slice(-3)] = { statut: p.statut, cid: p.cid };
        });

        const dstMap = {};
        (dstPortsRes.data || []).forEach(p => {
          dstMap[p.slot_port.slice(-3)] = { statut: p.statut, cid: p.cid };
        });

        setExpandedPorts({ src: srcMap, dst: dstMap });
      } catch (err) {
        console.error("Error loading port statuses:", err);
      }
    }
  };

  const getPortDisplay = (port) => {
    if (!port || !port.slots) return "—";
    const slot = port.slots;
    const odf = slot.odfs;
    const rack = odf?.racks;
    const salle = rack?.salles;
    const site = salle?.sites;
    const parts = [
      site?.id || "",
      salle?.name || "",
      rack?.name || "",
      odf?.name || "",
      port.slot_port || ""
    ].filter(Boolean);
    return parts.join("-");
  };

  const getPortPaths = (cable, pNum) => {
    const pStr = String(pNum).padStart(2, '0');
    
    const src = cable.port_source;
    let pathSrc = "—";
    if (src && src.slots) {
      const slot = src.slots;
      const odf = slot.odfs;
      const rack = odf?.racks;
      const salle = rack?.salles;
      const site = salle?.sites;
      pathSrc = `${site?.name || "Site"} / Salle ${salle?.name || "Salle"} / ${rack?.name || "Rack"} / ${odf?.name || "ODF"} / Slot ${slot?.name || "Slot"} / Port ${slot?.name || "Slot"}P${pStr}`;
    }

    const dst = cable.port_dest;
    let pathDst = "—";
    if (dst && dst.slots) {
      const slot = dst.slots;
      const odf = slot.odfs;
      const rack = odf?.racks;
      const salle = rack?.salles;
      const site = salle?.sites;
      pathDst = `${site?.name || "Site"} / Salle ${salle?.name || "Salle"} / ${rack?.name || "Rack"} / ${odf?.name || "ODF"} / Slot ${slot?.name || "Slot"} / Port ${slot?.name || "Slot"}P${pStr}`;
    }

    return { src: pathSrc, dst: pathDst };
  };

  const filteredCables = cables.filter(c => {
    const term = searchQuery.toLowerCase();
    const matchSearch =
      (c.cable_reference || "").toLowerCase().includes(term) ||
      (c.nom || "").toLowerCase().includes(term) ||
      (c.type_fibre || "").toLowerCase().includes(term);

    const matchType = !searchType || c.type_lien === searchType;
    return matchSearch && matchType;
  });

  return (
    <div>
      <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
        <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          placeholder="🔍 Rechercher par réf. câble, nom, type fibre..."
          style={{
            flex: 3, minWidth: "200px", background: TH.bgInput, border: `1px solid ${TH.border}`,
            borderRadius: "8px", padding: "9px 12px", color: TH.text1, fontSize: "13px", outline: "none"
          }} />
        <Sel value={searchType} onChange={setSearchType} TH={TH} style={{ flex: 1, minWidth: "140px" }}>
          <option value="">Tous les types</option>
          <option value="EXTERNE">🌐 EXTERNE</option>
          <option value="INTERNE">🏢 INTERNE</option>
        </Sel>
      </div>

      {loadingCables ? (
        <div style={{ textAlign: "center", padding: "40px", color: TH.text3 }}>Chargement des connexions…</div>
      ) : filteredCables.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px", color: TH.text3 }}>Aucune connexion trouvée</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
          <thead>
            <tr style={{ background: TH.bgSurface, borderBottom: `2px solid ${TH.border}` }}>
              <th style={{ width: "30px", padding: "10px 12px" }}></th>
              {["Référence", "Nom", "Type", "Fibre", "Port Source", "Port Dest"].map(h => (
                <th key={h} style={{ padding: "10px 12px", textAlign: "left", color: TH.text3, fontWeight: 600, fontSize: "11px" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredCables.map((c, i) => {
              const isExpanded = expandedCableId === c.id;
              return (
                <React.Fragment key={c.id}>
                  <tr style={{ borderBottom: `1px solid ${TH.border}`, background: i % 2 === 0 ? "transparent" : TH.bgHover }}>
                    <td style={{ padding: "10px 12px", textAlign: "center", cursor: "pointer", color: TH.blue }}
                        onClick={() => handleExpand(c)}>
                      {isExpanded ? "▼" : "▶"}
                    </td>
                    <td style={{ padding: "10px 12px", fontFamily: "'JetBrains Mono',monospace", color: TH.text1, fontWeight: 600 }}>{c.cable_reference}</td>
                    <td style={{ padding: "10px 12px", color: TH.text2 }}>{c.nom}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{
                        background: c.type_lien === "EXTERNE" 
                          ? "rgba(59,130,246,.15)" 
                          : "rgba(245,158,11,.15)",
                        color: c.type_lien === "EXTERNE" 
                          ? "#3B82F6" 
                          : "#F59E0B",
                        border: `1px solid ${
                          c.type_lien === "EXTERNE" 
                            ? "rgba(59,130,246,.3)" 
                            : "rgba(245,158,11,.3)"
                        }`,
                        borderRadius: "6px", padding: "2px 8px", fontSize: "10px", fontWeight: 700
                      }}>
                        {c.type_lien === "EXTERNE" ? "EXTERNE" : "INTERNE"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", color: TH.text2 }}>{c.type_fibre}</td>
                    <td style={{ padding: "10px 12px", fontFamily: "'JetBrains Mono',monospace", fontSize: "10px", color: TH.text3 }}>{getPortDisplay(c.port_source)}</td>
                    <td style={{ padding: "10px 12px", fontFamily: "'JetBrains Mono',monospace", fontSize: "10px", color: TH.text3 }}>{getPortDisplay(c.port_dest)}</td>

                  </tr>
                  {isExpanded && (
                    <tr style={{ background: TH.bgSurface }}>
                      <td colSpan={7} style={{ padding: "16px 20px" }}>
                        <div style={{ background: TH.bgCard, border: `1px solid ${TH.border}`, borderRadius: "10px", padding: "16px" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                            <thead>
                              <tr style={{ borderBottom: `1px solid ${TH.border}`, background: TH.bgInput }}>
                                <th style={{ padding: "8px 12px", textAlign: "left", color: TH.text3, width: "130px", fontWeight: 600 }}>CID</th>
                                <th style={{ padding: "8px 12px", textAlign: "left", color: TH.text3, fontWeight: 600 }}>chemin_source</th>
                                <th style={{ padding: "8px 12px", textAlign: "center", color: TH.text3, width: "100px", fontWeight: 600 }}>statut_source</th>
                                <th style={{ padding: "8px 12px", textAlign: "center", color: TH.text3, width: "50px", fontWeight: 600 }}>liaison</th>
                                <th style={{ padding: "8px 12px", textAlign: "left", color: TH.text3, fontWeight: 600 }}>chemin_destination</th>
                                <th style={{ padding: "8px 12px", textAlign: "center", color: TH.text3, width: "100px", fontWeight: 600 }}>statut_dest</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Array.from({ length: 12 }, (_, index) => {
                                const paths = getPortPaths(c, index + 1);
                                const pStr = 'P' + String(index + 1).padStart(2, '0');
                                
                                const srcPortObj = expandedPorts.src[pStr] || { statut: "LIBRE", cid: null };
                                const dstPortObj = expandedPorts.dst[pStr] || { statut: "LIBRE", cid: null };

                                const rowCid = srcPortObj.cid || dstPortObj.cid || "—";
                                
                                const srcStatus = srcPortObj.cid ? "OCCUPE" : "LIBRE";
                                const dstStatus = dstPortObj.cid ? "OCCUPE" : "LIBRE";

                                const getStatusBadge = (status) => (
                                  <span style={{
                                    background: status === "LIBRE" ? "rgba(16,185,129,.15)" : "rgba(248,113,113,.15)",
                                    color: status === "LIBRE" ? "#34D399" : "#F87171",
                                    borderRadius: "4px", padding: "2px 6px", fontSize: "10px", fontWeight: 700
                                  }}>
                                    {status}
                                  </span>
                                );

                                return (
                                  <tr key={index} style={{ borderBottom: `1px solid ${TH.border}55`, background: index % 2 === 0 ? "transparent" : TH.bgHover }}>
                                    <td style={{ padding: "7px 12px", fontFamily: "'JetBrains Mono',monospace", color: rowCid !== "—" ? TH.cyan : TH.text3, fontWeight: rowCid !== "—" ? 600 : 400 }}>{rowCid}</td>
                                    <td style={{ padding: "7px 12px", fontFamily: "'JetBrains Mono',monospace", color: TH.text2 }}>{paths.src}</td>
                                    <td style={{ padding: "7px 12px", textAlign: "center" }}>{getStatusBadge(srcStatus)}</td>
                                    <td style={{ padding: "7px 12px", textAlign: "center", color: TH.blue, fontWeight: 700 }}>➔</td>
                                    <td style={{ padding: "7px 12px", fontFamily: "'JetBrains Mono',monospace", color: TH.text2 }}>{paths.dst}</td>
                                    <td style={{ padding: "7px 12px", textAlign: "center" }}>{getStatusBadge(dstStatus)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
