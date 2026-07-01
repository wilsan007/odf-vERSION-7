import React, { useState } from "react";
import { supabase } from "../../supabase.js";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import Papa from "papaparse";

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
  const [expandedPorts, setExpandedPorts] = useState({});
  const [selectedGroupSlots, setSelectedGroupSlots] = useState({});
  const [selectedIds, setSelectedIds] = useState([]);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  const getBaseRef = (ref) => {
    if (!ref) return "";
    const match = ref.match(/(.*)-S\d+$/);
    return match ? match[1] : ref;
  };

  const getSlotNameFromRef = (ref) => {
    if (!ref) return "";
    const match = ref.match(/-([^-]+)$/);
    return match ? match[1] : ref;
  };

  const getOdfDisplay = (port) => {
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
      odf?.name || ""
    ].filter(Boolean);
    return parts.join("-");
  };

  const handleExpand = async (item) => {
    const itemId = item.id;
    if (expandedCableId === itemId) {
      setExpandedCableId(null);
      return;
    }
    
    setExpandedCableId(itemId);

    if (item.isGroup) {
      const srcSlotIds = item.cables.map(gc => gc.port_source?.slot_id).filter(Boolean);
      const dstSlotIds = item.cables.map(gc => gc.port_dest?.slot_id).filter(Boolean);

      if (srcSlotIds.length && dstSlotIds.length) {
        try {
          const [srcPortsRes, dstPortsRes] = await Promise.all([
            supabase.from("ports").select("slot_id, slot_port, statut, cid").in("slot_id", srcSlotIds),
            supabase.from("ports").select("slot_id, slot_port, statut, cid").in("slot_id", dstSlotIds)
          ]);

          const srcData = srcPortsRes.data || [];
          const dstData = dstPortsRes.data || [];

          setExpandedPorts(prev => {
            const nextPorts = { ...prev };
            item.cables.forEach(gc => {
              const srcSlotId = gc.port_source?.slot_id;
              const dstSlotId = gc.port_dest?.slot_id;

              const srcMap = {};
              srcData.filter(p => p.slot_id === srcSlotId).forEach(p => {
                srcMap[p.slot_port.slice(-3)] = { statut: p.statut, cid: p.cid };
              });

              const dstMap = {};
              dstData.filter(p => p.slot_id === dstSlotId).forEach(p => {
                dstMap[p.slot_port.slice(-3)] = { statut: p.statut, cid: p.cid };
              });

              nextPorts[gc.id] = { src: srcMap, dst: dstMap };
            });
            return nextPorts;
          });

          // Default selected slot
          setSelectedGroupSlots(prev => ({
            ...prev,
            [itemId]: item.cables[0]?.id
          }));

        } catch (err) {
          console.error("Error loading group port statuses:", err);
        }
      }
    } else {
      const srcSlotId = item.port_source?.slot_id;
      const dstSlotId = item.port_dest?.slot_id;

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

          setExpandedPorts(prev => ({
            ...prev,
            [item.id]: { src: srcMap, dst: dstMap }
          }));
        } catch (err) {
          console.error("Error loading port statuses:", err);
        }
      }
    }
  };

  const getEquipementPortDisplay = (eqPort) => {
    if (!eqPort) return "—";
    const eq = eqPort.equipements;
    const rack = eq?.racks;
    const site = rack?.sites;
    const parts = [
      site?.id || "",
      rack?.name || "",
      eq?.name || "",
      eqPort.slot_port || ""
    ].filter(Boolean);
    return parts.join("-");
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

  const groupedCables = React.useMemo(() => {
    const groups = {};
    const singles = [];

    cables.forEach(c => {
      const isOdfLevel = c.nom && c.nom.startsWith("[ODF]");
      if (isOdfLevel) {
        const baseRef = getBaseRef(c.cable_reference);
        if (!groups[baseRef]) {
          groups[baseRef] = {
            id: baseRef,
            isGroup: true,
            baseReference: baseRef,
            cables: [],
            nom: c.nom.replace(/^\[ODF\]\s*/, ""),
            type_lien: c.type_lien,
            type_fibre: c.type_fibre,
            port_source: c.port_source,
            port_dest: c.port_dest,
          };
        }
        groups[baseRef].cables.push(c);
      } else {
        singles.push({
          ...c,
          isGroup: false,
        });
      }
    });

    Object.values(groups).forEach(g => {
      g.cables.sort((a, b) => (a.cable_reference || "").localeCompare(b.cable_reference || ""));
    });

    return [...singles, ...Object.values(groups)];
  }, [cables]);

  const filteredItems = React.useMemo(() => {
    const term = searchQuery.toLowerCase();
    return groupedCables.filter(item => {
      const matchType = !searchType || item.type_lien === searchType;
      if (!matchType) return false;

      if (!term) return true;

      if (item.isGroup) {
        const matchGroup =
          (item.baseReference || "").toLowerCase().includes(term) ||
          (item.nom || "").toLowerCase().includes(term) ||
          (item.type_fibre || "").toLowerCase().includes(term);

        if (matchGroup) return true;

        return item.cables.some(c => 
          (c.cable_reference || "").toLowerCase().includes(term)
        );
      } else {
        return (
          (item.cable_reference || "").toLowerCase().includes(term) ||
          (item.nom || "").toLowerCase().includes(term) ||
          (item.type_fibre || "").toLowerCase().includes(term)
        );
      }
    });
  }, [groupedCables, searchQuery, searchType]);

  const getItemReference = (item) => {
    if (item.isGroup) {
      return `${item.baseReference} (${item.cables.map(gc => getSlotNameFromRef(gc.cable_reference)).join(" / ")})`;
    }
    return item.cable_reference || "";
  };

  const buildPortChemin = (port, slotPort) => {
    if (!port || !port.slots) return "—";
    const slot  = port.slots;
    const odf   = slot.odfs;
    const rack  = odf?.racks;
    const salle = rack?.salles;
    const site  = salle?.sites;
    return [
      site?.name  || "",
      salle?.name ? `Salle ${salle.name}` : "",
      rack?.name  || "",
      odf?.name   || "",
      slot?.name  ? `Slot ${slot.name}` : "",
      slotPort    ? `Port ${slotPort}` : ""
    ].filter(Boolean).join(" / ");
  };

  const getExportData = async () => {
    const selected    = filteredItems.filter(item => selectedIds.includes(item.id));
    const portHeaders = ["CID", "Chemin Source", "Statut Source", "Liaison", "Chemin Destination", "Statut Dest"];
    // Une section par câble sélectionné : { title, portRows }
    const sections = [];

    for (const item of selected) {
      // Titre du document : référence — type
      const ref   = getItemReference(item);
      const type  = item.type_lien === "EXTERNE" ? "EXTERNE" : "INTERNE";
      const title = `${ref} — ${type}`;
      const portRows = [];

      if (item.isGroup) {
        const cableList  = item.cables || [];
        const srcSlotIds = cableList.map(gc => gc.port_source?.slot_id).filter(Boolean);
        const dstSlotIds = cableList.map(gc => gc.port_dest?.slot_id).filter(Boolean);
        if (srcSlotIds.length && dstSlotIds.length) {
          const [srcRes, dstRes] = await Promise.all([
            supabase.from("ports").select("slot_id, slot_port, statut, cid").in("slot_id", srcSlotIds).order("slot_port"),
            supabase.from("ports").select("slot_id, slot_port, statut, cid").in("slot_id", dstSlotIds).order("slot_port")
          ]);
          const srcData = srcRes.data || [];
          const dstData = dstRes.data || [];
          for (const gc of cableList) {
            const srcPorts = srcData.filter(p => p.slot_id === gc.port_source?.slot_id);
            const dstPorts = dstData.filter(p => p.slot_id === gc.port_dest?.slot_id);
            for (let i = 0; i < Math.max(srcPorts.length, dstPorts.length); i++) {
              const sp = srcPorts[i];
              const dp = dstPorts[i];
              portRows.push([
                sp?.cid || "—",
                buildPortChemin(gc.port_source, sp?.slot_port),
                sp?.statut || "—",
                "→",
                buildPortChemin(gc.port_dest, dp?.slot_port),
                dp?.statut || "—",
              ]);
            }
          }
        }
      } else {
        const srcSlotId = item.port_source?.slot_id;
        const dstSlotId = item.port_dest?.slot_id;
        if (srcSlotId && dstSlotId) {
          const [srcRes, dstRes] = await Promise.all([
            supabase.from("ports").select("slot_port, statut, cid").eq("slot_id", srcSlotId).order("slot_port"),
            supabase.from("ports").select("slot_port, statut, cid").eq("slot_id", dstSlotId).order("slot_port")
          ]);
          const srcPorts = srcRes.data || [];
          const dstPorts = dstRes.data || [];
          for (let i = 0; i < Math.max(srcPorts.length, dstPorts.length); i++) {
            const sp = srcPorts[i];
            const dp = dstPorts[i];
            portRows.push([
              sp?.cid || "—",
              buildPortChemin(item.port_source, sp?.slot_port),
              sp?.statut || "—",
              "→",
              buildPortChemin(item.port_dest, dp?.slot_port),
              dp?.statut || "—",
            ]);
          }
        }
      }
      sections.push({ title, portRows });
    }
    return { portHeaders, sections };
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const allVisibleSelected = filteredItems.length > 0 && filteredItems.every(item => selectedIds.includes(item.id));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      const visibleIds = filteredItems.map(item => item.id);
      setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...filteredItems.map(item => item.id)])]);
    }
  };

  const exportToPdf = async () => {
    const { portHeaders, sections } = await getExportData();
    if (sections.length === 0) return;
    const dateStr = new Date().toISOString().slice(0, 10);
    const doc = new jsPDF({ orientation: "landscape" });
    let totalPorts = 0;

    sections.forEach((section, idx) => {
      if (idx > 0) doc.addPage();

      // Titre du document (nom du fichier)
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      doc.text(`connexions_${dateStr}`, 14, 12);

      // Titre câble en gras — devient le nom de la section
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0);
      doc.text(section.title, 14, 22);

      // Tableau des ports uniquement (pas de résumé câble)
      if (section.portRows.length > 0) {
        autoTable(doc, {
          head: [portHeaders],
          body: section.portRows,
          startY: 28,
          styles: { fontSize: 8, cellPadding: 2.5 },
          headStyles: { fillColor: [16, 185, 129], fontStyle: "bold" },
          columnStyles: {
            0: { cellWidth: 18 },
            1: { cellWidth: 72 },
            2: { cellWidth: 24 },
            3: { cellWidth: 8 },
            4: { cellWidth: 72 },
            5: { cellWidth: 24 },
          },
        });
        totalPorts += section.portRows.length;
      }
    });

    doc.save(`connexions_${dateStr}.pdf`);
    setExportMenuOpen(false);
    setSuccess && setSuccess(`${sections.length} câble(s) — ${totalPorts} port(s) exportés en PDF`);
  };

  const exportToExcel = async () => {
    const { portHeaders, sections } = await getExportData();
    if (sections.length === 0) return;
    const dateStr = new Date().toISOString().slice(0, 10);
    let totalPorts = 0;

    // Chaque câble = une ligne titre (référence — TYPE) + tableau ports
    const csvParts = sections.map(section => {
      totalPorts += section.portRows.length;
      const titleLine = `"${section.title}"`;
      const portsData = section.portRows.length > 0
        ? Papa.unparse({ fields: portHeaders, data: section.portRows })
        : portHeaders.join(",");
      return titleLine + "\r\n" + portsData;
    });

    const csv  = csvParts.join("\r\n\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `connexions_${dateStr}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setExportMenuOpen(false);
    setSuccess && setSuccess(`${sections.length} câble(s) — ${totalPorts} port(s) exportés en Excel`);
  };

  return (
    <div>
      <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap", alignItems: "center" }}>
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
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setExportMenuOpen(o => !o)}
            disabled={selectedIds.length === 0}
            style={{
              background: selectedIds.length === 0 ? TH.bgInput : TH.blue,
              color: selectedIds.length === 0 ? TH.text3 : "#fff",
              border: `1px solid ${selectedIds.length === 0 ? TH.border : TH.blue}`,
              borderRadius: "8px", padding: "9px 16px", fontSize: "13px", fontWeight: 600,
              cursor: selectedIds.length === 0 ? "not-allowed" : "pointer", whiteSpace: "nowrap"
            }}>
            ⬇ Exporter{selectedIds.length > 0 ? ` (${selectedIds.length})` : ""} ▾
          </button>
          {exportMenuOpen && selectedIds.length > 0 && (
            <div style={{
              position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 20,
              background: TH.bgCard, border: `1px solid ${TH.border}`, borderRadius: "8px",
              boxShadow: "0 8px 24px rgba(0,0,0,.3)", overflow: "hidden", minWidth: "160px"
            }}>
              <button onClick={exportToPdf}
                style={{
                  display: "block", width: "100%", textAlign: "left", background: "transparent",
                  border: "none", padding: "10px 14px", color: TH.text1, fontSize: "13px", cursor: "pointer"
                }}
                onMouseEnter={e => e.currentTarget.style.background = TH.bgHover}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                📄 Exporter en PDF
              </button>
              <button onClick={exportToExcel}
                style={{
                  display: "block", width: "100%", textAlign: "left", background: "transparent",
                  border: "none", borderTop: `1px solid ${TH.border}`, padding: "10px 14px",
                  color: TH.text1, fontSize: "13px", cursor: "pointer"
                }}
                onMouseEnter={e => e.currentTarget.style.background = TH.bgHover}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                📊 Exporter en Excel
              </button>
            </div>
          )}
        </div>
      </div>

      {loadingCables ? (
        <div style={{ textAlign: "center", padding: "40px", color: TH.text3 }}>Chargement des connexions…</div>
      ) : filteredItems.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px", color: TH.text3 }}>Aucune connexion trouvée</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
          <thead>
            <tr style={{ background: TH.bgSurface, borderBottom: `2px solid ${TH.border}` }}>
              <th style={{ width: "36px", padding: "10px 12px", textAlign: "center" }}>
                <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll}
                  style={{ cursor: "pointer", accentColor: TH.blue, width: "15px", height: "15px" }} />
              </th>
              <th style={{ width: "30px", padding: "10px 12px" }}></th>
              {["Référence", "Nom", "Type", "Fibre", "Port Source", "Port Dest"].map(h => (
                <th key={h} style={{ padding: "10px 12px", textAlign: "left", color: TH.text3, fontWeight: 600, fontSize: "11px" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item, i) => {
              const isExpanded = expandedCableId === item.id;
              const isGroup = item.isGroup;
              return (
                <React.Fragment key={item.id}>
                  <tr style={{ borderBottom: `1px solid ${TH.border}`, background: selectedIds.includes(item.id) ? "rgba(59,130,246,.08)" : (i % 2 === 0 ? "transparent" : TH.bgHover) }}>
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>
                      <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleSelect(item.id)}
                        style={{ cursor: "pointer", accentColor: TH.blue, width: "15px", height: "15px" }} />
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "center", cursor: "pointer", color: TH.blue }}
                        onClick={() => handleExpand(item)}>
                      {isExpanded ? "▼" : "▶"}
                    </td>
                    <td style={{ padding: "10px 12px", fontFamily: "'JetBrains Mono',monospace", color: TH.text1, fontWeight: 600 }}>
                      {isGroup 
                        ? `${item.baseReference} (${item.cables.map(gc => getSlotNameFromRef(gc.cable_reference)).join(" / ")})`
                        : item.cable_reference}
                    </td>
                    <td style={{ padding: "10px 12px", color: TH.text2 }}>{item.nom}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{
                        background: item.type_lien === "EXTERNE" 
                          ? "rgba(59,130,246,.15)" 
                          : "rgba(245,158,11,.15)",
                        color: item.type_lien === "EXTERNE" 
                          ? "#3B82F6" 
                          : "#F59E0B",
                        border: `1px solid ${
                          item.type_lien === "EXTERNE" 
                            ? "rgba(59,130,246,.3)" 
                            : "rgba(245,158,11,.3)"
                        }`,
                        borderRadius: "6px", padding: "2px 8px", fontSize: "10px", fontWeight: 700
                      }}>
                        {item.type_lien === "EXTERNE" ? "EXTERNE" : "INTERNE"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", color: TH.text2 }}>{item.type_fibre}</td>
                    <td style={{ padding: "10px 12px", fontFamily: "'JetBrains Mono',monospace", fontSize: "10px", color: TH.text3 }}>
                      {isGroup ? getOdfDisplay(item.port_source) : getPortDisplay(item.port_source)}
                    </td>
                    <td style={{ padding: "10px 12px", fontFamily: "'JetBrains Mono',monospace", fontSize: "10px", color: TH.text3 }}>
                      {isGroup ? getOdfDisplay(item.port_dest) : getPortDisplay(item.port_dest)}
                    </td>

                  </tr>
                  {isExpanded && (
                    <tr style={{ background: TH.bgSurface }}>
                      <td colSpan={8} style={{ padding: "16px 20px" }}>
                        <div style={{ background: TH.bgCard, border: `1px solid ${TH.border}`, borderRadius: "10px", padding: "16px" }}>
                          
                          {isGroup && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
                              <div style={{ fontSize: "11px", color: TH.text3, fontWeight: 600 }}>Sélectionnez un slot pour voir ses ports raccordés :</div>
                              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                {item.cables.map(gc => {
                                  const gcId = gc.id;
                                  const isSelected = selectedGroupSlots[item.id] === gcId || (selectedGroupSlots[item.id] === undefined && gcId === item.cables[0]?.id);
                                  const slotLabel = getSlotNameFromRef(gc.cable_reference);
                                  return (
                                    <button
                                      key={gcId}
                                      onClick={() => setSelectedGroupSlots(prev => ({ ...prev, [item.id]: gcId }))}
                                      style={{
                                        padding: "6px 12px",
                                        borderRadius: "6px",
                                        border: `1px solid ${isSelected ? TH.blue : TH.border}`,
                                        background: isSelected ? `${TH.blue}22` : TH.bgInput,
                                        color: isSelected ? TH.blue : TH.text2,
                                        fontSize: "11px",
                                        fontWeight: 600,
                                        cursor: "pointer",
                                        transition: "all 0.15s"
                                      }}
                                    >
                                      Slot {slotLabel}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {(() => {
                            const activeCable = isGroup 
                              ? (item.cables.find(gc => gc.id === (selectedGroupSlots[item.id] || item.cables[0]?.id)) || item.cables[0])
                              : item;

                            if (!activeCable) return null;

                            return (
                              <div>
                                {isGroup && (
                                  <div style={{ fontSize: "11px", color: TH.text3, marginBottom: "12px", fontFamily: "'JetBrains Mono',monospace" }}>
                                    Référence câble pour ce slot : <strong style={{ color: TH.cyan }}>{activeCable.cable_reference}</strong>
                                  </div>
                                )}
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
                                      const paths = getPortPaths(activeCable, index + 1);
                                      const pStr = 'P' + String(index + 1).padStart(2, '0');
                                      
                                      const activePorts = expandedPorts[activeCable.id] || { src: {}, dst: {} };
                                      const srcPortObj = activePorts.src[pStr] || { statut: "LIBRE", cid: null };
                                      const dstPortObj = activePorts.dst[pStr] || { statut: "LIBRE", cid: null };

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
                            );
                          })()}

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
