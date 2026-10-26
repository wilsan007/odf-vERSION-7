// DocumentsView v7.1 — documents module
import React, { useState, useEffect, useMemo } from "react";
import {
  getInventaireDocuments, upsertInventaireDocument, deleteInventaireDocument,
  getInventaireItemsByDocument,
} from "../supabase.js";
import { Btn, Inp, Sel, Spinner, Modal, Field, Confirm } from "./common/UI.jsx";
import { exportCSV } from "./common/Utilities.js";
import { compareDocuments } from "./documents/compareEngine.js";

const NA = new Set(["", "N/A", "NA", "UNAVAIL", "NONE", "-"]);
const rv = (v) => (v && !NA.has(String(v).toUpperCase()) ? v : "");

function ChipStat({ TH, label, value, accent }) {
  return (
    <div style={{ textAlign: "center", minWidth: "84px" }}>
      <div className="font-syne" style={{ color: accent || TH.text1, fontSize: "22px", fontWeight: 800 }}>{value}</div>
      <div style={{ color: TH.text3, fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".3px" }}>{label}</div>
    </div>
  );
}

// Petite table de composants (ajoutés / retirés)
function MiniTable({ TH, items }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ fontSize: "12px" }}>
        <thead>
          <tr style={{ color: TH.text3, textAlign: "left" }}>
            {["Description", "Part Number", "N° Série", "Localisation"].map((h) => (
              <th key={h} style={{ padding: "6px 10px", fontWeight: 600, fontSize: "10.5px", borderBottom: `1px solid ${TH.border}`, whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={it.id || i} style={{ borderBottom: `1px solid ${TH.border}` }}>
              <td style={{ padding: "6px 10px", color: TH.text1 }}>{it.description || "—"}</td>
              <td style={{ padding: "6px 10px", color: TH.text2, whiteSpace: "nowrap" }} className="font-mono">{rv(it.part_number) || "—"}</td>
              <td style={{ padding: "6px 10px", color: TH.cyan, whiteSpace: "nowrap" }} className="font-mono">{rv(it.serial_nr) || "—"}</td>
              <td style={{ padding: "6px 10px", color: TH.text3, whiteSpace: "nowrap" }}>{[rv(it.bay_sn), rv(it.shelf_descrip), rv(it.loc_slot)].filter(Boolean).join(" / ") || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DocumentsView({ t, TH }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notReady, setNotReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [docForm, setDocForm] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [docA, setDocA] = useState("");
  const [docB, setDocB] = useState("");
  const [result, setResult] = useState(null);
  const [comparing, setComparing] = useState(false);
  const [openSec, setOpenSec] = useState({ added: true, removed: true, modified: true });

  const load = () => {
    setLoading(true);
    getInventaireDocuments()
      .then((d) => {
        if (d.error) { setNotReady(true); setLoading(false); return; }
        setNotReady(false);
        const list = d.data || [];
        setDocs(list);
        // Pré-sélection : deux révisions de la même station si possible
        if (!docA && list.length) {
          const byStation = {};
          list.forEach((x) => (byStation[x.station] ||= []).push(x));
          const pair = Object.values(byStation).find((g) => g.length >= 2);
          if (pair) { setDocA(pair[0].id); setDocB(pair[1].id); }
          else { setDocA(list[0].id); setDocB(list[Math.min(1, list.length - 1)].id); }
        }
        setLoading(false);
      })
      .catch(() => { setNotReady(true); setLoading(false); });
  };
  useEffect(() => { load(); }, []);

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(""), 2600); };

  const byStation = useMemo(() => {
    const g = {};
    for (const d of docs) (g[d.station] ||= []).push(d);
    Object.values(g).forEach((arr) => arr.sort((a, b) => String(b.issue || "").localeCompare(String(a.issue || ""))));
    return Object.entries(g).sort((a, b) => a[0].localeCompare(b[0]));
  }, [docs]);

  const docLabel = (d) => `${d.station} · Issue ${d.issue || "?"} · ${d.item_count ?? "?"} comp.`;
  const docById = (id) => docs.find((d) => d.id === id);

  const runCompare = async () => {
    if (!docA || !docB) { flash("Choisissez deux documents."); return; }
    if (docA === docB) { flash("Choisissez deux documents différents."); return; }
    setComparing(true); setResult(null);
    try {
      const [a, b] = await Promise.all([getInventaireItemsByDocument(docA), getInventaireItemsByDocument(docB)]);
      if (a.error || b.error) { flash("Erreur de chargement des composants."); setComparing(false); return; }
      setResult(compareDocuments(a.data || [], b.data || []));
    } catch (e) { flash("Erreur : " + (e?.message || e)); }
    finally { setComparing(false); }
  };

  const swap = () => { setDocA(docB); setDocB(docA); setResult(null); };

  const saveDoc = async () => {
    setBusy(true);
    try {
      const { error } = await upsertInventaireDocument(docForm);
      if (error) { flash("Erreur : " + error.message); return; }
      setDocForm(null); load();
    } catch (e) { flash("Erreur : " + (e?.message || e)); }
    finally { setBusy(false); }
  };

  const doDelete = async () => {
    setBusy(true);
    try {
      const { error } = await deleteInventaireDocument(confirm.id);
      if (error) { flash("Erreur : " + error.message); return; }
      setConfirm(null);
      if (docA === confirm.id) setDocA(""); if (docB === confirm.id) setDocB("");
      setResult(null); load();
    } catch (e) { flash("Erreur : " + (e?.message || e)); }
    finally { setBusy(false); }
  };

  const exportDiff = () => {
    if (!result) return;
    const rows = [
      ...result.added.map((it) => ({ Changement: "AJOUTÉ", Description: it.description, Part_Number: it.part_number, Serial: it.serial_nr, Champ: "", Avant: "", Après: "" })),
      ...result.removed.map((it) => ({ Changement: "RETIRÉ", Description: it.description, Part_Number: it.part_number, Serial: it.serial_nr, Champ: "", Avant: "", Après: "" })),
      ...result.modified.flatMap((m) => m.changes.map((c) => ({ Changement: "MODIFIÉ", Description: m.after.description, Part_Number: m.after.part_number, Serial: m.after.serial_nr, Champ: c.field, Avant: c.from, Après: c.to }))),
    ];
    if (rows.length) exportCSV(rows, `diff_${docA}_vs_${docB}.csv`);
  };

  const inp = (k) => (v) => setDocForm({ ...docForm, [k]: v });
  const toggleSec = (k) => setOpenSec((o) => ({ ...o, [k]: !o[k] }));

  if (loading) return <Spinner TH={TH} />;

  if (notReady) {
    return (
      <div style={{ padding: "40px", maxWidth: "620px", margin: "0 auto" }}>
        <div style={{ background: TH.bgCard, border: `1px solid ${TH.border}`, borderRadius: "16px", padding: "32px", textAlign: "center", boxShadow: TH.cardShadow }}>
          <div style={{ fontSize: "40px", marginBottom: "10px" }}>📄</div>
          <div className="font-syne" style={{ color: TH.text1, fontWeight: 800, fontSize: "20px", marginBottom: "8px" }}>Module Documents non initialisé</div>
          <div style={{ color: TH.text2, fontSize: "14px", lineHeight: 1.6 }}>
            Ce module s'appuie sur l'inventaire (v10). Appliquez{" "}
            <code style={{ color: TH.blue }}>20260712_v10_inventory_module.sql</code> et importez au moins un fichier.
          </div>
          <div style={{ marginTop: "18px" }}><Btn onClick={load} variant="outline" TH={TH}>Réessayer</Btn></div>
        </div>
      </div>
    );
  }

  const sec = (key, title, color, count, body) => (
    <div style={{ background: TH.bgCard, border: `1px solid ${TH.border}`, borderRadius: "10px", overflow: "hidden", marginTop: "10px" }}>
      <button onClick={() => toggleSec(key)} style={{ width: "100%", display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", background: "transparent", border: "none", borderBottom: openSec[key] ? `1px solid ${TH.border}` : "none" }}>
        <span style={{ color: TH.text3, fontSize: "12px" }}>{openSec[key] ? "▾" : "▸"}</span>
        <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: color }} />
        <span className="font-syne" style={{ color: TH.text1, fontWeight: 700, fontSize: "13px" }}>{title}</span>
        <span style={{ marginLeft: "auto", color, fontWeight: 700, fontSize: "13px" }}>{count}</span>
      </button>
      {openSec[key] && count > 0 && body}
      {openSec[key] && count === 0 && <div style={{ color: TH.text3, fontSize: "12px", padding: "10px 14px" }}>Aucun.</div>}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "16px 20px", borderBottom: `1px solid ${TH.border}`, flexShrink: 0 }}>
        <span className="font-syne" style={{ color: TH.text1, fontWeight: 700, fontSize: "15px" }}>Documents & Révisions As-Built</span>
        <span style={{ color: TH.text3, fontSize: "12px" }}>{docs.length} révision{docs.length > 1 ? "s" : ""} · {byStation.length} station{byStation.length > 1 ? "s" : ""}</span>
      </div>
      {msg && <div style={{ padding: "8px 20px", color: TH.blue, fontSize: "13px", background: TH.blueGlow }}>{msg}</div>}

      <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px" }}>
        {docs.length === 0 ? (
          <div style={{ textAlign: "center", color: TH.text2, padding: "56px 20px" }}>
            <div style={{ fontSize: "42px", marginBottom: "12px" }}>📄</div>
            <div className="font-syne" style={{ fontSize: "18px", fontWeight: 700, color: TH.text1, marginBottom: "6px" }}>Aucune révision</div>
            <div style={{ fontSize: "14px" }}>Importez des fichiers dans le module Inventaire ; chaque Issue apparaîtra ici.</div>
          </div>
        ) : (
          <>
            {/* ── Comparateur de révisions ─────────────────────────────────── */}
            <div style={{ background: TH.bgCard, border: `1px solid ${TH.border}`, borderRadius: "12px", padding: "16px", marginBottom: "20px", boxShadow: TH.cardShadow }}>
              <div className="font-syne" style={{ color: TH.text1, fontWeight: 700, fontSize: "14px", marginBottom: "12px" }}>Comparer deux révisions</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "flex-end" }}>
                <div style={{ flex: 1, minWidth: "200px" }}>
                  <Field label="Révision A (ancienne)" TH={TH}>
                    <Sel value={docA} onChange={(v) => { setDocA(v); setResult(null); }} TH={TH}>
                      <option value="">—</option>
                      {docs.map((d) => <option key={d.id} value={d.id}>{docLabel(d)}</option>)}
                    </Sel>
                  </Field>
                </div>
                <Btn onClick={swap} variant="ghost" size="sm" TH={TH}>⇄</Btn>
                <div style={{ flex: 1, minWidth: "200px" }}>
                  <Field label="Révision B (nouvelle)" TH={TH}>
                    <Sel value={docB} onChange={(v) => { setDocB(v); setResult(null); }} TH={TH}>
                      <option value="">—</option>
                      {docs.map((d) => <option key={d.id} value={d.id}>{docLabel(d)}</option>)}
                    </Sel>
                  </Field>
                </div>
                <Btn onClick={runCompare} variant="primary" TH={TH} disabled={comparing}>{comparing ? "Comparaison…" : "Comparer"}</Btn>
                {result && <Btn onClick={exportDiff} variant="outline" size="sm" TH={TH}>⬇ Diff CSV</Btn>}
              </div>
              {docA && docB && docById(docA)?.station !== docById(docB)?.station && (
                <div style={{ color: TH.gold, fontSize: "12px", marginTop: "8px" }}>⚠️ Vous comparez deux stations différentes — la comparaison est plus pertinente entre révisions d'une même station.</div>
              )}

              {comparing && <Spinner TH={TH} />}
              {result && (
                <div className="fade-up" style={{ marginTop: "14px" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "20px", padding: "12px 0", borderTop: `1px solid ${TH.border}` }}>
                    <ChipStat TH={TH} label="Rév. A" value={result.summary.a} />
                    <ChipStat TH={TH} label="Rév. B" value={result.summary.b} />
                    <ChipStat TH={TH} label="Ajoutés" value={result.summary.added} accent={TH.green} />
                    <ChipStat TH={TH} label="Retirés" value={result.summary.removed} accent={TH.red} />
                    <ChipStat TH={TH} label="Modifiés" value={result.summary.modified} accent={TH.gold} />
                    <ChipStat TH={TH} label="Inchangés" value={result.summary.unchanged} accent={TH.text2} />
                  </div>

                  {sec("added", "Composants ajoutés (dans B)", TH.green, result.summary.added, <MiniTable TH={TH} items={result.added} />)}
                  {sec("removed", "Composants retirés (absents de B)", TH.red, result.summary.removed, <MiniTable TH={TH} items={result.removed} />)}
                  {sec("modified", "Composants modifiés", TH.gold, result.summary.modified, (
                    <div style={{ padding: "6px 0" }}>
                      {result.modified.map((m, i) => (
                        <div key={m.after.id || i} style={{ padding: "8px 14px", borderBottom: `1px solid ${TH.border}` }}>
                          <div style={{ color: TH.text1, fontSize: "13px", fontWeight: 600 }}>
                            {m.after.description || "—"} <span style={{ color: TH.cyan }} className="font-mono">{rv(m.after.serial_nr)}</span>
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "4px" }}>
                            {m.changes.map((c, j) => (
                              <span key={j} style={{ fontSize: "11.5px", color: TH.text2, background: TH.bgHover, borderRadius: "6px", padding: "2px 8px" }}>
                                <b style={{ color: TH.text3 }}>{c.field}:</b> <span style={{ color: TH.red }}>{c.from}</span> → <span style={{ color: TH.green }}>{c.to}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Timeline des révisions par station ────────────────────────── */}
            {byStation.map(([station, revs]) => (
              <div key={station} style={{ marginBottom: "18px" }}>
                <div className="font-syne" style={{ color: TH.text2, fontWeight: 700, fontSize: "13px", marginBottom: "8px", textTransform: "uppercase", letterSpacing: ".5px" }}>{station}</div>
                {revs.map((d) => (
                  <div key={d.id} style={{ background: TH.bgCard, border: `1px solid ${TH.border}`, borderRadius: "12px", padding: "14px 16px", marginBottom: "10px", boxShadow: TH.cardShadow, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px" }}>
                    <span style={{ background: TH.blueGlow, color: TH.blue, borderRadius: "8px", padding: "4px 12px", fontWeight: 700, fontSize: "13px" }}>Issue {d.issue || "?"}</span>
                    <span style={{ color: TH.text2, fontSize: "13px" }}>{d.issue_date || "date ?"}</span>
                    <span style={{ color: TH.text3, fontSize: "12px" }}>{d.item_count ?? "?"} composants</span>
                    {d.owner_engineer && <span style={{ color: TH.text3, fontSize: "12px" }}>👤 {d.owner_engineer}</span>}
                    {d.approver && <span style={{ color: TH.text3, fontSize: "12px" }}>✓ {d.approver}</span>}
                    {d.reason && <span style={{ color: TH.text2, fontSize: "12px", fontStyle: "italic" }}>« {d.reason} »</span>}
                    <span style={{ color: TH.text3, fontSize: "11px", fontFamily: "monospace" }}>{d.id}</span>
                    <div style={{ marginLeft: "auto", display: "flex", gap: "6px" }}>
                      <Btn onClick={() => setDocForm({ ...d })} variant="ghost" size="sm" TH={TH}>✎</Btn>
                      <Btn onClick={() => setConfirm({ id: d.id, label: `${d.station} Issue ${d.issue || "?"}` })} variant="danger" size="sm" TH={TH}>🗑</Btn>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </>
        )}
      </div>

      {/* Modale édition métadonnées */}
      {docForm && (
        <Modal title="Métadonnées de la révision" onClose={() => setDocForm(null)} TH={TH} width="480px">
          <div style={{ display: "grid", gap: "12px" }}>
            <div style={{ color: TH.text3, fontSize: "12px" }}>{docForm.station} · <span className="font-mono">{docForm.id}</span></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Field label="Issue" TH={TH}><Inp value={docForm.issue || ""} onChange={inp("issue")} TH={TH} /></Field>
              <Field label="Date" TH={TH}><Inp type="date" value={docForm.issue_date || ""} onChange={inp("issue_date")} TH={TH} /></Field>
            </div>
            <Field label="Owner / Engineer" TH={TH}><Inp value={docForm.owner_engineer || ""} onChange={inp("owner_engineer")} TH={TH} /></Field>
            <Field label="Approver" TH={TH}><Inp value={docForm.approver || ""} onChange={inp("approver")} TH={TH} /></Field>
            <Field label="Raison du changement" TH={TH}><Inp value={docForm.reason || ""} onChange={inp("reason")} TH={TH} /></Field>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "6px" }}>
              <Btn onClick={() => setDocForm(null)} variant="ghost" TH={TH}>Annuler</Btn>
              <Btn onClick={saveDoc} variant="primary" TH={TH} disabled={busy}>Enregistrer</Btn>
            </div>
          </div>
        </Modal>
      )}

      {confirm && (
        <Confirm message={`Supprimer la révision « ${confirm.label} » et tous ses composants ?`} onYes={doDelete} onNo={() => setConfirm(null)} TH={TH} t={t} />
      )}
    </div>
  );
}
