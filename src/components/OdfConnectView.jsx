import React, { useState, useEffect } from "react";
import { supabase } from "../supabase.js";

// Import OdfConnect subcomponents
import { ConnectionCreator } from "./odfConnect/ConnectionCreator.jsx";
import { ConnectionManager } from "./odfConnect/ConnectionManager.jsx";
import { EquipementManager } from "./odfConnect/EquipementManager.jsx";

export default function OdfConnectView({ t, TH }) {
  const [activeTab, setActiveTab] = useState("create"); // "create" | "manage" | "equipements"
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

  // Charger les connexions — requête résiliente avec fallback
  const loadCablesList = async () => {
    setLoadingCables(true);
    setErr("");

    // Requête principale avec jointure equipement_port
    const fullQuery = () =>
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
      ),
      equipement_port:equipement_ports!cables_fibre_equipement_port_id_fkey(
        id, slot_port,
        equipements(id, name, type,
          racks(id, name,
            sites(id, name)
          )
        )
      )
    `).order('cable_reference');

    // Requête de fallback sans la jointure equipement_port (si la colonne/FK n'existe pas)
    const fallbackQuery = () =>
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
    `).order('cable_reference');

    try {
      let r = await fullQuery();

      // Si la requête principale échoue (colonne/FK equipement_port manquante), utiliser le fallback
      if (r.error && /equipement/i.test(r.error.message || "")) {
        console.warn("[loadCablesList] Jointure equipement_port indisponible, utilisation du fallback:", r.error.message);
        r = await fallbackQuery();
      }

      if (r.error) throw r.error;

      const allCables = r.data || [];
      // Afficher uniquement les connexions ODF (EXTERNE ou INTERNE au niveau ODF entier)
      // — référence normalisée contenant '/'  : ALP-BET/S1-R1-ODF7_S1-R1-ODF5
      // — nom préfixé [ODF]                   : câbles créés par ODF entier
      // Exclure : jarretières port-à-port (INT-xxx-SxxPxx-SxxPxx) et câbles de transit service
      const infraCables = allCables.filter(c => {
        const ref = c.cable_reference || "";
        const nom = c.nom || "";
        return ref.includes("/") || nom.startsWith("[ODF]");
      });
      setCables(infraCables);
      setLoadingCables(false);
    } catch (e) {
      console.error("[loadCablesList] Erreur:", e);
      setErr("Impossible de charger les connexions : " + (e.message || JSON.stringify(e)));
      setCables([]);
      setLoadingCables(false);
    }
  };

  useEffect(() => {
    loadCablesList();
  }, [activeTab]);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* ── Onglets Principaux ── */}
      <div style={{ display: "flex", borderBottom: `1px solid ${TH.border}`, background: TH.bgSurface, flexShrink: 0 }}>
        {[
          { key: "create",      label: "🔌 Nouvelle interconnexion" },
          { key: "manage",      label: `🔍 Connexions existantes (${cables.length})` },
          { key: "equipements", label: "🖧 Gérer les équipements" },
        ].map(tab => (
          <button key={tab.key} onClick={() => { setActiveTab(tab.key); setErr(""); setSuccess(""); }}
            style={{
              flex: 1, padding: "16px",
              background: activeTab === tab.key ? "rgba(255,255,255,.03)" : "transparent",
              color: activeTab === tab.key ? TH.blue : TH.text2, border: "none",
              borderBottom: `2px solid ${activeTab === tab.key ? TH.blue : "transparent"}`,
              fontSize: "14px", fontWeight: 700, cursor: "pointer", transition: "all 0.15s",
            }}>
            {tab.label}
          </button>
        ))}
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

        {/* ── CONTENU : ÉQUIPEMENTS ── */}
        {activeTab === "equipements" && (
          <EquipementManager
            TH={TH}
            setErr={setErr}
            setSuccess={setSuccess}
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
