import React from "react";
import { Btn, Sel } from "../../common/UI.jsx";
import { RoutePathDisplay } from "../RoutePathDisplay.jsx";
import { ComboboxCreation } from "./ComboboxCreation.jsx";
import { creerEnBase } from "./creation.js";
import { createClient, createTypeService } from "../../../supabase.js";

export function SelectClientStep({
  pathSites,
  sites,
  clientId,
  setClientId,
  clients,
  onClientAdded,
  typeServiceId,
  setTypeServiceId,
  typesService,
  onTypeServiceAdded,
  capacite,
  setCapacite,
  totalHops,
  TH,
  siteB,
  setStep,
  setErr,
  onNextClient,
  siteName,
  userLabel,
}) {
  // Saisie d'un client absent de la liste : enregistré en base immédiatement
  const creerClient = async (nom) => {
    const row = await creerEnBase({
      insert: createClient,
      nom,
      existants: clients,
      userLabel,
      designation: "le client",
      libelle: "Client",
      entite: "client",
    });
    if (onClientAdded) onClientAdded(row);
    return row;
  };

  // Saisie d'un type de service absent de la liste : enregistré en base immédiatement
  const creerType = async (nom) => {
    const row = await creerEnBase({
      insert: createTypeService,
      nom,
      existants: typesService,
      userLabel,
      designation: "le type de service",
      libelle: "Type de service",
      entite: "type_service",
    });
    if (onTypeServiceAdded) onTypeServiceAdded(row);
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
          Client final (côté {siteName(siteB)})
        </div>
        <div style={{ color: TH.text3, fontSize: "11px", marginBottom: "12px" }}>
          Sélectionnez le client qui reçoit le service à destination.
        </div>
        <ComboboxCreation
          items={clients}
          value={clientId}
          onSelect={c => setClientId(c.id)}
          onCreate={creerClient}
          placeholder="Rechercher ou saisir un nouveau client…"
          TH={TH}
        />
      </div>

      <div style={{
        background: TH.bgCard, border: `1px solid ${TH.border}`,
        borderRadius: "10px", padding: "16px"
      }}>
        <div style={{ color: TH.text1, fontSize: "13px", fontWeight: 700, marginBottom: "4px" }}>
          Type de service
        </div>
        <div style={{ color: TH.text3, fontSize: "11px", marginBottom: "12px" }}>
          Facultatif. Choisissez dans la liste, ou saisissez un nouveau type.
        </div>
        <ComboboxCreation
          items={typesService}
          value={typeServiceId}
          onSelect={t => setTypeServiceId(t.id)}
          onCreate={creerType}
          placeholder="Rechercher ou saisir un type de service…"
          TH={TH}
        />
      </div>

      <div style={{
        background: TH.bgCard, border: `1px solid ${TH.border}`,
        borderRadius: "10px", padding: "16px"
      }}>
        <div style={{ color: TH.text1, fontSize: "13px", fontWeight: 700, marginBottom: "4px" }}>
          Capacité du service
        </div>
        <Sel value={capacite} onChange={setCapacite} TH={TH}>
          <option value="10">10 Gbps</option>
          <option value="100">100 Gbps</option>
        </Sel>
      </div>

      <div style={{ display: "flex", gap: "10px", justifyContent: "space-between" }}>
        <Btn onClick={() => { setErr(""); setStep("SELECT_FOURNISSEUR"); }} variant="ghost" TH={TH}>
          ‹ Retour
        </Btn>
        <Btn onClick={onNextClient} disabled={!clientId} TH={TH}>
          Vérifier et confirmer ›
        </Btn>
      </div>
    </div>
  );
}
