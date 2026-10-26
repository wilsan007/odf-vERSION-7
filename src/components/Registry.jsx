import React, { useState, useEffect } from "react";
import { getPortsFlat, getSites } from "../supabase.js";
import { Btn, Bdg, Spinner } from "./common/UI.jsx";
import { formatPortLabel } from "../utils/portLabel.js";
import { fmt, exportCSV, exportPDFLabels } from "./common/Utilities.js";

const STATUTS = ["LIBRE", "OCCUPE", "MAUVAIS", "INCONNU"];

export default function Registry({ t, TH, lang }) {
  const [ports, setPorts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSite, setFilterSite] = useState("");
  const [sites, setSites] = useState([]);
  const [page, setPage] = useState(0);
  const PER_PAGE = 30;

  useEffect(() => {
    setLoading(true);
    Promise.all([getPortsFlat(), getSites()])
      .then(([pr, sr]) => {
        setPorts(pr.data || []);
        setSites(sr.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = ports.filter(p => {
    const path = [
      p.slots?.odfs?.racks?.sites?.name,
      p.slots?.odfs?.racks?.salles?.name,
      p.slots?.odfs?.racks?.name,
      p.slots?.odfs?.name,
      p.slots?.name,
      p.slot_port,
      p.owner, 
      p.cid, 
      p.ot_num
    ].filter(Boolean).join(" ").toLowerCase();
    const q = search.toLowerCase();
    return (!q || path.includes(q))
      && (!filterStatus || p.statut === filterStatus)
      && (!filterSite || p.slots?.odfs?.racks?.sites?.name === filterSite);
  });

  const paginated = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  const totalPages = Math.ceil(filtered.length / PER_PAGE);

  const doExportCSV = () => {
    const rows = filtered.map(p => ({
      Site: p.slots?.odfs?.racks?.sites?.name || "",
      Salle: p.slots?.odfs?.racks?.salles?.name || "",
      Rack: p.slots?.odfs?.racks?.name || "",
      ODF: p.slots?.odfs?.name || "",
      Slot: p.slots?.name || "",
      Port_ID: p.id || "",
      Slot_Port: p.slot_port || "",
      Statut: p.statut || "",
      CID: p.cid || "",
      OT: p.ot_num || "",
      Owner: p.owner || "",
      Destination: p.destination || "",
      Remarques: p.remarques || "",
      Modifié: fmt(p.updated_at),
    }));
    exportCSV(rows, `registre_ports_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const doExportPDF = () => exportPDFLabels(filtered);

  if (loading) return <Spinner TH={TH} />;

  const cols = [
    { k: "site",  w: "70px",  label: "Site" },
    { k: "salle", w: "70px",  label: "Salle" },
    { k: "rack",  w: "70px",  label: "Rack" },
    { k: "odf",   w: "80px",  label: "ODF" },
    { k: "slot",  w: "60px",  label: "Slot" },
    { k: "port",  w: "100px", label: "Port ID" },
    { k: "st",    w: "100px", label: t.status },
    { k: "own",   w: "90px",  label: t.operator },
    { k: "cid",   w: "100px", label: t.cid },
    { k: "ot",    w: "80px",  label: "OT#" },
    { k: "dest",  w: "100px", label: t.destination },
    { k: "upd",   w: "90px",  label: t.updatedAt },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Topbar */}
      <div style={{
        display: "flex", 
        alignItems: "center", 
        gap: "10px", 
        padding: "12px 20px",
        borderBottom: `1px solid ${TH.border}`, 
        flexShrink: 0, 
        flexWrap: "wrap"
      }}>
        <input 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
          placeholder={t.searchPlaceholder}
          style={{
            flex: 1, 
            minWidth: "160px", 
            maxWidth: "280px", 
            background: TH.bgInput,
            border: `1px solid ${TH.border}`, 
            borderRadius: "8px", 
            padding: "7px 12px",
            color: TH.text1, 
            fontSize: "13px"
          }} 
        />
        <select 
          value={filterStatus} 
          onChange={e => setFilterStatus(e.target.value)}
          style={{
            background: TH.bgInput, 
            border: `1px solid ${TH.border}`, 
            borderRadius: "8px",
            padding: "7px 10px", 
            color: TH.text1, 
            fontSize: "12px"
          }}>
          <option value="">{t.allStatuses}</option>
          {STATUTS.map(s => <option key={s}>{s}</option>)}
        </select>
        <select 
          value={filterSite} 
          onChange={e => setFilterSite(e.target.value)}
          style={{
            background: TH.bgInput, 
            border: `1px solid ${TH.border}`, 
            borderRadius: "8px",
            padding: "7px 10px", 
            color: TH.text1, 
            fontSize: "12px"
          }}>
          <option value="">{t.allSites}</option>
          {sites.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
        </select>
        <span style={{ color: TH.text2, fontSize: "12px" }}>{filtered.length} ports</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
          <Btn onClick={doExportCSV} variant="outline" size="sm" TH={TH}>⬇ CSV</Btn>
          <Btn onClick={doExportPDF} variant="ghost" size="sm" TH={TH}>🖨 PDF</Btn>
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        <table style={{ fontSize: "12px", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: TH.bgCard, position: "sticky", top: 0 }}>
              {cols.map(c => (
                <th 
                  key={c.k} 
                  style={{
                    padding: "10px 12px",
                    textAlign: "left",
                    color: TH.text2,
                    fontWeight: 600,
                    fontSize: "11px",
                    borderBottom: `1px solid ${TH.border}`,
                    whiteSpace: "nowrap",
                    width: c.w
                  }}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.map((p, i) => (
              <tr 
                key={p.id} 
                style={{
                  borderBottom: `1px solid ${TH.border}`,
                  background: i % 2 === 0 ? "transparent" : TH.bgHover
                }}>
                <td style={{ 
                  padding: "8px 12px", 
                  color: TH.text2, 
                  fontFamily: "'JetBrains Mono',monospace", 
                  fontSize: "11px" 
                }}>
                  {p.slots?.odfs?.racks?.sites?.name || "—"}
                </td>
                <td style={{ 
                  padding: "8px 12px", 
                  color: TH.text2, 
                  fontFamily: "'JetBrains Mono',monospace", 
                  fontSize: "11px" 
                }}>
                  {p.slots?.odfs?.racks?.salles?.name || "—"}
                </td>
                <td style={{ 
                  padding: "8px 12px", 
                  color: TH.text2, 
                  fontFamily: "'JetBrains Mono',monospace", 
                  fontSize: "11px" 
                }}>
                  {p.slots?.odfs?.racks?.name || "—"}
                </td>
                <td style={{ 
                  padding: "8px 12px", 
                  color: TH.text2, 
                  fontFamily: "'JetBrains Mono',monospace", 
                  fontSize: "11px" 
                }}>
                  {p.slots?.odfs?.name || "—"}
                </td>
                <td style={{ 
                  padding: "8px 12px", 
                  color: TH.text2, 
                  fontFamily: "'JetBrains Mono',monospace", 
                  fontSize: "11px" 
                }}>
                  {p.slots?.name || "—"}
                </td>
                <td style={{ 
                  padding: "8px 12px", 
                  color: TH.text1, 
                  fontFamily: "'JetBrains Mono',monospace", 
                  fontWeight: 600, 
                  fontSize: "11px" 
                }}>
                  {formatPortLabel(p.id)}
                </td>
                <td style={{ padding: "8px 12px" }}>
                  <Bdg status={p.statut || "LIBRE"} TH={TH} />
                </td>
                <td style={{ padding: "8px 12px", color: TH.text2, fontSize: "11px" }}>
                  {p.owner || "—"}
                </td>
                <td style={{ 
                  padding: "8px 12px", 
                  color: TH.cyan, 
                  fontFamily: "'JetBrains Mono',monospace", 
                  fontSize: "11px" 
                }}>
                  {p.cid || "—"}
                </td>
                <td style={{ padding: "8px 12px", color: TH.text2, fontSize: "11px" }}>
                  {p.ot_num || "—"}
                </td>
                <td style={{ 
                  padding: "8px 12px", 
                  color: TH.text2, 
                  fontSize: "11px", 
                  maxWidth: "100px", 
                  overflow: "hidden", 
                  textOverflow: "ellipsis", 
                  whiteSpace: "nowrap" 
                }}>
                  {p.destination || "—"}
                </td>
                <td style={{ padding: "8px 12px", color: TH.text3, fontSize: "10px" }}>
                  {fmt(p.updated_at)}
                </td>
              </tr>
            ))}
            {!paginated.length && (
              <tr>
                <td colSpan={13} style={{ padding: "32px", textAlign: "center", color: TH.text3 }}>
                  {t.noData}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{
          display: "flex", 
          alignItems: "center", 
          gap: "8px",
          padding: "10px 20px", 
          borderTop: `1px solid ${TH.border}`, 
          flexShrink: 0
        }}>
          <Btn onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} variant="ghost" size="sm" TH={TH}>←</Btn>
          <span style={{ color: TH.text2, fontSize: "12px" }}>{page + 1} / {totalPages}</span>
          <Btn onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1} variant="ghost" size="sm" TH={TH}>→</Btn>
        </div>
      )}
    </div>
  );
}
