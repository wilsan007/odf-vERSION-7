// ═══════════════════════════════════════════════════════════════════════════
// PARSEUR D'INVENTAIRE DARE1 — Station Inventory (.xlsx SubCom/Ciena/PFE/TEMS)
// ═══════════════════════════════════════════════════════════════════════════
// Fonctions PURES et isomorphes (navigateur + Node) : transforment un classeur
// SheetJS en { document, items } prêts à insérer dans Supabase.
//
// Robustesse : le mapping colonnes se fait PAR NOM d'en-tête (jamais par index),
// les en-têtes sur 2 lignes sont fusionnés, et chaque ligne conserve sa source
// intégrale dans `raw` → aucune perte de donnée même si une colonne n'est pas
// reconnue.

import * as XLSX from 'xlsx';

const SKIP_SHEETS = ['cover sheet', 'read me', 'readme', 'revision history'];

const NA_SET = new Set(['', 'N/A', 'NA', 'NONE', 'NULL', '-']);

const clean = (v) => (v == null ? '' : String(v).replace(/\s+/g, ' ').trim());
const isEmptyVal = (v) => NA_SET.has(clean(v).toUpperCase()) === false ? clean(v) : '';

// ── Normalisation d'un en-tête vers une clé canonique ────────────────────────
function canonKey(rawHeader) {
  const h = clean(rawHeader).toLowerCase();
  if (!h) return null;
  if (/project|^system$/.test(h)) return 'systeme';
  if (/station/.test(h)) return 'station';
  if (/^seg/.test(h)) return 'segment';
  if (/^lp$|line ?pair/.test(h)) return 'line_pair';
  if (/equip.*location/.test(h)) return 'equip_location';
  if (/^equip/.test(h)) return 'equip_type';
  if (/bay ?s\/?n/.test(h)) return 'bay_sn';
  if (/shelf ?descrip/.test(h)) return 'shelf_descrip';
  if (/shelf ?s\/?n/.test(h)) return 'shelf_sn';
  if (/tems ?shelf ?id/.test(h)) return 'tems_shelf_id';
  if (/description/.test(h)) return 'description';
  // PFE/TEMS : la colonne "Part number" est libellée "Circuit Pack Type /" en
  // ligne 0. "Circuit Pack" seul (colonne Version) ne doit PAS matcher ici.
  if (/part ?(number|no|nr)/.test(h) || /circuit pack type/.test(h)) return 'part_number';
  if (/version/.test(h)) return 'version';
  if (/serial/.test(h)) return 'serial_nr';
  if (/^bay$/.test(h)) return 'loc_bay';
  if (/^shelf$/.test(h)) return 'loc_shelf';
  if (/^slot$/.test(h)) return 'loc_slot';
  if (/^type$/.test(h)) return 'equip_type';
  return null;
}

// Catégorie d'équipement déduite du nom d'onglet
function categorieFromSheet(sheetName) {
  const s = sheetName.toLowerCase();
  if (/pfe|kv/.test(s)) return 'PFE';
  if (/tems/.test(s)) return 'TEMS';
  if (/psb/.test(s)) return 'PSB';
  if (/slte|slt/.test(s)) return 'SLTE';
  return 'AUTRE';
}

// ── Détection de la (des) ligne(s) d'en-tête ─────────────────────────────────
// On cherche la ligne contenant 'Description' + ('Serial' ou 'Part'). L'en-tête
// SubCom est sur 2 lignes (la 2e porte les sous-colonnes Bay/Shelf/Slot).
function findHeader(rows) {
  for (let i = 0; i < Math.min(rows.length, 8); i++) {
    const joined = (rows[i] || []).map(clean).join(' | ').toLowerCase();
    if (joined.includes('description') && (joined.includes('serial') || joined.includes('part'))) {
      return i;
    }
  }
  return -1;
}

