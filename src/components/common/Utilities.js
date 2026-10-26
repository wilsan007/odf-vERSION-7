import { formatPortLabel } from "../../utils/portLabel.js";

export const fmt = (d) => d
  ? new Date(d).toLocaleDateString("fr-DJ", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }) 
  : "—";

export const uid = () => Math.random().toString(36).slice(2, 9);

// Export CSV
export const exportCSV = (rows, filename) => {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csvRows = rows.map(r => 
    headers.map(h => `"${(r[h] ?? '').toString().replace(/"/g, '""')}"`).join(",")
  );
  const csv = [headers.join(","), ...csvRows].join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); 
  a.href = url; 
  a.download = filename; 
  a.click();
  URL.revokeObjectURL(url);
};

// Export PDF labels (impression navigateur)
export const exportPDFLabels = (ports) => {
  const win = window.open("", "_blank");
  if (!win) return;
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Étiquettes Ports ODF</title>
    <style>
      body{font-family:monospace;background:#fff;padding:20px;}
      .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;}
      .label{border:1px solid #333;padding:8px;font-size:9px;break-inside:avoid;}
      .label-id{font-weight:bold;font-size:10px;margin-bottom:4px;background:#1e3a5f;color:#fff;padding:2px 4px;}
      .label-row{display:flex;justify-content:space-between;}
      .st{display:inline-block;padding:1px 4px;border-radius:2px;font-weight:bold;}
      .LIBRE{background:#f1f5f9;color:#94a3b8;}
      .OCCUPE{background:#d1fae5;color:#065f46;}
      .MAUVAIS{background:#fee2e2;color:#991b1b;}
      @media print{body{padding:0;}button{display:none;}}
    </style></head><body>
    <button onclick="window.print()" style="margin-bottom:16px;padding:8px 16px;background:#1e3a5f;color:#fff;border:none;cursor:pointer;border-radius:4px;">🖨 Imprimer</button>
    <div class="grid">
    ${ports.map(p => {
      const path = [
        p.slots?.odfs?.racks?.sites?.name,
        p.slots?.odfs?.racks?.salles?.name,
        p.slots?.odfs?.racks?.name,
        p.slots?.odfs?.name,
        p.slots?.name
      ].filter(Boolean).join("/");
      return `<div class="label print-label">
        <div class="label-id">${formatPortLabel(p.id)}</div>
        <div class="label-row"><span>${p.owner || '—'}</span><span class="st ${p.statut}">${p.statut}</span></div>
        <div>CID: ${p.cid || '—'}</div>
        <div>OT: ${p.ot_num || '—'}</div>
        <div style="font-size:7px;color:#666;margin-top:4px;">${path}</div>
      </div>`;
    }).join("")}
    </div></body></html>`;
  win.document.write(html);
  win.document.close();
};
