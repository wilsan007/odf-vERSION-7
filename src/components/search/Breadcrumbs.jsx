import React from "react";

export function Breadcrumbs({
  selSite,
  setSelSite,
  sites,
  selSalle,
  setSelSalle,
  salles,
  selRack,
  setSelRack,
  racks,
  selOdf,
  setSelOdf,
  odfs,
  selSlot,
  setSelSlot,
  slots,
  TH,
}) {
  const crumbs = [
    selSite && { 
      label: sites.find(s => s.id === selSite)?.name || selSite, 
      clear: () => setSelSite(""), 
      color: "#3B82F6" 
    },
    selSalle && { 
      label: `Salle ${salles.find(s => s.id === selSalle)?.name || selSalle}`, 
      clear: () => setSelSalle(""), 
      color: "#22D3EE" 
    },
    selRack && { 
      label: racks.find(r => r.id === selRack)?.name || selRack, 
      clear: () => setSelRack(""), 
      color: "#A78BFA" 
    },
    selOdf && { 
      label: odfs.find(o => o.id === selOdf)?.name || selOdf, 
      clear: () => setSelOdf(""), 
      color: "#FBBF24" 
    },
    selSlot && { 
      label: slots.find(s => s.id === selSlot)?.name || selSlot, 
      clear: () => setSelSlot(""), 
      color: "#10B981" 
    },
  ].filter(Boolean);

  if (crumbs.length === 0) return null;

  return (
    <div style={{ 
      padding: "8px 20px", 
      borderBottom: `1px solid ${TH.border}`, 
      background: TH.bgSurface, 
      display: "flex", 
      alignItems: "center", 
      gap: "6px", 
      flexWrap: "wrap", 
      flexShrink: 0 
    }}>
      <span style={{ color: TH.text3, fontSize: "11px" }}>📍</span>
      {crumbs.map((c, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
          {i > 0 && <span style={{ color: TH.text3, fontSize: "11px" }}>›</span>}
          <span style={{
            background: `${c.color}22`, 
            color: c.color, 
            border: `1px solid ${c.color}44`,
            borderRadius: "6px", 
            padding: "2px 8px", 
            fontSize: "11px", 
            fontWeight: 600
          }}>
            {c.label}
          </span>
          <button 
            onClick={c.clear} 
            style={{ 
              background: "transparent", 
              border: "none", 
              color: TH.text3, 
              fontSize: "11px", 
              cursor: "pointer", 
              padding: "0 2px" 
            }}>
            ×
          </button>
        </span>
      ))}
    </div>
  );
}
