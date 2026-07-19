// MaintenanceView v7.1 — maintenance module
import React, { useState, useEffect, useMemo } from "react";
import {
  getInventaireDocuments, getInventaireItems, getMaintenances,
  updateItemLocation, getServiceForPort,
  createMaintenance, updateMaintenance, deleteMaintenance,
} from "../supabase.js";
import { Btn, Inp, Sel, Spinner, Modal, Field, Confirm } from "./common/UI.jsx";
import { exportCSV } from "./common/Utilities.js";
import MaintenanceCalendar from "./maintenance/Calendar.jsx";

const NA = new Set(["", "N/A", "NA", "UNAVAIL", "NONE", "-"]);
const rv = (v) => (v && !NA.has(String(v).toUpperCase()) ? v : "");
const TYPES = ["MAINTENANCE", "REMPLACEMENT", "RETRAIT", "MODIFICATION", "INSPECTION"];
const STATUTS = ["PLANIFIE", "EN_COURS", "FAIT", "ANNULE"];
const PRIOS = ["BASSE", "NORMALE", "HAUTE", "CRITIQUE"];
const CATS = ["SLTE", "LTE", "PSB", "PFE", "TEMS", "AUTRE"];

const NA_LOC = new Set(["", "N/A", "NA", "UNAVAIL", "NONE", "-"]);
const cleanLoc = (v) => (v && !NA_LOC.has(String(v).toUpperCase()) ? v : "");

const locString = (it) => {
  // 1. Champs de localisation physique (v13 — emp_*)
  const emp = [it.emp_salle, it.emp_halle, it.emp_niveau, it.emp_rack, it.emp_chassis, it.emp_position]
    .filter(Boolean).join(" · ");
  if (emp) return emp;
  // 2. Fallback : champs d'origine de l'import Excel (v10)
  const imp = [cleanLoc(it.equip_location), cleanLoc(it.loc_bay), cleanLoc(it.loc_shelf), cleanLoc(it.loc_slot)]
    .filter(Boolean).join(" · ");
  return imp || "";
};

function typeColor(TH, t) {
  if (t === "REMPLACEMENT") return TH.orange;
  if (t === "RETRAIT") return TH.red;
  if (t === "MODIFICATION") return TH.purple;
  if (t === "INSPECTION") return TH.cyan;
  return TH.blue;
}
function statutColor(TH, s, retard) {
  if (retard) return { bg: "rgba(248,113,113,.15)", tx: TH.red, bd: TH.red };
  if (s === "FAIT") return { bg: "rgba(16,185,129,.15)", tx: TH.green, bd: TH.green };
  if (s === "EN_COURS") return { bg: "rgba(59,130,246,.15)", tx: TH.blue, bd: TH.blue };
  if (s === "ANNULE") return { bg: TH.bgHover, tx: TH.text3, bd: TH.border2 };
  return { bg: "rgba(251,191,36,.15)", tx: TH.gold, bd: TH.gold }; // PLANIFIE
}
function prioColor(TH, p) {
  if (p === "CRITIQUE") return TH.red;
  if (p === "HAUTE") return TH.orange;
  if (p === "BASSE") return TH.text3;
  return TH.text2;
}
function Tag({ TH, text, color }) {
  return <span style={{ background: `${color}22`, color, border: `1px solid ${color}66`, borderRadius: "20px", padding: "1px 9px", fontSize: "10.5px", fontWeight: 600, whiteSpace: "nowrap" }}>{text}</span>;
}
function Stat({ TH, label, value, accent }) {
  return (
    <div style={{ background: TH.bgCard, border: `1px solid ${TH.border}`, borderRadius: "12px", padding: "12px 16px", minWidth: "110px", boxShadow: TH.cardShadow }}>
      <div style={{ color: TH.text3, fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".4px" }}>{label}</div>
      <div className="font-syne" style={{ color: accent || TH.text1, fontSize: "22px", fontWeight: 800, marginTop: "2px" }}>{value}</div>
    </div>
  );
}

