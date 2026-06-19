import React from "react";
import { Modal } from "../common/UI.jsx";
import { fmtDt } from "../../utils/constants";

// ═══════════════════════════════════════════════════════════════════════════
// SERVICE DETAIL MODAL — détail complet d'un service (ouvert au clic sur le CID)
// ═══════════════════════════════════════════════════════════════════════════

function Row({ label, value, TH }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", padding: "7px 0", borderBottom: `1px solid ${TH.border}` }}>
      <span style={{ color: TH.text2, fontSize: "12px" }}>{label}</span>
      <span style={{ color: TH.text1, fontSize: "12px", fontWeight: 600, textAlign: "right" }}>{value || "—"}</span>
    </div>
  );
}

export function ServiceDetailModal({ service, routeInfo, onClose, TH }) {
  if (!service) return null;

  const st = service.statut || "ACTIF";
  const SC_SVC = { ACTIF: TH.green, SUSPENDU: TH.gold, RESILIE: TH.red };
  const col = SC_SVC[st] || TH.text2;
  const route = routeInfo?.route;
  const nb = routeInfo?.nb_jonctions ?? (service.service_jonctions?.length || 0);
  const cable = service.cables_fibre;
  const port = service.ports;

  return (
    <Modal title={`Service — ${service.cid || service.id}`} onClose={onClose} TH={TH} width="560px">
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
        <span style={{ color: TH.text1, fontSize: "15px", fontWeight: 700 }}>{service.label}</span>
        <span style={{
          fontSize: "10px", fontWeight: 700, color: col,
          border: `1px solid ${col}`, borderRadius: "6px", padding: "2px 8px"
        }}>{st}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <Row label="Client" value={service.clients?.nom} TH={TH} />
        <Row label="Fournisseur" value={service.fournisseurs?.nom} TH={TH} />
        <Row label="Source (câble)" value={cable ? `${cable.cable_reference}${cable.nom ? " — " + cable.nom : ""} (${cable.type_lien})` : null} TH={TH} />
        <Row label="Port d'entrée" value={port?.slot_port} TH={TH} />
        <Row label="OT" value={service.ot_num} TH={TH} />
        <Row label="Capacité" value={service.capacite_gbps != null ? `${service.capacite_gbps} Gbps` : null} TH={TH} />
        <Row label="Jonctions" value={nb} TH={TH} />
        <Row label="Remarques" value={service.remarques} TH={TH} />
        <Row label="Créé le" value={fmtDt(service.created_at)} TH={TH} />
        <Row label="Créé par" value={service.created_by} TH={TH} />
        <Row label="Modifié le" value={fmtDt(service.updated_at)} TH={TH} />
        <Row label="Modifié par" value={service.updated_by} TH={TH} />
      </div>

      <div style={{
        marginTop: "14px",
        fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: TH.text1,
        background: TH.bgInput, borderRadius: "8px", padding: "8px 10px", lineHeight: 1.5
      }}>
        {route || "— (aucune route définie)"}
      </div>
    </Modal>
  );
}
