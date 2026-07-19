import React, { useState, useMemo } from "react";

const MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const pad = (n) => String(n).padStart(2, "0");

function typeColor(TH, t) {
  if (t === "REMPLACEMENT") return TH.orange;
  if (t === "RETRAIT") return TH.red;
  if (t === "MODIFICATION") return TH.purple;
  if (t === "INSPECTION") return TH.cyan;
  return TH.blue;
}

// Calendrier mensuel du planning de maintenance.
export default function MaintenanceCalendar({ TH, maints, onPick }) {
  const [offset, setOffset] = useState(0);
  const today = new Date().toISOString().slice(0, 10);

  const base = new Date();
  const cur = new Date(base.getFullYear(), base.getMonth() + offset, 1);
  const year = cur.getFullYear();
  const month = cur.getMonth();

  const byDay = useMemo(() => {
    const m = {};
    for (const x of maints) if (x.date_prevue) (m[x.date_prevue] ||= []).push(x);
    return m;
  }, [maints]);

  const startWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // Lundi = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const monthCount = maints.filter((m) => (m.date_prevue || "").slice(0, 7) === `${year}-${pad(month + 1)}`).length;

  return (
    <div style={{ background: TH.bgCard, border: `1px solid ${TH.border}`, borderRadius: "12px", padding: "14px", boxShadow: TH.cardShadow }}>
      {/* En-tête navigation */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
        <button onClick={() => setOffset(offset - 1)} style={navBtn(TH)}>‹</button>
        <span className="font-syne" style={{ color: TH.text1, fontWeight: 800, fontSize: "16px", minWidth: "170px", textAlign: "center" }}>{MOIS[month]} {year}</span>
        <button onClick={() => setOffset(offset + 1)} style={navBtn(TH)}>›</button>
        {offset !== 0 && <button onClick={() => setOffset(0)} style={{ ...navBtn(TH), width: "auto", padding: "0 12px", fontSize: "12px" }}>Aujourd'hui</button>}
        <span style={{ marginLeft: "auto", color: TH.text3, fontSize: "12px" }}>{monthCount} opération(s) ce mois</span>
      </div>

      {/* Jours de la semaine */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "6px", marginBottom: "6px" }}>
        {JOURS.map((j) => <div key={j} style={{ color: TH.text3, fontSize: "11px", fontWeight: 700, textAlign: "center", textTransform: "uppercase" }}>{j}</div>)}
      </div>

      {/* Grille */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "6px" }}>
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const key = `${year}-${pad(month + 1)}-${pad(d)}`;
          const list = byDay[key] || [];
          const isToday = key === today;
          return (
            <div key={i} style={{
              minHeight: "84px", border: `1px solid ${isToday ? TH.blue : TH.border}`, borderRadius: "8px",
              padding: "5px 6px", background: isToday ? TH.blueGlow : TH.bgSurface, overflow: "hidden",
            }}>
              <div style={{ color: isToday ? TH.blue : TH.text3, fontSize: "11px", fontWeight: 700, marginBottom: "3px" }}>{d}</div>
              {list.slice(0, 3).map((m) => {
                const col = m.en_retard ? TH.red : typeColor(TH, m.type);
                return (
                  <div key={m.id} onClick={() => onPick?.(m)} title={`${m.type} · ${m.titre || m.item_description || ""}${m.service_cid ? " · CID " + m.service_cid : ""}`}
                    style={{ cursor: "pointer", background: `${col}22`, borderLeft: `3px solid ${col}`, borderRadius: "4px", padding: "1px 5px", marginBottom: "3px", fontSize: "10.5px", color: TH.text1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {m.service_cid ? "⚡ " : ""}{(m.titre || m.item_description || m.type).slice(0, 18)}
                  </div>
                );
              })}
              {list.length > 3 && <div style={{ color: TH.text3, fontSize: "10px" }}>+{list.length - 3}</div>}
            </div>
          );
        })}
      </div>

      {/* Légende */}
      <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", marginTop: "10px", color: TH.text3, fontSize: "11px" }}>
        <span><span style={{ color: TH.blue }}>▍</span>Maintenance</span>
        <span><span style={{ color: TH.orange }}>▍</span>Remplacement</span>
        <span><span style={{ color: TH.red }}>▍</span>Retrait / En retard</span>
        <span><span style={{ color: TH.purple }}>▍</span>Modification</span>
        <span><span style={{ color: TH.cyan }}>▍</span>Inspection</span>
        <span>⚡ impact service</span>
      </div>
    </div>
  );
}

const navBtn = (TH) => ({
  background: TH.bgInput, border: `1px solid ${TH.border}`, borderRadius: "6px",
  width: "30px", height: "30px", color: TH.text1, cursor: "pointer", fontSize: "16px", fontWeight: 700,
});
