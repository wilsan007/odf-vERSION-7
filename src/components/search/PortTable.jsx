import React from "react";
import { Bdg } from "../common/UI.jsx";

const fmt = d => d 
  ? new Date(d).toLocaleDateString("fr-DJ", { 
      day: "2-digit", 
      month: "2-digit", 
      year: "numeric", 
      hour: "2-digit", 
      minute: "2-digit" 
    }) 
  : "—";

export function PortTable({
  ports,
  allFilteredPorts,
  isSearchActive,
  page,
  setPage,
  perPage,
  TH,
  ctxCols,
}) {
  const totalPages = Math.ceil(allFilteredPorts.length / perPage);

  const handleExportCSV = () => {
    const h = [
      "Site", 
      "Salle", 
      "Rack", 
      "ODF", 
      "Slot", 
      "Port", 
      "Statut", 
      "CID", 
      "Owner", 
      "OT#", 
      "Destination", 
      "Modifié"
    ];
    const rows = allFilteredPorts.map(p => [
      p.slots?.odfs?.racks?.sites?.name || "",
      p.slots?.odfs?.racks?.salles?.name || "",
      p.slots?.odfs?.racks?.name || "",
      p.slots?.odfs?.name || "",
      p.slots?.name || "",
      p.slot_port || "",
      p.statut || "",
      p.cid || "", 
      p.owner || "", 
      p.ot_num || "", 
      p.destination || "", 
      fmt(p.updated_at)
    ]);
    const csv = [h, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" })
    );
    a.download = `recherche_globale_${new Date().toISOString().slice(0, 10)}.csv`; 
    a.click();
  };

  const buttonStyle = {
    background: TH.bgInput, 
    border: `1px solid ${TH.border}`, 
    borderRadius: "8px",
    padding: "7px 10px", 
    color: TH.text1, 
    fontSize: "12px", 
    outline: "none"
  };

  if (isSearchActive) {
    return (
      <div>
        <div style={{ 
          padding: "14px 20px", 
          color: TH.text3, 
          fontSize: "12px", 
          fontWeight: 600, 
          letterSpacing: "1px", 
          textTransform: "uppercase", 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center" 
        }}>
          <span>Résultats de recherche ({allFilteredPorts.length} port(s) trouvé(s))</span>
          {allFilteredPorts.length > 0 && (
            <button 
              onClick={handleExportCSV} 
              style={{ 
                background: TH.blue, 
                border: "none", 
                borderRadius: "8px", 
                padding: "5px 12px", 
                color: "#fff", 
                fontSize: "11px", 
                fontWeight: 600, 
                cursor: "pointer" 
              }}>
              ⬇ CSV
            </button>
          )}
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
          <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
            <tr style={{ background: TH.bgSurface, borderBottom: `2px solid ${TH.border}` }}>
              {[
                "Site", 
                "Salle", 
                "Rack", 
                "ODF", 
                "Slot", 
                "Port", 
                "Statut", 
                "CID", 
                "Owner", 
                "OT#", 
                "Destination", 
                "Modifié"
              ].map(h => (
                <th 
                  key={h} 
                  style={{ 
                    padding: "10px 12px", 
                    textAlign: "left", 
                    color: TH.text3, 
                    fontWeight: 600, 
                    fontSize: "11px", 
                    letterSpacing: "0.5px", 
                    whiteSpace: "nowrap" 
                  }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ports.map((p, i) => {
              const rk = p.slots?.odfs?.racks;
              return (
                <tr 
                  key={p.id} 
                  style={{ 
                    borderBottom: `1px solid ${TH.border}`, 
                    background: i % 2 === 0 ? "transparent" : TH.bgHover 
                  }}>
                  <td style={{ padding: "9px 12px", color: TH.blue, fontWeight: 600 }}>
                    {rk?.sites?.name || "—"} ({rk?.sites?.id || ""})
                  </td>
                  <td style={{ padding: "9px 12px", color: TH.text2 }}>
                    {rk?.salles?.name || "—"}
                  </td>
                  <td style={{ padding: "9px 12px", color: TH.text2 }}>
                    {rk?.name || "—"}
                  </td>
                  <td style={{ padding: "9px 12px", color: TH.text2 }}>
                    {p.slots?.odfs?.name || "—"}
                  </td>
                  <td style={{ padding: "9px 12px", color: TH.text2 }}>
                    {p.slots?.name || "—"}
                  </td>
                  <td style={{ 
                    padding: "9px 12px", 
                    fontFamily: "'JetBrains Mono',monospace", 
                    color: TH.text1, 
                    fontWeight: 600 
                  }}>
                    {p.slot_port}
                  </td>
                  <td style={{ padding: "9px 12px" }}>
                    <Bdg status={p.statut} TH={TH} />
                  </td>
                  <td style={{ 
                    padding: "9px 12px", 
                    fontFamily: "'JetBrains Mono',monospace", 
                    color: TH.cyan, 
                    fontSize: "11px" 
                  }}>
                    {p.cid || "—"}
                  </td>
                  <td style={{ padding: "9px 12px", color: TH.text2 }}>
                    {p.owner || "—"}
                  </td>
                  <td style={{ padding: "9px 12px", color: TH.text2 }}>
                    {p.ot_num || "—"}
                  </td>
                  <td style={{ padding: "9px 12px", color: TH.text2 }}>
                    {p.destination || "—"}
                  </td>
                  <td style={{ padding: "9px 12px", color: TH.text3, fontSize: "11px" }}>
                    {fmt(p.updated_at)}
                  </td>
                </tr>
              );
            })}
            {!ports.length && (
              <tr>
                <td 
                  colSpan={13} 
                  style={{ padding: "50px", textAlign: "center", color: TH.text3 }}>
                  Aucun port correspondant aux critères globaux
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center", 
            gap: "8px", 
            padding: "10px", 
            borderTop: `1px solid ${TH.border}` 
          }}>
            <button 
              onClick={() => setPage(p => Math.max(0, p - 1))} 
              disabled={page === 0} 
              style={{ 
                ...buttonStyle, 
                cursor: page === 0 ? "not-allowed" : "pointer", 
                opacity: page === 0 ? 0.4 : 1 
              }}>
              ‹
            </button>
            <span style={{ color: TH.text2, fontSize: "12px" }}>
              Page {page + 1} / {totalPages} — {allFilteredPorts.length} résultats
            </span>
            <button 
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} 
              disabled={page === totalPages - 1} 
              style={{ 
                ...buttonStyle, 
                cursor: page === totalPages - 1 ? "not-allowed" : "pointer", 
                opacity: page === totalPages - 1 ? 0.4 : 1 
              }}>
              ›
            </button>
          </div>
        )}
      </div>
    );
  }

  // explorerLevel === "ports"
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
      <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
        <tr style={{ background: TH.bgSurface, borderBottom: `2px solid ${TH.border}` }}>
          {(ctxCols || []).map(c => (
            <th 
              key={c.label} 
              style={{ 
                padding: "10px 12px", 
                textAlign: "left", 
                color: c.color, 
                fontWeight: 700, 
                fontSize: "11px", 
                letterSpacing: "0.5px", 
                whiteSpace: "nowrap" 
              }}>
              {c.label}
            </th>
          ))}
          {[
            "Port", 
            "Statut", 
            "CID", 
            "Owner", 
            "OT#", 
            "Destination", 
            "Modifié"
          ].map(h => (
            <th 
              key={h} 
              style={{ 
                padding: "10px 12px", 
                textAlign: "left", 
                color: TH.text3, 
                fontWeight: 600, 
                fontSize: "11px", 
                letterSpacing: "0.5px", 
                whiteSpace: "nowrap" 
              }}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {ports.map((p, i) => (
          <tr 
            key={p.id} 
            style={{ 
              borderBottom: `1px solid ${TH.border}`, 
              background: i % 2 === 0 ? "transparent" : TH.bgHover 
            }}>
            {(ctxCols || []).map(c => (
              <td 
                key={c.label} 
                style={{ 
                  padding: "9px 12px", 
                  color: c.color, 
                  fontWeight: 600, 
                  fontSize: "11px", 
                  whiteSpace: "nowrap" 
                }}>
                {c.val}
              </td>
            ))}
            <td style={{ 
              padding: "9px 12px", 
              fontFamily: "'JetBrains Mono',monospace", 
              color: TH.text1, 
              fontWeight: 600 
            }}>
              {p.slot_port}
            </td>
            <td style={{ padding: "9px 12px" }}>
              <Bdg status={p.statut} TH={TH} />
            </td>
            <td style={{ 
              padding: "9px 12px", 
              fontFamily: "'JetBrains Mono',monospace", 
              color: TH.cyan, 
              fontSize: "11px" 
            }}>
              {p.cid || "—"}
            </td>
            <td style={{ padding: "9px 12px", color: TH.text2 }}>
              {p.owner || "—"}
            </td>
            <td style={{ padding: "9px 12px", color: TH.text2 }}>
              {p.ot_num || "—"}
            </td>
            <td style={{ padding: "9px 12px", color: TH.text2 }}>
              {p.destination || "—"}
            </td>
            <td style={{ padding: "9px 12px", color: TH.text3, fontSize: "11px" }}>
              {fmt(p.updated_at)}
            </td>
          </tr>
        ))}
        {!ports.length && (
          <tr>
            <td 
              colSpan={(ctxCols || []).length + 8} 
              style={{ padding: "40px", textAlign: "center", color: TH.text3 }}>
              Aucun port correspondant aux critères
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
