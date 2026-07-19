// ═══════════════════════════════════════════════════════════════════════════
// COMPARAISON DE RÉVISIONS AS-BUILT — diff de composants entre deux documents
// ═══════════════════════════════════════════════════════════════════════════
// Fonctions PURES. Identité d'un composant : le n° de série réel s'il existe
// (identifiant physique le plus fiable), sinon une clé composite
// part_number|localisation|description. On calcule ajoutés / retirés / modifiés.

const NA = new Set(["", "N/A", "NA", "UNAVAIL", "NONE", "-"]);
const real = (v) => (v && !NA.has(String(v).toUpperCase().trim()) ? String(v).trim() : "");

// Clé d'identité d'un composant
export function itemKey(it) {
  const sn = real(it.serial_nr);
  if (sn) return `SN:${sn}`;
  return [
    "K", real(it.part_number), real(it.bay_sn), real(it.shelf_sn) || real(it.shelf_descrip),
    real(it.loc_slot), (it.description || "").trim(),
  ].join("|");
}

// Champs surveillés pour détecter une modification sur un composant commun
const WATCH = [
  ["statut_inventaire", "Statut"],
  ["part_number", "Part Number"],
  ["version", "Version"],
  ["description", "Description"],
  ["shelf_descrip", "Tiroir"],
  ["loc_slot", "Slot"],
  ["is_spare", "Rechange"],
];

// Normalise pour la comparaison : les variantes N/A comptent comme « vide »
// (évite les faux positifs "NA" → "N/A" qui ne sont pas de vrais changements).
const norm = (v) => {
  const s = v == null ? "" : String(v).trim();
  return NA.has(s.toUpperCase()) ? "" : s;
};

function diffFields(a, b) {
  const changes = [];
  for (const [k, label] of WATCH) {
    const na = norm(a[k]);
    const nb = norm(b[k]);
    if (na !== nb) changes.push({ field: label, from: na || "—", to: nb || "—" });
  }
  return changes;
}

/**
 * Compare deux jeux de composants (révision A = ancienne, B = nouvelle).
 * @returns {{ added, removed, modified, unchangedCount, summary }}
 */
export function compareDocuments(itemsA, itemsB) {
  const mapA = new Map();
  const mapB = new Map();
  for (const it of itemsA || []) if (!mapA.has(itemKey(it))) mapA.set(itemKey(it), it);
  for (const it of itemsB || []) if (!mapB.has(itemKey(it))) mapB.set(itemKey(it), it);

  const added = [];    // dans B, absent de A
  const removed = [];  // dans A, absent de B
  const modified = []; // dans les deux, au moins un champ différent
  let unchangedCount = 0;

  for (const [k, b] of mapB) {
    if (!mapA.has(k)) { added.push(b); continue; }
    const changes = diffFields(mapA.get(k), b);
    if (changes.length) modified.push({ before: mapA.get(k), after: b, changes });
    else unchangedCount++;
  }
  for (const [k, a] of mapA) if (!mapB.has(k)) removed.push(a);

  return {
    added, removed, modified, unchangedCount,
    summary: {
      a: mapA.size, b: mapB.size,
      added: added.length, removed: removed.length,
      modified: modified.length, unchanged: unchangedCount,
    },
  };
}
