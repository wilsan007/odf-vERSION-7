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
  rackA,
  setRackA,
  rackB,
  setRackB,
  odfA,
  setOdfA,
  odfB,
  setOdfB,
  racksA,
  racksB,
  odfsA,
  odfsB,
  sites,
  pathSites,
  noPath,
  TH,
  onClose,
  onSubmitSites,
  siteName,
  setErr,
}) {
  // Cascade Salle → Rack → ODF : chaque niveau ne propose que les éléments du niveau choisi au-dessus
  const racksFor = (racks, salle) => (racks || []).filter(r => !salle || r.salle_id === salle);
  // Les noms d'ODF (ODF1, ODF2…) se répètent dans chaque rack : on préfixe par le rack
  const odfLabel = (odf, racks) => `${(racks || []).find(r => r.id === odf.rack_id)?.name ?? "?"} · ${odf.name}`;
  const odfsFor = (odfs, racks, salle, rack) => {
    if (rack) return (odfs || []).filter(o => o.rack_id === rack);
    const rackIds = new Set(racksFor(racks, salle).map(r => r.id));
    return (odfs || []).filter(o => rackIds.has(o.rack_id));
  };

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
            <Sel value={siteA} onChange={v => { setSiteA(v); setSalleA(""); setRackA(""); setOdfA(""); setErr(""); }} TH={TH}>
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
              <Sel value={salleA} onChange={v => { setSalleA(v); setRackA(""); setOdfA(""); setErr(""); }} TH={TH} disabled={!sallesA?.length}>
                <option value="">— Toutes salles —</option>
                {(sallesA || []).map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.id})</option>
                ))}
              </Sel>
            </div>
          )}
          {siteA && (
            <div>
              <label style={{ display: "block", color: TH.green, fontSize: "11px", fontWeight: 600, marginBottom: "5px" }}>
                Rack de départ (optionnel)
              </label>
              <Sel value={rackA} onChange={v => { setRackA(v); setOdfA(""); setErr(""); }} TH={TH} disabled={!racksFor(racksA, salleA).length}>
                <option value="">— Tous racks —</option>
                {racksFor(racksA, salleA).map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </Sel>
            </div>
          )}
          {siteA && (
            <div>
              <label style={{ display: "block", color: TH.green, fontSize: "11px", fontWeight: 600, marginBottom: "5px" }}>
                ODF de départ (optionnel)
              </label>
              <Sel value={odfA} onChange={v => { setOdfA(v); setErr(""); }} TH={TH} disabled={!odfsFor(odfsA, racksA, salleA, rackA).length}>
                <option value="">— Tous ODF —</option>
                {odfsFor(odfsA, racksA, salleA, rackA).map(o => (
                  <option key={o.id} value={o.id}>{odfLabel(o, racksA)}</option>
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
            <Sel value={siteB} onChange={v => { setSiteB(v); setSalleB(""); setRackB(""); setOdfB(""); setErr(""); }} TH={TH}>
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
              <Sel value={salleB} onChange={v => { setSalleB(v); setRackB(""); setOdfB(""); setErr(""); }} TH={TH} disabled={!sallesB?.length}>
                <option value="">— Toutes salles —</option>
                {(sallesB || []).map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.id})</option>
                ))}
              </Sel>
            </div>
          )}
          {siteB && (
            <div>
              <label style={{ display: "block", color: TH.cyan, fontSize: "11px", fontWeight: 600, marginBottom: "5px" }}>
                Rack d'arrivée (optionnel)
              </label>
              <Sel value={rackB} onChange={v => { setRackB(v); setOdfB(""); setErr(""); }} TH={TH} disabled={!racksFor(racksB, salleB).length}>
                <option value="">— Tous racks —</option>
                {racksFor(racksB, salleB).map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </Sel>
            </div>
          )}
          {siteB && (
            <div>
              <label style={{ display: "block", color: TH.cyan, fontSize: "11px", fontWeight: 600, marginBottom: "5px" }}>
                ODF d'arrivée (optionnel)
              </label>
              <Sel value={odfB} onChange={v => { setOdfB(v); setErr(""); }} TH={TH} disabled={!odfsFor(odfsB, racksB, salleB, rackB).length}>
                <option value="">— Tous ODF —</option>
                {odfsFor(odfsB, racksB, salleB, rackB).map(o => (
                  <option key={o.id} value={o.id}>{odfLabel(o, racksB)}</option>
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
