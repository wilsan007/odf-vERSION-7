import React from "react";

function ItemCard({ icon, title, subtitle, badge, badgeColor, TH, onClick }) {
  return (
    <div onClick={onClick}
      style={{
        background: TH.bgCard, 
        border: `1px solid ${TH.border}`, 
        borderRadius: "12px",
        padding: "16px 20px", 
        display: "flex", 
        alignItems: "center", 
        gap: "14px",
        cursor: onClick ? "pointer" : "default", 
        transition: "border-color .15s, background .15s"
      }}
      onMouseEnter={e => { 
        if (onClick) { 
          e.currentTarget.style.borderColor = "#3B82F6"; 
          e.currentTarget.style.background = TH.bgHover; 
        } 
      }}
      onMouseLeave={e => { 
        if (onClick) { 
          e.currentTarget.style.borderColor = TH.border; 
          e.currentTarget.style.background = TH.bgCard; 
        } 
      }}>
      <span style={{ fontSize: "22px" }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ 
          fontFamily: "'Syne',sans-serif", 
          fontWeight: 700, 
          color: TH.text1, 
          fontSize: "14px" 
        }}>{title}</div>
        {subtitle && (
          <div style={{ color: TH.text3, fontSize: "11px", marginTop: "2px" }}>
            {subtitle}
          </div>
        )}
      </div>
      {badge !== undefined && (
        <span style={{
          background: `${badgeColor || "#3B82F6"}22`, 
          color: badgeColor || "#3B82F6",
          border: `1px solid ${badgeColor || "#3B82F6"}44`, 
          borderRadius: "8px",
          padding: "4px 12px", 
          fontSize: "13px", 
          fontWeight: 700, 
          fontFamily: "'JetBrains Mono',monospace"
        }}>
          {badge}
        </span>
      )}
    </div>
  );
}

export function ExplorerCards({
  explorerLevel,
  sites,
  salles,
  racks,
  odfs,
  slots,
  selSite,
  selSalle,
  selRack,
  selOdf,
  setSelSite,
  setSelSalle,
  setSelRack,
  setSelOdf,
  setSelSlot,
  TH,
}) {
  if (explorerLevel === "sites") {
    return (
      <div>
        <div style={{ 
          padding: "14px 20px", 
          color: TH.text3, 
          fontSize: "12px", 
          fontWeight: 600, 
          letterSpacing: "1px", 
          textTransform: "uppercase" 
        }}>
          {sites.length} site(s) disponible(s)
        </div>
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", 
          gap: "12px", 
          padding: "0 20px 20px" 
        }}>
          {sites.map(s => (
            <ItemCard 
              key={s.id} 
              icon="🌐" 
              title={s.name} 
              subtitle={s.description || s.id} 
              badge={s.id} 
              badgeColor="#3B82F6" 
              TH={TH} 
              onClick={() => setSelSite(s.id)} 
            />
          ))}
        </div>
      </div>
    );
  }

  if (explorerLevel === "salles") {
    const currentSiteName = sites.find(s => s.id === selSite)?.name || selSite;
    return (
      <div>
        <div style={{ 
          padding: "14px 20px", 
          color: TH.text3, 
          fontSize: "12px", 
          fontWeight: 600, 
          letterSpacing: "1px", 
          textTransform: "uppercase" 
        }}>
          {salles.length} salle(s) dans {currentSiteName}
        </div>
        {!salles.length && (
          <div style={{ textAlign: "center", padding: "40px", color: TH.text3 }}>
            Aucune salle dans ce site
          </div>
        )}
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", 
          gap: "12px", 
          padding: "0 20px 20px" 
        }}>
          {salles.map(s => (
            <ItemCard 
              key={s.id} 
              icon="🏢" 
              title={`Salle ${s.name}`} 
              subtitle={s.id} 
              badge={s.name} 
              badgeColor="#22D3EE" 
              TH={TH} 
              onClick={() => setSelSalle(s.id)} 
            />
          ))}
        </div>
      </div>
    );
  }

  if (explorerLevel === "racks") {
    const currentSalleName = salles.find(s => s.id === selSalle)?.name || selSalle;
    return (
      <div>
        <div style={{ 
          padding: "14px 20px", 
          color: TH.text3, 
          fontSize: "12px", 
          fontWeight: 600, 
          letterSpacing: "1px", 
          textTransform: "uppercase" 
        }}>
          {racks.length} rack(s) dans Salle {currentSalleName}
        </div>
        {!racks.length && (
          <div style={{ textAlign: "center", padding: "40px", color: TH.text3 }}>
            Aucun rack dans cette salle
          </div>
        )}
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", 
          gap: "12px", 
          padding: "0 20px 20px" 
        }}>
          {racks.map(r => (
            <ItemCard 
              key={r.id} 
              icon="🔲" 
              title={r.name} 
              subtitle={r.id} 
              badge={r.name} 
              badgeColor="#A78BFA" 
              TH={TH} 
              onClick={() => setSelRack(r.id)} 
            />
          ))}
        </div>
      </div>
    );
  }

  if (explorerLevel === "odfs") {
    const currentRackName = racks.find(r => r.id === selRack)?.name || selRack;
    return (
      <div>
        <div style={{ 
          padding: "14px 20px", 
          color: TH.text3, 
          fontSize: "12px", 
          fontWeight: 600, 
          letterSpacing: "1px", 
          textTransform: "uppercase" 
        }}>
          {odfs.length} ODF(s) dans Rack {currentRackName}
        </div>
        {!odfs.length && (
          <div style={{ textAlign: "center", padding: "40px", color: TH.text3 }}>
            Aucun ODF dans ce rack
          </div>
        )}
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", 
          gap: "12px", 
          padding: "0 20px 20px" 
        }}>
          {odfs.map(o => (
            <ItemCard 
              key={o.id} 
              icon="◉" 
              title={o.name} 
              subtitle={`${o.odf_type || "NON CONFIGURÉ"} — ${o.id}`} 
              badge={o.odf_type || "N/C"} 
              badgeColor={o.odf_type === "INTERNE" ? "#A78BFA" : o.odf_type === "EXTERNE" ? "#3B82F6" : "#9CA3AF"} 
              TH={TH} 
              onClick={() => setSelOdf(o.id)} 
            />
          ))}
        </div>
      </div>
    );
  }

  if (explorerLevel === "slots") {
    const currentOdfName = odfs.find(o => o.id === selOdf)?.name || selOdf;
    return (
      <div>
        <div style={{ 
          padding: "14px 20px", 
          color: TH.text3, 
          fontSize: "12px", 
          fontWeight: 600, 
          letterSpacing: "1px", 
          textTransform: "uppercase" 
        }}>
          {slots.length} slot(s) dans ODF {currentOdfName}
        </div>
        {!slots.length && (
          <div style={{ textAlign: "center", padding: "40px", color: TH.text3 }}>
            Aucun slot dans cet ODF
          </div>
        )}
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", 
          gap: "12px", 
          padding: "0 20px 20px" 
        }}>
          {slots.map(s => (
            <ItemCard 
              key={s.id} 
              icon="📦" 
              title={s.name} 
              subtitle={s.id} 
              badge={`Slot ${s.slot_num}`} 
              badgeColor="#FBBF24" 
              TH={TH} 
              onClick={() => setSelSlot(s.id)} 
            />
          ))}
        </div>
      </div>
    );
  }

  return null;
}
