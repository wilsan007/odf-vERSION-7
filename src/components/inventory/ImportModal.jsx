import React, { useState } from "react";
import { Modal, Btn, Spinner } from "../common/UI.jsx";
import { parseArrayBuffer, summarize } from "./importParser.js";
import { importInventaireDocument } from "../../supabase.js";

// Modale d'import d'un fichier "Station Inventory" (.xlsx DARE1)
export default function ImportModal({ TH, onClose, onImported }) {
  const [parsed, setParsed] = useState(null);   // { document, items }
  const [summary, setSummary] = useState(null);
  const [fileName, setFileName] = useState("");
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);        // { inserted }

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(""); setDone(null); setParsed(null); setSummary(null);
    setFileName(file.name);
    setParsing(true);
    try {
      const buf = await file.arrayBuffer();
      const res = parseArrayBuffer(buf, file.name);
      if (!res.items.length) {
        setError("Aucune ligne d'inventaire détectée dans ce fichier.");
      } else {
        setParsed(res);
        setSummary(summarize(res.items));
      }
    } catch (err) {
      setError("Impossible de lire le fichier : " + (err?.message || err));
    } finally {
      setParsing(false);
    }
  };

  const doImport = async () => {
    if (!parsed) return;
    setImporting(true); setError("");
    try {
      const { error: err, inserted } = await importInventaireDocument(parsed);
      if (err) { setError("Erreur d'insertion : " + err.message); }
      else { setDone({ inserted }); onImported?.(parsed.document.station); }
    } catch (err) {
      setError("Erreur : " + (err?.message || err));
    } finally {
      setImporting(false);
    }
  };

  const lbl = { color: TH.text3, fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".4px" };
  const val = { color: TH.text1, fontSize: "14px", fontWeight: 700 };
  const doc = parsed?.document;

  return (
    <Modal title="Importer un inventaire de station (.xlsx)" onClose={onClose} TH={TH} width="560px">
      {/* Zone de dépôt de fichier */}
      <label style={{
        display: "block", border: `1.5px dashed ${TH.border2}`, borderRadius: "12px",
        padding: "24px", textAlign: "center", cursor: "pointer", background: TH.bgInput,
        marginBottom: "18px"
      }}>
        <input type="file" accept=".xlsx,.xls" onChange={onFile} style={{ display: "none" }} />
        <div style={{ fontSize: "30px", marginBottom: "6px" }}>📦</div>
        <div style={{ color: TH.text1, fontWeight: 600, fontSize: "14px" }}>
          {fileName || "Choisir un fichier Station Inventory"}
        </div>
        <div style={{ color: TH.text3, fontSize: "12px", marginTop: "4px" }}>
          Formats DARE1 SubCom/Ciena/PFE/TEMS — un fichier par station
        </div>
      </label>

      {parsing && <Spinner TH={TH} />}

      {error && (
        <div style={{
          background: "rgba(248,113,113,.12)", border: `1px solid ${TH.red}`, color: TH.red,
          borderRadius: "8px", padding: "10px 14px", fontSize: "13px", marginBottom: "14px"
        }}>{error}</div>
      )}

      {/* Prévisualisation avant validation */}
      {doc && !done && (
        <div className="fade-up">
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px",
            background: TH.bgInput, border: `1px solid ${TH.border}`, borderRadius: "10px",
            padding: "16px", marginBottom: "16px"
          }}>
            <div><div style={lbl}>Système</div><div style={val}>{doc.systeme}</div></div>
            <div><div style={lbl}>Station</div><div style={val}>{doc.station}</div></div>
            <div><div style={lbl}>Issue</div><div style={val}>{doc.issue || "—"}{doc.issue_date ? ` · ${doc.issue_date}` : ""}</div></div>
            <div><div style={lbl}>Composants</div><div style={val}>{summary.total}</div></div>
            {doc.owner_engineer && <div><div style={lbl}>Owner / Eng.</div><div style={val}>{doc.owner_engineer}</div></div>}
            {doc.approver && <div><div style={lbl}>Approver</div><div style={val}>{doc.approver}</div></div>}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "8px" }}>
            {Object.entries(summary.byCat).map(([cat, n]) => (
              <span key={cat} style={{
                background: TH.blueGlow, color: TH.blue, border: `1px solid ${TH.blue}`,
                borderRadius: "20px", padding: "3px 12px", fontSize: "12px", fontWeight: 600
              }}>{cat} · {n}</span>
            ))}
            <span style={{
              background: TH.bgHover, color: TH.text2, border: `1px solid ${TH.border}`,
              borderRadius: "20px", padding: "3px 12px", fontSize: "12px", fontWeight: 600
            }}>Rechanges · {summary.spares}</span>
            <span style={{
              background: TH.bgHover, color: TH.text2, border: `1px solid ${TH.border}`,
              borderRadius: "20px", padding: "3px 12px", fontSize: "12px", fontWeight: 600
            }}>N° série · {summary.serials}</span>
          </div>

          <div style={{ color: TH.text3, fontSize: "12px", marginBottom: "16px" }}>
            ⚠️ Réimporter la même révision <b style={{ color: TH.text2 }}>{doc.id}</b> remplacera ses composants existants.
          </div>

          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <Btn onClick={onClose} variant="ghost" TH={TH}>Annuler</Btn>
            <Btn onClick={doImport} variant="primary" TH={TH} disabled={importing}>
              {importing ? "Import en cours…" : `Importer ${summary.total} composants`}
            </Btn>
          </div>
        </div>
      )}

      {/* Résultat */}
      {done && (
        <div className="fade-up" style={{ textAlign: "center", padding: "8px 0" }}>
          <div style={{ fontSize: "34px", marginBottom: "8px" }}>✅</div>
          <div style={{ color: TH.green, fontWeight: 700, fontSize: "16px", marginBottom: "4px" }}>
            {done.inserted} composants importés
          </div>
          <div style={{ color: TH.text3, fontSize: "13px", marginBottom: "18px" }}>
            Station {doc.station} · {doc.id}
          </div>
          <Btn onClick={onClose} variant="primary" TH={TH}>Fermer</Btn>
        </div>
      )}
    </Modal>
  );
}
