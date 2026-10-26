import React, { useState } from "react";
import { Btn, Inp, Sel } from "../../common/UI.jsx";
import { createFournisseur } from "../../../supabase.js";
import { creerEnBase, sameName } from "./creation.js";

const TYPES = ["Opérateur", "Opérateur de gros", "Câble sous-marin", "Terrestre", "Autre"];

/**
 * Ajout d'un fournisseur avec détails (type, pays) : enregistré en base, puis ajouté à la liste
 * et sélectionné. Un fournisseur du même nom n'est pas dupliqué : l'existant est sélectionné.
 */
export function NewFournisseurForm({ fournisseurs, userLabel, onCreated, onCancel, TH }) {
  const [nom, setNom] = useState("");
  const [type, setType] = useState(TYPES[0]);
  const [pays, setPays] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const save = async () => {
    const name = nom.trim();
    if (name.length < 2) { setErr("Saisissez le nom du fournisseur."); return; }
    const existing = (fournisseurs || []).find(f => sameName(f.nom, name));
    if (existing) { onCreated(existing, false); return; }

    setSaving(true); setErr("");
    try {
      const row = await creerEnBase({
        insert: createFournisseur,
        nom: name,
        existants: fournisseurs,
        champs: { type, pays: pays.trim() || null },
        userLabel,
        designation: "le fournisseur",
        libelle: "Fournisseur",
        entite: "fournisseur",
      });
      onCreated(row, true);
    } catch (e) {
      setErr(e.message || "Erreur inattendue.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      marginTop: "12px", padding: "12px", borderRadius: "8px",
      background: TH.bgInput, border: `1px dashed ${TH.border2}`,
      display: "flex", flexDirection: "column", gap: "10px",
    }}>
      <div style={{ color: TH.text1, fontSize: "12px", fontWeight: 700 }}>Nouveau fournisseur</div>
      <Inp value={nom} onChange={setNom} placeholder="Nom du fournisseur *" TH={TH} />
      <div style={{ display: "flex", gap: "8px" }}>
        <Sel value={type} onChange={setType} TH={TH}>
          {TYPES.map(x => <option key={x} value={x}>{x}</option>)}
        </Sel>
        <Inp value={pays} onChange={setPays} placeholder="Pays / région (facultatif)" TH={TH} />
      </div>
      {err && <div style={{ color: TH.red, fontSize: "12px" }}>{err}</div>}
      <div style={{ display: "flex", gap: "8px" }}>
        <Btn onClick={save} disabled={saving || nom.trim().length < 2} size="sm" TH={TH}>
          {saving ? "Enregistrement…" : "Enregistrer et sélectionner"}
        </Btn>
        <Btn onClick={onCancel} variant="ghost" size="sm" TH={TH}>Annuler</Btn>
      </div>
    </div>
  );
}
