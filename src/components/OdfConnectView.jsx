import React, { useState, useEffect } from "react";
import { supabase } from "../supabase.js";

// Import OdfConnect subcomponents
import { ConnectionCreator } from "./odfConnect/ConnectionCreator.jsx";
import { ConnectionManager } from "./odfConnect/ConnectionManager.jsx";

export default function OdfConnectView({ t, TH }) {
  const [activeTab, setActiveTab] = useState("create"); // "create" | "manage"
  const [mode, setMode] = useState("externe"); // "externe" | "intersalle"
  const [connType, setConnType] = useState("odf"); // "odf" | "slot"

  const [src, setSrc] = useState({ site: "", salle: "", rack: "", odf: "", selectedSlots: [] });
  const [dst, setDst] = useState({ site: "", salle: "", rack: "", odf: "", selectedSlots: [] });

  const [cableRef, setCableRef] = useState("");
  const [typeFibre, setTypeFibre] = useState("Monomode");

  // Liste des connexions
  const [cables, setCables] = useState([]);
  const [loadingCables, setLoadingCables] = useState(false);

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [err, setErr] = useState("");

  // Charger les connexions
  const loadCablesList = () => {
    setLoadingCables(true);
    supabase.from('cables_fibre').select(`
      *,
      port_source:ports!cables_fibre_port_source_id_fkey(
        id, slot_port, slot_id,
        slots(id, name, slot_num,
          odfs(id, name, odf_type,
            racks(id, name,
              salles(id, name,
                sites(id, name)
              )
            )
          )
        )
      ),
      port_dest:ports!cables_fibre_port_dest_id_fkey(
        id, slot_port, slot_id,
        slots(id, name, slot_num,
          odfs(id, name, odf_type,
            racks(id, name,
              salles(id, name,
                sites(id, name)
              )
            )
          )
        )
      )
    `).order('cable_reference')
    .then(r => {
      setCables(r.data || []);
      setLoadingCables(false);
    }).catch(() => setLoadingCables(false));
  };

  useEffect(() => {
    if (activeTab === "manage") {
      loadCablesList();
    }
  }, [activeTab]);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* ── Onglets Principaux ── */}
      <div style={{ display: "flex", borderBottom: `1px solid ${TH.border}`, background: TH.bgSurface, flexShrink: 0 }}>
        <button onClick={() => { setActiveTab("create"); setErr(""); setSuccess(""); }}
          style={{
            flex: 1, padding: "16px", background: activeTab === "create" ? "rgba(255,255,255,.03)" : "transparent",
            color: activeTab === "create" ? TH.blue : TH.text2, border: "none",
            borderBottom: `2px solid ${activeTab === "create" ? TH.blue : "transparent"}`,
            fontSize: "14px", fontWeight: 700, cursor: "pointer", transition: "all 0.15s"
          }}>
          🔌 Nouvelle interconnexion
        </button>
        <button onClick={() => { setActiveTab("manage"); setErr(""); setSuccess(""); }}
          style={{
            flex: 1, padding: "16px", background: activeTab === "manage" ? "rgba(255,255,255,.03)" : "transparent",
            color: activeTab === "manage" ? TH.blue : TH.text2, border: "none",
            borderBottom: `2px solid ${activeTab === "manage" ? TH.blue : "transparent"}`,
            fontSize: "14px", fontWeight: 700, cursor: "pointer", transition: "all 0.15s"
          }}>
          🔍 Gérer les connexions existantes ({cables.length})
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>

        {err && <div style={{ background: "rgba(248,113,113,.12)", border: "1px solid rgba(248,113,113,.3)", borderRadius: "10px", padding: "12px 16px", color: "#F87171", fontSize: "13px", marginBottom: "16px" }}>{err}</div>}
        {success && <div style={{ background: "rgba(16,185,129,.12)", border: "1px solid rgba(16,185,129,.3)", borderRadius: "10px", padding: "12px 16px", color: "#34D399", fontSize: "13px", marginBottom: "16px" }}>{success}</div>}

        {/* ── CONTENU : CRÉATION ── */}
        {activeTab === "create" && (
          <ConnectionCreator
            mode={mode}
            setMode={setMode}
            connType={connType}
            setConnType={setConnType}
            src={src}
            setSrc={setSrc}
            dst={dst}
            setDst={setDst}
            cableRef={cableRef}
            setCableRef={setCableRef}
            typeFibre={typeFibre}
            setTypeFibre={setTypeFibre}
            saving={saving}
            setSaving={setSaving}
            err={err}
            setErr={setErr}
            success={success}
            setSuccess={setSuccess}
            TH={TH}
            onCreated={loadCablesList}
          />
        )}

        {/* ── CONTENU : VISUALISATION & SUPPRESSION ── */}
        {activeTab === "manage" && (
          <ConnectionManager
            cables={cables}
            loadCablesList={loadCablesList}
            loadingCables={loadingCables}
            TH={TH}
            setErr={setErr}
            setSuccess={setSuccess}
            setSaving={setSaving}
          />
        )}

      </div>
    </div>
  );
}