// Construit colIndex → { key, header } en fusionnant l'en-tête sur 2 lignes.
function buildColumnMap(rows, headerRow) {
  const r0 = rows[headerRow] || [];
  const r1 = rows[headerRow + 1] || [];
  const width = Math.max(r0.length, r1.length);
  const cols = [];
  for (let c = 0; c < width; c++) {
    const h0 = clean(r0[c]);
    const h1 = clean(r1[c]);
    // La 2e ligne porte les sous-en-têtes DÉTAILLÉS (Bay/Shelf/Slot, Part number,
    // Version, LP, Type…) alors que la ligne 0 peut être un libellé de groupe
    // générique (« Location », « Circuit Pack Type / »). On privilégie donc la
    // clé de la 2e ligne quand elle est reconnue, sinon on retombe sur la 1re.
    const k1 = canonKey(h1);
    const header = h0 || h1;
    cols[c] = k1 ? { key: k1, header: h1 || header } : { key: canonKey(header), header };
  }
  return cols;
}

// ── Parse un onglet inventaire ───────────────────────────────────────────────
function parseSheet(ws, sheetName, ctx) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: null, blankrows: false });
  const headerRow = findHeader(rows);
  if (headerRow < 0) return [];

  const cols = buildColumnMap(rows, headerRow);
  const categorie = categorieFromSheet(sheetName);
  const dataStart = headerRow + 2; // en-tête sur 2 lignes

  const items = [];
  let currentSection = '';
  let spareMode = false;

  for (let r = dataStart; r < rows.length; r++) {
    const row = rows[r] || [];
    const nonEmpty = row.map(clean).filter(Boolean);
    if (nonEmpty.length === 0) continue;

    // Ligne "section" (une seule cellule) → en-tête de bloc (ex. TEMS SPARES)
    if (nonEmpty.length === 1) {
      currentSection = nonEmpty[0];
      spareMode = /spare/i.test(currentSection);
      continue;
    }

    // Construit l'item à partir du mapping + conserve la ligne brute
    const item = {
      systeme: ctx.systeme,
      station: ctx.station,
      categorie,
      sheet_name: sheetName,
      segment: '', line_pair: '', equip_type: '', equip_location: '',
      bay_sn: '', shelf_descrip: '', shelf_sn: '', tems_shelf_id: '',
      loc_bay: '', loc_shelf: '', loc_slot: '',
      description: '', part_number: '', version: '', serial_nr: '',
      remarques: currentSection || null,
      row_index: r,
      raw: {},
    };

    for (let c = 0; c < cols.length; c++) {
      const meta = cols[c];
      const val = clean(row[c]);
      if (!meta) continue;
      if (meta.header) item.raw[meta.header] = row[c] == null ? null : row[c];
      if (meta.key && val) item[meta.key] = val;
    }

    // Une ligne réellement vide de contenu métier → ignorée
    const hasContent = item.description || item.part_number || item.serial_nr ||
      item.shelf_descrip || item.bay_sn;
    if (!hasContent) continue;

    // Station fallback
    if (!item.station) item.station = ctx.station;

    // Statut d'inventaire
    const descU = (item.description || '').toUpperCase();
    if (descU.includes('UNEQUIPPED')) item.statut_inventaire = 'UNEQUIPPED';
    else if (descU.includes('MISSING')) item.statut_inventaire = 'MISSING';
    else item.statut_inventaire = 'EQUIPE';

    // Rechange (spare)
    item.is_spare = spareMode || /\bspare/i.test(item.description || '');

    items.push(item);
  }
  return items;
}

