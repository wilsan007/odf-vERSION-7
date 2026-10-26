import React, { useState } from "react";

/**
 * Champ de sélection avec saisie : on choisit dans la liste en tapant pour filtrer,
 * ou on saisit un nom absent de la liste et on le crée (enregistré en base via onCreate).
 *
 * items    : [{ id, nom }]
 * value    : id sélectionné
 * onSelect : (item) => void
 * onCreate : async (nom) => row  — doit lever une Error si l'enregistrement échoue
 */
export function ComboboxCreation({ items, value, onSelect, onCreate, placeholder, TH, disabled = false }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState("");

  const selected = (items || []).find(i => i.id === value);
  const q = query.trim();
  const matches = (items || []).filter(i => i.nom.toLowerCase().includes(q.toLowerCase()));
  const canCreate = q.length >= 2 && !(items || []).some(i => i.nom.trim().toLowerCase() === q.toLowerCase());

  const choisir = (item) => {
    onSelect(item);
    setQuery("");
    setOpen(false);
    setCreateErr("");
  };

  // Saisie d'un nom absent de la liste : enregistré en base immédiatement, puis sélectionné
  const creer = async () => {
    setCreating(true); setCreateErr("");
    try {
      const row = await onCreate(q);
      choisir(row);
    } catch (e) {
      setCreateErr(e?.message || "Erreur inattendue.");
    } finally {
      setCreating(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (matches.length === 1 && !canCreate) choisir(matches[0]);
    else if (canCreate && !creating) creer();
  };

  return (
    <div>
      <div style={{ position: "relative" }}>
        <input
          value={open ? query : (selected?.nom || "")}
          placeholder={placeholder}
          onFocus={() => { setOpen(true); setQuery(""); }}
          onBlur={() => setOpen(false)}
          onChange={e => { setQuery(e.target.value); setOpen(true); setCreateErr(""); }}
          onKeyDown={onKeyDown}
          disabled={creating || disabled}
          style={{
            background: TH.bgInput, border: `1px solid ${TH.border}`, borderRadius: "8px",
            padding: "8px 12px", color: TH.text1, fontSize: "13px", width: "100%", boxSizing: "border-box",
          }}
        />
        {open && (matches.length > 0 || canCreate) && (
          <div style={{
            position: "absolute", top: "100%", left: 0, right: 0, marginTop: "4px", zIndex: 10,
            background: TH.bgCard, border: `1px solid ${TH.border}`, borderRadius: "8px",
            maxHeight: "220px", overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,.25)",
          }}>
            {matches.map(i => (
              <div
                key={i.id}
                onMouseDown={e => { e.preventDefault(); choisir(i); }}
                style={{
                  padding: "8px 12px", cursor: "pointer", fontSize: "13px", color: TH.text1,
                  background: i.id === value ? `${TH.blue}22` : "transparent",
                }}
              >
                {i.nom} <span style={{ color: TH.text3, fontSize: "11px" }}>({i.id})</span>
              </div>
            ))}
            {canCreate && (
              <div
                onMouseDown={e => { e.preventDefault(); if (!creating) creer(); }}
                style={{
                  padding: "8px 12px", cursor: creating ? "wait" : "pointer", fontSize: "13px",
                  color: TH.blue, fontWeight: 700, borderTop: matches.length ? `1px solid ${TH.border}` : "none",
                }}
              >
                {creating ? "Enregistrement…" : `+ Créer et enregistrer « ${q} »`}
              </div>
            )}
          </div>
        )}
      </div>
      {createErr && <div style={{ color: TH.red, fontSize: "12px", marginTop: "6px" }}>{createErr}</div>}
    </div>
  );
}
