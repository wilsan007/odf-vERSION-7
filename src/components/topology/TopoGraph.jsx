import React from "react";

// Schéma topologique : stations = nœuds sur un cercle, segments = arêtes.
// Segments avec les deux extrémités → arête reliant les 2 stations.
// Segments sans station_b → « stub » sortant du nœud (extrémité à définir).
export default function TopoGraph({ TH, segments, lpsBySeg = {}, onPickStation, onPickSegment }) {
  const W = 820, H = 500, cx = 410, cy = 250, R = 168;

  const stationsSet = new Set();
  segments.forEach((s) => { if (s.station_a) stationsSet.add(s.station_a); if (s.station_b) stationsSet.add(s.station_b); });
  const stations = [...stationsSet];
  const n = stations.length;

  const pos = {};
  stations.forEach((st, i) => {
    if (n === 1) { pos[st] = { x: cx, y: cy, ang: -Math.PI / 2 }; return; }
    const ang = (2 * Math.PI * i) / n - Math.PI / 2;
    pos[st] = { x: cx + R * Math.cos(ang), y: cy + R * Math.sin(ang), ang };
  });

  const edgeColor = (s) => (s.statut === "ACTIF" ? TH.green : s.statut === "HS" ? TH.red : TH.gold);

  if (!stations.length) {
    return <div style={{ color: TH.text3, textAlign: "center", padding: "40px" }}>Aucune station à représenter.</div>;
  }

  return (
    <div style={{ background: TH.bgCard, border: `1px solid ${TH.border}`, borderRadius: "12px", padding: "8px", boxShadow: TH.cardShadow, overflowX: "auto" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", minWidth: "560px", height: "auto", display: "block" }}>
        {/* Arêtes / stubs */}
        {segments.map((s) => {
          const a = pos[s.station_a];
          const b = s.station_b ? pos[s.station_b] : null;
          const col = edgeColor(s);
          const lpCount = (lpsBySeg[s.id] || []).length;
          if (a && b) {
            const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
            return (
              <g key={s.id} style={{ cursor: "pointer" }} onClick={() => onPickSegment?.(s)}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={col} strokeWidth="2.5" strokeOpacity="0.7" />
                <rect x={mx - 26} y={my - 11} width="52" height="22" rx="6" fill={TH.bgSurface} stroke={col} strokeOpacity="0.5" />
                <text x={mx} y={my + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill={TH.text1}>{s.nom || "?"}</text>
                {lpCount > 0 && <text x={mx} y={my + 20} textAnchor="middle" fontSize="9" fill={TH.text3}>{lpCount} LP</text>}
              </g>
            );
          }
          if (a) {
            // stub vers l'extérieur (extrémité non définie)
            const ex = a.x + 46 * Math.cos(a.ang), ey = a.y + 46 * Math.sin(a.ang);
            return (
              <g key={s.id} style={{ cursor: "pointer" }} onClick={() => onPickSegment?.(s)}>
                <line x1={a.x} y1={a.y} x2={ex} y2={ey} stroke={col} strokeWidth="2" strokeDasharray="4 3" strokeOpacity="0.7" />
                <circle cx={ex} cy={ey} r="4" fill={TH.bgSurface} stroke={col} />
                <text x={ex + 8 * Math.cos(a.ang)} y={ey + 8 * Math.sin(a.ang) + 3} textAnchor="middle" fontSize="10" fontWeight="700" fill={TH.text2}>{s.nom}</text>
              </g>
            );
          }
          return null;
        })}

        {/* Nœuds stations */}
        {stations.map((st) => {
          const p = pos[st];
          return (
            <g key={st} style={{ cursor: "pointer" }} onClick={() => onPickStation?.(st)}>
              <circle cx={p.x} cy={p.y} r="30" fill={TH.bgSurface} stroke={TH.blue} strokeWidth="2.5" />
              <circle cx={p.x} cy={p.y} r="30" fill={TH.blueGlow} />
              <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize="12" fontWeight="800" fill={TH.text1} style={{ fontFamily: "'Syne',sans-serif" }}>
                {st.length > 8 ? st.slice(0, 7) + "…" : st}
              </text>
            </g>
          );
        })}
      </svg>
      <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", padding: "8px 12px", color: TH.text3, fontSize: "11px" }}>
        <span><span style={{ color: TH.green }}>━</span> Actif</span>
        <span><span style={{ color: TH.gold }}>━</span> Planifié</span>
        <span><span style={{ color: TH.red }}>━</span> HS</span>
        <span style={{ color: TH.text3 }}>┈ extrémité à définir · clic station/segment → filtrer la liste</span>
      </div>
    </div>
  );
}
