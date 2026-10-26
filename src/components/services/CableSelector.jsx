import React from "react";
import { formatPortLabel } from "../../utils/portLabel.js";

// ═══════════════════════════════════════════════════════════════════════════
// CABLE SELECTOR — liste de câbles disponibles entre deux sites
// ═══════════════════════════════════════════════════════════════════════════

export function CableSelector({ cablesDispos, selectedCableId, onSelect, TH }) {
  if (!cablesDispos || cablesDispos.length === 0) {
    return (
      <div style={{
        background: `${TH.red}22`, border: `1px solid ${TH.red}`,
        borderRadius: "8px", padding: "12px", color: TH.red, fontSize: "12px",
      }}>
        Aucun câble disponible sur cette liaison. Vérifiez la topologie.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {cablesDispos.map(c => {
        const isSelected = c.id === selectedCableId;
        return (
          <div
            key={c.id}
            onClick={() => onSelect(c)}
            style={{
              background: isSelected ? `${TH.blue}22` : TH.bgCard,
              border: `2px solid ${isSelected ? TH.blue : TH.border}`,
              borderRadius: "10px", padding: "10px 14px",
              cursor: "pointer", transition: "all 0.15s",
              display: "flex", alignItems: "center", gap: "12px",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "3px", flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {isSelected && <span style={{ color: TH.blue, fontWeight: 900, fontSize: "14px" }}>✓</span>}
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", fontWeight: 700, color: TH.text1 }}>
                  {c.cable_reference}
                </span>
                {c.fournisseurs?.nom && (
                  <span style={{ fontSize: "10px", color: TH.text3, background: TH.bgInput, borderRadius: "4px", padding: "1px 6px" }}>
                    {c.fournisseurs.nom}
                  </span>
                )}
              </div>
              <div style={{ fontSize: "10px", color: TH.text3, fontFamily: "'JetBrains Mono', monospace" }}>
                Port Source : {formatPortLabel(c.portEntree)}
                <span style={{ margin: "0 6px", color: TH.text3 }}>›</span>
                Port Destination : {formatPortLabel(c.portSortie)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