export default function MaintenanceView({ t, TH, user }) {
  const [tab, setTab] = useState("pieces");
  const [stations, setStations] = useState([]);
  const [station, setStation] = useState("");
  const [items, setItems] = useState([]);
  const [maints, setMaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [notReady, setNotReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [fStatut, setFStatut] = useState("");
  const [planMode, setPlanMode] = useState("list"); // 'list' | 'calendar'
  const [locForm, setLocForm] = useState(null);
  const [maintForm, setMaintForm] = useState(null);
  const [resolved, setResolved] = useState(null); // {cid,label,statut}
  const [resolving, setResolving] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(""), 2600); };
  const userLabel = user?.name || user?.email || null;

  const loadBase = () => {
    setLoading(true);
    Promise.all([getInventaireDocuments(), getMaintenances()])
      .then(([d, m]) => {
        if (m.error || d.error) { setNotReady(true); setLoading(false); return; }
        setNotReady(false);
        const list = d.data || [];
        setStations([...new Set(list.map((x) => x.station))].filter(Boolean));
        setStation((prev) => prev || list[0]?.station || "");
        setMaints(m.data || []);
        setLoading(false);
      })
      .catch(() => { setNotReady(true); setLoading(false); });
  };
  useEffect(() => { loadBase(); }, []);

  const loadItems = (st) => {
    if (!st) { setItems([]); return; }
    setLoadingItems(true);
    getInventaireItems(st).then((r) => { setItems(r.data || []); setLoadingItems(false); }).catch(() => setLoadingItems(false));
  };
  useEffect(() => { loadItems(station); }, [station]);
  const reloadMaints = () => getMaintenances().then((m) => !m.error && setMaints(m.data || []));

  // Pièces avec maintenance ouverte (signalement)
  const openByItem = useMemo(() => {
    const m = {};
    for (const x of maints) if (["PLANIFIE", "EN_COURS"].includes(x.statut)) (m[x.item_id] ||= []).push(x);
    return m;
  }, [maints]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (catFilter && it.categorie !== catFilter) return false;
      if (!q) return true;
      return [it.description, it.serial_nr, it.part_number, locString(it), it.port_id]
        .filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [items, search, catFilter]);

  const filteredMaints = useMemo(() => {
    return maints.filter((m) => !fStatut || m.statut === fStatut);
  }, [maints, fStatut]);

  const mStats = useMemo(() => ({
    planifie: maints.filter((m) => m.statut === "PLANIFIE").length,
    encours: maints.filter((m) => m.statut === "EN_COURS").length,
    retard: maints.filter((m) => m.en_retard).length,
    fait: maints.filter((m) => m.statut === "FAIT").length,
  }), [maints]);

  // ── Résolution du CID service depuis un port ────────────────────────────────
  const resolvePort = async (portId) => {
    setResolved(null);
    if (!rv(portId)) return;
    setResolving(true);
    try { const { data } = await getServiceForPort(portId.trim()); setResolved(data || { none: true }); }
    catch { setResolved({ none: true }); }
    finally { setResolving(false); }
  };

  // ── Localisation ────────────────────────────────────────────────────────────
  const openLoc = (it) => {
    setResolved(null);
    setLocForm({ id: it.id, description: it.description, serial_nr: it.serial_nr,
      emp_salle: it.emp_salle || "", emp_halle: it.emp_halle || "", emp_niveau: it.emp_niveau || "",
      emp_rack: it.emp_rack || "", emp_chassis: it.emp_chassis || "", emp_position: it.emp_position || "",
      port_id: it.port_id || "" });
    if (it.port_id) resolvePort(it.port_id);
  };
  const saveLoc = async () => {
    setBusy(true);
    try {
      const f = locForm;
      const { error } = await updateItemLocation(f.id, {
        emp_salle: f.emp_salle || null, emp_halle: f.emp_halle || null, emp_niveau: f.emp_niveau || null,
        emp_rack: f.emp_rack || null, emp_chassis: f.emp_chassis || null, emp_position: f.emp_position || null,
        port_id: rv(f.port_id) ? f.port_id.trim() : null,
      });
      if (error) { flash("Erreur : " + error.message); return; }
      setLocForm(null); loadItems(station);
    } catch (e) { flash("Erreur : " + (e?.message || e)); }
    finally { setBusy(false); }
  };

  // ── Maintenance ─────────────────────────────────────────────────────────────
  const openMaint = (it = null, existing = null) => {
    setResolved(null);
    if (existing) {
      setMaintForm({ ...existing });
      if (existing.port_id) resolvePort(existing.port_id);
    } else {
      const base = { _new: true, item_id: it?.id || "", station: it?.station || station,
        type: "MAINTENANCE", statut: "PLANIFIE", priorite: "NORMALE",
        date_prevue: new Date().toISOString().slice(0, 10), titre: "", description: "", assigne: "",
        port_id: it?.port_id || "", service_cid: "", service_label: "",
        _itemLabel: it ? `${it.description || ""} ${rv(it.serial_nr) || ""}`.trim() : "" };
      setMaintForm(base);
      if (it?.port_id) resolvePort(it.port_id);
    }
  };
  const saveMaint = async () => {
    const f = maintForm;
    if (!f.item_id) { flash("Sélectionnez une pièce."); return; }
    if (!f.date_prevue) { flash("La date prévue est obligatoire."); return; }
    setBusy(true);
    try {
      const cid = f.service_cid || (resolved && !resolved.none ? resolved.cid : null);
      const label = f.service_label || (resolved && !resolved.none ? resolved.label : null);
      const payload = {
        item_id: f.item_id, station: f.station || station, type: f.type, statut: f.statut,
        priorite: f.priorite, date_prevue: f.date_prevue, date_realisee: f.date_realisee || null,
        titre: f.titre || null, description: f.description || null, assigne: f.assigne || null,
        port_id: rv(f.port_id) ? f.port_id.trim() : null, service_cid: cid, service_label: label,
      };
      let error;
      if (f._new) ({ error } = await createMaintenance({ ...payload, created_by: userLabel }));
      else ({ error } = await updateMaintenance(f.id, payload));
      if (error) { flash("Erreur : " + error.message); return; }
      setMaintForm(null); reloadMaints();
    } catch (e) { flash("Erreur : " + (e?.message || e)); }
    finally { setBusy(false); }
  };
  const quickStatut = async (m, statut) => {
    setBusy(true);
    try {
      const patch = { statut };
      if (statut === "FAIT" && !m.date_realisee) patch.date_realisee = new Date().toISOString().slice(0, 10);
      const { error } = await updateMaintenance(m.id, patch);
      if (error) { flash("Erreur : " + error.message); return; }
      reloadMaints();
    } finally { setBusy(false); }
  };
  const doDelete = async () => {
    setBusy(true);
    try { const { error } = await deleteMaintenance(confirm.id); if (error) { flash("Erreur : " + error.message); return; } setConfirm(null); reloadMaints(); }
    finally { setBusy(false); }
  };

  const exportMaints = () => {
    const rows = filteredMaints.map((m) => ({
      Type: m.type, Statut: m.statut, Retard: m.en_retard ? "OUI" : "", Priorite: m.priorite,
      Date_prevue: m.date_prevue, Date_realisee: m.date_realisee || "", Station: m.station,
      Piece: m.item_description, Serial: m.item_serial, Titre: m.titre, Assigne: m.assigne || "",
      Port: m.port_id || "", Service_CID: m.service_cid || "",
    }));
    if (rows.length) exportCSV(rows, `maintenances_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const inpLoc = (k) => (v) => setLocForm({ ...locForm, [k]: v });
  const inpM = (k) => (v) => setMaintForm({ ...maintForm, [k]: v });

  if (loading) return <Spinner TH={TH} />;

  if (notReady) {
    return (
      <div style={{ padding: "40px", maxWidth: "640px", margin: "0 auto" }}>
        <div style={{ background: TH.bgCard, border: `1px solid ${TH.border}`, borderRadius: "16px", padding: "32px", textAlign: "center", boxShadow: TH.cardShadow }}>
          <div style={{ fontSize: "40px", marginBottom: "10px" }}>🔧</div>
          <div className="font-syne" style={{ color: TH.text1, fontWeight: 800, fontSize: "20px", marginBottom: "8px" }}>Module Maintenance non initialisé</div>
          <div style={{ color: TH.text2, fontSize: "14px", lineHeight: 1.6 }}>
            Appliquez la migration{" "}
            <code style={{ color: TH.blue }}>supabase/migrations/20260712_v13_maintenance_module.sql</code> (nécessite l'inventaire v10), puis rechargez.
          </div>
          <div style={{ marginTop: "18px" }}><Btn onClick={loadBase} variant="outline" TH={TH}>Réessayer</Btn></div>
        </div>
      </div>
    );
  }

  const cidBox = (
    <div style={{ marginTop: "4px", minHeight: "20px" }}>
      {resolving && <span style={{ color: TH.text3, fontSize: "12px" }}>Résolution du service…</span>}
      {resolved && !resolved.none && (
        <span style={{ color: TH.green, fontSize: "12.5px", fontWeight: 600 }}>
          ⚡ Service desservi — CID <span className="font-mono">{resolved.cid}</span>
          {resolved.label ? ` · ${resolved.label}` : ""}{resolved.statut ? ` (${resolved.statut})` : ""}
        </span>
      )}
      {resolved && resolved.none && <span style={{ color: TH.text3, fontSize: "12px" }}>Aucun service actif rattaché à ce port.</span>}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Onglets */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "14px 20px 0", borderBottom: `1px solid ${TH.border}`, flexShrink: 0 }}>
        {[["pieces", "Pièces & localisation"], ["planning", "Planning maintenance"]].map(([k, lbl]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            background: "transparent", border: "none", borderBottom: tab === k ? `2px solid ${TH.blue}` : "2px solid transparent",
            color: tab === k ? TH.text1 : TH.text3, fontWeight: 700, fontSize: "13px", padding: "8px 6px 12px", cursor: "pointer",
          }}>{lbl}{k === "planning" && mStats.retard > 0 ? <span style={{ marginLeft: 6, background: TH.red, color: "#fff", borderRadius: 10, fontSize: 10, padding: "1px 6px" }}>{mStats.retard}</span> : null}</button>
        ))}
      </div>
      {msg && <div style={{ padding: "8px 20px", color: TH.blue, fontSize: "13px", background: TH.blueGlow }}>{msg}</div>}

      {/* ─────────────────────────── ONGLET PIÈCES ─────────────────────────── */}
      {tab === "pieces" && (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center", padding: "14px 20px", borderBottom: `1px solid ${TH.border}` }}>
            <div style={{ minWidth: "150px" }}>
              <Sel value={station} onChange={setStation} TH={TH}>
                {stations.length === 0 && <option value="">— station —</option>}
                {stations.map((s) => <option key={s} value={s}>{s}</option>)}
              </Sel>
            </div>
            <div style={{ flex: 1, minWidth: "180px" }}><Inp value={search} onChange={setSearch} placeholder="Rechercher (n° série, description, emplacement, port…)" TH={TH} /></div>
            <div style={{ width: "130px" }}>
              <Sel value={catFilter} onChange={setCatFilter} TH={TH}>
                <option value="">Toutes cat.</option>
                {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
              </Sel>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
            {loadingItems ? <Spinner TH={TH} /> : (
              <>
                <div style={{ color: TH.text3, fontSize: "12px", marginBottom: "10px" }}>{filteredItems.length} pièce(s)</div>
                <div style={{ background: TH.bgCard, border: `1px solid ${TH.border}`, borderRadius: "12px", overflow: "hidden", boxShadow: TH.cardShadow }}>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ fontSize: "12.5px" }}>
                      <thead>
                        <tr style={{ color: TH.text3, textAlign: "left" }}>
                          {["", "Description", "N° Série", "Cat.", "Localisation", "Port relié", "Actions"].map((h) => (
                            <th key={h} style={{ padding: "8px 12px", fontWeight: 600, fontSize: "11px", whiteSpace: "nowrap", borderBottom: `1px solid ${TH.border}`, position: "sticky", top: 0, background: TH.bgCard }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredItems.map((it) => {
                          const loc = locString(it);
                          const open = openByItem[it.id];
                          return (
                            <tr key={it.id} style={{ borderBottom: `1px solid ${TH.border}` }}>
                              <td style={{ padding: "7px 10px", textAlign: "center" }}>
                                {open && <span title={`${open.length} maintenance(s) planifiée(s)`} style={{ fontSize: "13px" }}>🔧</span>}
                              </td>
                              <td style={{ padding: "7px 12px", color: TH.text1 }}>{it.description || "—"}</td>
                              <td style={{ padding: "7px 12px", color: TH.cyan, whiteSpace: "nowrap" }} className="font-mono">{rv(it.serial_nr) || "—"}</td>
                              <td style={{ padding: "7px 12px" }}><span style={{ background: TH.blueGlow, color: TH.blue, borderRadius: "5px", padding: "1px 7px", fontSize: "10.5px", fontWeight: 700 }}>{it.categorie}</span></td>
                              <td style={{ padding: "7px 12px", color: loc ? TH.text2 : TH.text3, maxWidth: "220px" }}>{loc || <span style={{ fontStyle: "italic" }}>Non localisé</span>}</td>
                              <td style={{ padding: "7px 12px", color: it.port_id ? TH.text2 : TH.text3, whiteSpace: "nowrap" }} className="font-mono">{it.port_id || "—"}</td>
                              <td style={{ padding: "7px 12px", whiteSpace: "nowrap" }}>
                                <Btn onClick={() => openLoc(it)} variant="ghost" size="sm" TH={TH}>📍 Localiser</Btn>{" "}
                                <Btn onClick={() => openMaint(it)} variant="outline" size="sm" TH={TH}>🔧 Planifier</Btn>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
                {!filteredItems.length && <div style={{ textAlign: "center", color: TH.text3, padding: "30px" }}>Aucune pièce.</div>}
              </>
            )}
          </div>
        </>
      )}

      {/* ─────────────────────────── ONGLET PLANNING ───────────────────────── */}
      {tab === "planning" && (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center", padding: "14px 20px", borderBottom: `1px solid ${TH.border}` }}>
            <div style={{ width: "150px" }}>
              <Sel value={fStatut} onChange={setFStatut} TH={TH}>
                <option value="">Tous statuts</option>
                {STATUTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </Sel>
            </div>
            <div style={{ display: "inline-flex", background: TH.bgInput, border: `1px solid ${TH.border}`, borderRadius: "8px", padding: "2px" }}>
              {[["list", "Liste"], ["calendar", "Calendrier"]].map(([k, lbl]) => (
                <button key={k} onClick={() => setPlanMode(k)} style={{
                  background: planMode === k ? TH.blue : "transparent", color: planMode === k ? "#fff" : TH.text2,
                  border: "none", borderRadius: "6px", padding: "5px 12px", fontSize: "12px", fontWeight: 600, cursor: "pointer",
                }}>{lbl}</button>
              ))}
            </div>
            <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
              <Btn onClick={exportMaints} variant="outline" size="sm" TH={TH} disabled={!filteredMaints.length}>⬇ CSV</Btn>
              <Btn onClick={() => openMaint()} variant="primary" size="sm" TH={TH}>＋ Planifier</Btn>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
              <Stat TH={TH} label="Planifiées" value={mStats.planifie} accent={TH.gold} />
              <Stat TH={TH} label="En cours" value={mStats.encours} accent={TH.blue} />
              <Stat TH={TH} label="En retard" value={mStats.retard} accent={TH.red} />
              <Stat TH={TH} label="Réalisées" value={mStats.fait} accent={TH.green} />
            </div>
            {planMode === "calendar" ? (
              <MaintenanceCalendar TH={TH} maints={filteredMaints} onPick={(m) => openMaint(null, m)} />
            ) : filteredMaints.length === 0 ? (
              <div style={{ textAlign: "center", color: TH.text2, padding: "50px 20px" }}>
                <div style={{ fontSize: "40px", marginBottom: "10px" }}>🗓️</div>
                <div className="font-syne" style={{ fontSize: "17px", fontWeight: 700, color: TH.text1, marginBottom: "6px" }}>Aucune maintenance planifiée</div>
                <div style={{ fontSize: "14px", marginBottom: "16px" }}>Planifiez une opération depuis l'onglet « Pièces » ou avec « ＋ Planifier ».</div>
              </div>
            ) : filteredMaints.map((m) => {
              const sc = statutColor(TH, m.statut, m.en_retard);
              return (
                <div key={m.id} style={{ background: TH.bgCard, border: `1px solid ${m.en_retard ? TH.red : TH.border}`, borderRadius: "12px", padding: "12px 16px", marginBottom: "10px", boxShadow: TH.cardShadow }}>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px" }}>
                    <span className="font-syne" style={{ color: m.en_retard ? TH.red : TH.text1, fontWeight: 800, fontSize: "13px", minWidth: "88px" }}>{m.date_prevue}</span>
                    <Tag TH={TH} text={m.type} color={typeColor(TH, m.type)} />
                    <Tag TH={TH} text={m.priorite} color={prioColor(TH, m.priorite)} />
                    <span style={{ color: TH.text1, fontSize: "13px", fontWeight: 600 }}>{m.titre || m.item_description || "—"}</span>
                    <span style={{ color: TH.cyan, fontSize: "12px" }} className="font-mono">{rv(m.item_serial)}</span>
                    <span style={{ ...sc, background: sc.bg, color: sc.tx, border: `1px solid ${sc.bd}`, borderRadius: "20px", padding: "1px 9px", fontSize: "10.5px", fontWeight: 600 }}>{m.en_retard ? "EN RETARD" : m.statut}</span>
                    <div style={{ marginLeft: "auto", display: "flex", gap: "5px" }}>
                      {m.statut === "PLANIFIE" && <Btn onClick={() => quickStatut(m, "EN_COURS")} variant="ghost" size="sm" TH={TH}>▶ Démarrer</Btn>}
                      {["PLANIFIE", "EN_COURS"].includes(m.statut) && <Btn onClick={() => quickStatut(m, "FAIT")} variant="success" size="sm" TH={TH}>✓ Fait</Btn>}
                      <Btn onClick={() => openMaint(null, m)} variant="ghost" size="sm" TH={TH}>✎</Btn>
                      <Btn onClick={() => setConfirm({ id: m.id, label: m.titre || m.item_description || `#${m.id}` })} variant="danger" size="sm" TH={TH}>🗑</Btn>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", marginTop: "6px", color: TH.text3, fontSize: "12px" }}>
                    <span>🏢 {m.station || "—"}</span>
                    {m.assigne && <span>👤 {m.assigne}</span>}
                    {m.port_id && <span className="font-mono">🔌 {m.port_id}</span>}
                    {m.service_cid && <span style={{ color: TH.orange, fontWeight: 600 }}>⚡ CID {m.service_cid} — impact service !</span>}
                    {m.date_realisee && <span style={{ color: TH.green }}>✓ réalisé le {m.date_realisee}</span>}
                  </div>
                  {m.description && <div style={{ color: TH.text2, fontSize: "12.5px", marginTop: "4px" }}>{m.description}</div>}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Modale localisation */}
      {locForm && (
        <Modal title="Localiser la pièce" onClose={() => setLocForm(null)} TH={TH} width="520px">
          <div style={{ display: "grid", gap: "12px" }}>
            <div style={{ color: TH.text2, fontSize: "13px" }}>{locForm.description} · <span className="font-mono" style={{ color: TH.cyan }}>{rv(locForm.serial_nr) || "sans n° série"}</span></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
              <Field label="Salle" TH={TH}><Inp value={locForm.emp_salle} onChange={inpLoc("emp_salle")} TH={TH} /></Field>
              <Field label="Halle" TH={TH}><Inp value={locForm.emp_halle} onChange={inpLoc("emp_halle")} TH={TH} /></Field>
              <Field label="Niveau" TH={TH}><Inp value={locForm.emp_niveau} onChange={inpLoc("emp_niveau")} TH={TH} /></Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
              <Field label="Rack / Baie" TH={TH}><Inp value={locForm.emp_rack} onChange={inpLoc("emp_rack")} TH={TH} /></Field>
              <Field label="Châssis" TH={TH}><Inp value={locForm.emp_chassis} onChange={inpLoc("emp_chassis")} TH={TH} /></Field>
              <Field label="Position / Slot" TH={TH}><Inp value={locForm.emp_position} onChange={inpLoc("emp_position")} TH={TH} /></Field>
            </div>
            <Field label="Port ODF relié (id) — pour récupérer le CID du service" TH={TH}>
              <div style={{ display: "flex", gap: "8px" }}>
                <Inp value={locForm.port_id} onChange={inpLoc("port_id")} placeholder="ex. ALP-S1-R1-ODF1_S01P01" TH={TH} />
                <Btn onClick={() => resolvePort(locForm.port_id)} variant="outline" size="sm" TH={TH} disabled={resolving}>Vérifier</Btn>
              </div>
            </Field>
            {cidBox}
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "4px" }}>
              <Btn onClick={() => setLocForm(null)} variant="ghost" TH={TH}>Annuler</Btn>
              <Btn onClick={saveLoc} variant="primary" TH={TH} disabled={busy}>Enregistrer</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* Modale maintenance */}
      {maintForm && (
        <Modal title={maintForm._new ? "Planifier une opération" : "Modifier l'opération"} onClose={() => setMaintForm(null)} TH={TH} width="540px">
          <div style={{ display: "grid", gap: "12px" }}>
            {maintForm._new && !maintForm._itemLabel ? (
              <Field label="Pièce concernée" TH={TH}>
                <Sel value={maintForm.item_id} onChange={inpM("item_id")} TH={TH}>
                  <option value="">— choisir une pièce ({station}) —</option>
                  {items.map((it) => <option key={it.id} value={it.id}>{(it.description || "?").slice(0, 40)} · {rv(it.serial_nr) || "s/n"}</option>)}
                </Sel>
              </Field>
            ) : (
              <div style={{ color: TH.text2, fontSize: "13px" }}>Pièce : {maintForm._itemLabel || maintForm.item_description} {maintForm.item_serial ? <span className="font-mono" style={{ color: TH.cyan }}>· {rv(maintForm.item_serial)}</span> : null}</div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
              <Field label="Type" TH={TH}><Sel value={maintForm.type} onChange={inpM("type")} TH={TH}>{TYPES.map((x) => <option key={x} value={x}>{x}</option>)}</Sel></Field>
              <Field label="Priorité" TH={TH}><Sel value={maintForm.priorite} onChange={inpM("priorite")} TH={TH}>{PRIOS.map((x) => <option key={x} value={x}>{x}</option>)}</Sel></Field>
              <Field label="Statut" TH={TH}><Sel value={maintForm.statut} onChange={inpM("statut")} TH={TH}>{STATUTS.map((x) => <option key={x} value={x}>{x}</option>)}</Sel></Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <Field label="Date prévue *" TH={TH}><Inp type="date" value={maintForm.date_prevue} onChange={inpM("date_prevue")} TH={TH} /></Field>
              <Field label="Assigné à" TH={TH}><Inp value={maintForm.assigne} onChange={inpM("assigne")} TH={TH} /></Field>
            </div>
            <Field label="Titre" TH={TH}><Inp value={maintForm.titre} onChange={inpM("titre")} placeholder="ex. Remplacement carte LME défaillante" TH={TH} /></Field>
            <Field label="Description / consignes" TH={TH}><Inp value={maintForm.description} onChange={inpM("description")} TH={TH} /></Field>
            <Field label="Port relié (id) — impact service" TH={TH}>
              <div style={{ display: "flex", gap: "8px" }}>
                <Inp value={maintForm.port_id} onChange={inpM("port_id")} placeholder="ex. ALP-S1-R1-ODF1_S01P01" TH={TH} />
                <Btn onClick={() => resolvePort(maintForm.port_id)} variant="outline" size="sm" TH={TH} disabled={resolving}>Vérifier CID</Btn>
              </div>
            </Field>
            {cidBox}
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "4px" }}>
              <Btn onClick={() => setMaintForm(null)} variant="ghost" TH={TH}>Annuler</Btn>
              <Btn onClick={saveMaint} variant="primary" TH={TH} disabled={busy}>{maintForm._new ? "Planifier" : "Enregistrer"}</Btn>
            </div>
          </div>
        </Modal>
      )}

      {confirm && <Confirm message={`Supprimer la maintenance « ${confirm.label} » ?`} onYes={doDelete} onNo={() => setConfirm(null)} TH={TH} t={t} />}
    </div>
  );
}
