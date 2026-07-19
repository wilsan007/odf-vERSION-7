import React, { useState, useEffect, useMemo } from "react";
import {
  getTopoSegments, createTopoSegment, updateTopoSegment, deleteTopoSegment,
  getTopoLinePairs, createTopoLinePair, updateTopoLinePair, deleteTopoLinePair,
  upsertTopoSegments, upsertTopoLinePairs, getTopoInventaire,
} from "../supabase.js";
import { Btn, Inp, Sel, Spinner, Modal, Field, Confirm } from "./common/UI.jsx";
import { exportCSV } from "./common/Utilities.js";
import TopoGraph from "./topology/TopoGraph.jsx";

const slug = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const SEG_STATUTS = ["ACTIF", "PLANIFIE", "HS"];
const LP_STATUTS = ["ACTIF", "RESERVE", "HS"];

function statutColor(TH, s) {
  if (s === "ACTIF") return { bg: "rgba(16,185,129,.15)", tx: TH.green, bd: TH.green };
  if (s === "HS")    return { bg: "rgba(248,113,113,.15)", tx: TH.red,   bd: TH.red };
  return { bg: "rgba(251,191,36,.15)", tx: TH.gold, bd: TH.gold }; // PLANIFIE / RESERVE
}
function Tag({ TH, s }) {
  const c = statutColor(TH, s);
  return <span style={{ background: c.bg, color: c.tx, border: `1px solid ${c.bd}`, borderRadius: "20px", padding: "1px 9px", fontSize: "10.5px", fontWeight: 600 }}>{s}</span>;
}

