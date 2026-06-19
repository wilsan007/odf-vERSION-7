import React from "react";
import { Btn } from "../common/UI.jsx";

// ═══════════════════════════════════════════════════════════════════════════
// SERVICE CARD — ligne compacte "CID - STATUT - LABEL", cliquable pour le détail
// ═══════════════════════════════════════════════════════════════════════════

export function ServiceCard({ service, onSelect, onEdit, onToggleStatut, TH }) {
  const st = service.statut || "ACTIF";
  const SC_SVC = { ACTIF: TH.green, SUSPENDU: TH.gold, RESILIE: TH.red };
  const col = SC_SVC[st] || TH.text2;
  const isActif = st === "ACTIF";

  return (
    <div
      onClick={() => onSelect(service)}
      style={{
        background: TH.bgCard, border: `1px solid ${TH.border}`,
        borderRadius: "12px", padding: "12px 16px",
        display: "flex", alignItems: "center", gap: "12px", cursor: "pointer"
      }}
    >
      <span className="font-mono" style={{ fontWeight: 700, color: TH.cyan, fontSize: "13px" }}>
        {service.cid || service.id}
      </span>
      <span style={{
        fontSize: "10px", fontWeight: 700, color: col,
        border: `1px solid ${col}`, borderRadius: "6px", padding: "2px 8px"
      }}>{st}</span>
      <span style={{ color: TH.text1, fontSize: "13px", fontWeight: 600, flex: 1 }}>{service.label}</span>
      <div style={{ display: "flex", gap: "6px" }} onClick={e => e.stopPropagation()}>
        <Btn onClick={() => onToggleStatut(service)} variant={isActif ? "danger" : "success"} size="sm" TH={TH}>
          {isActif ? "Désactiver" : "Activer"}
        </Btn>
        <Btn onClick={() => onEdit(service)} size="sm" TH={TH}>✏️ Modifier</Btn>
      </div>
    </div>
  );
}
