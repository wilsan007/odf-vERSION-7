import * as XLSX from "xlsx";
import { parseWorkbook, summarize } from "../src/components/inventory/importParser.js";
import { readFileSync } from "fs";
const dir = "/Users/awalehosman/Downloads/";
const files = [
  "DARE1-Djibouti-Station Inventory-As-Built-Issue 2.0.xlsx",
  "DARE1_Mombasa_Station Inventory_Issue 2 0_NFiles.xlsx",
  "DARE1_Bosaso_Station Inventory_Issue 1 0_NFiles.xlsx",
  "DARE1_Mogadishu_Station Inventory_Issue 1.0_NFiles.xlsx",
];
let grand = 0;
for (const f of files) {
  const buf = readFileSync(dir + f);
  const wb = XLSX.read(buf, { type: "buffer" });
  const { document, items } = parseWorkbook(wb, f);
  grand += items.length;
  console.log("─".repeat(70));
  console.log("DOC:", document.id, "| station:", document.station, "| issue:", document.issue, "| date:", document.issue_date, "| owner:", document.owner_engineer, "| approver:", document.approver);
  console.log("   items:", items.length, "|", JSON.stringify(summarize(items).byCat), "| spares:", summarize(items).spares, "| serials:", summarize(items).serials);
  const s = items.find(x=>x.serial_nr && x.description);
  console.log("   sample:", JSON.stringify({cat:s.categorie,seg:s.segment,lp:s.line_pair,eq:s.equip_type,bay:s.bay_sn,shelf:s.shelf_descrip,slot:s.loc_slot,desc:s.description,pn:s.part_number,sn:s.serial_nr,st:s.statut_inventaire}));
}
console.log("═".repeat(70), "\nGRAND TOTAL items:", grand);
