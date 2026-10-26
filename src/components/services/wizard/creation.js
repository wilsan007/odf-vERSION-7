import { addHistory } from "../../../supabase.js";

// Identifiant lisible déduit du nom (convention de la table : 'SEACOM', 'AAE1'…)
export const slugId = (nom) =>
  nom.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30) || "ID";

// Même nom, sans tenir compte de la casse ni des espaces
export const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

const messageErreur = (designation, error) =>
  error?.code === "42501"
    ? `Droits insuffisants : seul un technicien ou un administrateur peut ajouter ${designation}.`
    : `Impossible d'enregistrer ${designation}` + (error?.message ? ` (${error.message})` : ".");

/**
 * Enregistre une ligne en base et trace l'action dans l'historique.
 * L'id est déduit du nom ; s'il est déjà pris, on essaie un suffixe (-2, -3…).
 * Lève une Error (message lisible) si l'enregistrement échoue.
 *
 * insert      : (data) => Promise<{ data, error }>  (ex. createClient)
 * nom         : nom saisi
 * existants   : lignes déjà chargées (pour éviter les ids pris)
 * champs      : autres colonnes à enregistrer
 * designation : "le client" (message d'erreur)
 * libelle     : "Client" (historique)
 * entite      : "client" (historique)
 */
export async function creerEnBase({ insert, nom, existants, champs = {}, userLabel, designation, libelle, entite }) {
  const name = nom.trim();
  const taken = new Set((existants || []).map(x => x.id));
  const base = slugId(name);
  let row = null, error = null;
  for (let i = 1; i <= 5 && !row; i++) {
    const id = i === 1 ? base : `${base}-${i}`;
    if (taken.has(id)) continue;
    const res = await insert({ id, nom: name, ...champs, updated_by: userLabel || null });
    if (res.error?.code === "23505") { taken.add(id); continue; }   // id déjà pris : suffixe suivant
    row = res.data; error = res.error;
    break;
  }
  if (!row) throw new Error(messageErreur(designation, error));
  // Trace d'audit : un échec d'écriture de l'historique ne doit pas bloquer l'ajout
  try {
    await addHistory({
      action: `${libelle} créé : ${row.nom}`, entity_type: entite, entity_id: row.id, user_email: userLabel,
    });
  } catch { /* ignoré */ }
  return row;
}
