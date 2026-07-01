import React from "react";
import { Btn } from "../../common/UI.jsx";
import { RoutePathDisplay } from "../RoutePathDisplay.jsx";

export function ConfirmStep({
  pathSites,
  sites,
  hops,
  totalHops,
  fournisseurId,
  fournisseurs,
  clientId,
  clients,
  capacite,
  label,
  saving,
  TH,
  setStep,
  setErr,
  onConfirm,
  siteName,
  resolvedJarretieresList,
}) {
  const fournisseurNom = (fournisseurs || []).find(f => f.id === fournisseurId)?.nom || fournisseurId;
  const clientNom = (clients || []).find(c => c.id === clientId)?.nom || clientId;
  
  const Row = ({ label: lbl, value }) => (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "6px 0", borderBottom: `1px solid ${TH.border}`, fontSize: "12px"
    }}>
      <span style={{ color: TH.text2, fontWeight: 600 }}>{lbl}</span>
      <span style={{ color: TH.text1, fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}>{value}</span>
    </div>
  );

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
        borderRadius: "10px", padding: "16px",
        display: "flex", flexDirection: "column", gap: "2px"
      }}>
        <div style={{ color: TH.text1, fontSize: "13px", fontWeight: 700, marginBottom: "10px" }}>
          Récapitulatif du service
        </div>
        <Row label="Label" value={label} />
        <Row label="Capacité" value={`${capacite} Gbps`} />
        <Row label="Fournisseur" value={fournisseurNom} />
        <Row label="Client" value={clientNom} />
        <Row label="Route" value={pathSites.map(s => siteName(s)).join(" › ")} />
        <Row label="Liaisons" value={hops.filter(Boolean).map(h => h.cable_reference).join(" + ")} />
        {hops.filter(Boolean).map((h, i) => (
          <Row
            key={i}
            value={`${h.portEntree} › ${h.portSortie}`}
          />
        ))}
      </div>

      {hops.length > 1 && (
        <div style={{
          background: `${TH.purple}10`, border: `1px solid ${TH.purple}33`,
          borderRadius: "10px", padding: "14px 16px"
        }}>
          <div style={{
            fontSize: "10px", color: TH.purple, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px",
            display: "flex", alignItems: "center", gap: "6px"
          }}>
            <span>🔀</span> Connexions locales (jarretières) utilisées
          </div>
          {hops.slice(1).map((hop, idx) => {
            const hopIdx = idx + 1;
            const siteTransit = siteName(pathSites[hopIdx]);
            const portIn = hops[hopIdx - 1]?.portSortie;
            const portMid = hop?.portTransitMid;
            const portOut = hop?.portEntree;
            if (!portIn || !portMid || !portOut) return null;
            
            const jDetails = resolvedJarretieresList?.[hopIdx];
            const j1 = jDetails?.j1;
            const j2 = jDetails?.j2;
            const intersalleCable = jDetails?.intersalleCable;
            const portMid2 = hop?.portTransitMid2 || null;
            const isIntersalle = !!(portMid2 && intersalleCable);

            return (
              <div key={hopIdx} style={{
                marginBottom: "8px", padding: "8px 10px",
                background: TH.bgSurface, borderRadius: "8px",
                border: `1px solid ${isIntersalle ? TH.gold : TH.border}`
              }}>
                <div style={{ fontSize: "10px", color: TH.text2, fontWeight: 700, marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
                  Site de transit : {siteTransit}
                  {isIntersalle && (
                    <span style={{ background: `${TH.gold}22`, color: TH.gold, padding: "1px 6px", borderRadius: "4px", fontSize: "9px" }}>
                      INTERSALLE
                    </span>
                  )}
                </div>
                
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", marginBottom: "4px" }}>
                  <span style={{ background: `${TH.blue}22`, color: TH.blue, padding: "2px 6px", borderRadius: "4px", fontWeight: 700 }}>
                    {portIn.replace('_', '-')}
                  </span>
                  <span style={{ color: TH.purple, fontWeight: 700 }}>─►</span>
                  <span style={{ background: `${TH.purple}22`, color: TH.purple, padding: "2px 6px", borderRadius: "4px", fontWeight: 700 }}>
                    {portMid.replace('_', '-')}
                  </span>
                  {isIntersalle && (
                    <>
                      <span style={{ color: TH.gold, fontWeight: 700 }}>══►</span>
                      <span style={{ background: `${TH.gold}22`, color: TH.gold, padding: "2px 6px", borderRadius: "4px", fontWeight: 700 }}>
                        {portMid2.replace('_', '-')}
                      </span>
                    </>
                  )}
                  <span style={{ color: TH.purple, fontWeight: 700 }}>─►</span>
                  <span style={{ background: `${TH.cyan}22`, color: TH.cyan, padding: "2px 6px", borderRadius: "4px", fontWeight: 700 }}>
                    {portOut.replace('_', '-')}
                  </span>
                </div>
                
                <div style={{ fontSize: "9px", color: TH.text3, display: "flex", flexDirection: "column", gap: "2px" }}>
                  {j1 && <div>Jarretière 1 (intrasalle) : <strong>{j1.cable_reference}</strong> {j1.nom ? `(${j1.nom})` : ""}</div>}
                  {isIntersalle && intersalleCable && <div style={{ color: TH.gold }}>Câble intersalle : <strong>{intersalleCable.cable_reference}</strong> {intersalleCable.nom ? `(${intersalleCable.nom})` : ""}</div>}
                  {j2 && <div>Jarretière 2 (intrasalle) : <strong>{j2.cable_reference}</strong> {j2.nom ? `(${j2.nom})` : ""}</div>}
                </div>
              </div>
            );
          }).filter(Boolean)}
          <div style={{ fontSize: "10px", color: TH.text3, marginTop: "4px" }}>
            Ces connexions locales d'infrastructure existantes seront associées aux jonctions du service.
          </div>
        </div>
      )}

      <div style={{
        background: `${TH.gold}22`, border: `1px solid ${TH.gold}66`,
        borderRadius: "8px", padding: "10px 14px", fontSize: "11px", color: TH.gold
      }}>
        Câble principal : {hops[0]?.cable_reference}.
        Cette opération est irréversible via l'interface (contacter un admin pour rollback).
      </div>

      <div style={{ display: "flex", gap: "10px", justifyContent: "space-between" }}>
        <Btn onClick={() => { setErr(""); setStep("SELECT_CLIENT"); }} variant="ghost" TH={TH} disabled={saving}>
          ‹ Retour
        </Btn>
        <Btn onClick={onConfirm} disabled={saving} TH={TH}>
          {saving ? "Enregistrement en cours…" : "Confirmer et créer le service"}
        </Btn>
      </div>
    </div>
  );
}
