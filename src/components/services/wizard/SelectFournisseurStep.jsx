import React, { useState } from "react";
import { Btn } from "../../common/UI.jsx";
import { RoutePathDisplay } from "../RoutePathDisplay.jsx";
import { NewFournisseurForm } from "./NewFournisseurForm.jsx";
import { ComboboxCreation } from "./ComboboxCreation.jsx";
import { creerEnBase } from "./creation.js";
import { createFournisseur } from "../../../supabase.js";

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

  // Saisie d'un nom absent de la liste : enregistré en base immédiatement, puis sélectionné
  const creerFournisseur = async (nom) => {
    const row = await creerEnBase({
      insert: createFournisseur,
      nom,
      existants: fournisseurs,
      userLabel,
      designation: "le fournisseur",
      libelle: "Fournisseur",
      entite: "fournisseur",
    });
    if (onFournisseurAdded) onFournisseurAdded(row);
    return row;
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
        <ComboboxCreation
          items={fournisseurs}
          value={fournisseurId}
          onSelect={f => setFournisseurId(f.id)}
          onCreate={creerFournisseur}
          placeholder="Rechercher ou saisir un nouveau fournisseur…"
          TH={TH}
        />

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
