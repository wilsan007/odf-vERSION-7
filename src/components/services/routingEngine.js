import { useMemo, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// ROUTING ENGINE — logique BFS, scoring de ports internes, helpers purs
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Génère un identifiant de circuit unique basé sur la date/heure courante.
 * @returns {string} ex: "DJT-20260616102134"
 */
export const genCid = () => {
  const n = new Date();
  const p = x => String(x).padStart(2, '0');
  return `DJT-${n.getFullYear()}${p(n.getMonth() + 1)}${p(n.getDate())}${p(n.getHours())}${p(n.getMinutes())}${p(n.getSeconds())}`;
};

/**
 * Extrait l'identifiant du site depuis un identifiant de port.
 * @param {string} portId
 * @returns {string|null}
 */
export const siteFromPortId = (portId) => {
  if (!portId) return null;
  return portId.split('-')[0];
};

/**
 * Labels humains associés à chaque type de correspondance de port interne.
 */
export const MATCH_LABELS = {
  PERFECT_MATCH:   '✦ Parfait — chaîne entrant→iODF→sortant vérifiée',
  CHAIN_CONFIRMED: '★ Recommandé — chemin complet vérifié',
  DIRECT_INT:      '◆ Brassage direct depuis port entrant',
  ROUTE_TO_C:      '◇ Sortie vers destination disponible',
  HAS_EXTERNAL:    '○ Port interne avec connexion externe',
  FREE_INTERNAL:   '  Port interne libre',
};

/**
 * Analyse et classe les ports internes disponibles sur un site de transit
 * selon leur adéquation à former une chaîne entrant→iODF→sortant.
 *
 * @param {object} params
 * @param {string}   params.portTransitIn      - ID du port d'entrée (depuis le hop précédent)
 * @param {string}   params.portEntreeB        - ID du port de sortie sélectionné (vers hop suivant)
 * @param {Array}    params.internalPorts      - Ports internes (iODF) du site de transit
 * @param {Array}    params.externalPorts      - Ports externes (ODF) du site de transit
 * @param {Array}    params.cablesInternes     - Câbles internes (INTERNE) existants
 * @param {Array}    params.cablesExterneB     - Câbles externes vers le site C suivant
 * @returns {Array}  Candidats triés par score (le meilleur en premier)
 */
export function findBestInternalPort({
  portTransitIn,
  portEntreeB,
  internalPorts,
  externalPorts,
  cablesInternes,
  cablesExterneB,
}) {
  const portNum = (id) => {
    const m = (id || '').match(/P(\d+)$/);
    return m ? parseInt(m[1], 10) : 0;
  };
  const slotNum = (id) => {
    const m = (id || '').match(/S(\d+)P/);
    return m ? parseInt(m[1], 10) : 0;
  };

  // Index des câbles internes : portId → [portId voisin, ...]
  const intIndex = {};
  cablesInternes.forEach(j => {
    if (!intIndex[j.port_source_id]) intIndex[j.port_source_id] = [];
    if (!intIndex[j.port_dest_id])   intIndex[j.port_dest_id]   = [];
    intIndex[j.port_source_id].push(j.port_dest_id);
    intIndex[j.port_dest_id].push(j.port_source_id);
  });

  // Ports externes qui ont une sortie vers le site C
  const portsExterneAvecSortieC = new Set(
    cablesExterneB.flatMap(c => [c.port_source_id, c.port_dest_id])
  );

  const externalPortMap = Object.fromEntries(externalPorts.map(p => [p.id, p]));
  const refPortNum = portNum(portTransitIn);
  const refSlotNum = slotNum(portTransitIn);

  const candidates = [];
  const freePorts = internalPorts.filter(p => p.statut !== 'OCCUPE');

  freePorts.forEach(portInterne => {
    const intNeighbors        = intIndex[portInterne.id] || [];
    const directIntIn         = (intIndex[portTransitIn] || []).includes(portInterne.id);
    const directIntOut        = portEntreeB ? intNeighbors.includes(portEntreeB) : false;
    const externalNeighbors   = intNeighbors.filter(pid => externalPortMap[pid]);
    const externalWithRouteToC = externalNeighbors.filter(pid => portsExterneAvecSortieC.has(pid));

    const distPort = Math.abs(portNum(portInterne.id) - refPortNum);
    const distSlot = Math.abs(slotNum(portInterne.id) - refSlotNum);

    let matchType, score;
    if (directIntIn && directIntOut) {
      matchType = 'PERFECT_MATCH';
      score = -1 + distPort * 0.01 + distSlot * 0.001;
    } else if (directIntIn && externalWithRouteToC.length > 0) {
      matchType = 'CHAIN_CONFIRMED';
      score = 0 + distPort * 0.1 + distSlot * 0.01;
    } else if (directIntIn) {
      matchType = 'DIRECT_INT';
      score = 1 + distPort * 0.1 + distSlot * 0.01;
    } else if (directIntOut) {
      matchType = 'ROUTE_TO_C';
      score = 5 + distPort * 0.1 + distSlot * 0.01;
    } else if (externalWithRouteToC.length > 0) {
      matchType = 'ROUTE_TO_C';
      score = 10 + distPort * 0.1 + distSlot * 0.01;
    } else if (externalNeighbors.length > 0) {
      matchType = 'HAS_EXTERNAL';
      score = 100 + distPort * 0.1 + distSlot * 0.01;
    } else {
      matchType = 'FREE_INTERNAL';
      score = 1000 + distPort * 0.1 + distSlot * 0.01;
    }

    let resolvedExternalPort = null;
    if (portEntreeB && directIntOut) {
      resolvedExternalPort = externalPortMap[portEntreeB];
    } else if (externalWithRouteToC.length > 0) {
      resolvedExternalPort = externalPortMap[externalWithRouteToC[0]];
    } else if (externalNeighbors.length > 0) {
      resolvedExternalPort = externalPortMap[externalNeighbors[0]];
    }

    candidates.push({ portInterne, portExterneB: resolvedExternalPort, matchType, score });
  });

  candidates.sort((a, b) =>
    a.score !== b.score
      ? a.score - b.score
      : portNum(a.portInterne.id) - portNum(b.portInterne.id)
  );
  return candidates;
}

/**
 * Trouve les câbles intersalle existants entre deux salles d'un même site.
 *
 * @param {object} params
 * @param {Array}  params.internalPorts   - Ports internes (iODF) enrichis avec salle_id
 * @param {Array}  params.cablesInternes  - Câbles INTERNES du site
 * @param {string} params.salleIn         - salle_id de la salle d'arrivée
 * @param {string} params.salleOut        - salle_id de la salle de départ
 * @returns {Array}  Câbles intersalle (source dans salleIn, dest dans salleOut ou inverse)
 */
export function findIntersalleCables({ internalPorts, externalPorts, cablesInternes, salleIn, salleOut }) {
  if (!salleIn || !salleOut || salleIn === salleOut) return [];
  const allPorts = [...(internalPorts || []), ...(externalPorts || [])];
  const portSalleMap = Object.fromEntries(allPorts.map(p => [p.id, p.salle_id]));
  return cablesInternes.filter(c => {
    const sSalle = portSalleMap[c.port_source_id];
    const dSalle = portSalleMap[c.port_dest_id];
    return (sSalle === salleIn && dSalle === salleOut) || (sSalle === salleOut && dSalle === salleIn);
  });
}

/**
 * Trouve le meilleur transit intersalle sur un site de transit où
 * le port d'arrivée et le port de sortie sont dans des salles différentes.
 *
 * Cherche un port interne dans la salle d'arrivée (portTransitMid) connecté
 * via un câble intersalle existant à un port interne dans la salle de départ
 * (portTransitMid2), puis une jarretière intrasalle de portTransitMid2 vers
 * le port de sortie externe (portEntreeB).
 *
 * @param {object} params
 * @param {string}   params.portTransitIn      - ID du port d'entrée (ODF externe, salleIn)
 * @param {string}   params.portEntreeB        - ID du port de sortie (ODF externe, salleOut)
 * @param {Array}    params.internalPorts      - Ports internes (iODF) enrichis avec salle_id
 * @param {Array}    params.externalPorts      - Ports externes (ODF) enrichis avec salle_id
 * @param {Array}    params.cablesInternes     - Câbles INTERNES existants
 * @param {string}   params.salleIn            - salle_id du port d'arrivée
 * @param {string}   params.salleOut           - salle_id du port de sortie
 * @returns {Array}  Candidats triés par score : { portTransitMid, portTransitMid2, intersalleCable, score }
 */
export function findBestIntersalleTransit({
  portTransitIn,
  portEntreeB,
  internalPorts,
  externalPorts,
  cablesInternes,
  salleIn,
  salleOut,
}) {
  if (!salleIn || !salleOut || salleIn === salleOut) return [];

  const portNum = (id) => {
    const m = (id || '').match(/P(\d+)$/);
    return m ? parseInt(m[1], 10) : 0;
  };
  const slotNum = (id) => {
    const m = (id || '').match(/S(\d+)P/);
    return m ? parseInt(m[1], 10) : 0;
  };

  const allPorts = [...(internalPorts || []), ...(externalPorts || [])];
  const portSalleMap = Object.fromEntries(allPorts.map(p => [p.id, p.salle_id]));

  const intersalleCables = findIntersalleCables({ internalPorts, externalPorts, cablesInternes, salleIn, salleOut });

  const refPortNumIn = portNum(portTransitIn);
  const refSlotNumIn = slotNum(portTransitIn);
  const refPortNumOut = portNum(portEntreeB);
  const refSlotNumOut = slotNum(portEntreeB);

  const candidates = [];

  for (const cable of intersalleCables) {
    const srcSalle = portSalleMap[cable.port_source_id];
    const isSrcInSalleIn = srcSalle === salleIn;
    const midId  = isSrcInSalleIn ? cable.port_source_id : cable.port_dest_id;
    const mid2Id = isSrcInSalleIn ? cable.port_dest_id   : cable.port_source_id;

    const distPortIn  = Math.abs(portNum(midId)  - refPortNumIn);
    const distSlotIn  = Math.abs(slotNum(midId)  - refSlotNumIn);
    const distPortOut = Math.abs(portNum(mid2Id) - refPortNumOut);
    const distSlotOut = Math.abs(slotNum(mid2Id) - refSlotNumOut);

    const score = distPortIn + distSlotIn * 0.1 + distPortOut + distSlotOut * 0.1;

    candidates.push({
      portTransitMid: midId,
      portTransitMid2: mid2Id,
      intersalleCable: cable,
      score,
    });
  }

  candidates.sort((a, b) => a.score - b.score);
  return candidates;
}

/**
 * Hook React qui construit un graphe orienté de sites à partir des câbles
 * inter-sites (type EXTERNE) et expose des utilitaires de routage BFS.
 *
 * @param {Array} cables - Liste de câbles_fibre
 * @returns {{ graph, findPath, getCablesBetween }}
 */
export function useRouteGraph(cables) {
  const graph = useMemo(() => {
    const g = {};
    const cablesExterne = (cables || []).filter(c => c.type_lien === 'EXTERNE');

    for (const c of cablesExterne) {
      const s1 = siteFromPortId(c.port_source_id);
      const s2 = siteFromPortId(c.port_dest_id);
      if (!s1 || !s2 || s1 === s2) continue;

      const entry = {
        id: c.id,
        cable_reference: c.cable_reference,
        nom: c.nom,
        portSourceId: c.port_source_id,
        portDestId: c.port_dest_id,
        siteSource: s1,
        siteDest: s2,
        fournisseur_id: c.fournisseur_id,
        fournisseurs: c.fournisseurs,
        port_source: c.port_source,
        port_dest: c.port_dest,
      };

      if (!g[s1]) g[s1] = {};
      if (!g[s1][s2]) g[s1][s2] = [];
      g[s1][s2].push(entry);

      if (!g[s2]) g[s2] = {};
      if (!g[s2][s1]) g[s2][s1] = [];
      g[s2][s1].push(entry);
    }
    return g;
  }, [cables]);

  /** Recherche BFS du chemin le plus court entre deux sites. */
  const findPath = useCallback((siteA, siteB) => {
    if (!siteA || !siteB) return null;
    if (siteA === siteB) return [siteA];

    const queue   = [[siteA]];
    const visited = new Set([siteA]);

    while (queue.length > 0) {
      const path      = queue.shift();
      const node      = path[path.length - 1];
      const neighbors = graph[node] ? Object.keys(graph[node]) : [];

      for (const neighbor of neighbors) {
        if (visited.has(neighbor)) continue;
        const cablesAvec = graph[node][neighbor] || [];
        if (cablesAvec.length === 0) continue;
        const newPath = [...path, neighbor];
        if (neighbor === siteB) return newPath;
        visited.add(neighbor);
        queue.push(newPath);
      }
    }
    return null;
  }, [graph]);

  /** Retourne les câbles disponibles entre deux sites, avec sens normalisé. */
  const getCablesBetween = useCallback((siteFrom, siteTo) => {
    const list = (graph[siteFrom] && graph[siteFrom][siteTo])
      ? graph[siteFrom][siteTo]
      : [];
    return list.map(c => ({
      ...c,
      portEntree:    c.siteSource === siteFrom ? c.portSourceId : c.portDestId,
      portSortie:    c.siteSource === siteFrom ? c.portDestId   : c.portSourceId,
      portEntreeObj: c.siteSource === siteFrom ? c.port_source  : c.port_dest,
      portSortieObj: c.siteSource === siteFrom ? c.port_dest    : c.port_source,
    }));
  }, [graph]);

  return { graph, findPath, getCablesBetween };
}
