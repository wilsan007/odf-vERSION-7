// ═══════════════════════════════════════════════════════════════════════════
// AFFICHAGE D'UN PORT — format unique dans toute la plateforme
//   identifiant : SC-S1-R1-ODF8_S01P02  →  affiché : SC-S1-R1-ODF8-S01P02
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Libellé d'un port à partir de son identifiant complet (ports.id).
 * @param {string|null|undefined} portId
 * @returns {string} ex: "SC-S1-R1-ODF8-S01P02", ou "" si absent
 */
export const formatPortLabel = (portId) => (portId ? String(portId).replace("_", "-") : "");
