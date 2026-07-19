import React, { useState, useEffect, useMemo } from "react";
import { getInventaireDocuments, getInventaireItems, getInventaireStats } from "../supabase.js";
import { Btn, Inp, Sel, Spinner } from "./common/UI.jsx";
import { exportCSV } from "./common/Utilities.js";
import ImportModal from "./inventory/ImportModal.jsx";

const CATS = ["SLTE", "LTE", "PSB", "PFE", "TEMS", "AUTRE"];
const NA = new Set(["", "N/A", "NA", "UNAVAIL", "NONE", "-"]);
const rv = (v) => (v && !NA.has(String(v).toUpperCase()) ? v : "");

const MODES = [
  { key: "bay",      label: "Baie" },
  { key: "bayShelf", label: "Baie › Tiroir" },
  { key: "flat",     label: "Table plate" },
];

function statutColor(TH, s) {
  switch (s) {
    case "EQUIPE":     return { bg: "rgba(16,185,129,.15)", tx: TH.green,  bd: TH.green };
    case "MISSING":    return { bg: "rgba(248,113,113,.15)", tx: TH.red,    bd: TH.red };
    case "UNEQUIPPED": return { bg: TH.bgHover,              tx: TH.text3,  bd: TH.border2 };
    default:           return { bg: "rgba(251,191,36,.15)",  tx: TH.gold,   bd: TH.gold };
  }
}

function Stat({ TH, label, value, accent }) {
  return (
    <div style={{
      background: TH.bgCard, border: `1px solid ${TH.border}`, borderRadius: "12px",
      padding: "12px 16px", minWidth: "110px", boxShadow: TH.cardShadow
    }}>
      <div style={{ color: TH.text3, fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".4px" }}>{label}</div>
      <div className="font-syne" style={{ color: accent || TH.text1, fontSize: "22px", fontWeight: 800, marginTop: "2px" }}>{value}</div>
    </div>
  );
}

// Cellule statut réutilisable
function StatutTag({ TH, s }) {
  const sc = statutColor(TH, s);
  return (
    <span style={{
      background: sc.bg, color: sc.tx, border: `1px solid ${sc.bd}`,
      borderRadius: "20px", padding: "1px 9px", fontSize: "10.5px", fontWeight: 600, whiteSpace: "nowrap"
    }}>{s}</span>
  );
}

