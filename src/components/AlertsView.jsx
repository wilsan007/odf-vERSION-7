import React, { useState, useEffect } from "react";
import { getPortsFlat } from "../supabase.js";
import { Spinner } from "./common/UI.jsx";
import { formatPortLabel } from "../utils/portLabel.js";
import { fmt } from "./common/Utilities.js";

export default function AlertsView({ t, TH }) {
  const [ports, setPorts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPortsFlat().then(r => {
      const unknown = (r.data || []).filter(p => p.statut === "INCONNU");
      setPorts(unknown);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <Spinner TH={TH} />;

  const c = TH.sc.INCONNU || TH.sc.LIBRE;

  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "20px" }}>
      {ports.length > 0 && (
        <div style={{
          background: c.bg, 
          border: `1px solid ${c.bd}`, 
          borderRadius: "10px",
          padding: "12px 16px", 
          marginBottom: "16px", 
          color: c.tx, 
          fontSize: "13px", 
          fontWeight: 600
        }}>
          ⚠ {ports.length} port(s) INCONNU détecté(s)
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {ports.map(p => (
          <div 
            key={p.id} 
            style={{
              background: TH.bgCard, 
              border: `1px solid ${c.bd}`,
              borderRadius: "10px", 
              padding: "14px 16px"
            }}>
            <div className="font-mono" style={{ fontWeight: 700, color: c.tx, marginBottom: "4px" }}>{formatPortLabel(p.id)}</div>
            <div style={{ color: TH.text2, fontSize: "11px" }}>
              {[
                p.slots?.odfs?.racks?.sites?.name,
                p.slots?.odfs?.racks?.salles?.name,
                p.slots?.odfs?.racks?.name,
                p.slots?.odfs?.name,
                p.slots?.name
              ].filter(Boolean).join(" › ")}
            </div>
            <div style={{ color: TH.text3, fontSize: "10px", marginTop: "4px" }}>{fmt(p.updated_at)}</div>
          </div>
        ))}
        {!ports.length && (
          <div style={{ textAlign: "center", color: TH.green, paddingTop: "40px", fontSize: "14px" }}>
            ✓ Aucun port INCONNU — Tout est en ordre
          </div>
        )}
      </div>
    </div>
  );
}