// ── Métadonnées documentaires depuis la Cover Sheet ──────────────────────────
function parseCoverSheet(wb, fallbackStation, fileName) {
  const meta = { systeme: 'DARE1', station: fallbackStation, issue: '', issue_date: null,
    owner_engineer: '', approver: '', reason: '', filename: fileName || '' };
  const sheet = wb.SheetNames.find((n) => /cover/i.test(n));
  if (!sheet) return meta;
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, raw: false, defval: null, blankrows: false });

  let lastIssue = null;
  for (const row of rows) {
    const cells = (row || []).map(clean);
    const label = (cells[0] || '').toLowerCase();
    const val = cells.slice(1).find(Boolean) || '';
    if (label.includes('document name') && val) {
      const m = val.match(/-([A-Za-z]+)-/);
      if (m) meta.station = m[1];
    }
    if ((label.includes('owner') || label.includes('engineer')) && val) meta.owner_engineer = val;
    if (label.includes('approver') && val) meta.approver = val;
    // Table de révision : lignes { issue, date, reason }
    if (/^\d+(\.\d+)?$/.test(cells[0] || '')) {
      const issueNum = parseFloat(cells[0]);
      if (lastIssue == null || issueNum >= lastIssue) {
        lastIssue = issueNum;
        meta.issue = cells[0];
        const d = cells[1];
        if (d) {
          const parsed = new Date(d);
          if (!isNaN(parsed)) meta.issue_date = parsed.toISOString().slice(0, 10);
        }
        meta.reason = cells[2] || meta.reason;
      }
    }
  }
  return meta;
}

// Déduit une station de secours depuis le nom de fichier
function stationFromFileName(fileName) {
  if (!fileName) return 'Station';
  const m = fileName.match(/DARE1[-_]([A-Za-z]+)/i);
  return m ? m[1] : (fileName.split(/[-_]/)[1] || 'Station');
}

// ── API PRINCIPALE ───────────────────────────────────────────────────────────

/** Parse un classeur SheetJS déjà chargé. */
export function parseWorkbook(wb, fileName = '') {
  const fallbackStation = stationFromFileName(fileName);
  const doc = parseCoverSheet(wb, fallbackStation, fileName);
  // Fallback issue depuis le nom de fichier (ex. "…Issue 2.0.xlsx" → '2.0')
  if (!doc.issue && fileName) {
    const m = fileName.match(/issue[ _-]*([0-9]+)[._ ]?([0-9]+)?/i);
    if (m) doc.issue = m[2] != null ? `${m[1]}.${m[2]}` : m[1];
  }
  const ctx = { systeme: doc.systeme, station: doc.station };

  let items = [];
  for (const name of wb.SheetNames) {
    if (SKIP_SHEETS.includes(name.toLowerCase())) continue;
    items = items.concat(parseSheet(wb.Sheets[name], name, ctx));
  }

  // ID document déterministe : DARE1-STATION-Ix
  const stationSlug = doc.station.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const issueSlug = doc.issue ? `I${doc.issue.replace(/[^0-9]/g, '')}` : 'I1';
  const documentId = `${doc.systeme}-${stationSlug}-${issueSlug}`;

  // Rattache chaque item au document + fige la station
  items.forEach((it) => { it.document_id = documentId; it.station = doc.station; it.systeme = doc.systeme; });

  return {
    document: {
      id: documentId,
      systeme: doc.systeme,
      station: doc.station,
      issue: doc.issue || null,
      issue_date: doc.issue_date,
      owner_engineer: doc.owner_engineer || null,
      approver: doc.approver || null,
      reason: doc.reason || null,
      filename: doc.filename || fileName || null,
      item_count: items.length,
    },
    items,
  };
}

/** Parse un ArrayBuffer (upload navigateur). */
export function parseArrayBuffer(buf, fileName = '') {
  const wb = XLSX.read(buf, { type: 'array' });
  return parseWorkbook(wb, fileName);
}

// Résumé par catégorie pour la prévisualisation d'import
export function summarize(items) {
  const byCat = {};
  let spares = 0, serials = 0;
  for (const it of items) {
    byCat[it.categorie] = (byCat[it.categorie] || 0) + 1;
    if (it.is_spare) spares++;
    const s = (it.serial_nr || '').toUpperCase();
    if (s && !NA_SET.has(s) && s !== 'UNAVAIL') serials++;
  }
  return { total: items.length, byCat, spares, serials };
}
