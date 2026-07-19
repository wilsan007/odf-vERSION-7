import * as XLSX from "xlsx";
import { parseWorkbook } from "../src/components/inventory/importParser.js";
import { readFileSync } from "fs";
const NA=new Set(["","N/A","NA","UNAVAIL","NONE","-"]);
const has=v=>v&&!NA.has(String(v).toUpperCase());
const f="/Users/awalehosman/Downloads/DARE1-Djibouti-Station Inventory-As-Built-Issue 2.0.xlsx";
const {items}=parseWorkbook(XLSX.read(readFileSync(f),{type:"buffer"}),f);
const byCat={};
for(const it of items){const c=it.categorie;byCat[c]??={n:0,pn:0,ver:0,sn:0,slot:0,shelf:0};const g=byCat[c];g.n++;if(has(it.part_number))g.pn++;if(has(it.version))g.ver++;if(has(it.serial_nr))g.sn++;if(has(it.loc_slot))g.slot++;if(has(it.shelf_descrip))g.shelf++;}
console.log("Cat    | n   | part# | version | serial | slot | tiroir");
for(const[c,g]of Object.entries(byCat))
  console.log(`${c.padEnd(6)} | ${String(g.n).padStart(3)} | ${String(g.pn).padStart(5)} | ${String(g.ver).padStart(7)} | ${String(g.sn).padStart(6)} | ${String(g.slot).padStart(4)} | ${g.shelf}`);
// échantillon PFE
const pfe=items.find(x=>x.categorie==="PFE"&&has(x.part_number));
console.log("\nPFE sample:",JSON.stringify({desc:pfe.description,pn:pfe.part_number,ver:pfe.version,sn:pfe.serial_nr,slot:pfe.loc_slot,shelf:pfe.shelf_descrip}));
const tems=items.find(x=>x.categorie==="TEMS"&&has(x.part_number));
console.log("TEMS sample:",JSON.stringify({desc:tems.description,pn:tems.part_number,ver:tems.version,sn:tems.serial_nr}));
