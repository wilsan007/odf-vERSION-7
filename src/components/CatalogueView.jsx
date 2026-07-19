// CatalogueView v7.1 — catalogue module
import React, { useState, useEffect, useMemo } from "react";
import { getCataloguePieces } from "../supabase.js";
import { Btn, Inp, Sel, Spinner } from "./common/UI.jsx";
import { exportCSV } from "./common/Utilities.js";

const CATS = ["SLTE", "LTE", "PSB", "PFE", "TEMS", "AUTRE"];

function Stat({ TH, label, value, accent }) {
  return (
    <div style={{ background: TH.bgCard, border: `1px solid ${TH.border}`, borderRadius: "12px", padding: "12px 16px", minWidth: "120px", boxShadow: TH.cardShadow }}>
      <div style={{ color: TH.text3, fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".4px" }}>{label}</div>
      <div className="font-syne" style={{ color: accent || TH.text1, fontSize: "22px", fontWeight: 800, marginTop: "2px" }}>{value}</div>
    </div>
  );
}

export default function CatalogueView({ t, TH }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notReady, setNotReady] = useState(false);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [sort, setSort] = useState({ k: "quantite", dir: -1 });

  const load = () => {
    setLoading(true);
    getCataloguePieces()
      .then((r) => {
        if (r.error) { setNotReady(true); setLoading(false); return; }
        setNotReady(false); setRows(r.data || []); setLoading(false);
      })
      .catch(() => { setNotReady(true); setLoading(false); });
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let arr = rows.filter((r) => {
      if (catFilter && r.categorie !== catFilter) return false;
      if (!q) return true;
      return [r.part_number, r.description, r.fabricant, r.stations].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
    const { k, dir } = sort;
    arr = [...arr].sort((a, b) => {
      const va = a[k] ?? "", vb = b[k] ?? "";
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).toLowerCase() < String(vb).toLowerCase() ? -dir : String(va).toLowerCase() > String(vb).toLowerCase() ? dir : 0;
    });
    return arr;
  }, [rows, search, catFilter, sort]);

  const totals = useMemo(() => ({
    refs: rows.length,
    qty: rows.reduce((s, r) => s + (r.quantite || 0), 0),
    spares: rows.reduce((s, r) => s + (r.rechanges || 0), 0),
  }), [rows]);

  const setSortKey = (k) => setSort((s) => ({ k, dir: s.k === k ? -s.dir : (typeof rows[0]?.[k] === "number" ? -1 : 1) }));

  const doExport = () => {
    const out = filtered.map((r) => ({
      Part_Number: r.part_number, Famille: r.categorie, Fabricant: r.fabricant || "",
      Description: r.description, Quantite: r.quantite, Rechanges: r.rechanges,
      N_Series: r.series, Nb_Stations: r.nb_stations, Stations: r.stations,
    }));
    if (out.length) exportCSV(out, `catalogue_pieces_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  if (loading) return <Spinner TH={TH} />;

  if (notReady) {
    return (
      <div style={{ padding: "40px", maxWidth: "620px", margin: "0 auto" }}>
        <div style={{ background: TH.bgCard, border: `1px solid ${TH.border}`, borderRadius: "16px", padding: "32px", textAlign: "center", boxShadow: TH.cardShadow }}>
          <div style={{ fontSize: "40px", marginBottom: "10px" }}>🗂️</div>
          <div className="font-syne" style={{ color: TH.text1, fontWeight: 800, fontSize: "20px", marginBottom: "8px" }}>Catalogue non initialisé</div>
          <div style={{ color: TH.text2, fontSize: "14px", lineHeight: 1.6 }}>
            Appliquez la migration{" "}
            <code style={{ color: TH.blue }}>supabase/migrations/20260712_v12_catalogue_view.sql</code> (nécessite l'inventaire v10), puis rechargez.
          </div>
          <div style={{ marginTop: "18px" }}><Btn onClick={load} variant="outline" TH={TH}>Réessayer</Btn></div>
        </div>
      </div>
    );
  }

  const cols = [
    { k: "part_number", h: "Part Number" }, { k: "categorie", h: "Famille" },
    { k: "fabricant", h: "Fabricant" }, { k: "description", h: "Description" },
    { k: "quantite", h: "Qté" }, { k: "rechanges", h: "Rechanges" },
    { k: "series", h: "N° séries" }, { k: "nb_stations", h: "Stations" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center", padding: "16px 20px", borderBottom: `1px solid ${TH.border}`, flexShrink: 0 }}>
        <span className="font-syne" style={{ color: TH.text1, fontWeight: 700, fontSize: "15px" }}>Catalogue matériel</span>
        <div style={{ flex: 1, minWidth: "180px" }}><Inp value={search} onChange={setSearch} placeholder="Rechercher (part number, description, fabricant…)" TH={TH} /></div>
        <div style={{ width: "140px" }}>
          <Sel value={catFilter} onChange={setCatFilter} TH={TH}>
            <option value="">Toutes familles</option>
            {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
          </Sel>
        </div>
        <Btn onClick={doExport} variant="outline" size="sm" TH={TH} disabled={!filtered.length}>⬇ CSV</Btn>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px" }}>
        {rows.length === 0 ? (
          <div style={{ textAlign: "center", color: TH.text2, padding: "56px 20px" }}>
            <div style={{ fontSize: "42px", marginBottom: "12px" }}>🗂️</div>
            <div className="font-syne" style={{ fontSize: "18px", fontWeight: 700, color: TH.text1, marginBottom: "6px" }}>Catalogue vide</div>
            <div style={{ fontSize: "14px" }}>Importez des inventaires ; les références apparaîtront ici automatiquement.</div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
              <Stat TH={TH} label="Références" value={totals.refs} accent={TH.blue} />
              <Stat TH={TH} label="Quantité totale" value={totals.qty} />
              <Stat TH={TH} label="Rechanges" value={totals.spares} accent={TH.gold} />
              <Stat TH={TH} label="Affichées" value={filtered.length} accent={TH.cyan} />
            </div>

            <div style={{ background: TH.bgCard, border: `1px solid ${TH.border}`, borderRadius: "12px", overflow: "hidden", boxShadow: TH.cardShadow }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ fontSize: "12.5px" }}>
                  <thead>
                    <tr style={{ color: TH.text3, textAlign: "left" }}>
                      {cols.map((c) => (
                        <th key={c.k} onClick={() => setSortKey(c.k)} style={{ padding: "9px 12px", fontWeight: 600, fontSize: "11px", whiteSpace: "nowrap", borderBottom: `1px solid ${TH.border}`, cursor: "pointer", userSelect: "none", position: "sticky", top: 0, background: TH.bgCard }}>
                          {c.h}{sort.k === c.k ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r, i) => (
                      <tr key={r.part_number + i} style={{ borderBottom: `1px solid ${TH.border}` }}>
                        <td style={{ padding: "7px 12px", color: TH.text1, fontWeight: 600, whiteSpace: "nowrap" }} className="font-mono">{r.part_number}</td>
                        <td style={{ padding: "7px 12px" }}><span style={{ background: TH.blueGlow, color: TH.blue, borderRadius: "5px", padding: "1px 7px", fontSize: "10.5px", fontWeight: 700 }}>{r.categorie}</span></td>
                        <td style={{ padding: "7px 12px", color: TH.text2, whiteSpace: "nowrap" }}>{r.fabricant || "—"}</td>
                        <td style={{ padding: "7px 12px", color: TH.text1 }}>{r.description || "—"}</td>
                        <td style={{ padding: "7px 12px", color: TH.text1, fontWeight: 600, textAlign: "right" }}>{r.quantite}</td>
                        <td style={{ padding: "7px 12px", color: r.rechanges ? TH.gold : TH.text3, textAlign: "right" }}>{r.rechanges || "—"}</td>
                        <td style={{ padding: "7px 12px", color: TH.cyan, textAlign: "right" }}>{r.series || "—"}</td>
                        <td style={{ padding: "7px 12px", color: TH.text3, whiteSpace: "nowrap" }} title={r.stations}>{r.nb_stations}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {!filtered.length && <div style={{ textAlign: "center", color: TH.text3, padding: "30px" }}>Aucune référence pour ces filtres.</div>}
          </>
        )}
      </div>
    </div>
  );
}
