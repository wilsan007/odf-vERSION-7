import React from "react";
import { Btn, Sel } from "../../common/UI.jsx";
import { RoutePathDisplay } from "../RoutePathDisplay.jsx";

export function SelectFournisseurStep({
  pathSites,
  sites,
  fournisseurId,
  setFournisseurId,
  fournisseurs,
  cables,
  hops,
  totalHops,
  TH,
  siteA,
  setStep,
  setCurrentHopIdx,
  setErr,
  onNextFournisseur,
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
          Fournisseur d'accès (côté {siteName(siteA)})
        </div>
        <div style={{ color: TH.text3, fontSize: "11px", marginBottom: "12px" }}>
          Sélectionnez l'opérateur qui fournit la capacité sur le câble de départ.
        </div>
        <Sel value={fournisseurId} onChange={setFournisseurId} TH={TH}>
          <option value="">— Sélectionner un fournisseur —</option>
          {(fournisseurs || []).map(f => (
            <option key={f.id} value={f.id}>{f.nom} ({f.id})</option>
          ))}
        </Sel>

        {hops[0]?.cableId && (
          (() => {
            const cable = (cables || []).find(c => c.id === hops[0].cableId);
            if (cable?.fournisseurs?.id && cable.fournisseurs.id !== fournisseurId) {
              return (
                <div style={{
                  marginTop: "8px", fontSize: "11px", color: TH.text3,
                  display: "flex", alignItems: "center", gap: "8px"
                }}>
                  <span>Suggestion :</span>
                  <button
                    onClick={() => setFournisseurId(cable.fournisseurs.id)}
                    style={{
                      background: `${TH.blue}22`, border: `1px solid ${TH.blue}`,
                      borderRadius: "6px", padding: "2px 10px",
                      color: TH.blue, fontSize: "11px", fontWeight: 700, cursor: "pointer"
                    }}
                  >
                    {cable.fournisseurs.nom}
                  </button>
                  <span style={{ color: TH.text3 }}>(fournisseur du câble {cable.cable_reference})</span>
                </div>
              );
            }
            return null;
          })()
        )}
      </div>

      <div style={{ display: "flex", gap: "10px", justifyContent: "space-between" }}>
        <Btn onClick={() => {
          setErr("");
          setStep(`HOP_${totalHops - 1}`);
          setCurrentHopIdx(totalHops - 1);
        }} variant="ghost" TH={TH}>‹ Retour</Btn>
        <Btn onClick={onNextFournisseur} disabled={!fournisseurId} TH={TH}>
          Suivant — Client final ›
        </Btn>
      </div>
    </div>
  );
}