// Tableau de composants réutilisé (modes Baie et Baie › Tiroir)
function ComponentTable({ TH, items, showShelf = true }) {
  const cols = showShelf
    ? ["Tiroir", "Slot", "Description", "Part Number", "Version", "N° Série", "Statut"]
    : ["Slot", "Description", "Part Number", "Version", "N° Série", "Statut"];
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ fontSize: "12.5px" }}>
        <thead>
          <tr style={{ color: TH.text3, textAlign: "left" }}>
            {cols.map((h) => (
              <th key={h} style={{ padding: "8px 12px", fontWeight: 600, fontSize: "11px", whiteSpace: "nowrap", borderBottom: `1px solid ${TH.border}` }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id} style={{ borderBottom: `1px solid ${TH.border}` }}>
              {showShelf && <td style={{ padding: "7px 12px", color: TH.text2, whiteSpace: "nowrap" }}>{rv(it.shelf_descrip) || "—"}</td>}
              <td style={{ padding: "7px 12px", color: TH.text2, whiteSpace: "nowrap" }} className="font-mono">{rv(it.loc_slot) || "—"}</td>
              <td style={{ padding: "7px 12px", color: TH.text1 }}>
                {it.description || "—"}
                {it.is_spare && <span style={{ marginLeft: "6px", color: TH.gold, fontSize: "10px", fontWeight: 700 }}>SPARE</span>}
              </td>
              <td style={{ padding: "7px 12px", color: TH.text2, whiteSpace: "nowrap" }} className="font-mono">{rv(it.part_number) || "—"}</td>
              <td style={{ padding: "7px 12px", color: TH.text3, whiteSpace: "nowrap" }}>{rv(it.version) || "—"}</td>
              <td style={{ padding: "7px 12px", color: TH.cyan, whiteSpace: "nowrap" }} className="font-mono">{rv(it.serial_nr) || "—"}</td>
              <td style={{ padding: "7px 12px" }}><StatutTag TH={TH} s={it.statut_inventaire} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function InventoryView({ t, TH }) {
  const [docs, setDocs] = useState([]);
  const [stats, setStats] = useState([]);
  const [station, setStation] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [notReady, setNotReady] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [spareOnly, setSpareOnly] = useState(false);
  const [mode, setMode] = useState("bay");
  const [openGroups, setOpenGroups] = useState({});
  const [openShelves, setOpenShelves] = useState({});
  const [sort, setSort] = useState({ k: "bay_sn", dir: 1 });
  const [page, setPage] = useState(0);
  const PER_PAGE = 60;

  const loadDocs = () => {
    setLoading(true);
    Promise.all([getInventaireDocuments(), getInventaireStats()])
      .then(([d, s]) => {
        if (d.error) { setNotReady(true); setLoading(false); return; }
        setNotReady(false);
        const list = d.data || [];
        setDocs(list);
        setStats(s.data || []);
        setStation((prev) => prev || list[0]?.station || "");
        setLoading(false);
      })
      .catch(() => { setNotReady(true); setLoading(false); });
  };
  useEffect(() => { loadDocs(); }, []);

  useEffect(() => {
    if (!station) { setItems([]); return; }
    setLoadingItems(true);
    getInventaireItems(station)
      .then((r) => { setItems(r.data || []); setLoadingItems(false); })
      .catch(() => setLoadingItems(false));
  }, [station]);

  useEffect(() => { setPage(0); }, [station, search, catFilter, spareOnly, mode]);

  const stationStat = stats.find((s) => s.station === station);
  const stationsList = useMemo(
    () => [...new Set([...docs.map((d) => d.station), ...stats.map((s) => s.station)])].filter(Boolean),
    [docs, stats]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (catFilter && it.categorie !== catFilter) return false;
      if (spareOnly && !it.is_spare) return false;
      if (!q) return true;
      const hay = [it.description, it.part_number, it.serial_nr, it.equip_type,
        it.bay_sn, it.shelf_descrip, it.loc_slot, it.segment, it.line_pair]
        .filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [items, search, catFilter, spareOnly]);

  // Groupement par baie (modes bay + bayShelf)
  const groups = useMemo(() => {
    const g = {};
    for (const it of filtered) {
      const bay = rv(it.bay_sn);
      const key = bay || `${rv(it.equip_type) || it.categorie}|${it.sheet_name}`;
      if (!g[key]) {
        g[key] = {
          label: [rv(it.equip_type) || it.categorie, bay && `S/N ${bay}`].filter(Boolean).join(" — "),
          categorie: it.categorie, sheet: it.sheet_name, seg: it.segment, lp: it.line_pair, items: [],
        };
      }
      g[key].items.push(it);
    }
    return Object.entries(g);
  }, [filtered]);

  // Sous-groupement par tiroir dans une baie (mode bayShelf)
  const shelvesOf = (bayItems) => {
    const s = {};
    for (const it of bayItems) {
      const sn = rv(it.shelf_sn);
      const key = sn || rv(it.shelf_descrip) || "—";
      if (!s[key]) {
        s[key] = { label: [rv(it.shelf_descrip) || "Sans tiroir", sn && `S/N ${sn}`].filter(Boolean).join(" · "), items: [] };
      }
      s[key].items.push(it);
    }
    return Object.entries(s);
  };

  // Tri pour la table plate
  const flatSorted = useMemo(() => {
    const arr = [...filtered];
    const { k, dir } = sort;
    arr.sort((a, b) => {
      const va = (a[k] ?? "").toString().toLowerCase();
      const vb = (b[k] ?? "").toString().toLowerCase();
      return va < vb ? -dir : va > vb ? dir : 0;
    });
    return arr;
  }, [filtered, sort]);
  const flatPage = flatSorted.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  const totalPages = Math.ceil(flatSorted.length / PER_PAGE);

  const doExport = () => {
    const rows = filtered.map((it) => ({
      Systeme: it.systeme, Station: it.station, Categorie: it.categorie, Onglet: it.sheet_name,
      Seg: it.segment, LP: it.line_pair, Equipement: it.equip_type, Bay_SN: it.bay_sn,
      Shelf: it.shelf_descrip, Shelf_SN: it.shelf_sn, Slot: it.loc_slot,
      Description: it.description, Part_Number: it.part_number, Version: it.version,
      Serial: it.serial_nr, Statut: it.statut_inventaire, Rechange: it.is_spare ? "OUI" : "",
    }));
    exportCSV(rows, `inventaire_${station}_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const toggle = (k) => setOpenGroups((o) => ({ ...o, [k]: !o[k] }));
  const toggleShelf = (k) => setOpenShelves((o) => ({ ...o, [k]: !o[k] }));
  const setSortKey = (k) => setSort((s) => ({ k, dir: s.k === k ? -s.dir : 1 }));

  if (loading) return <Spinner TH={TH} />;

  if (notReady) {
    return (
      <div style={{ padding: "40px", maxWidth: "620px", margin: "0 auto" }}>
        <div style={{ background: TH.bgCard, border: `1px solid ${TH.border}`, borderRadius: "16px", padding: "32px", textAlign: "center", boxShadow: TH.cardShadow }}>
          <div style={{ fontSize: "40px", marginBottom: "10px" }}>🗃️</div>
          <div className="font-syne" style={{ color: TH.text1, fontWeight: 800, fontSize: "20px", marginBottom: "8px" }}>Module Inventaire non initialisé</div>
          <div style={{ color: TH.text2, fontSize: "14px", lineHeight: 1.6 }}>
            Les tables d'inventaire n'existent pas encore côté base. Appliquez la migration{" "}
            <code style={{ color: TH.blue }}>supabase/migrations/20260712_v10_inventory_module.sql</code>, puis rechargez.
          </div>
          <div style={{ marginTop: "18px" }}><Btn onClick={loadDocs} variant="outline" TH={TH}>Réessayer</Btn></div>
        </div>
      </div>
    );
  }

  // Bouton d'un groupe (baie / tiroir)
  const GroupHeader = ({ open, onClick, badge, title, meta, count, level = 0 }) => (
    <button onClick={onClick} style={{
      width: "100%", display: "flex", alignItems: "center", gap: "10px",
      padding: level ? "9px 14px" : "12px 16px", paddingLeft: level ? "28px" : "16px",
      background: level ? TH.bgHover : "transparent", border: "none",
      borderBottom: open ? `1px solid ${TH.border}` : "none", textAlign: "left",
    }}>
      <span style={{ color: TH.text3, fontSize: "12px", width: "14px" }}>{open ? "▾" : "▸"}</span>
      {badge && <span style={{ background: TH.blueGlow, color: TH.blue, borderRadius: "6px", padding: "2px 8px", fontSize: "11px", fontWeight: 700 }}>{badge}</span>}
      <span className="font-syne" style={{ color: TH.text1, fontWeight: 700, fontSize: level ? "13px" : "14px" }}>{title}</span>
      {meta && <span style={{ color: TH.text3, fontSize: "12px" }}>{meta}</span>}
      <span style={{ marginLeft: "auto", color: TH.text3, fontSize: "12px" }}>{count}</span>
    </button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Toolbar */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center", padding: "16px 20px", borderBottom: `1px solid ${TH.border}`, flexShrink: 0 }}>
        <div style={{ minWidth: "150px" }}>
          <Sel value={station} onChange={setStation} TH={TH}>
            {stationsList.length === 0 && <option value="">— aucune station —</option>}
            {stationsList.map((s) => <option key={s} value={s}>{s}</option>)}
          </Sel>
        </div>
        <div style={{ flex: 1, minWidth: "160px" }}>
          <Inp value={search} onChange={setSearch} placeholder="Rechercher (n° série, part number, description…)" TH={TH} />
        </div>
        <div style={{ width: "130px" }}>
          <Sel value={catFilter} onChange={setCatFilter} TH={TH}>
            <option value="">Toutes cat.</option>
            {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
          </Sel>
        </div>
        <Btn onClick={() => setSpareOnly((v) => !v)} variant={spareOnly ? "primary" : "ghost"} size="sm" TH={TH}>Rechanges</Btn>
        <Btn onClick={doExport} variant="outline" size="sm" TH={TH} disabled={!filtered.length}>⬇ CSV</Btn>
        <Btn onClick={() => setShowImport(true)} variant="primary" size="sm" TH={TH}>＋ Importer</Btn>
      </div>

      {/* Barre secondaire : sélecteur de mode d'affichage */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 20px", borderBottom: `1px solid ${TH.border}`, flexShrink: 0 }}>
        <span style={{ color: TH.text3, fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".4px" }}>Affichage</span>
        <div style={{ display: "inline-flex", background: TH.bgInput, border: `1px solid ${TH.border}`, borderRadius: "8px", padding: "2px" }}>
          {MODES.map((m) => (
            <button key={m.key} onClick={() => setMode(m.key)} style={{
              background: mode === m.key ? TH.blue : "transparent",
              color: mode === m.key ? "#fff" : TH.text2,
              border: "none", borderRadius: "6px", padding: "5px 12px", fontSize: "12px",
              fontWeight: 600, cursor: "pointer", transition: "all .15s",
            }}>{m.label}</button>
          ))}
        </div>
      </div>

      {/* Contenu */}
      <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px" }}>
        {docs.length === 0 ? (
          <div style={{ textAlign: "center", color: TH.text2, padding: "60px 20px" }}>
            <div style={{ fontSize: "42px", marginBottom: "12px" }}>📦</div>
            <div className="font-syne" style={{ fontSize: "18px", fontWeight: 700, color: TH.text1, marginBottom: "6px" }}>Aucun inventaire importé</div>
            <div style={{ fontSize: "14px", marginBottom: "18px" }}>Importez un fichier « Station Inventory » (.xlsx) DARE1 pour démarrer.</div>
            <Btn onClick={() => setShowImport(true)} variant="primary" TH={TH}>＋ Importer un fichier</Btn>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "18px" }}>
              <Stat TH={TH} label="Composants" value={stationStat?.total_items ?? items.length} accent={TH.blue} />
              <Stat TH={TH} label="Baies" value={stationStat?.total_bays ?? "—"} />
              <Stat TH={TH} label="N° série" value={stationStat?.total_serials ?? "—"} accent={TH.cyan} />
              <Stat TH={TH} label="SLTE / LTE" value={stationStat?.total_slte ?? "—"} />
              <Stat TH={TH} label="PFE" value={stationStat?.total_pfe ?? "—"} accent={TH.orange} />
              <Stat TH={TH} label="TEMS" value={stationStat?.total_tems ?? "—"} accent={TH.purple} />
              <Stat TH={TH} label="Rechanges" value={stationStat?.total_spares ?? "—"} accent={TH.gold} />
            </div>

            {loadingItems ? <Spinner TH={TH} /> : !filtered.length ? (
              <div style={{ textAlign: "center", color: TH.text3, padding: "40px" }}>Aucun composant pour ces filtres.</div>
            ) : (
              <>
                <div style={{ color: TH.text3, fontSize: "12px", marginBottom: "10px" }}>
                  {filtered.length} composant{filtered.length > 1 ? "s" : ""}
                  {mode !== "flat" && ` · ${groups.length} baie${groups.length > 1 ? "s" : ""}`}
                </div>

                {/* ── MODE TABLE PLATE ─────────────────────────────────────── */}
                {mode === "flat" && (
                  <div style={{ background: TH.bgCard, border: `1px solid ${TH.border}`, borderRadius: "12px", overflow: "hidden", boxShadow: TH.cardShadow }}>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ fontSize: "12.5px" }}>
                        <thead>
                          <tr style={{ color: TH.text3, textAlign: "left" }}>
                            {[
                              { k: "bay_sn", h: "Baie" }, { k: "shelf_descrip", h: "Tiroir" },
                              { k: "loc_slot", h: "Slot" }, { k: "categorie", h: "Cat." },
                              { k: "description", h: "Description" }, { k: "part_number", h: "Part Number" },
                              { k: "version", h: "Version" }, { k: "serial_nr", h: "N° Série" },
                              { k: "statut_inventaire", h: "Statut" },
                            ].map((c) => (
                              <th key={c.k} onClick={() => setSortKey(c.k)} style={{
                                padding: "9px 12px", fontWeight: 600, fontSize: "11px", whiteSpace: "nowrap",
                                borderBottom: `1px solid ${TH.border}`, cursor: "pointer", userSelect: "none",
                                position: "sticky", top: 0, background: TH.bgCard,
                              }}>
                                {c.h}{sort.k === c.k ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {flatPage.map((it) => (
                            <tr key={it.id} style={{ borderBottom: `1px solid ${TH.border}` }}>
                              <td style={{ padding: "7px 12px", color: TH.text2, whiteSpace: "nowrap" }} className="font-mono">{rv(it.bay_sn) || "—"}</td>
                              <td style={{ padding: "7px 12px", color: TH.text2, whiteSpace: "nowrap" }}>{rv(it.shelf_descrip) || "—"}</td>
                              <td style={{ padding: "7px 12px", color: TH.text2, whiteSpace: "nowrap" }} className="font-mono">{rv(it.loc_slot) || "—"}</td>
                              <td style={{ padding: "7px 12px" }}>
                                <span style={{ background: TH.blueGlow, color: TH.blue, borderRadius: "5px", padding: "1px 7px", fontSize: "10.5px", fontWeight: 700 }}>{it.categorie}</span>
                              </td>
                              <td style={{ padding: "7px 12px", color: TH.text1 }}>
                                {it.description || "—"}
                                {it.is_spare && <span style={{ marginLeft: "6px", color: TH.gold, fontSize: "10px", fontWeight: 700 }}>SPARE</span>}
                              </td>
                              <td style={{ padding: "7px 12px", color: TH.text2, whiteSpace: "nowrap" }} className="font-mono">{rv(it.part_number) || "—"}</td>
                              <td style={{ padding: "7px 12px", color: TH.text3, whiteSpace: "nowrap" }}>{rv(it.version) || "—"}</td>
                              <td style={{ padding: "7px 12px", color: TH.cyan, whiteSpace: "nowrap" }} className="font-mono">{rv(it.serial_nr) || "—"}</td>
                              <td style={{ padding: "7px 12px" }}><StatutTag TH={TH} s={it.statut_inventaire} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {totalPages > 1 && (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", padding: "12px", borderTop: `1px solid ${TH.border}` }}>
                        <Btn onClick={() => setPage((p) => Math.max(0, p - 1))} variant="ghost" size="sm" TH={TH} disabled={page === 0}>‹ Préc.</Btn>
                        <span style={{ color: TH.text2, fontSize: "12px" }}>{page + 1} / {totalPages}</span>
                        <Btn onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} variant="ghost" size="sm" TH={TH} disabled={page >= totalPages - 1}>Suiv. ›</Btn>
                      </div>
                    )}
                  </div>
                )}

                {/* ── MODES BAIE et BAIE › TIROIR ───────────────────────────── */}
                {mode !== "flat" && groups.map(([key, grp]) => {
                  const open = openGroups[key] !== false;
                  return (
                    <div key={key} style={{ background: TH.bgCard, border: `1px solid ${TH.border}`, borderRadius: "12px", marginBottom: "12px", overflow: "hidden", boxShadow: TH.cardShadow }}>
                      <GroupHeader
                        open={open} onClick={() => toggle(key)} badge={grp.categorie}
                        title={grp.label || grp.sheet} count={grp.items.length}
                        meta={`${rv(grp.seg) ? `Seg ${grp.seg}` : ""} ${rv(grp.lp) ? `· LP ${grp.lp}` : ""}`}
                      />
                      {open && (mode === "bay"
                        ? <ComponentTable TH={TH} items={grp.items} showShelf />
                        : shelvesOf(grp.items).map(([sk, sh]) => {
                            const shKey = `${key}||${sk}`;
                            const sOpen = openShelves[shKey] !== false;
                            return (
                              <div key={shKey} style={{ borderTop: `1px solid ${TH.border}` }}>
                                <GroupHeader open={sOpen} onClick={() => toggleShelf(shKey)} level={1}
                                  title={sh.label} count={sh.items.length} />
                                {sOpen && <ComponentTable TH={TH} items={sh.items} showShelf={false} />}
                              </div>
                            );
                          })
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </>
        )}
      </div>

      {showImport && (
        <ImportModal TH={TH} onClose={() => setShowImport(false)} onImported={(st) => { loadDocs(); setStation(st); }} />
      )}
    </div>
  );
}
