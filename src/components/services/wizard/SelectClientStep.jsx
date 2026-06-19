import React from "react";
import { Btn, Sel } from "../../common/UI.jsx";
import { RoutePathDisplay } from "../RoutePathDisplay.jsx";

export function SelectClientStep({
  pathSites,
  sites,
  clientId,
  setClientId,
  clients,
  capacite,
  setCapacite,
  totalHops,
  TH,
  siteB,
  setStep,
  setErr,
  onNextClient,
  siteName,
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <RoutePathDisplay
        pathSites={pathSites}
        activeHopIndex={totalHops}
        sitesList={sites}
        TH={TH}
      />

      <div style={{
        background: TH.bgCard, border: `1px solid ${TH.border}`,
        borderRadius: "10px", padding: "16px"
      }}>
        <div style={{ color: TH.text1, fontSize: "13px", fontWeight: 700, marginBottom: "4px" }}>
          Client final (côté {siteName(siteB)})
        </div>
        <div style={{ color: TH.text3, fontSize: "11px", marginBottom: "12px" }}>
          Sélectionnez le client qui reçoit le service à destination.
        </div>
        <Sel value={clientId} onChange={setClientId} TH={TH}>
          <option value="">— Sélectionner un client —</option>
          {(clients || []).map(c => (
            <option key={c.id} value={c.id}>{c.nom} ({c.id})</option>
          ))}
        </Sel>
      </div>

      <div style={{
        background: TH.bgCard, border: `1px solid ${TH.border}`,
        borderRadius: "10px", padding: "16px"
      }}>
        <div style={{ color: TH.text1, fontSize: "13px", fontWeight: 700, marginBottom: "4px" }}>
          Capacité du service
        </div>
        <Sel value={capacite} onChange={setCapacite} TH={TH}>
          <option value="10">10 Gbps</option>
          <option value="100">100 Gbps</option>
        </Sel>
      </div>

      <div style={{ display: "flex", gap: "10px", justifyContent: "space-between" }}>
        <Btn onClick={() => { setErr(""); setStep("SELECT_FOURNISSEUR"); }} variant="ghost" TH={TH}>
          ‹ Retour
        </Btn>
        <Btn onClick={onNextClient} disabled={!clientId} TH={TH}>
          Vérifier et confirmer ›
        </Btn>
      </div>
    </div>
  );
}
