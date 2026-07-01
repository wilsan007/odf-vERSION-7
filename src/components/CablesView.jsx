import React, { useState, useEffect } from "react";
import { getCables, getPortsFlat, createCable, deleteCable } from "../supabase.js";
import { Btn, Inp, Sel, Modal, Confirm, Spinner } from "./common/UI.jsx";

export default function CablesView({ t, TH }) {
  const [cables, setCables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [ports, setPorts] = useState([]);
  const [form, setForm] = useState({
    cable_reference: "",
    type_fibre: "Monomode",
    port_source_id: "",
    port_dest_id: ""
  });

  const load = () => { 
    setLoading(true); 
    getCables().then(r => {
      // Filtrer pour exclure les jarretières de transit dynamique créées pour un service (port-to-port, contiennent Pxx dans leur référence)
      const allCables = r.data || [];
      const infraCables = allCables.filter(c => !/P\d+/i.test(c.cable_reference || ""));
      setCables(infraCables);
      setLoading(false);
    }); 
  };

  useEffect(() => { 
    load(); 
    getPortsFlat().then(r => setPorts(r.data || [])); 
  }, []);

  const doAdd = async () => {
    if (!form.cable_reference || !form.port_source_id || !form.port_dest_id) return;
    await createCable({ ...form });
    setShowAdd(false); 
    load();
  };

  const doDelete = async (id) => { 
    await deleteCable(id); 
    load(); 
    setConfirm(null); 
  };

  const formatPath = (p) => {
    if (!p) return "—";
    const sl = p.slots;
    return [
      sl?.odfs?.racks?.sites?.name, 
      sl?.odfs?.racks?.name,
      sl?.odfs?.name, 
      sl?.name, 
      p.slot_port || p.id
    ].filter(Boolean).join("/");
  };

  if (loading) return <Spinner TH={TH} />;

  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "20px" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
        <Btn onClick={() => setShowAdd(true)} TH={TH}>+ {t.add}</Btn>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {cables.map(c => (
          <div 
            key={c.id || c.cable_id} 
            style={{
              background: TH.bgCard,
              border: `1px solid ${TH.border}`,
              borderRadius: "12px",
              padding: "16px",
              display: "flex",
              alignItems: "center",
              gap: "16px"
            }}>
            <div style={{ flex: 1 }}>
              <div 
                className="font-mono" 
                style={{ fontWeight: 700, color: TH.cyan, fontSize: "13px", marginBottom: "6px" }}>
                {c.cable_reference}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px" }}>
                <span style={{ color: TH.text1, fontFamily: "'JetBrains Mono',monospace", fontSize: "11px" }}>
                  {formatPath(c.port_source)}
                </span>
                <span style={{ color: TH.gold }}>⇌</span>
                <span style={{ color: TH.text1, fontFamily: "'JetBrains Mono',monospace", fontSize: "11px" }}>
                  {formatPath(c.port_dest)}
                </span>
              </div>
              <div style={{ color: TH.text3, fontSize: "10px", marginTop: "4px" }}>{c.type_fibre}</div>
            </div>
            <Btn onClick={() => setConfirm(c.id || c.cable_id)} variant="danger" size="sm" TH={TH}>✕</Btn>
          </div>
        ))}
        {!cables.length && (
          <div style={{ textAlign: "center", color: TH.text3, paddingTop: "40px" }}>
            {t.noData}
          </div>
        )}
      </div>

      {showAdd && (
        <Modal title={t.add + " câble fibre"} onClose={() => setShowAdd(false)} TH={TH}>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {[
              { label: t.cableRef, k: "cable_reference" },
              { label: t.fiberType, k: "type_fibre" },
            ].map(f => (
              <div key={f.k}>
                <label style={{ 
                  display: "block", 
                  color: TH.text2, 
                  fontSize: "11px", 
                  fontWeight: 600, 
                  marginBottom: "5px" 
                }}>{f.label}</label>
                <Inp 
                  value={form[f.k]} 
                  onChange={v => setForm(fm => ({ ...fm, [f.k]: v }))} 
                  TH={TH} 
                />
              </div>
            ))}
            {[
              { label: t.pathSource, k: "port_source_id" },
              { label: t.pathDest, k: "port_dest_id" },
            ].map(f => (
              <div key={f.k}>
                <label style={{ 
                  display: "block", 
                  color: TH.text2, 
                  fontSize: "11px", 
                  fontWeight: 600, 
                  marginBottom: "5px" 
                }}>{f.label}</label>
                <Sel 
                  value={form[f.k]} 
                  onChange={v => setForm(fm => ({ ...fm, [f.k]: v }))} 
                  TH={TH}>
                  <option value="">— Sélectionner port —</option>
                  {ports.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.slot_port || p.id} ({p.slots?.odfs?.name || p.odf_id})
                    </option>
                  ))}
                </Sel>
              </div>
            ))}
            <Btn onClick={doAdd} TH={TH}>{t.save}</Btn>
          </div>
        </Modal>
      )}

      {confirm && <Confirm message={t.confirmDelete} onYes={() => doDelete(confirm)} onNo={() => setConfirm(null)} TH={TH} t={t} />}
    </div>
  );
}
