import React, { useState, useEffect } from "react";
import { 
  getSites, 
  getRacks, 
  getOdfs, 
  getSlots, 
  getPorts, 
  updatePort 
} from "../supabase.js";
import { Bdg, Spinner, Btn, Sel, Inp } from "./common/UI.jsx";
import { formatPortLabel } from "../utils/portLabel.js";

const STATUTS = ["LIBRE", "OCCUPE", "MAUVAIS", "INCONNU"];

export default function ODFPanel({ t, TH }) {
  const [sites, setSites] = useState([]);
  const [racks, setRacks] = useState([]);
  const [odfs, setOdfs] = useState([]);
  const [slots, setSlots] = useState([]);
  const [ports, setPorts] = useState([]);
  const [selSite, setSelSite] = useState("");
  const [selRack, setSelRack] = useState("");
  const [selOdf, setSelOdf] = useState("");
  const [selSlot, setSelSlot] = useState("");
  const [selPort, setSelPort] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { 
    getSites().then(r => setSites(r.data || [])); 
  }, []);

  useEffect(() => {
    if (selSite) { 
      getRacks(selSite).then(r => setRacks(r.data || [])); 
      setSelRack(""); 
      setSelOdf(""); 
      setSelSlot(""); 
      setPorts([]); 
    } else { 
      setRacks([]); 
    }
  }, [selSite]);

  useEffect(() => {
    if (selRack) { 
      getOdfs(selRack).then(r => setOdfs(r.data || [])); 
      setSelOdf(""); 
      setSelSlot(""); 
      setPorts([]); 
    } else { 
      setOdfs([]); 
    }
  }, [selRack]);

  useEffect(() => {
    if (selOdf) { 
      getSlots(selOdf).then(r => setSlots(r.data || [])); 
      setSelSlot(""); 
      setPorts([]); 
    } else { 
      setSlots([]); 
    }
  }, [selOdf]);

  useEffect(() => {
    if (selSlot) {
      setLoading(true);
      getPorts(selSlot)
        .then(r => {
          setPorts(r.data || []);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else { 
      setPorts([]); 
    }
  }, [selSlot]);

  const handleSavePort = async (portId, data) => {
    await updatePort(portId, data);
    const r = await getPorts(selSlot);
    setPorts(r.data || []);
    setSelPort(null);
  };

  const pathBar = [
    sites.find(s => s.id === selSite)?.name,
    racks.find(r => r.id === selRack)?.name,
    odfs.find(o => o.id === selOdf)?.name,
    slots.find(s => s.id === selSlot)?.name,
  ].filter(Boolean).join(" › ");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Filtres en cascade */}
      <div style={{ padding: "14px 20px", borderBottom: `1px solid ${TH.border}`, flexShrink: 0 }}>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {[
            { label: t.selectSite, val: selSite, set: setSelSite, items: sites, idK: "id", nmK: "name" },
            { label: t.selectRack, val: selRack, set: setSelRack, items: racks, idK: "id", nmK: "name" },
            { label: t.selectOdf,  val: selOdf,  set: setSelOdf,  items: odfs,  idK: "id", nmK: "name" },
            { label: t.selectSlot, val: selSlot, set: setSelSlot, items: slots, idK: "id", nmK: "name" },
          ].map((f, i) => (
            <select 
              key={i} 
              value={f.val} 
              onChange={e => f.set(e.target.value)}
              style={{
                flex: 1,
                minWidth: "130px",
                background: TH.bgInput,
                border: `1px solid ${TH.border}`,
                borderRadius: "8px",
                padding: "7px 10px",
                color: TH.text1,
                fontSize: "12px"
              }}>
              <option value="">{f.label}</option>
              {f.items.map(item => (
                <option key={item[f.idK]} value={item[f.idK]}>
                  {item[f.nmK]}
                </option>
              ))}
            </select>
          ))}
        </div>
        {pathBar && (
          <div style={{ 
            marginTop: "8px", 
            color: TH.text2, 
            fontSize: "11px", 
            fontFamily: "'JetBrains Mono',monospace" 
          }}>
            📍 {pathBar}
          </div>
        )}
      </div>

      {/* Grille ports */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
        {loading && <Spinner TH={TH} />}
        {!loading && !selSlot && (
          <div style={{ textAlign: "center", color: TH.text3, marginTop: "60px", fontSize: "14px" }}>
            Sélectionnez un slot pour afficher les ports
          </div>
        )}
        {!loading && selSlot && (
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(auto-fill,minmax(120px,1fr))", 
            gap: "10px" 
          }}>
            {ports.map(p => {
              const st = p.statut || "LIBRE";
              const c = TH.sc[st] || TH.sc.LIBRE;
              return (
                <div 
                  key={p.id} 
                  onClick={() => setSelPort(p)}
                  title={`${formatPortLabel(p.id)} — ${st}`}
                  style={{
                    background: c.bg, 
                    border: `1px solid ${c.bd}`, 
                    borderRadius: "10px",
                    padding: "12px 10px", 
                    cursor: "pointer", 
                    transition: "transform .15s",
                    display: "flex", 
                    flexDirection: "column", 
                    gap: "4px"
                  }}>
                  <div 
                    className="font-mono" 
                    style={{ fontSize: "11px", fontWeight: 600, color: c.tx }}>
                    {formatPortLabel(p.id)}
                  </div>
                  <Bdg status={st} TH={TH} />
                  {p.type_port && (
                    <div title="Paire de fibres TX/RX" style={{ fontSize: "9px", color: TH.text3, letterSpacing: ".3px" }}>
                      ⇄ {p.type_port === "DUPLEX" ? "Duplex" : "Simplex"}
                    </div>
                  )}
                  {p.owner && (
                    <div style={{ 
                      fontSize: "10px", 
                      color: TH.text2, 
                      overflow: "hidden", 
                      textOverflow: "ellipsis", 
                      whiteSpace: "nowrap" 
                    }}>
                      {p.owner}
                    </div>
                  )}
                </div>
              );
            })}
            {!ports.length && (
              <div style={{ 
                gridColumn: "1/-1", 
                textAlign: "center", 
                color: TH.text3, 
                paddingTop: "40px" 
              }}>
                {t.noData}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Port Drawer */}
      {selPort && (
        <PortDrawer 
          port={selPort} 
          onClose={() => setSelPort(null)} 
          onSave={handleSavePort} 
          t={t} 
          TH={TH} 
        />
      )}
    </div>
  );
}

function PortDrawer({ port, onClose, onSave, t, TH }) {
  const [form, setForm] = useState({
    statut: port.statut || "LIBRE",
    cid: port.cid || "",
    ot_num: port.ot_num || "",
    owner: port.owner || "",
    destination: port.destination || "",
    date_activ: port.date_activ || "",
    remarques: port.remarques || "",
  });
  const [saving, setSaving] = useState(false);
  const up = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const doSave = async () => {
    setSaving(true);
    await onSave(port.id, form);
    setSaving(false);
  };

  return (
    <div 
      className="slide-r" 
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        height: "100vh",
        width: "380px",
        background: TH.bgCard,
        borderLeft: `1px solid ${TH.border}`,
        boxShadow: TH.drawerShadow,
        zIndex: 150,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden"
      }}>
      <div style={{
        padding: "18px 20px",
        borderBottom: `1px solid ${TH.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: TH.modalHeaderBg
      }}>
        <div>
          <div 
            className="font-mono" 
            style={{ fontWeight: 700, color: TH.text1, fontSize: "14px" }}>
            {formatPortLabel(port.id)}
          </div>
          <div style={{ color: TH.text2, fontSize: "11px" }}>
            {t.portDrawerTitle} — <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "10px" }}>{port.id}</span>{port.type_port ? ` · ${port.type_port === "DUPLEX" ? "Duplex" : "Simplex"}` : ""}
          </div>
        </div>
        <button 
          onClick={onClose} 
          style={{ background: "none", border: "none", color: TH.text2, fontSize: "20px", cursor: "pointer" }}>
          ×
        </button>
      </div>
      <div style={{ 
        flex: 1, 
        overflowY: "auto", 
        padding: "20px", 
        display: "flex", 
        flexDirection: "column", 
        gap: "14px" 
      }}>
        {[
          { label: t.status,      k: "statut", type: "select", opts: STATUTS },
          { label: t.cid,         k: "cid" },
          { label: "OT #",        k: "ot_num" },
          { label: t.operator,    k: "owner" },
          { label: t.destination, k: "destination" },
          { label: "Date activ.", k: "date_activ" },
          { label: t.notes,       k: "remarques" },
        ].map(f => (
          <div key={f.k}>
            <label style={{ 
              display: "block", 
              color: TH.text2, 
              fontSize: "11px", 
              fontWeight: 600, 
              marginBottom: "5px" 
            }}>{f.label}</label>
            {f.type === "select" ? (
              <Sel value={form[f.k]} onChange={v => up(f.k, v)} TH={TH}>
                {f.opts.map(o => <option key={o}>{o}</option>)}
              </Sel>
            ) : (
              <Inp value={form[f.k]} onChange={v => up(f.k, v)} TH={TH} />
            )}
          </div>
        ))}
      </div>
      <div style={{ padding: "16px 20px", borderTop: `1px solid ${TH.border}`, display: "flex", gap: "10px" }}>
        <Btn onClick={doSave} disabled={saving} size="lg" TH={TH}>
          {saving ? t.saving : t.save}
        </Btn>
        <Btn onClick={onClose} variant="ghost" size="lg" TH={TH}>{t.cancel}</Btn>
      </div>
    </div>
  );
}
