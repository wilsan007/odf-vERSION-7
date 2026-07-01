import React, { useState, useEffect, useMemo } from "react";
import { supabase, getTransitData, getSalleIdsForPorts, createService, addServiceJonctions, addHistory } from "../../supabase.js";
import { Modal } from "../common/UI.jsx";
import { useRouteGraph, findBestInternalPort, findBestIntersalleTransit, genCid } from "./routingEngine.js";

// Import Wizard Steps
import { SelectSitesStep } from "./wizard/SelectSitesStep.jsx";
import { HopStep } from "./wizard/HopStep.jsx";
import { SelectFournisseurStep } from "./wizard/SelectFournisseurStep.jsx";
import { SelectClientStep } from "./wizard/SelectClientStep.jsx";
import { ConfirmStep } from "./wizard/ConfirmStep.jsx";

// ═══════════════════════════════════════════════════════════════════════════
// HELPER POUR RESOUDRE LES JARRETIERES DE TRANSIT
// ═══════════════════════════════════════════════════════════════════════════
export const resolveJarretieresForHop = (portTransitIn, portTransitMid, portEntree, internalCables, portTransitMid2, intersalleCableId, portSalleMap) => {
  if (!portTransitIn || !portTransitMid || !portEntree || !internalCables) {
    return { j1: null, j2: null, intersalleCable: null };
  }
  const slotIn = portTransitIn.split(/P\d+$/)[0];
  const slotMid = portTransitMid.split(/P\d+$/)[0];
  const slotOut = portEntree.split(/P\d+$/)[0];

  const j1 = internalCables.find(c => {
    const sSrc = c.port_source_id ? c.port_source_id.split(/P\d+$/)[0] : null;
    const sDst = c.port_dest_id ? c.port_dest_id.split(/P\d+$/)[0] : null;
    return (sSrc === slotIn && sDst === slotMid) || (sSrc === slotMid && sDst === slotIn);
  });

  // j2 est TOUJOURS intrasalle. En cas B, portTransitMid2 est dans salleOut.
  const j2Port = portTransitMid2 || null;
  let j2 = null;
  if (j2Port) {
    const slotMid2 = j2Port.split(/P\d+$/)[0];
    j2 = internalCables.find(c => {
      const sSrc = c.port_source_id ? c.port_source_id.split(/P\d+$/)[0] : null;
      const sDst = c.port_dest_id ? c.port_dest_id.split(/P\d+$/)[0] : null;
      return (sSrc === slotMid2 && sDst === slotOut) || (sSrc === slotOut && sDst === slotMid2);
    });
  } else if (portSalleMap) {
    const salleMid = portSalleMap[portTransitMid];
    const salleOut = portSalleMap[portEntree];
    if (salleMid && salleOut && salleMid === salleOut) {
      j2 = internalCables.find(c => {
        const sSrc = c.port_source_id ? c.port_source_id.split(/P\d+$/)[0] : null;
        const sDst = c.port_dest_id ? c.port_dest_id.split(/P\d+$/)[0] : null;
        return (sSrc === slotMid && sDst === slotOut) || (sSrc === slotOut && sDst === slotMid);
      });
    }
  } else {
    j2 = internalCables.find(c => {
      const sSrc = c.port_source_id ? c.port_source_id.split(/P\d+$/)[0] : null;
      const sDst = c.port_dest_id ? c.port_dest_id.split(/P\d+$/)[0] : null;
      return (sSrc === slotMid && sDst === slotOut) || (sSrc === slotOut && sDst === slotMid);
    });
  }

  const intersalleCable = intersalleCableId
    ? internalCables.find(c => c.id === intersalleCableId)
    : null;

  return { j1, j2, intersalleCable };
};

export const getJarretieresCandidates = (portA, portB, internalCables, portSalleMap) => {
  if (!portA || !portB || !internalCables) return [];
  const slotA = portA.split(/P\d+$/)[0];
  const slotB = portB.split(/P\d+$/)[0];
  if (portSalleMap) {
    const salleA = portSalleMap[portA];
    const salleB = portSalleMap[portB];
    if (salleA && salleB && salleA !== salleB) return [];
  }
  return internalCables.filter(c => {
    const sSrc = c.port_source_id ? c.port_source_id.split(/P\d+$/)[0] : null;
    const sDst = c.port_dest_id ? c.port_dest_id.split(/P\d+$/)[0] : null;
    return (sSrc === slotA && sDst === slotB) || (sSrc === slotB && sDst === slotA);
  });
};

