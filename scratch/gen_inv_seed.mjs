import * as XLSX from "xlsx";
import { parseWorkbook } from "../src/components/inventory/importParser.js";
import { readFileSync, writeFileSync } from "fs";

const dir = "/Users/awalehosman/Downloads/";
const files = [
  "DARE1-Djibouti-Station Inventory-As-Built-Issue 2.0.xlsx",
  "DARE1_Mombasa_Station Inventory_Issue 2 0_NFiles.xlsx",
  "DARE1_Bosaso_Station Inventory_Issue 1 0_NFiles.xlsx",
  "DARE1_Mogadishu_Station Inventory_Issue 1.0_NFiles.xlsx",
];
const q = (v) => v == null || v === "" ? "NULL" : "'" + String(v).replace(/'/g, "''") + "'";
const b = (v) => v ? "TRUE" : "FALSE";
const jb = (o) => { const s = JSON.stringify(o||{}); return "'" + s.replace(/'/g,"''") + "'::jsonb"; };

let out = [];
out.push("-- SEED Inventaire DARE1 — généré depuis les 4 fichiers Station Inventory");
out.push("-- Idempotent : purge les documents (cascade → items) avant réinsertion.");
out.push("-- À exécuter APRÈS la migration 20260712_v10_inventory_module.sql\nBEGIN;");

const docIds = [];
const docRows = [];
const itemRows = [];
for (const f of files) {
  const wb = XLSX.read(readFileSync(dir + f), { type: "buffer" });
  const { document: d, items } = parseWorkbook(wb, f);
  docIds.push(d.id);
  docRows.push(`(${q(d.id)},${q(d.systeme)},${q(d.station)},${q(d.issue)},${d.issue_date?q(d.issue_date):"NULL"},${q(d.owner_engineer)},${q(d.approver)},${q(d.reason)},${q(d.filename)},${d.item_count})`);
  for (const it of items) {
    itemRows.push(`(${q(it.document_id)},${q(it.systeme)},${q(it.station)},${q(it.categorie)},${q(it.sheet_name)},${q(it.segment)},${q(it.line_pair)},${q(it.equip_type)},${q(it.equip_location)},${q(it.bay_sn)},${q(it.shelf_descrip)},${q(it.shelf_sn)},${q(it.tems_shelf_id)},${q(it.loc_bay)},${q(it.loc_shelf)},${q(it.loc_slot)},${q(it.description)},${q(it.part_number)},${q(it.version)},${q(it.serial_nr)},${q(it.statut_inventaire)},${b(it.is_spare)},${q(it.remarques)},${jb(it.raw)},${it.row_index})`);
  }
}
out.push(`DELETE FROM public.inventaire_documents WHERE id IN (${docIds.map(q).join(",")});`);
out.push("");
out.push("INSERT INTO public.inventaire_documents (id,systeme,station,issue,issue_date,owner_engineer,approver,reason,filename,item_count) VALUES");
out.push(docRows.join(",\n") + ";");
out.push("");
// insertion des items en paquets de 200
out.push("INSERT INTO public.inventaire_items (document_id,systeme,station,categorie,sheet_name,segment,line_pair,equip_type,equip_location,bay_sn,shelf_descrip,shelf_sn,tems_shelf_id,loc_bay,loc_shelf,loc_slot,description,part_number,version,serial_nr,statut_inventaire,is_spare,remarques,raw,row_index) VALUES");
out.push(itemRows.join(",\n") + ";");
out.push("");
out.push("UPDATE public.inventaire_documents d SET item_count = (SELECT COUNT(*) FROM public.inventaire_items i WHERE i.document_id = d.id);");
out.push("COMMIT;");
writeFileSync("supabase/seed_inventaire_dare1.sql", out.join("\n"));
console.log("Seed écrit :", itemRows.length, "items,", docRows.length, "documents");
