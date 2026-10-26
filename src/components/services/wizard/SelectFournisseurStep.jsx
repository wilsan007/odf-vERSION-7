import React, { useState } from "react";
import { Btn } from "../../common/UI.jsx";
import { RoutePathDisplay } from "../RoutePathDisplay.jsx";
import {
  NewFournisseurForm, trouverFournisseur, enregistrerFournisseur, messageErreurFournisseur,
} from "./NewFournisseurForm.jsx";

export function SelectFournisseurStep({
  pathSites,
  sites,
  fournisseurId,
  setFournisseurId,
  fournisseurs,
  cables,
  hops,
  totalHops,
  TH,
  siteA,
  setStep,
  setCurrentHopIdx,
  setErr,
  onNextFournisseur,
  siteName,
  onFournisseurAdded,
  userLabel,
}) {
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState("");

  const selected = (fournisseurs || []).find(f => f.id === fournisseurId);
  const q = query.trim();
  const matches = (fournisseurs || []).filter(f => f.nom.toLowerCase().includes(q.toLowerCase()));
  const canCreate = q.length >= 2 && !trouverFournisseur(fournisseurs, q);

  const choisir = (f) => {
    setFournisseurId(f.id);
    setQuery("");
    setOpen(false);
    setCreateErr("");
  };

  // Saisie d'un nom absent de la liste : enregistré en base immédiatement, puis sélectionné
  const creer = async () => {
    setCreating(true); setCreateErr("");
    try {
      const { row, error } = await enregistrerFournisseur({ nom: q, fournisseurs, userLabel });
      if (!row) { setCreateErr(messageErreurFournisseur(error)); return; }
      if (onFournisseurAdded) onFournisseurAdded(row);
      choisir(row);
    } catch (e) {
      setCreateErr("Erreur inattendue : " + (e?.message || e));
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
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <RoutePathDisplay
        pathSites={pathSites}
        activeHopIndex={totalHops}
        sitesList={sites}
        TH={TH}
      />

      <div style={{
        background: TH.bgCard, border: `1px solid ${TH.border}`,
        borderRadius: "10px", padding: "16px"
      }}>
        <div style={{ color: TH.text1, fontSize: "13px", fontWeight: 700, marginBottom: "4px" }}>
          Fournisseur d'accès (côté {siteName(siteA)})
        </div>
        <div style={{ color: TH.text3, fontSize: "11px", marginBottom: "12px" }}>
          Sélectionnez l'opérateur qui fournit la capacité sur le câble de départ, ou ajoutez-en un nouveau.
        </div>
        <div style={{ position: "relative" }}>
          <input
            value={open ? query : (selected?.nom || "")}
            placeholder="Rechercher ou saisir un nouveau fournisseur…"
            onFocus={() => { setOpen(true); setQuery(""); }}
            onBlur={() => setOpen(false)}
            onChange={e => { setQuery(e.target.value); setOpen(true); setCreateErr(""); }}
            onKeyDown={onKeyDown}
            disabled={creating}
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
              {matches.map(f => (
                <div
                  key={f.id}
                  onMouseDown={e => { e.preventDefault(); choisir(f); }}
                  style={{
                    padding: "8px 12px", cursor: "pointer", fontSize: "13px", color: TH.text1,
                    background: f.id === fournisseurId ? `${TH.blue}22` : "transparent",
                  }}
                >
                  {f.nom} <span style={{ color: TH.text3, fontSize: "11px" }}>({f.id})</span>
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

        {!adding && (
          <button
            onClick={() => setAdding(true)}
            style={{
              marginTop: "8px", background: "none", border: "none", padding: 0,
              color: TH.blue, fontSize: "12px", fontWeight: 700, cursor: "pointer",
            }}
          >
            + Ajouter un fournisseur
          </button>
        )}
        {adding && (
          <NewFournisseurForm
            fournisseurs={fournisseurs}
            userLabel={userLabel}
            TH={TH}
            onCancel={() => setAdding(false)}
            onCreated={(row, isNew) => {
              if (isNew && onFournisseurAdded) onFournisseurAdded(row);
              setFournisseurId(row.id);
              setAdding(false);
            }}
          />
        )}

        {hops[0]?.cableId && (
          (() => {
            const cable = (cables || []).find(c => c.id === hops[0].cableId);
            if (cable?.fournisseurs?.id && cable.fournisseurs.id !== fournisseurId) {
              return (
                <div style={{
                  marginTop: "8px", fontSize: "11px", color: TH.text3,
                  display: "flex", alignItems: "center", gap: "8px"
                }}>
                  <span>Suggestion :</span>
                  <button
                    onClick={() => setFournisseurId(cable.fournisseurs.id)}
                    style={{
                      background: `${TH.blue}22`, border: `1px solid ${TH.blue}`,
                      borderRadius: "6px", padding: "2px 10px",
                      color: TH.blue, fontSize: "11px", fontWeight: 700, cursor: "pointer"
                    }}
                  >
                    {cable.fournisseurs.nom}
                  </button>
                  <span style={{ color: TH.text3 }}>(fournisseur du câble {cable.cable_reference})</span>
                </div>
              );
            }
            return null;
          })()
        )}
      </div>

      <div style={{ display: "flex", gap: "10px", justifyContent: "space-between" }}>
        <Btn onClick={() => {
          setErr("");
          setStep(`HOP_${totalHops - 1}`);
          setCurrentHopIdx(totalHops - 1);
        }} variant="ghost" TH={TH}>‹ Retour</Btn>
        <Btn onClick={onNextFournisseur} disabled={!fournisseurId} TH={TH}>
          Suivant — Client final ›
        </Btn>
      </div>
    </div>
  );
}
