import * as XLSX from "xlsx";
import { readFileSync } from "fs";
const f="/Users/awalehosman/Downloads/DARE1-Djibouti-Station Inventory-As-Built-Issue 2.0.xlsx";
const wb=XLSX.read(readFileSync(f),{type:"buffer"});
for (const name of ["SLT - FP1-3","PFE","TEMS"].map(n=>wb.SheetNames.find(s=>s.includes(n.split(" ")[0]) && (n==="PFE"?/PFE/.test(s):n==="TEMS"?/TEMS/.test(s):/SLT/.test(s))))) {
  if(!name) continue;
  const rows=XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,raw:false,defval:null,blankrows:false});
  console.log("="*3, "ONGLET:", name);
  // trouver header
  let hr=-1;
  for(let i=0;i<8;i++){const j=(rows[i]||[]).map(x=>x==null?"":String(x)).join(" | ").toLowerCase(); if(j.includes("description")&&(j.includes("serial")||j.includes("part"))){hr=i;break;}}
  console.log("headerRow=",hr);
  const r0=rows[hr]||[], r1=rows[hr+1]||[];
  const w=Math.max(r0.length,r1.length);
  for(let c=0;c<w;c++){
    const a=(r0[c]==null?"":String(r0[c])).trim();
    const b=(r1[c]==null?"":String(r1[c])).trim();
    if(a||b) console.log(`  col${c}: r0="${a}" r1="${b}"`);
  }
  // une ligne de données
  const d=rows[hr+2]||[];
  console.log("  DATA row:", d.map((x,i)=>x!=null&&String(x).trim()?`[${i}]${String(x).trim().slice(0,22)}`:"").filter(Boolean).join("  "));
}
