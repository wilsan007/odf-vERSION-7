import React from "react";
import { Btn, Sel } from "../../common/UI.jsx";
import { RoutePathDisplay } from "../RoutePathDisplay.jsx";
import { MATCH_LABELS } from "../routingEngine.js";
import { getJarretieresCandidates } from "../ServiceWizard.jsx";

export function HopStep({
  n,
  pathSites,
  sites,
  hops,
  loadingHopPorts,
  availablePortOptions,
  transitReco,
  transitPorts,
  transitLoading,
  totalHops,
  TH,
  setStep,
  setCurrentHopIdx,
  setErr,
  onSelectCable,
  onSelectTransitMid,
  onNextHop,
  siteName,
  resolvedJarretieres,
  allInternalCables,
  onSelectJarretiere1,
  onSelectJarretiere2,
}) {
  const fromSite = pathSites[n];
  const toSite = pathSites[n + 1];
  if (!fromSite || !toSite) return null;

  const handleSelectPortEntree = (portVal) => {
    const opt = availablePortOptions.find(o => o.portEntree === portVal);
    if (!opt) return;

    setErr("");
    const modifiedCable = {
      ...opt.cable,
      portEntree: opt.portEntree,
      portSortie: opt.portSortie,
    };
    onSelectCable(n, modifiedCable);
  };

  const formatPortDisplay = (pid) => {
    if (!pid) return "";
    return pid.replace('_', '-');
  };

  const selectedHop = hops[n] || {};
  const portTransitIn = n > 0 ? (hops[n - 1]?.portSortie || null) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <RoutePathDisplay
        pathSites={pathSites}
        activeHopIndex={n}
        sitesList={sites}
        TH={TH}
      />

      {n === 0 ? (
        <div style={{
          background: TH.bgCard, border: `1px solid ${TH.border}`,
          borderRadius: "10px", padding: "16px", display: "flex", flexDirection: "column", gap: "14px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
            <span style={{
              background: TH.blue, color: "#fff", borderRadius: "50%",
              width: "24px", height: "24px", display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: "11px", fontWeight: 700
            }}>{n + 1}</span>
            <div>
              <div style={{ color: TH.text1, fontSize: "13px", fontWeight: 700 }}>
                Liaison {siteName(fromSite)} › {siteName(toSite)}
              </div>
              <div style={{ color: TH.text3, fontSize: "11px" }}>
                Sélectionnez les ports pour cette liaison directe
              </div>
            </div>
          </div>

          <div>
            <label style={{ display: "block", color: TH.text2, fontSize: "11px", fontWeight: 600, marginBottom: "5px" }}>
              1. Port de départ (côté {siteName(fromSite)}) *
            </label>
            <Sel value={selectedHop.portEntree || ""} onChange={handleSelectPortEntree} TH={TH}>
              <option value="">
                {loadingHopPorts ? "Chargement des ports disponibles…" : "— Sélectionner le port de départ —"}
              </option>
              {availablePortOptions.map(opt => (
                <option key={opt.portEntree} value={opt.portEntree}>
                  {formatPortDisplay(opt.portEntree)} (via {opt.cable_reference})
                </option>
              ))}
            </Sel>
            {availablePortOptions.length === 0 && !loadingHopPorts && (
              <div style={{ background: "rgba(248,113,113,.12)", border: "1px solid rgba(248,113,113,.3)", borderRadius: "8px", padding: "10px 14px", color: "#F87171", fontSize: "12px", marginTop: "10px" }}>
                Erreur : Tous les ports de destination sur {siteName(toSite)} sont occupés.
              </div>
            )}
          </div>

          {selectedHop.portSortie && (
            <div>
              <label style={{ display: "block", color: TH.text2, fontSize: "11px", fontWeight: 600, marginBottom: "5px" }}>
                2. Port d'arrivée (côté {siteName(toSite)})
              </label>
              <div style={{
                background: TH.bgInput, border: `1px solid ${TH.border}`,
                borderRadius: "8px", padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center"
              }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", color: TH.text1, fontSize: "13px", fontWeight: 700 }}>
                  {formatPortDisplay(selectedHop.portSortie)}
                </span>
                <span style={{
                  background: `${TH.green}22`, color: TH.green, fontSize: "10px",
                  padding: "2px 8px", borderRadius: "4px", fontWeight: 700
                }}>
                  DISPONIBLE
                </span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{
          background: TH.bgCard, border: `1px solid ${TH.border}`,
          borderRadius: "10px", padding: "16px", display: "flex", flexDirection: "column", gap: "14px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
            <span style={{
              background: TH.blue, color: "#fff", borderRadius: "50%",
              width: "24px", height: "24px", display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: "11px", fontWeight: 700
            }}>{n + 1}</span>
            <div>
              <div style={{ color: TH.text1, fontSize: "13px", fontWeight: 700 }}>
                Transit via {siteName(fromSite)} › {siteName(toSite)}
              </div>
              <div style={{ color: TH.text3, fontSize: "11px" }}>
                Configurez le brassage interne et la sortie sur le site de transit {siteName(fromSite)}
              </div>
            </div>
          </div>

          <div>
            <label style={{ display: "block", color: TH.text3, fontSize: "11px", fontWeight: 600, marginBottom: "5px" }}>
              1. Port d'entrée entrant (provenant de {siteName(pathSites[n - 1])})
            </label>
            <div style={{
              background: TH.bgInput, border: `1px solid ${portTransitIn ? TH.border : TH.red}`,
              borderRadius: "8px", padding: "10px 14px", color: TH.text2,
              fontFamily: "'JetBrains Mono', monospace", fontSize: "13px",
              display: "flex", justifyContent: "space-between", alignItems: "center"
            }}>
              {portTransitIn
                ? <span style={{ color: TH.text1, fontWeight: 700 }}>{formatPortDisplay(portTransitIn)}</span>
                : <span style={{ color: TH.red, fontStyle: 'italic' }}>⚠ Aucun port entrant — retournez à l'étape précédente</span>}
              {portTransitIn && (
                <span style={{
                  background: `${TH.green}22`, color: TH.green, fontSize: "9px",
                  padding: "2px 8px", borderRadius: "4px", fontWeight: 700, flexShrink: 0
                }}>ODF EXTERNE</span>
              )}
            </div>
          </div>

          {portTransitIn && (() => {
            const salleIn = (transitPorts || []).find(p => p.id === portTransitIn)?.salle_id || null;
            const salleMid = (transitPorts || []).find(p => p.id === selectedHop.portTransitMid)?.salle_id || null;
            const salleOut = (transitPorts || []).find(p => p.id === selectedHop.portEntree)?.salle_id || null;

            const int1Type = 'INTERNE';
            const int2Type = 'INTERNE';

            const typeLabel = (t) => ({ txt: 'câble interne', color: TH.orange });

            return (
              <div style={{
                background: `${TH.purple}12`, border: `1px solid ${TH.purple}44`,
                borderRadius: "10px", padding: "14px 16px"
              }}>
                <div style={{
                  fontSize: "10px", color: TH.purple, fontWeight: 700,
                  textTransform: "uppercase", letterSpacing: "1px", marginBottom: "12px",
                  display: "flex", alignItems: "center", gap: "6px"
                }}>
                  <span>🔀</span> Connexion locale planifiée sur {siteName(fromSite)}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                    <span style={{
                      fontSize: "9px", color: TH.text3, fontWeight: 700,
                      textTransform: "uppercase", letterSpacing: "0.5px"
                    }}>Port entrant</span>
                    <div style={{
                      background: TH.bgCard, border: `1px solid ${TH.border2}`,
                      borderRadius: "6px", padding: "6px 10px",
                      fontFamily: "'JetBrains Mono', monospace", fontSize: "11px",
                      fontWeight: 700, color: TH.text1
                    }}>
                      {formatPortDisplay(portTransitIn)}
                    </div>
                    <span style={{ fontSize: "9px", color: TH.blue }}>ODF EXTERNE</span>
                    {salleIn && <span style={{ fontSize: "8px", color: TH.text3 }}>Salle {salleIn}</span>}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", flexShrink: 0 }}>
                    <span style={{ fontSize: "9px", color: typeLabel(int1Type).color, fontWeight: 700 }}>──►</span>
                    <span style={{ fontSize: "8px", color: typeLabel(int1Type).color, fontWeight: 600 }}>
                      {typeLabel(int1Type).txt}
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                    <span style={{
                      fontSize: "9px", color: TH.text3, fontWeight: 700,
                      textTransform: "uppercase", letterSpacing: "0.5px"
                    }}>Port brassage</span>
                    <div style={{
                      background: selectedHop.portTransitMid
                        ? `${TH.purple}22` : `${TH.text3}11`,
                      border: `1px solid ${selectedHop.portTransitMid ? TH.purple : TH.border}`,
                      borderRadius: "6px", padding: "6px 10px",
                      fontFamily: "'JetBrains Mono', monospace", fontSize: "11px",
                      fontWeight: 700,
                      color: selectedHop.portTransitMid ? TH.purple : TH.text3,
                      minWidth: "80px", textAlign: "center"
                    }}>
                      {selectedHop.portTransitMid
                        ? formatPortDisplay(selectedHop.portTransitMid)
                        : "— à choisir —"}
                    </div>
                    <span style={{ fontSize: "9px", color: TH.purple }}>iODF (INTERNE)</span>
                    {salleMid && <span style={{ fontSize: "8px", color: TH.text3 }}>Salle {salleMid}</span>}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", flexShrink: 0 }}>
                    <span style={{ fontSize: "9px", color: typeLabel(int2Type).color, fontWeight: 700 }}>──►</span>
                    <span style={{ fontSize: "8px", color: typeLabel(int2Type).color, fontWeight: 600 }}>
                      {typeLabel(int2Type).txt}
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                    <span style={{
                      fontSize: "9px", color: TH.text3, fontWeight: 700,
                      textTransform: "uppercase", letterSpacing: "0.5px"
                    }}>Port sortant</span>
                    <div style={{
                      background: selectedHop.portEntree
                        ? `${TH.cyan}15` : `${TH.text3}11`,
                      border: `1px solid ${selectedHop.portEntree ? TH.cyan : TH.border}`,
                      borderRadius: "6px", padding: "6px 10px",
                      fontFamily: "'JetBrains Mono', monospace", fontSize: "11px",
                      fontWeight: 700,
                      color: selectedHop.portEntree ? TH.cyan : TH.text3,
                      minWidth: "80px", textAlign: "center"
                    }}>
                      {selectedHop.portEntree
                        ? formatPortDisplay(selectedHop.portEntree)
                        : "— à choisir —"}
                    </div>
                    <span style={{ fontSize: "9px", color: TH.cyan }}>ODF EXTERNE → {siteName(toSite)}</span>
                    {salleOut && <span style={{ fontSize: "8px", color: TH.text3 }}>Salle {salleOut}</span>}
                  </div>
                </div>

                {selectedHop.portTransitMid && selectedHop.portEntree && (() => {
                  const isJ1Required = portTransitIn && selectedHop.portTransitMid && portTransitIn !== selectedHop.portTransitMid;
                  const isJ2Required = selectedHop.portTransitMid && selectedHop.portEntree && selectedHop.portTransitMid !== selectedHop.portEntree;
                  
                  const j1 = resolvedJarretieres?.j1;
                  const j2 = resolvedJarretieres?.j2;
                  
                  const isJ1Valid = !isJ1Required || j1;
                  const isJ2Valid = !isJ2Required || j2;
                  const isValid = isJ1Valid && isJ2Valid;

                  return (
                    <div style={{
                      marginTop: "12px", padding: "10px",
                      background: isValid ? `${TH.green}12` : "rgba(239, 68, 68, 0.08)",
                      border: `1px solid ${isValid ? TH.green : TH.red}33`,
                      borderRadius: "8px",
                      fontSize: "11px",
                      display: "flex", flexDirection: "column", gap: "6px"
                    }}>
                      <div style={{ fontWeight: 700, color: isValid ? TH.green : TH.red, fontSize: "11px", display: "flex", alignItems: "center", gap: "6px" }}>
                        <span>{isValid ? "✓ Connexions locales validées" : "⚠ Connexions locales requises manquantes"}</span>
                      </div>
                      
                      {isJ1Required && (() => {
                        const candidates = getJarretieresCandidates(portTransitIn, selectedHop.portTransitMid, allInternalCables);
                        if (candidates.length === 0) {
                          return (
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: TH.red, fontSize: "11px" }}>
                              <span>❌</span>
                              <span>
                                Jarretière 1 ({formatPortDisplay(portTransitIn)} ↔ {formatPortDisplay(selectedHop.portTransitMid)}) :{" "}
                                <span style={{ fontWeight: 600 }}>Aucune connexion existante entre ces slots</span>
                              </span>
                            </div>
                          );
                        }
                        return (
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", color: TH.text2, fontSize: "11px", fontWeight: 600 }}>
                              <span>✅ Jarretière 1 ({formatPortDisplay(portTransitIn)} ↔ {formatPortDisplay(selectedHop.portTransitMid)}) :</span>
                              {candidates.length > 1 && (
                                <span style={{ background: `${TH.blue}22`, color: TH.blue, padding: "1px 6px", borderRadius: "4px", fontSize: "9px", fontWeight: 700 }}>
                                  {candidates.length} options disponibles
                                </span>
                              )}
                            </div>
                            <Sel
                              value={j1?.id || ""}
                              onChange={(val) => onSelectJarretiere1(n, val)}
                              TH={TH}
                              style={{ height: "36px", padding: "6px 10px", fontSize: "12px" }}
                            >
                              {candidates.map(c => (
                                <option key={c.id} value={c.id}>
                                  {c.cable_reference} {c.nom ? `(${c.nom})` : ""}
                                </option>
                              ))}
                            </Sel>
                          </div>
                        );
                      })()}
                      
                      {isJ2Required && (() => {
                        const candidates = getJarretieresCandidates(selectedHop.portTransitMid, selectedHop.portEntree, allInternalCables);
                        if (candidates.length === 0) {
                          return (
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: TH.red, fontSize: "11px" }}>
                              <span>❌</span>
                              <span>
                                Jarretière 2 ({formatPortDisplay(selectedHop.portTransitMid)} ↔ {formatPortDisplay(selectedHop.portEntree)}) :{" "}
                                <span style={{ fontWeight: 600 }}>Aucune connexion existante entre ces slots</span>
                              </span>
                            </div>
                          );
                        }
                        return (
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", color: TH.text2, fontSize: "11px", fontWeight: 600 }}>
                              <span>✅ Jarretière 2 ({formatPortDisplay(selectedHop.portTransitMid)} ↔ {formatPortDisplay(selectedHop.portEntree)}) :</span>
                              {candidates.length > 1 && (
                                <span style={{ background: `${TH.blue}22`, color: TH.blue, padding: "1px 6px", borderRadius: "4px", fontSize: "9px", fontWeight: 700 }}>
                                  {candidates.length} options disponibles
                                </span>
                              )}
                            </div>
                            <Sel
                              value={j2?.id || ""}
                              onChange={(val) => onSelectJarretiere2(n, val)}
                              TH={TH}
                              style={{ height: "36px", padding: "6px 10px", fontSize: "12px" }}
                            >
                              {candidates.map(c => (
                                <option key={c.id} value={c.id}>
                                  {c.cable_reference} {c.nom ? `(${c.nom})` : ""}
                                </option>
                              ))}
                            </Sel>
                          </div>
                        );
                      })()}

                      {!isValid && (
                        <div style={{ color: TH.text3, fontSize: "10px", marginTop: "4px", borderTop: `1px dashed ${TH.red}44`, paddingTop: "6px" }}>
                          Veuillez créer l'interconnexion de brassage requise via le module <strong>Connexion ODF</strong> pour continuer.
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })()}

          <div>
            <label style={{ display: "block", color: TH.text2, fontSize: "11px", fontWeight: 600, marginBottom: "5px" }}>
              2. Port de sortie (côté {siteName(fromSite)}) vers {siteName(toSite)} *
            </label>
            <div style={{ fontSize: "10px", color: TH.text3, marginBottom: "6px" }}>
              Choisissez le port de sortie disponible — cela permettra de recommander automatiquement le bon port iODF.
            </div>
            <Sel value={selectedHop.portEntree || ""} onChange={handleSelectPortEntree} TH={TH}>
              <option value="">
                {loadingHopPorts ? "Chargement des ports disponibles…" : `— Sélectionner le port de sortie vers ${siteName(toSite)} —`}
              </option>
              {availablePortOptions.map(opt => (
                <option key={opt.portEntree} value={opt.portEntree}>
                  {formatPortDisplay(opt.portEntree)} (via {opt.cable_reference})
                </option>
              ))}
            </Sel>
            {availablePortOptions.length === 0 && !loadingHopPorts && (
              <div style={{ background: "rgba(248,113,113,.12)", border: "1px solid rgba(248,113,113,.3)", borderRadius: "8px", padding: "10px 14px", color: "#F87171", fontSize: "12px", marginTop: "10px" }}>
                Erreur : Tous les ports de destination sur {siteName(toSite)} sont occupés.
              </div>
            )}
            {selectedHop.portSortie && (
              <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "10px", color: TH.text3 }}>Arrivée côté {siteName(toSite)} :</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", fontWeight: 700, color: TH.text1 }}>
                  {formatPortDisplay(selectedHop.portSortie)}
                </span>
                <span style={{ background: `${TH.green}22`, color: TH.green, fontSize: "9px", padding: "1px 6px", borderRadius: "4px", fontWeight: 700 }}>
                  DISPONIBLE
                </span>
              </div>
            )}
          </div>

          <div>
            <label style={{ display: "block", color: TH.text2, fontSize: "11px", fontWeight: 600, marginBottom: "5px" }}>
              3. Port de brassage interne — iODF sur {siteName(fromSite)} *
              {selectedHop.portEntree && <span style={{ color: TH.green, marginLeft: "6px", fontSize: "10px", fontWeight: 400 }}>
                (recommandation affinée grâce au port de sortie)
              </span>}
            </label>

            {transitReco.length > 0 && (
              <div style={{
                background: `${TH.green}18`, border: `1px solid ${TH.green}55`,
                borderRadius: "6px", padding: "8px 12px", marginBottom: "8px",
                fontSize: "11px", color: TH.text2, display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap",
              }}>
                <span style={{ color: TH.green, fontWeight: 700 }}>
                  <span style={{ color: ['HAS_EXTERNAL','ROUTE_TO_C'].includes(transitReco[0].matchType) ? TH.blue : TH.green }}>{MATCH_LABELS[transitReco[0].matchType]}</span>
                </span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: TH.text1 }}>
                  {formatPortDisplay(transitReco[0].portInterne.id)}
                </span>
                {transitReco[0].portExterneB && (
                  <span style={{ color: TH.text3 }}>
                    › câble interne › {formatPortDisplay(transitReco[0].portExterneB.id)}
                  </span>
                )}
                {selectedHop.portTransitMid !== transitReco[0].portInterne.id && (
                  <button
                    onClick={() => onSelectTransitMid(n, transitReco[0].portInterne.id)}
                    style={{
                      marginLeft: "auto", padding: "2px 10px", fontSize: "10px",
                      background: TH.green, color: "#fff", border: "none",
                      borderRadius: "4px", cursor: "pointer", fontWeight: 700,
                    }}
                  >
                    Appliquer
                  </button>
                )}
              </div>
            )}

            <Sel value={selectedHop.portTransitMid || ""} onChange={val => onSelectTransitMid(n, val)} TH={TH}>
              <option value="">— Sélectionner le port interne (iODF) —</option>
              {transitLoading
                ? <option disabled value="">Chargement des ports iODF…</option>
                : transitPorts.length === 0
                  ? <option disabled value="">Aucun port iODF disponible sur ce site</option>
                  : (() => {
                      const pNum = (id) => { const m = id.match(/P(\d+)$/); return m ? parseInt(m[1], 10) : 0; };
                      const refNum = pNum(portTransitIn || '');
                      const recoIds = transitReco.map(r => r.portInterne.id);
                      const freePorts = transitPorts.filter(p => p.statut !== 'OCCUPE' || p.id === selectedHop.portTransitMid);
                      const recoGroup = recoIds.map(id => freePorts.find(p => p.id === id)).filter(Boolean);
                      const otherGroup = freePorts
                        .filter(p => !recoIds.includes(p.id))
                        .sort((a, b) => Math.abs(pNum(a.id) - refNum) - Math.abs(pNum(b.id) - refNum));
                      const renderOpt = (p) => {
                        const entry = transitReco.find(r => r.portInterne.id === p.id);
                        const lbl = p.id;
                        const hint = entry ? ` — ${MATCH_LABELS[entry.matchType]}` : '';
                        return <option key={p.id} value={p.id} style={{ fontWeight: entry ? 700 : 400 }}>{lbl}{hint}</option>;
                      };
                      return (
                        <>
                          {recoGroup.length > 0 && <optgroup label="── Recommandés ──">{recoGroup.map(renderOpt)}</optgroup>}
                          {otherGroup.length > 0 && <optgroup label="── Autres ports iODF libres ──">{otherGroup.map(renderOpt)}</optgroup>}
                        </>
                      );
                    })()
              }
            </Sel>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: "10px", justifyContent: "space-between", marginTop: "4px" }}>
        <Btn onClick={() => {
          setErr("");
          if (n === 0) setStep("SELECT_SITES");
          else { setStep(`HOP_${n - 1}`); setCurrentHopIdx(n - 1); }
        }} variant="ghost" TH={TH}>‹ Retour</Btn>
        <Btn
          onClick={() => onNextHop(n)}
          disabled={
            n === 0
              ? !selectedHop.cableId
              : (
                  !selectedHop.cableId ||
                  !selectedHop.portEntree ||
                  !selectedHop.portTransitMid ||
                  (portTransitIn && selectedHop.portTransitMid && portTransitIn !== selectedHop.portTransitMid && !resolvedJarretieres?.j1) ||
                  (selectedHop.portTransitMid && selectedHop.portEntree && selectedHop.portTransitMid !== selectedHop.portEntree && !resolvedJarretieres?.j2)
                )
          }
          TH={TH}
        >
          {n + 1 < totalHops ? "Suivant — Liaison suivante ›" : "Suivant — Fournisseur ›"}
        </Btn>
      </div>
    </div>
  );
}