export default function TopologyView({ t, TH }) {
  const [segments, setSegments] = useState([]);
  const [linePairs, setLinePairs] = useState([]);
  const [bridge, setBridge] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notReady, setNotReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState({});
  const [segForm, setSegForm] = useState(null);   // objet en édition ou {} pour nouveau
  const [lpForm, setLpForm] = useState(null);      // { segment_id, ...lp }
  const [confirm, setConfirm] = useState(null);    // { type, id, label }
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState("list");   // 'list' | 'graph'

  const load = () => {
    setLoading(true);
    Promise.all([getTopoSegments(), getTopoLinePairs(), getTopoInventaire()])
      .then(([s, lp, br]) => {
        if (s.error) { setNotReady(true); setLoading(false); return; }
        setNotReady(false);
        setSegments(s.data || []);
        setLinePairs(lp.data || []);
        setBridge(br.error ? [] : (br.data || []));
        setLoading(false);
      })
      .catch(() => { setNotReady(true); setLoading(false); });
  };
  useEffect(() => { load(); }, []);

  const lpsBySeg = useMemo(() => {
    const m = {};
    for (const lp of linePairs) (m[lp.segment_id] ||= []).push(lp);
    return m;
  }, [linePairs]);

  // Pont inventaire indexé par station|segment
  const invBySegKey = useMemo(() => {
    const m = {};
    for (const r of bridge) {
      const k = `${slug(r.station)}|${slug(r.segment)}`;
      if (!m[k]) m[k] = { total: 0, slte: 0, pfe: 0, tems: 0, lps: new Set() };
      m[k].total += r.total_items || 0; m[k].slte += r.total_slte || 0;
      m[k].pfe += r.total_pfe || 0; m[k].tems += r.total_tems || 0;
      if (r.line_pair) m[k].lps.add(r.line_pair);
    }
    return m;
  }, [bridge]);

  // Filtrage des segments (recherche sur nom / stations / n° de line pair)
  const filteredSegments = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return segments;
    return segments.filter((seg) => {
      const lps = lpsBySeg[seg.id] || [];
      const hay = [seg.nom, seg.id, seg.station_a, seg.station_b, seg.remarques,
        ...lps.map((lp) => lp.numero)].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [segments, lpsBySeg, search]);

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(""), 2500); };

  // Export CSV de la topologie (segments + line pairs à plat)
  const doExport = () => {
    const rows = [];
    for (const seg of segments) {
      const lps = lpsBySeg[seg.id] || [];
      if (lps.length === 0) {
        rows.push({ Systeme: seg.systeme, Segment: seg.nom, Segment_ID: seg.id, Station_A: seg.station_a, Station_B: seg.station_b || "", Longueur_km: seg.longueur_km || "", Nb_Fibres: seg.nombre_fibres || "", Statut_Segment: seg.statut, Line_Pair: "", Statut_LP: "", Capacite_Gbps: "" });
      } else {
        for (const lp of lps) {
          rows.push({ Systeme: seg.systeme, Segment: seg.nom, Segment_ID: seg.id, Station_A: seg.station_a, Station_B: seg.station_b || "", Longueur_km: seg.longueur_km || "", Nb_Fibres: seg.nombre_fibres || "", Statut_Segment: seg.statut, Line_Pair: lp.numero, Statut_LP: lp.statut, Capacite_Gbps: lp.capacite_gbps || "" });
        }
      }
    }
    if (rows.length) exportCSV(rows, `topologie_dare1_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  // ── Générer segments + line pairs depuis l'inventaire ──────────────────────
  const generateFromInventory = async () => {
    setBusy(true);
    try {
      const { data, error } = await getTopoInventaire();
      if (error) { flash("Inventaire indisponible."); setBusy(false); return; }
      // Ignore les valeurs non significatives (N/A, NA, UNAVAIL…) de l'inventaire
      const isReal = (v) => v && !["N/A", "NA", "UNAVAIL", "NONE", "-"].includes(String(v).toUpperCase().trim());
      const segMap = {}; const lpMap = {};
      for (const r of (data || [])) {
        if (!isReal(r.segment)) continue;
        const id = `SEG-${slug(r.station)}-${slug(r.segment)}`;
        if (!segMap[id]) segMap[id] = { id, systeme: "DARE1", nom: r.segment, station_a: r.station, station_b: null, statut: "ACTIF" };
        if (isReal(r.line_pair)) {
          const lpId = `${id}-LP${slug(r.line_pair)}`;
          if (!lpMap[lpId]) lpMap[lpId] = { id: lpId, segment_id: id, systeme: "DARE1", numero: r.line_pair, station_a: r.station, statut: "ACTIF" };
        }
      }
      const segs = Object.values(segMap), lps = Object.values(lpMap);
      if (!segs.length) { flash("Aucun segment détecté dans l'inventaire."); setBusy(false); return; }
      const r1 = await upsertTopoSegments(segs);
      if (r1.error) { flash("Erreur : " + r1.error.message); setBusy(false); return; }
      if (lps.length) { const r2 = await upsertTopoLinePairs(lps); if (r2.error) { flash("Erreur LP : " + r2.error.message); setBusy(false); return; } }
      flash(`${segs.length} segment(s) et ${lps.length} line pair(s) générés.`);
      load();
    } catch (e) { flash("Erreur : " + (e?.message || e)); }
    finally { setBusy(false); }
  };

  // ── Sauvegarde segment ─────────────────────────────────────────────────────
  const saveSegment = async () => {
    const f = segForm;
    if (!f.station_a || !f.nom) { flash("Nom et station A requis."); return; }
    setBusy(true);
    try {
      const payload = { nom: f.nom, station_a: f.station_a, station_b: f.station_b || null, longueur_km: f.longueur_km || null, nombre_fibres: f.nombre_fibres || null, statut: f.statut || "ACTIF", remarques: f.remarques || null };
      let error;
      if (f.id && !f._new) {
        ({ error } = await updateTopoSegment(f.id, payload));
      } else {
        const id = `SEG-${slug(f.station_a)}-${slug(f.station_b || f.nom)}`;
        ({ error } = await createTopoSegment({ id, systeme: "DARE1", ...payload }));
      }
      if (error) { flash(error.code === "23505" ? "Ce segment existe déjà." : "Erreur : " + error.message); return; }
      setSegForm(null); load();
    } catch (e) { flash("Erreur : " + (e?.message || e)); }
    finally { setBusy(false); }
  };

  // ── Sauvegarde line pair ───────────────────────────────────────────────────
  const saveLinePair = async () => {
    const f = lpForm;
    if (!f.numero) { flash("Numéro de line pair requis."); return; }
    setBusy(true);
    try {
      const payload = { numero: f.numero, station_a: f.station_a || null, station_b: f.station_b || null, statut: f.statut || "ACTIF", capacite_gbps: f.capacite_gbps || null, remarques: f.remarques || null };
      let error;
      if (f.id && !f._new) {
        ({ error } = await updateTopoLinePair(f.id, payload));
      } else {
        const id = `${f.segment_id}-LP${slug(f.numero)}`;
        ({ error } = await createTopoLinePair({ id, segment_id: f.segment_id, systeme: "DARE1", ...payload }));
      }
      if (error) { flash(error.code === "23505" ? "Cette line pair existe déjà sur ce segment." : "Erreur : " + error.message); return; }
      setLpForm(null); load();
    } catch (e) { flash("Erreur : " + (e?.message || e)); }
    finally { setBusy(false); }
  };

  const doDelete = async () => {
    const c = confirm; setBusy(true);
    try {
      const { error } = c.type === "seg" ? await deleteTopoSegment(c.id) : await deleteTopoLinePair(c.id);
      if (error) { flash("Erreur : " + error.message); return; }
      setConfirm(null); load();
    } catch (e) { flash("Erreur : " + (e?.message || e)); }
    finally { setBusy(false); }
  };

  if (loading) return <Spinner TH={TH} />;

  if (notReady) {
    return (
      <div style={{ padding: "40px", maxWidth: "620px", margin: "0 auto" }}>
        <div style={{ background: TH.bgCard, border: `1px solid ${TH.border}`, borderRadius: "16px", padding: "32px", textAlign: "center", boxShadow: TH.cardShadow }}>
          <div style={{ fontSize: "40px", marginBottom: "10px" }}>🌐</div>
          <div className="font-syne" style={{ color: TH.text1, fontWeight: 800, fontSize: "20px", marginBottom: "8px" }}>Module Topologie non initialisé</div>
          <div style={{ color: TH.text2, fontSize: "14px", lineHeight: 1.6 }}>
            Appliquez la migration{" "}
            <code style={{ color: TH.blue }}>supabase/migrations/20260712_v11_topology_module.sql</code>, puis rechargez.
          </div>
          <div style={{ marginTop: "18px" }}><Btn onClick={load} variant="outline" TH={TH}>Réessayer</Btn></div>
        </div>
      </div>
    );
  }

  const inp = (f, k) => (v) => setSegForm({ ...f, [k]: v });
  const inpLp = (f, k) => (v) => setLpForm({ ...f, [k]: v });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Toolbar */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center", padding: "16px 20px", borderBottom: `1px solid ${TH.border}`, flexShrink: 0 }}>
        <span className="font-syne" style={{ color: TH.text1, fontWeight: 700, fontSize: "15px" }}>Topologie DARE1</span>
        <span style={{ color: TH.text3, fontSize: "12px" }}>{segments.length} segment{segments.length > 1 ? "s" : ""} · {linePairs.length} line pair{linePairs.length > 1 ? "s" : ""}</span>
        <div style={{ width: "200px" }}>
          <Inp value={search} onChange={setSearch} placeholder="Rechercher (segment, station, LP…)" TH={TH} />
        </div>
        <div style={{ display: "inline-flex", background: TH.bgInput, border: `1px solid ${TH.border}`, borderRadius: "8px", padding: "2px" }}>
          {[["list", "Liste"], ["graph", "Schéma"]].map(([k, lbl]) => (
            <button key={k} onClick={() => setMode(k)} style={{
              background: mode === k ? TH.blue : "transparent", color: mode === k ? "#fff" : TH.text2,
              border: "none", borderRadius: "6px", padding: "5px 12px", fontSize: "12px", fontWeight: 600, cursor: "pointer",
            }}>{lbl}</button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
          <Btn onClick={doExport} variant="outline" size="sm" TH={TH} disabled={!segments.length}>⬇ CSV</Btn>
          <Btn onClick={generateFromInventory} variant="outline" size="sm" TH={TH} disabled={busy}>⟲ Générer depuis l'inventaire</Btn>
          <Btn onClick={() => setSegForm({ _new: true, statut: "ACTIF" })} variant="primary" size="sm" TH={TH}>＋ Segment</Btn>
        </div>
      </div>

      {msg && <div style={{ padding: "8px 20px", color: TH.blue, fontSize: "13px", background: TH.blueGlow }}>{msg}</div>}

      {/* Corps */}
      <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px" }}>
        {segments.length === 0 ? (
          <div style={{ textAlign: "center", color: TH.text2, padding: "56px 20px" }}>
            <div style={{ fontSize: "42px", marginBottom: "12px" }}>🌐</div>
            <div className="font-syne" style={{ fontSize: "18px", fontWeight: 700, color: TH.text1, marginBottom: "6px" }}>Aucun segment</div>
            <div style={{ fontSize: "14px", marginBottom: "18px" }}>Générez la topologie depuis l'inventaire, ou ajoutez un segment manuellement.</div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <Btn onClick={generateFromInventory} variant="outline" TH={TH} disabled={busy}>⟲ Générer depuis l'inventaire</Btn>
              <Btn onClick={() => setSegForm({ _new: true, statut: "ACTIF" })} variant="primary" TH={TH}>＋ Segment</Btn>
            </div>
          </div>
        ) : mode === "graph" ? (
          <TopoGraph
            TH={TH}
            segments={filteredSegments}
            lpsBySeg={lpsBySeg}
            onPickStation={(st) => { setSearch(st); setMode("list"); }}
            onPickSegment={(s) => { setSearch(s.nom || s.id); setMode("list"); }}
          />
        ) : filteredSegments.length === 0 ? (
          <div style={{ textAlign: "center", color: TH.text3, padding: "40px" }}>Aucun segment pour « {search} ».</div>
        ) : filteredSegments.map((seg) => {
          const isOpen = open[seg.id] !== false;
          const lps = lpsBySeg[seg.id] || [];
          const inv = invBySegKey[`${slug(seg.station_a)}|${slug(seg.nom)}`];
          return (
            <div key={seg.id} style={{ background: TH.bgCard, border: `1px solid ${TH.border}`, borderRadius: "12px", marginBottom: "12px", overflow: "hidden", boxShadow: TH.cardShadow }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 16px", borderBottom: isOpen ? `1px solid ${TH.border}` : "none" }}>
                <button onClick={() => setOpen((o) => ({ ...o, [seg.id]: !isOpen }))} style={{ background: "none", border: "none", color: TH.text3, cursor: "pointer", fontSize: "12px" }}>{isOpen ? "▾" : "▸"}</button>
                <span className="font-syne" style={{ color: TH.text1, fontWeight: 700, fontSize: "14px" }}>{seg.nom || seg.id}</span>
                <span style={{ color: TH.text2, fontSize: "13px" }}>
                  {seg.station_a} <span style={{ color: TH.blue }}>↔</span> {seg.station_b || <span style={{ color: TH.text3 }}>? (à définir)</span>}
                </span>
                <Tag TH={TH} s={seg.statut} />
                {seg.nombre_fibres ? <span style={{ color: TH.text3, fontSize: "12px" }}>{seg.nombre_fibres} fibres</span> : null}
                {seg.longueur_km ? <span style={{ color: TH.text3, fontSize: "12px" }}>{seg.longueur_km} km</span> : null}
                {inv && <span title="Composants installés (inventaire)" style={{ background: TH.blueGlow, color: TH.blue, borderRadius: "6px", padding: "1px 8px", fontSize: "11px", fontWeight: 600 }}>📦 {inv.total} · SLTE {inv.slte} · PFE {inv.pfe}</span>}
                <div style={{ marginLeft: "auto", display: "flex", gap: "6px" }}>
                  <Btn onClick={() => setLpForm({ _new: true, segment_id: seg.id, station_a: seg.station_a, station_b: seg.station_b, statut: "ACTIF" })} variant="ghost" size="sm" TH={TH}>＋ LP</Btn>
                  <Btn onClick={() => setSegForm({ ...seg })} variant="ghost" size="sm" TH={TH}>✎</Btn>
                  <Btn onClick={() => setConfirm({ type: "seg", id: seg.id, label: seg.nom || seg.id })} variant="danger" size="sm" TH={TH}>🗑</Btn>
                </div>
              </div>
              {isOpen && (
                <div style={{ overflowX: "auto" }}>
                  {lps.length === 0 ? (
                    <div style={{ color: TH.text3, fontSize: "13px", padding: "12px 16px" }}>Aucune line pair. Ajoutez-en avec « ＋ LP ».</div>
                  ) : (
                    <table style={{ fontSize: "12.5px" }}>
                      <thead>
                        <tr style={{ color: TH.text3, textAlign: "left" }}>
                          {["Line Pair", "Station A", "Station B", "Statut", "Capacité", "Installé", ""].map((h) => (
                            <th key={h} style={{ padding: "8px 12px", fontWeight: 600, fontSize: "11px", whiteSpace: "nowrap", borderBottom: `1px solid ${TH.border}` }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {lps.map((lp) => (
                          <tr key={lp.id} style={{ borderBottom: `1px solid ${TH.border}` }}>
                            <td style={{ padding: "7px 12px", color: TH.text1, fontWeight: 600 }} className="font-mono">{lp.numero}</td>
                            <td style={{ padding: "7px 12px", color: TH.text2 }}>{lp.station_a || "—"}</td>
                            <td style={{ padding: "7px 12px", color: TH.text2 }}>{lp.station_b || "—"}</td>
                            <td style={{ padding: "7px 12px" }}><Tag TH={TH} s={lp.statut} /></td>
                            <td style={{ padding: "7px 12px", color: TH.text3 }}>{lp.capacite_gbps ? `${lp.capacite_gbps} Gbps` : "—"}</td>
                            <td style={{ padding: "7px 12px", color: inv?.lps?.has(lp.numero) ? TH.green : TH.text3, fontSize: "11px" }}>{inv?.lps?.has(lp.numero) ? "✓ inventorié" : "—"}</td>
                            <td style={{ padding: "7px 12px", textAlign: "right", whiteSpace: "nowrap" }}>
                              <Btn onClick={() => setLpForm({ ...lp })} variant="ghost" size="sm" TH={TH}>✎</Btn>{" "}
                              <Btn onClick={() => setConfirm({ type: "lp", id: lp.id, label: `LP ${lp.numero}` })} variant="danger" size="sm" TH={TH}>🗑</Btn>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modale segment */}
      {segForm && (
        <Modal title={segForm._new ? "Nouveau segment" : "Modifier le segment"} onClose={() => setSegForm(null)} TH={TH} width="480px">
          <div style={{ display: "grid", gap: "12px" }}>
            <Field label="Nom / n° segment (ex. S1)" TH={TH}><Inp value={segForm.nom || ""} onChange={inp(segForm, "nom")} TH={TH} /></Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Field label="Station A" TH={TH}><Inp value={segForm.station_a || ""} onChange={inp(segForm, "station_a")} TH={TH} /></Field>
              <Field label="Station B (extrémité)" TH={TH}><Inp value={segForm.station_b || ""} onChange={inp(segForm, "station_b")} TH={TH} /></Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
              <Field label="Longueur (km)" TH={TH}><Inp type="number" value={segForm.longueur_km || ""} onChange={inp(segForm, "longueur_km")} TH={TH} /></Field>
              <Field label="Nb fibres" TH={TH}><Inp type="number" value={segForm.nombre_fibres || ""} onChange={inp(segForm, "nombre_fibres")} TH={TH} /></Field>
              <Field label="Statut" TH={TH}><Sel value={segForm.statut || "ACTIF"} onChange={inp(segForm, "statut")} TH={TH}>{SEG_STATUTS.map((s) => <option key={s} value={s}>{s}</option>)}</Sel></Field>
            </div>
            <Field label="Remarques" TH={TH}><Inp value={segForm.remarques || ""} onChange={inp(segForm, "remarques")} TH={TH} /></Field>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "6px" }}>
              <Btn onClick={() => setSegForm(null)} variant="ghost" TH={TH}>Annuler</Btn>
              <Btn onClick={saveSegment} variant="primary" TH={TH} disabled={busy}>Enregistrer</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* Modale line pair */}
      {lpForm && (
        <Modal title={lpForm._new ? "Nouvelle line pair" : "Modifier la line pair"} onClose={() => setLpForm(null)} TH={TH} width="460px">
          <div style={{ display: "grid", gap: "12px" }}>
            <Field label="Numéro (ex. 1-3)" TH={TH}><Inp value={lpForm.numero || ""} onChange={inpLp(lpForm, "numero")} TH={TH} /></Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Field label="Station A" TH={TH}><Inp value={lpForm.station_a || ""} onChange={inpLp(lpForm, "station_a")} TH={TH} /></Field>
              <Field label="Station B" TH={TH}><Inp value={lpForm.station_b || ""} onChange={inpLp(lpForm, "station_b")} TH={TH} /></Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Field label="Statut" TH={TH}><Sel value={lpForm.statut || "ACTIF"} onChange={inpLp(lpForm, "statut")} TH={TH}>{LP_STATUTS.map((s) => <option key={s} value={s}>{s}</option>)}</Sel></Field>
              <Field label="Capacité (Gbps)" TH={TH}><Inp type="number" value={lpForm.capacite_gbps || ""} onChange={inpLp(lpForm, "capacite_gbps")} TH={TH} /></Field>
            </div>
            <Field label="Remarques" TH={TH}><Inp value={lpForm.remarques || ""} onChange={inpLp(lpForm, "remarques")} TH={TH} /></Field>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "6px" }}>
              <Btn onClick={() => setLpForm(null)} variant="ghost" TH={TH}>Annuler</Btn>
              <Btn onClick={saveLinePair} variant="primary" TH={TH} disabled={busy}>Enregistrer</Btn>
            </div>
          </div>
        </Modal>
      )}

      {confirm && (
        <Confirm message={`Supprimer « ${confirm.label} » ?`} onYes={doDelete} onNo={() => setConfirm(null)} TH={TH} t={t} />
      )}
    </div>
  );
}
