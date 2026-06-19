import React from "react";

function Sel({ value, onChange, children, TH, disabled = false, highlight = false, style = {} }) {
  return (
    <select 
      value={value} 
      onChange={e => onChange(e.target.value)} 
      disabled={disabled}
      style={{
        background: TH.bgInput, 
        border: `1px solid ${highlight ? "#3B82F6" : TH.border}`,
        borderRadius: "8px", 
        padding: "7px 10px", 
        color: disabled ? TH.text3 : highlight ? "#3B82F6" : TH.text1,
        fontSize: "12px", 
        cursor: disabled ? "not-allowed" : "pointer", 
        opacity: disabled ? 0.5 : 1, 
        outline: "none",
        ...style
      }}>
      {children}
    </select>
  );
}

export function HierarchySelectors({
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
  return (
    <div style={{ 
      padding: "10px 20px", 
      borderBottom: `1px solid ${TH.border}`, 
      background: TH.bgSurface, 
      display: "flex", 
      alignItems: "center", 
      gap: "8px", 
      flexWrap: "wrap", 
      flexShrink: 0 
    }}>
      <span style={{ 
        fontFamily: "'Syne',sans-serif", 
        fontWeight: 700, 
        color: TH.text1, 
        fontSize: "12px", 
        marginRight: "4px" 
      }}>
        Filtrer par hiérarchie :
      </span>
      {/* Site */}
      <Sel value={selSite} onChange={setSelSite} TH={TH} highlight={!!selSite}>
        <option value="">🌐 Tous les sites ({sites.length})</option>
        {sites.map(s => (
          <option key={s.id} value={s.id}>{s.name} ({s.id})</option>
        ))}
      </Sel>
      {/* Salle */}
      {selSite && (
        <Sel value={selSalle} onChange={setSelSalle} TH={TH} highlight={!!selSalle}>
          <option value="">🏢 Toutes salles ({salles.length})</option>
          {salles.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </Sel>
      )}
      {/* Rack */}
      {selSalle && (
        <Sel value={selRack} onChange={setSelRack} TH={TH} highlight={!!selRack}>
          <option value="">🔲 Tous racks ({racks.length})</option>
          {racks.map(r => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </Sel>
      )}
      {/* ODF */}
      {selRack && (
        <Sel value={selOdf} onChange={setSelOdf} TH={TH} highlight={!!selOdf}>
          <option value="">◉ Tous ODFs ({odfs.length})</option>
          {odfs.map(o => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </Sel>
      )}
      {/* Slot */}
      {selOdf && (
        <Sel value={selSlot} onChange={setSelSlot} TH={TH} highlight={!!selSlot}>
          <option value="">📦 Tous slots ({slots.length})</option>
          {slots.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </Sel>
      )}
    </div>
  );
}
