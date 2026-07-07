import React from "react";
import { Btn, Sel, Inp } from "../../common/UI.jsx";
import { RoutePathDisplay } from "../RoutePathDisplay.jsx";

export function SelectSitesStep({
  label,
  setLabel,
  siteA,
  setSiteA,
  siteB,
  setSiteB,
  salleA,
  setSalleA,
  salleB,
  setSalleB,
  sallesA,
  sallesB,
  sites,
  pathSites,
  noPath,
  TH,
  onClose,
  onSubmitSites,
  siteName,
  setErr,
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <div>
        <label style={{ display: "block", color: TH.text2, fontSize: "11px", fontWeight: 600, marginBottom: "5px" }}>
          Label du service *
        </label>
        <Inp value={label} onChange={setLabel} placeholder="ex: Backbone RDK-HAR MTN" TH={TH} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "10px", alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div>
            <label style={{ display: "block", color: TH.green, fontSize: "11px", fontWeight: 700, marginBottom: "5px" }}>
              Site de départ (A)
            </label>
            <Sel value={siteA} onChange={v => { setSiteA(v); setSalleA(""); setErr(""); }} TH={TH}>
              <option value="">— Choisir le site source —</option>
              {(sites || []).map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.id})</option>
              ))}
            </Sel>
          </div>
          {siteA && (
            <div>
              <label style={{ display: "block", color: TH.green, fontSize: "11px", fontWeight: 600, marginBottom: "5px" }}>
                Salle de départ (optionnel)
              </label>
              <Sel value={salleA} onChange={v => { setSalleA(v); setErr(""); }} TH={TH} disabled={!sallesA?.length}>
                <option value="">— Toutes salles —</option>
                {(sallesA || []).map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.id})</option>
                ))}
              </Sel>
            </div>
          )}
        </div>

        <div style={{ color: TH.gold, fontSize: "20px", fontWeight: 700, paddingTop: "22px", textAlign: "center" }}>
          ›
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div>
            <label style={{ display: "block", color: TH.cyan, fontSize: "11px", fontWeight: 700, marginBottom: "5px" }}>
              Site de destination (B)
            </label>
            <Sel value={siteB} onChange={v => { setSiteB(v); setSalleB(""); setErr(""); }} TH={TH}>
              <option value="">— Choisir le site destination —</option>
              {(sites || []).filter(s => s.id !== siteA).map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.id})</option>
              ))}
            </Sel>
          </div>
          {siteB && (
            <div>
              <label style={{ display: "block", color: TH.cyan, fontSize: "11px", fontWeight: 600, marginBottom: "5px" }}>
                Salle d'arrivée (optionnel)
              </label>
              <Sel value={salleB} onChange={v => { setSalleB(v); setErr(""); }} TH={TH} disabled={!sallesB?.length}>
                <option value="">— Toutes salles —</option>
                {(sallesB || []).map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.id})</option>
                ))}
              </Sel>
            </div>
          )}
        </div>
      </div>

      {siteA && siteB && siteA !== siteB && (
        noPath ? (
          <div style={{
            background: `${TH.red}22`, border: `1px solid ${TH.red}`,
            borderRadius: "8px", padding: "10px 14px", color: TH.red, fontSize: "12px"
          }}>
            Aucun chemin physique disponible entre {siteName(siteA)} et {siteName(siteB)}.
            Vérifiez que les câbles inter-sites sont correctement configurés.
          </div>
        ) : pathSites.length > 0 && (
          <div style={{
            background: `${TH.green}11`, border: `1px solid ${TH.green}44`,
            borderRadius: "8px", padding: "10px 14px"
          }}>
            <div style={{
              fontSize: "10px", color: TH.text3, fontWeight: 700,
              textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px"
            }}>
              Chemin optimal ({pathSites.length - 1} liaison{pathSites.length - 1 > 1 ? 's' : ''})
            </div>
            <RoutePathDisplay
              pathSites={pathSites}
              activeHopIndex={-1}
              sitesList={sites}
              TH={TH}
            />
          </div>
        )
      )}

      <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "4px" }}>
        <Btn onClick={onClose} variant="ghost" TH={TH}>Annuler</Btn>
        <Btn
          onClick={onSubmitSites}
          disabled={!siteA || !siteB || pathSites.length === 0}
          TH={TH}
        >
          Continuer — Sélectionner les liaisons ›
        </Btn>
      </div>
    </div>
  );
}