// ═══════════════════════════════════════════════════════════════════════════
// SERVICE WIZARD
// ═══════════════════════════════════════════════════════════════════════════

export function ServiceWizard({ open, onClose, onDone, sites, cables, fournisseurs, clients, userLabel, TH, t }) {
  const [step, setStep] = useState("SELECT_SITES");
  const [currentHopIdx, setCurrentHopIdx] = useState(0);

  const [label, setLabel] = useState("");
  const [siteA, setSiteA] = useState("");
  const [siteB, setSiteB] = useState("");
  const [pathSites, setPathSites] = useState([]);
  const [noPath, setNoPath] = useState(false);
  const [hops, setHops] = useState([]);

  const [fournisseurId, setFournisseurId] = useState("");
  const [clientId, setClientId] = useState("");
  const [capacite, setCapacite] = useState("10");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [transitPorts, setTransitPorts] = useState([]);
  const [transitData, setTransitData] = useState(null);
  const [transitReco, setTransitReco] = useState([]);
  const [transitLoading, setTransitLoading] = useState(false);
  const [hopPorts, setHopPorts] = useState([]);
  const [loadingHopPorts, setLoadingHopPorts] = useState(false);
  const [allInternalCables, setAllInternalCables] = useState([]);
  const [intersalleReco, setIntersalleReco] = useState([]);

  const { findPath, getCablesBetween } = useRouteGraph(cables);

  useEffect(() => {
    if (open) {
      setStep("SELECT_SITES");
      setCurrentHopIdx(0);
      setLabel("");
      setSiteA("");
      setSiteB("");
      setPathSites([]);
      setNoPath(false);
      setHops([]);
      setFournisseurId("");
      setClientId("");
      setCapacite("10");
      setSaving(false);
      setErr("");
      setTransitData(null);
      setTransitReco([]);
      setIntersalleReco([]);
      setTransitLoading(false);
      setHopPorts([]);
      setLoadingHopPorts(false);
      
      // Charger toutes les jarretières/câbles INTERNES de la base
      supabase.from('cables_fibre')
        .select('id, cable_reference, nom, type_lien, port_source_id, port_dest_id')
        .eq('type_lien', 'INTERNE')
        .then(r => {
          setAllInternalCables(r.data || []);
        });
    }
  }, [open]);

  useEffect(() => {
    if (!siteA || !siteB || siteA === siteB) {
      setPathSites([]);
      setNoPath(false);
      return;
    }
    const path = findPath(siteA, siteB);
    if (path) {
      setPathSites(path);
      setNoPath(false);
      setHops(Array(path.length - 1).fill(null).map(() => ({
        cableId: null, portEntree: null, portSortie: null,
        siteFrom: null, siteTo: null, cable_reference: null
      })));
    } else {
      setPathSites([]);
      setNoPath(true);
    }
  }, [siteA, siteB, cables, findPath]);

  useEffect(() => {
    if (!step.startsWith("HOP_")) {
      setTransitPorts([]); setTransitData(null); setTransitReco([]); setTransitLoading(false);
      return;
    }
    const n = parseInt(step.split("_")[1], 10);
    if (n === 0 || !pathSites[n]) {
      setTransitPorts([]); setTransitData(null); setTransitReco([]); setTransitLoading(false);
      return;
    }
    setTransitLoading(true);
    setTransitData(null);
    setTransitPorts([]);
    setTransitReco([]);
    setIntersalleReco([]);
    const siteBTransit = pathSites[n];
    getTransitData(siteBTransit).then(data => {
      setTransitData(data);
      setTransitPorts(data.internalPorts);
      setTransitLoading(false);
    });
  }, [step, pathSites]);

  useEffect(() => {
    if (!transitData || !step.startsWith("HOP_")) return;
    const n = parseInt(step.split("_")[1], 10);
    if (n === 0) return;
    const portTransitIn = hops[n - 1]?.portSortie || null;
    if (!portTransitIn) { setTransitReco([]); return; }
    const portEntreeB = hops[n]?.portEntree || null;
    const siteBTransit = pathSites[n];
    const siteCNext = pathSites[n + 1];
    const cablesExterneB = (cables || []).filter(c => {
      const s = c.port_source_id?.split('-')[0];
      const d = c.port_dest_id?.split('-')[0];
      return (s === siteBTransit && d === siteCNext) || (s === siteCNext && d === siteBTransit);
    });
    const reco = findBestInternalPort({
      portTransitIn, portEntreeB,
      internalPorts: transitData.internalPorts,
      externalPorts: transitData.externalPorts,
      cablesInternes: transitData.cablesInternes,
      cablesExterneB,
    });
    setTransitReco(reco);

    // ── Détection intersalle : portTransitIn et portEntreeB dans des salles différentes ──
    if (portTransitIn && portEntreeB && transitData) {
      const allEnrichedPorts = [...transitData.internalPorts, ...transitData.externalPorts];
      const portInObj = allEnrichedPorts.find(p => p.id === portTransitIn);
      const portOutObj = allEnrichedPorts.find(p => p.id === portEntreeB);
      let salleIn = portInObj?.salle_id || null;
      let salleOut = portOutObj?.salle_id || null;

      const resolveAndApply = () => {
        const isIntersalle = salleIn && salleOut && salleIn !== salleOut;
        if (isIntersalle) {
          const intersalleCandidates = findBestIntersalleTransit({
            portTransitIn,
            portEntreeB,
            internalPorts: transitData.internalPorts,
            externalPorts: transitData.externalPorts,
            cablesInternes: transitData.cablesInternes,
            salleIn,
            salleOut,
          });
          setIntersalleReco(intersalleCandidates);
          if (intersalleCandidates.length > 0 && !hops[n]?.portTransitMid2) {
            const best = intersalleCandidates[0];
            onSelectIntersalleTransit(n, {
              portTransitMid: best.portTransitMid,
              portTransitMid2: best.portTransitMid2,
              intersalleCableId: best.intersalleCable.id,
            });
          }
        } else {
          setIntersalleReco([]);
          if (reco.length > 0 && ['PERFECT_MATCH', 'CHAIN_CONFIRMED'].includes(reco[0].matchType) && !hops[n]?.portTransitMid) {
            onSelectTransitMid(n, reco[0].portInterne.id);
          }
        }
      };

      if (!salleIn || !salleOut) {
        getSalleIdsForPorts([portTransitIn, portEntreeB]).then(missingMap => {
          if (!salleIn) salleIn = missingMap[portTransitIn] || null;
          if (!salleOut) salleOut = missingMap[portEntreeB] || null;
          resolveAndApply();
        });
      } else {
        resolveAndApply();
      }
    } else {
      setIntersalleReco([]);
      if (reco.length > 0 && ['PERFECT_MATCH', 'CHAIN_CONFIRMED'].includes(reco[0].matchType) && !hops[n]?.portTransitMid) {
        onSelectTransitMid(n, reco[0].portInterne.id);
      }
    }
  }, [hops, transitData, step, pathSites, cables]);

  const resolvedHopsJarretieres = useMemo(() => {
    const portSalleMap = transitData
      ? Object.fromEntries([...transitData.internalPorts, ...transitData.externalPorts].map(p => [p.id, p.salle_id]))
      : null;
    return hops.map((hop, idx) => {
      if (idx === 0) return null;
      const portTransitIn = hops[idx - 1]?.portSortie || null;
      const portTransitMid = hop?.portTransitMid || null;
      const portTransitMid2 = hop?.portTransitMid2 || null;
      const intersalleCableId = hop?.intersalleCableId || null;
      const portEntree = hop?.portEntree || null;
      
      const { j1: autoJ1, j2: autoJ2, intersalleCable } = resolveJarretieresForHop(
        portTransitIn, portTransitMid, portEntree, allInternalCables, portTransitMid2, intersalleCableId, portSalleMap
      );
      
      const j1Candidates = getJarretieresCandidates(portTransitIn, portTransitMid, allInternalCables, portSalleMap);
      const j2Candidates = getJarretieresCandidates(portTransitMid2, portEntree, allInternalCables, portSalleMap);
      
      const j1 = (hop?.selectedJ1Id && j1Candidates.find(c => c.id === hop.selectedJ1Id)) || autoJ1;
      const j2 = (hop?.selectedJ2Id && j2Candidates.find(c => c.id === hop.selectedJ2Id)) || autoJ2;
      
      return { j1, j2, intersalleCable, portTransitMid2 };
    });
  }, [hops, allInternalCables, transitData]);

  const totalHops = pathSites.length > 1 ? pathSites.length - 1 : 0;
  const siteName = (id) => (sites || []).find(s => s.id === id)?.name || id;

  const onSubmitSites = () => {
    setErr("");
    if (!label.trim()) { setErr("Le label du service est obligatoire."); return; }
    if (!siteA || !siteB) { setErr("Veuillez sélectionner les sites de départ et d'arrivée."); return; }
    if (siteA === siteB) { setErr("Les sites de départ et d'arrivée doivent être différents."); return; }
    if (pathSites.length === 0) { setErr("Aucun chemin disponible entre ces deux sites."); return; }
    setStep("HOP_0");
    setCurrentHopIdx(0);
  };

  const onSelectCable = (hopIdx, cable) => {
    setErr("");
    const newHops = [...hops];
    newHops[hopIdx] = {
      ...newHops[hopIdx],
      cableId: cable.id,
      portEntree: cable.portEntree,
      portSortie: cable.portSortie,
      siteFrom: cable.siteSource === pathSites[hopIdx] ? cable.siteSource : cable.siteDest,
      siteTo: cable.siteSource === pathSites[hopIdx] ? cable.siteDest : cable.siteSource,
      cable_reference: cable.cable_reference,
      selectedJ1Id: null,
      selectedJ2Id: null,
    };
    setHops(newHops);
  };

  const onSelectTransitMid = (hopIdx, portId) => {
    const newHops = [...hops];
    newHops[hopIdx] = {
      ...newHops[hopIdx],
      portTransitMid: portId,
      selectedJ1Id: null,
      selectedJ2Id: null
    };
    setHops(newHops);
  };

  const onSelectTransitMid2 = (hopIdx, portId) => {
    const newHops = [...hops];
    newHops[hopIdx] = {
      ...newHops[hopIdx],
      portTransitMid2: portId,
      selectedJ2Id: null
    };
    setHops(newHops);
  };

  const onSelectIntersalleCable = (hopIdx, cableId) => {
    const newHops = [...hops];
    newHops[hopIdx] = {
      ...newHops[hopIdx],
      intersalleCableId: cableId
    };
    setHops(newHops);
  };

  const onSelectIntersalleTransit = (hopIdx, { portTransitMid, portTransitMid2, intersalleCableId }) => {
    const newHops = [...hops];
    newHops[hopIdx] = {
      ...newHops[hopIdx],
      portTransitMid,
      portTransitMid2,
      intersalleCableId,
      selectedJ1Id: null,
      selectedJ2Id: null,
    };
    setHops(newHops);
  };

  const onSelectJarretiere1 = (hopIdx, j1Id) => {
    const newHops = [...hops];
    newHops[hopIdx] = {
      ...newHops[hopIdx],
      selectedJ1Id: j1Id
    };
    setHops(newHops);
  };

  const onSelectJarretiere2 = (hopIdx, j2Id) => {
    const newHops = [...hops];
    newHops[hopIdx] = {
      ...newHops[hopIdx],
      selectedJ2Id: j2Id
    };
    setHops(newHops);
  };

  useEffect(() => {
    if (!step.startsWith("HOP_")) {
      setHopPorts([]);
      return;
    }
    const n = parseInt(step.split("_")[1], 10);
    const fromSite = pathSites[n];
    const toSite = pathSites[n + 1];
    if (!fromSite || !toSite) {
      setHopPorts([]);
      return;
    }

    const cablesDispos = getCablesBetween(fromSite, toSite);
    const slotIds = new Set();
    cablesDispos.forEach(c => {
      if (c.portEntreeObj?.slot_id) slotIds.add(c.portEntreeObj.slot_id);
      if (c.portSortieObj?.slot_id) slotIds.add(c.portSortieObj.slot_id);
    });

    if (slotIds.size === 0) {
      setHopPorts([]);
      return;
    }

    setLoadingHopPorts(true);
    supabase.from("ports")
      .select("id, slot_id, slot_port, statut")
      .in("slot_id", Array.from(slotIds))
      .then(r => {
        setHopPorts(r.data || []);
        setLoadingHopPorts(false);
      })
      .catch(err => {
        console.error("Error fetching hop ports:", err);
        setLoadingHopPorts(false);
      });
  }, [step, pathSites, cables]);

  // Compute active hop index from step
  const activeHopIdx = useMemo(() => {
    if (!step.startsWith("HOP_")) return null;
    return parseInt(step.split("_")[1], 10);
  }, [step]);

  // Compute cablesDispos for active hop
  const activeCablesDispos = useMemo(() => {
    if (activeHopIdx === null) return [];
    const fromSite = pathSites[activeHopIdx];
    const toSite = pathSites[activeHopIdx + 1];
    if (!fromSite || !toSite) return [];
    return getCablesBetween(fromSite, toSite);
  }, [activeHopIdx, pathSites, getCablesBetween]);

  // Compute availablePortOptions for active hop
  const availablePortOptions = useMemo(() => {
    if (activeHopIdx === null || activeCablesDispos.length === 0) return [];
    
    const getPortNumber = (portStr) => {
      if (!portStr) return 0;
      const m = portStr.match(/P(\d+)$/);
      return m ? parseInt(m[1], 10) : 0;
    };

    const portMap = {};
    (hopPorts || []).forEach(p => {
      portMap[p.id] = p;
    });

    const list = [];
    activeCablesDispos.forEach(c => {
      const srcSlotId = c.portEntreeObj?.slot_id;
      const dstSlotId = c.portSortieObj?.slot_id;
      if (!srcSlotId || !dstSlotId) return;

      for (let pNum = 1; pNum <= 12; pNum++) {
        const pStr = String(pNum).padStart(2, '0');
        const pIdSrc = `${srcSlotId}P${pStr}`;
        const pIdDst = `${dstSlotId}P${pStr}`;

        const portSrc = portMap[pIdSrc];
        const portDst = portMap[pIdDst];

        if (portSrc && portDst && portSrc.statut === "LIBRE" && portDst.statut === "LIBRE") {
          list.push({
            cable: c,
            portEntree: pIdSrc,
            portSortie: pIdDst,
            cable_reference: c.cable_reference,
          });
        }
      }
    });

    list.sort((a, b) => {
      const portNumA = getPortNumber(a.portEntree);
      const portNumB = getPortNumber(b.portEntree);
      if (portNumA !== portNumB) return portNumA - portNumB;
      return a.cable_reference.localeCompare(b.cable_reference);
    });

    return list;
  }, [activeHopIdx, activeCablesDispos, hopPorts]);

  // Auto-select first available port if none is selected
  useEffect(() => {
    if (open && activeHopIdx !== null && availablePortOptions.length > 0 && !loadingHopPorts) {
      const currentPort = hops[activeHopIdx]?.portEntree;
      if (!currentPort) {
        const firstOpt = availablePortOptions[0];
        const modifiedCable = {
          ...firstOpt.cable,
          portEntree: firstOpt.portEntree,
          portSortie: firstOpt.portSortie,
        };
        onSelectCable(activeHopIdx, modifiedCable);
      }
    }
  }, [open, activeHopIdx, availablePortOptions, loadingHopPorts, hops]);

  if (!open) return null;

  const onNextHop = (hopIdx) => {
    setErr("");
    if (!hops[hopIdx] || !hops[hopIdx].cableId) {
      const from = siteName(pathSites[hopIdx]);
      const to = siteName(pathSites[hopIdx + 1]);
      setErr(`Veuillez sélectionner un câble pour la liaison ${from} → ${to}.`);
      return;
    }
    if (hopIdx > 0) {
      const portTransitInCheck = hops[hopIdx - 1]?.portSortie || null;
      if (!portTransitInCheck) {
        setErr(`Erreur : le port d'arrivée depuis ${siteName(pathSites[hopIdx - 1])} → ${siteName(pathSites[hopIdx])} n'est pas résolu. Retournez à l'étape précédente et sélectionnez un câble valide.`);
        return;
      }
      if (!hops[hopIdx].portEntree) {
        setErr(`Veuillez sélectionner le port de sortie vers ${siteName(pathSites[hopIdx + 1])} (étape 2).`);
        return;
      }
      if (!hops[hopIdx].portTransitMid) {
        setErr(`Veuillez sélectionner un port de brassage interne iODF sur le site ${siteName(pathSites[hopIdx])} (étape 3 — connexion locale requise).`);
        return;
      }
    }
    if (hopIdx + 1 < totalHops) {
      setStep(`HOP_${hopIdx + 1}`);
      setCurrentHopIdx(hopIdx + 1);
    } else {
      setStep("SELECT_FOURNISSEUR");
    }
  };

  const onNextFournisseur = () => {
    setErr("");
    if (!fournisseurId) { setErr("Veuillez sélectionner un fournisseur d'accès."); return; }
    setStep("SELECT_CLIENT");
  };

  const onNextClient = () => {
    setErr("");
    if (!clientId) { setErr("Veuillez sélectionner un client final."); return; }
    setStep("CONFIRM");
  };

  const onConfirm = async () => {
    setSaving(true); setErr("");

    try {
      // ── Auto-créer les jarretières locales manquantes ──
      const autoCreatedCables = {};

      for (let i = 1; i < hops.length; i++) {
        const portTransitIn = hops[i - 1]?.portSortie || null;
        if (!portTransitIn) {
          const siteFrom = siteName(pathSites[i - 1]);
          const siteTo = siteName(pathSites[i]);
          throw new Error(`Le port d'arrivée sur le site de transit ${siteTo} (depuis ${siteFrom}) n'est pas résolu. Retournez à l'étape ${i} et vérifiez le câble sélectionné.`);
        }
        if (!hops[i]?.portTransitMid) {
          throw new Error(`La connexion locale iODF sur le site de transit ${siteName(pathSites[i])} est manquante (étape ${i + 1}). Sélectionnez un port de brassage interne.`);
        }

        const portTransitMid = hops[i].portTransitMid;
        const portTransitMid2 = hops[i].portTransitMid2 || null;
        const intersalleCableId = hops[i].intersalleCableId || null;
        const portEntree = hops[i].portEntree;
        const jDetails = resolvedHopsJarretieres[i];
        const transitSite = siteName(pathSites[i]);

        // Détection de l'intersalle pour le hop courant (besoin de portTransitMid2)
        const hopPortSalleMap = transitData
          ? Object.fromEntries([...transitData.internalPorts, ...transitData.externalPorts].map(p => [p.id, p.salle_id]))
          : {};
        const salleIn = hopPortSalleMap[hops[i - 1]?.portSortie];
        const salleOut = hopPortSalleMap[portEntree];
        const isHopIntersalle = salleIn && salleOut && salleIn !== salleOut;

        // ── j1: intrasalle (portTransitIn → portTransitMid) ──
        if (portTransitIn && portTransitMid && portTransitIn !== portTransitMid && !jDetails?.j1) {
          const slotA = portTransitIn.split(/P\d+$/)[0];
          const slotB = portTransitMid.split(/P\d+$/)[0];
          const ref = `JAR-AUTO-${slotA.split('-').slice(-2).join('-')}_${slotB.split('-').slice(-2).join('-')}`;
          const { data: newCable, error: cabErr } = await supabase.from('cables_fibre').insert({
            cable_reference: ref,
            nom: `[JARRETIÈRE AUTO] ${transitSite}`,
            type_lien: 'INTERNE',
            type_fibre: 'Monomode',
            nombre_fibres: 1,
            fournisseur_id: null,
            capacite_totale_gbps: 0,
            capacite_disponible_gbps: 0,
            port_source_id: portTransitIn,
            port_dest_id: portTransitMid,
          }).select().single();
          if (cabErr) throw new Error(`Impossible de créer la jarretière locale j1 sur ${transitSite} : ${cabErr.message}`);
          autoCreatedCables[`j1_${i}`] = newCable;
        }

        // ── j2: intrasalle (portTransitMid2 → portEntree) or (portTransitMid → portEntree if same salle) ──
        if (isHopIntersalle && (!portTransitMid2 || !intersalleCableId)) {
          throw new Error(
            `Le transit sur ${transitSite} nécessite une connexion intersalle entre Salle ${salleIn} et Salle ${salleOut}. ` +
            `Aucun ODF interne (câble intersalle) n'a été trouvé. Créez d'abord un câble INTERNE entre ces deux salles.`
          );
        }

        const effectiveMid2 = portTransitMid2 || portTransitMid;
        if (effectiveMid2 && portEntree && effectiveMid2 !== portEntree && !jDetails?.j2) {
          const slotA = effectiveMid2.split(/P\d+$/)[0];
          const slotB = portEntree.split(/P\d+$/)[0];
          const ref = `JAR-AUTO-${slotA.split('-').slice(-2).join('-')}_${slotB.split('-').slice(-2).join('-')}`;
          const { data: newCable, error: cabErr } = await supabase.from('cables_fibre').insert({
            cable_reference: ref,
            nom: `[JARRETIÈRE AUTO] ${transitSite}`,
            type_lien: 'INTERNE',
            type_fibre: 'Monomode',
            nombre_fibres: 1,
            fournisseur_id: null,
            capacite_totale_gbps: 0,
            capacite_disponible_gbps: 0,
            port_source_id: effectiveMid2,
            port_dest_id: portEntree,
          }).select().single();
          if (cabErr) throw new Error(`Impossible de créer la jarretière locale j2 sur ${transitSite} : ${cabErr.message}`);
          autoCreatedCables[`j2_${i}`] = newCable;
        }
      }

      const cid = genCid();
      const primaryHop = hops[0];

      const jonctions = [];
      let ordre = 1;

      for (let i = 0; i < hops.length; i++) {
        const hop = hops[i];
        if (!hop || !hop.cableId) continue;

        // ─── Câbles internes de transit (uniquement pour hops intermédiaires i > 0) ───
        if (i > 0) {
          const portTransitIn = hops[i - 1]?.portSortie;
          const portTransitMid = hop.portTransitMid;
          const portTransitMid2 = hop.portTransitMid2 || null;
          const jDetails = resolvedHopsJarretieres[i];
          const j1 = jDetails?.j1 || autoCreatedCables[`j1_${i}`];
          const j2 = jDetails?.j2 || autoCreatedCables[`j2_${i}`];
          const intersalleCable = jDetails?.intersalleCable || null;

          if (portTransitIn && portTransitMid && hop.portEntree) {
            // Câble interne 1 (intrasalle) : port d'arrivée → port de brassage interne (salleIn)
            if (portTransitIn !== portTransitMid && j1) {
              jonctions.push({
                ordre: ordre++,
                cable_id: j1.id,
                port_entree_id: portTransitIn,
                port_sortie_id: portTransitMid,
              });
            }

            // Câble intersalle : portTransitMid (salleIn) → portTransitMid2 (salleOut)
            if (intersalleCable && portTransitMid2 && portTransitMid !== portTransitMid2) {
              jonctions.push({
                ordre: ordre++,
                cable_id: intersalleCable.id,
                port_entree_id: portTransitMid,
                port_sortie_id: portTransitMid2,
              });
            }

            // Câble interne 2 (intrasalle) : port de brassage interne → port de départ vers site suivant
            const effectiveMid2 = portTransitMid2 || portTransitMid;
            if (effectiveMid2 !== hop.portEntree && j2) {
              jonctions.push({
                ordre: ordre++,
                cable_id: j2.id,
                port_entree_id: effectiveMid2,
                port_sortie_id: hop.portEntree,
              });
            }
          }
        }

        jonctions.push({
          ordre: ordre++,
          cable_id: hop.cableId,
          port_entree_id: hop.portEntree,
          port_sortie_id: hop.portSortie,
        });
      }

      // Appel de l'insertion et propagation atomique en base de données via RPC.
      // p_port_id est le port principal du service (portEntree du hop 0).
      // Les jonctions contiennent déjà ce port (port_entree_id) donc la RPC
      // le marquera OCCUPE via la boucle jonctions → pas de doublon.
      // p_port_id sert de référence pour le service (colonne services.port_id).
      const { data: rpcData, error: rpcErr } = await supabase.rpc(
        "create_service_with_jonctions_atomic",
        {
          p_service_id: cid,
          p_cid: cid,
          p_label: label.trim(),
          p_cable_id: primaryHop.cableId,
          p_client_id: clientId || null,
          p_fournisseur_id: fournisseurId || null,
          p_port_id: primaryHop.portEntree,
          p_jonctions: jonctions,
          p_history_action: `Service créé via wizard : ${cid} — ${label.trim()} (${siteA}→${siteB})`,
          p_created_by: userLabel || null,
          p_capacite_gbps: Number(capacite) || 0
        }
      );

      if (rpcErr) throw rpcErr;

      setSaving(false);
      onDone();

    } catch (e) {
      setErr(e.message || "Erreur lors de la création du service. Veuillez réessayer.");
      setSaving(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case "SELECT_SITES":
        return (
          <SelectSitesStep
            label={label}
            setLabel={setLabel}
            siteA={siteA}
            setSiteA={setSiteA}
            siteB={siteB}
            setSiteB={setSiteB}
            sites={sites}
            pathSites={pathSites}
            noPath={noPath}
            TH={TH}
            onClose={onClose}
            onSubmitSites={onSubmitSites}
            siteName={siteName}
            setErr={setErr}
          />
        );
      case "SELECT_FOURNISSEUR":
        return (
          <SelectFournisseurStep
            pathSites={pathSites}
            sites={sites}
            fournisseurId={fournisseurId}
            setFournisseurId={setFournisseurId}
            fournisseurs={fournisseurs}
            cables={cables}
            hops={hops}
            totalHops={totalHops}
            TH={TH}
            siteA={siteA}
            setStep={setStep}
            setCurrentHopIdx={setCurrentHopIdx}
            setErr={setErr}
            onNextFournisseur={onNextFournisseur}
            siteName={siteName}
          />
        );
      case "SELECT_CLIENT":
        return (
          <SelectClientStep
            pathSites={pathSites}
            sites={sites}
            clientId={clientId}
            setClientId={setClientId}
            clients={clients}
            capacite={capacite}
            setCapacite={setCapacite}
            totalHops={totalHops}
            TH={TH}
            siteB={siteB}
            setStep={setStep}
            setErr={setErr}
            onNextClient={onNextClient}
            siteName={siteName}
          />
        );
      case "CONFIRM":
        return (
          <ConfirmStep
            pathSites={pathSites}
            sites={sites}
            hops={hops}
            totalHops={totalHops}
            fournisseurId={fournisseurId}
            fournisseurs={fournisseurs}
            clientId={clientId}
            clients={clients}
            capacite={capacite}
            label={label}
            saving={saving}
            TH={TH}
            setStep={setStep}
            setErr={setErr}
            onConfirm={onConfirm}
            siteName={siteName}
            resolvedJarretieresList={resolvedHopsJarretieres}
          />
        );
      default:
        if (step.startsWith("HOP_")) {
          return (
            <HopStep
              n={activeHopIdx}
              pathSites={pathSites}
              sites={sites}
              hops={hops}
              loadingHopPorts={loadingHopPorts}
              availablePortOptions={availablePortOptions}
              transitReco={transitReco}
              transitPorts={transitPorts}
              transitLoading={transitLoading}
              totalHops={totalHops}
              TH={TH}
              setStep={setStep}
              setCurrentHopIdx={setCurrentHopIdx}
              setErr={setErr}
              onSelectCable={onSelectCable}
              onSelectTransitMid={onSelectTransitMid}
              onNextHop={onNextHop}
              siteName={siteName}
              resolvedJarretieres={resolvedHopsJarretieres[activeHopIdx]}
              allInternalCables={allInternalCables}
              onSelectJarretiere1={onSelectJarretiere1}
              onSelectJarretiere2={onSelectJarretiere2}
              intersalleReco={intersalleReco}
              transitData={transitData}
              onSelectTransitMid2={onSelectTransitMid2}
              onSelectIntersalleCable={onSelectIntersalleCable}
            />
          );
        }
        return null;
    }
  };

  const stepTitle = () => {
    if (step === "SELECT_SITES") return "Nouveau service — Définir la route";
    if (step.startsWith("HOP_")) {
      const n = parseInt(step.split("_")[1], 10);
      return `Étape ${n + 1}/${totalHops} — Sélection câble ${siteName(pathSites[n])} › ${siteName(pathSites[n + 1])}`;
    }
    if (step === "SELECT_FOURNISSEUR") return "Sélection du fournisseur";
    if (step === "SELECT_CLIENT") return "Sélection du client final";
    if (step === "CONFIRM") return "Confirmation avant création";
    return "Nouveau service";
  };

  return (
    <Modal title={stepTitle()} onClose={saving ? undefined : onClose} TH={TH} width="720px">
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        {renderStep()}
        {err && (
          <div style={{
            background: `${TH.red}22`, border: `1px solid ${TH.red}`,
            borderRadius: "8px", padding: "8px 12px",
            color: TH.red, fontSize: "12px", marginTop: "4px"
          }}>
            {err}
          </div>
        )}
      </div>
    </Modal>
  );
}
