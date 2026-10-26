import React, { useState } from "react";
import { Btn, Inp, Sel } from "../../common/UI.jsx";
import { createFournisseur, addHistory } from "../../../supabase.js";

const TYPES = ["Opérateur", "Opérateur de gros", "Câble sous-marin", "Terrestre", "Autre"];

// Identifiant lisible déduit du nom (convention de la table : 'SEACOM', 'AAE1'…)
const slugId = (nom) =>
  nom.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30) || "FRN";
const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

// Fournisseur déjà présent du même nom (sans tenir compte de la casse)
export const trouverFournisseur = (fournisseurs, nom) =>
  (fournisseurs || []).find(f => sameName(f.nom, nom));

export const messageErreurFournisseur = (error) =>
  error?.code === "42501"
    ? "Droits insuffisants : seul un technicien ou un administrateur peut ajouter un fournisseur."
    : "Impossible d'enregistrer le fournisseur" + (error?.message ? ` (${error.message})` : ".");

/**
 * Enregistre un fournisseur en base et trace l'action dans l'historique.
 * L'id est déduit du nom ; s'il est déjà pris, on essaie un suffixe (-2, -3…).
 * Renvoie { row } en cas de succès, { error } sinon.
 */
export async function enregistrerFournisseur({ nom, type = TYPES[0], pays = null, fournisseurs, userLabel }) {
  const name = nom.trim();
  const taken = new Set((fournisseurs || []).map(f => f.id));
  const base = slugId(name);
  let row = null, error = null;
  for (let i = 1; i <= 5 && !row; i++) {
    const id = i === 1 ? base : `${base}-${i}`;
    if (taken.has(id)) continue;
    const res = await createFournisseur({
      id, nom: name, type, pays, updated_by: userLabel || null,
    });
    if (res.error?.code === "23505") { taken.add(id); continue; }   // id déjà pris : suffixe suivant
    row = res.data; error = res.error;
    break;
  }
  if (!row) return { error };
  // Trace d'audit : un échec d'écriture de l'historique ne doit pas bloquer l'ajout
  try {
    await addHistory({
      action: `Fournisseur créé : ${row.nom}`, entity_type: "fournisseur", entity_id: row.id, user_email: userLabel,
    });
  } catch { /* ignoré */ }
  return { row };
}

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
    const existing = trouverFournisseur(fournisseurs, name);
    if (existing) { onCreated(existing, false); return; }

    setSaving(true); setErr("");
    try {
      const { row, error } = await enregistrerFournisseur({
        nom: name, type, pays: pays.trim() || null, fournisseurs, userLabel,
      });
      if (!row) { setErr(messageErreurFournisseur(error)); return; }
      onCreated(row, true);
    } catch (e) {
      setErr("Erreur inattendue : " + (e?.message || e));
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
