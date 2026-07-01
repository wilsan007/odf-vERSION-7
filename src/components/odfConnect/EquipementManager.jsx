import React, { useState, useEffect } from "react";
import { supabase, getSites, getRacks, getTechnologies, getCarteModeles, createCarte } from "../../supabase.js";

// ── Composants utilitaires ───────────────────────────────────────────────────
function Lbl({ children, TH }) {
  return (
    <label style={{ display: "block", color: TH.text2, fontSize: "10px", fontWeight: 600,
      marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
      {children}
    </label>
  );
}

function Card({ children, TH, style = {} }) {
  return (
    <div style={{ background: TH.bgCard, border: `1px solid ${TH.border}`,
      borderRadius: "12px", padding: "16px", marginBottom: "14px", ...style }}>
      {children}
    </div>
  );
}

function SectionTitle({ children, TH }) {
  return (
    <div style={{ fontWeight: 700, color: TH.text1, fontSize: "12px", marginBottom: "12px" }}>
      {children}
    </div>
  );
}

// ── Composant principal ──────────────────────────────────────────────────────
export function EquipementManager({ TH, setErr, setSuccess }) {
  const [subView, setSubView] = useState("create");

  // ─── État : Création ───────────────────────────────────────────────────────
  const [technologies, setTechnologies] = useState([]);
  const [carteModeles, setCarteModeles] = useState([]);
  const [sites, setSites] = useState([]);
  const [racks, setRacks] = useState([]);
  const [site, setSite] = useState("");
  const [rack, setRack] = useState("");
  const [eqName, setEqName] = useState("");
  const [eqType, setEqType] = useState("");             // modèle libre (ex. CIENA 6500)
  const [eqTechnologie, setEqTechnologie] = useState(""); // FK → technologies.id
  const [eqDesc, setEqDesc] = useState("");
  // shape slot : { slotNum, name, carteModeleId, carteSN, portsCount }
  const [cards, setCards] = useState([{ slotNum: 1, name: "SL01", carteModeleId: "", carteSN: "", portsCount: 12 }]);
  const [saving, setSaving] = useState(false);
  const [bulkCount, setBulkCount] = useState(2);

  // ─── État : Liste ──────────────────────────────────────────────────────────
  const [equipList, setEquipList] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [expandedEq, setExpandedEq] = useState(null);
  const [addingSlots, setAddingSlots] = useState(null);
  const [newSlots, setNewSlots] = useState([]);
  const [savingSlots, setSavingSlots] = useState(false);

  // ─── Chargements ──────────────────────────────────────────────────────────
  useEffect(() => {
    getSites().then(r => setSites(r.data || []));
    getTechnologies().then(r => setTechnologies(r.data || []));
    getCarteModeles().then(r => setCarteModeles(r.data || []));
  }, []);

  useEffect(() => {
    setRack(""); setRacks([]);
    if (site) getRacks(site, null).then(r => setRacks(r.data || []));
  }, [site]);

  useEffect(() => {
    if (subView === "list") loadEquipList();
  }, [subView]);

  const loadEquipList = async () => {
    setLoadingList(true);
    const { data } = await supabase
      .from("equipements")
      .select(`
        id, name, type, is_active, technologie_id,
        technologies(id, name),
        racks(id, name, sites(id, name)),
        equipement_slots(id, name, slot_num, ports_count,
          equipement_ports(statut)
        )
      `)
      .order("id");
    setEquipList(data || []);
    setLoadingList(false);
  };

  // ─── Gestion des slots (création) ────────────────────────────────────────
  const newSlotRow = (n) => ({ slotNum: n, name: `SL${String(n).padStart(2,"0")}`, carteModeleId: "", carteSN: "", portsCount: 12 });

  const addCard = () => setCards(p => [...p, newSlotRow(p.length + 1)]);

  const addBulk = () => {
    const start = cards.length;
    setCards(p => [...p, ...Array.from({ length: Math.max(1, bulkCount) }, (_, i) => newSlotRow(start + i + 1))]);
  };

  const removeCard = (idx) => {
    setCards(p => {
      const next = p.filter((_, i) => i !== idx);
      return next.map((c, i) => ({ ...c, slotNum: i + 1 }));
    });
  };

  const updateCard = (idx, field, val) => {
    setCards(p => p.map((c, i) => {
      if (i !== idx) return c;
      const updated = { ...c, [field]: val };
      if (field === "carteModeleId") {
        const modele = carteModeles.find(m => m.id === val);
        updated.portsCount = modele ? modele.ports_count : 12;
        if (!val) updated.carteSN = "";
      }
      return updated;
    }));
  };

  // Modèles filtrés par la technologie de l'équipement
  const filteredCarteModeles = eqTechnologie
    ? carteModeles.filter(m => !m.technologie_id || m.technologie_id === eqTechnologie)
    : carteModeles;

  // ─── Création de l'équipement ──────────────────────────────────────────────
  const totalPorts = cards.reduce((s, c) => s + (parseInt(c.portsCount, 10) || 0), 0);
  const canCreate = site && rack && eqName.trim() && cards.length > 0 &&
    cards.every(c =>
      c.name.trim() &&
      parseInt(c.portsCount, 10) > 0 &&
      (!c.carteModeleId || c.carteSN.trim())
    );

  const doCreate = async () => {
    setSaving(true); setErr(""); setSuccess("");
    try {
      const { data: existing } = await supabase.from("equipements").select("id").eq("rack_id", rack);
      const n = (existing?.length || 0) + 1;
      const eqId = `${rack}-EQ${n}`;

      const { error: e1 } = await supabase.from("equipements").insert({
        id: eqId, rack_id: rack, name: eqName.trim(),
        type: eqType.trim() || null,
        technologie_id: eqTechnologie || null,
        description: eqDesc || null, is_active: true,
      });
      if (e1) throw e1;

      for (const c of cards) {
        let carteId = null;
        if (c.carteModeleId) {
          const { data: carteData, error: carteErr } = await createCarte({
            modele_id: c.carteModeleId,
            serial_number: c.carteSN.trim() || null,
            etat: "INSTALLEE",
          });
          if (carteErr) throw carteErr;
          carteId = carteData.id;
        }
        const slotId = `${eqId}_SL${String(c.slotNum).padStart(2,"0")}`;
        const { error: e2 } = await supabase.from("equipement_slots").insert({
          id: slotId, equipement_id: eqId,
          slot_num: c.slotNum, name: c.name.trim(),
          ports_count: parseInt(c.portsCount, 10),
          carte_id: carteId,
        });
        if (e2) throw e2;
      }

      const withCard = cards.filter(c => c.carteModeleId).length;
      setSuccess(`✅ "${eqName}" créé (${eqId}) — ${cards.length} slot(s) dont ${withCard} avec carte, ${totalPorts} ports générés.`);
      setEqName(""); setEqType(""); setEqTechnologie(""); setEqDesc("");
      setCards([newSlotRow(1)]);
    } catch (e) {
      setErr("Erreur : " + (e.message || JSON.stringify(e)));
    }
    setSaving(false);
  };

  // ─── Ajout de cartes à un équipement existant ─────────────────────────────
  const startAddSlots = (eq) => {
    const n = (eq.equipement_slots?.length || 0) + 1;
    setAddingSlots(eq.id);
    setNewSlots([{ slotNum: n, name: `SL${String(n).padStart(2,"0")}`, carteModeleId: "", carteSN: "", portsCount: 12 }]);
  };

  const doAddSlots = async (eqId) => {
    setSavingSlots(true);
    try {
      for (const s of newSlots) {
        let carteId = null;
        if (s.carteModeleId) {
          const { data: carteData, error: carteErr } = await createCarte({
            modele_id: s.carteModeleId,
            serial_number: s.carteSN.trim() || null,
            etat: "INSTALLEE",
          });
          if (carteErr) throw carteErr;
          carteId = carteData.id;
        }
        const slotId = `${eqId}_SL${String(s.slotNum).padStart(2,"0")}`;
        const { error } = await supabase.from("equipement_slots").insert({
          id: slotId, equipement_id: eqId,
          slot_num: s.slotNum, name: s.name.trim(),
          ports_count: parseInt(s.portsCount, 10),
          carte_id: carteId,
        });
        if (error) throw error;
      }
      const addedPorts = newSlots.reduce((s, sl) => s + (parseInt(sl.portsCount, 10) || 0), 0);
      setSuccess(`✅ ${newSlots.length} slot(s) ajouté(s) à ${eqId} (${addedPorts} ports générés).`);
      setAddingSlots(null);
      loadEquipList();
    } catch (e) {
      setErr("Erreur : " + (e.message || JSON.stringify(e)));
    }
    setSavingSlots(false);
  };

  // ─── Styles partagés ──────────────────────────────────────────────────────
  const inp = {
    background: TH.bgInput, border: `1px solid ${TH.border2}`,
    borderRadius: "8px", padding: "8px 10px", color: TH.text1,
    fontSize: "12px", outline: "none", width: "100%", boxSizing: "border-box",
  };

  // ─── Rendu ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Onglets secondaires */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "20px" }}>
        {[
          { key: "create", label: "➕ Créer un équipement" },
          { key: "list",   label: "📋 Équipements existants" },
        ].map(v => (
          <button key={v.key} onClick={() => setSubView(v.key)} style={{
            padding: "9px 18px", borderRadius: "10px",
            border: `1px solid ${subView === v.key ? TH.purple : TH.border}`,
            background: subView === v.key ? `${TH.purple}22` : "transparent",
            color: subView === v.key ? TH.purple : TH.text2,
            fontSize: "13px", fontWeight: 700, cursor: "pointer",
          }}>{v.label}</button>
        ))}
      </div>

      {/* ════════════════ VUE : CRÉATION ════════════════ */}
      {subView === "create" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 290px", gap: "20px", alignItems: "start" }}>

          {/* Colonne gauche : formulaire */}
          <div>
            {/* 1. Localisation */}
            <Card TH={TH}>
              <SectionTitle TH={TH}>📍 Localisation</SectionTitle>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <Lbl TH={TH}>Site</Lbl>
                  <select value={site} onChange={e => setSite(e.target.value)} style={{ ...inp, cursor: "pointer" }}>
                    <option value="">— Sélectionner —</option>
                    {sites.map(s => <option key={s.id} value={s.id}>{s.name} ({s.id})</option>)}
                  </select>
                </div>
                <div>
                  <Lbl TH={TH}>Rack</Lbl>
                  <select value={rack} onChange={e => setRack(e.target.value)} disabled={!site}
                    style={{ ...inp, cursor: site ? "pointer" : "not-allowed", opacity: site ? 1 : 0.5 }}>
                    <option value="">— Sélectionner —</option>
                    {racks.map(r => <option key={r.id} value={r.id}>{r.name} ({r.id})</option>)}
                  </select>
                </div>
              </div>
            </Card>

            {/* 2. Identité */}
            <Card TH={TH}>
              <SectionTitle TH={TH}>🏷 Identité de l'équipement</SectionTitle>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <Lbl TH={TH}>Nom</Lbl>
                  <input value={eqName} onChange={e => setEqName(e.target.value)}
                    placeholder="ex. SHELF-A" style={inp} />
                </div>
                <div>
                  <Lbl TH={TH}>Technologie</Lbl>
                  <select value={eqTechnologie} onChange={e => setEqTechnologie(e.target.value)}
                    style={{ ...inp, cursor: "pointer" }}>
                    <option value="">— Sélectionner —</option>
                    {technologies.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  {technologies.length === 0 && (
                    <div style={{ fontSize: "10px", color: "#F59E0B", marginTop: "4px" }}>
                      ⚠ Aucune technologie en base. Exécutez la migration 20260630_v9r_technologies.sql.
                    </div>
                  )}
                </div>
                <div>
                  <Lbl TH={TH}>Modèle / Marque (optionnel)</Lbl>
                  <input value={eqType} onChange={e => setEqType(e.target.value)}
                    placeholder="ex. CIENA 6500, TEJAS 1200…" style={inp} />
                </div>
                <div style={{ gridColumn: "1/-1" }}>
                  <Lbl TH={TH}>Description (optionnel)</Lbl>
                  <input value={eqDesc} onChange={e => setEqDesc(e.target.value)}
                    placeholder="Notes sur cet équipement…" style={inp} />
                </div>
              </div>
            </Card>

            {/* 3. Slots */}
            <Card TH={TH}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <SectionTitle TH={TH} style={{ marginBottom: 0 }}>📦 Slots de l'équipement</SectionTitle>
                <button onClick={addCard} style={{
                  padding: "5px 12px", borderRadius: "6px", border: `1px solid ${TH.green}`,
                  background: `${TH.green}18`, color: TH.green, fontSize: "11px", fontWeight: 700, cursor: "pointer",
                }}>+ Slot</button>
              </div>

              {carteModeles.length === 0 && (
                <div style={{ fontSize: "10px", color: "#F59E0B", marginBottom: "10px", padding: "6px 10px",
                  background: "#F59E0B11", borderRadius: "6px", border: "1px solid #F59E0B33" }}>
                  ⚠ Catalogue de cartes vide — exécutez 20260630_v9s_cartes_stock.sql pour avoir les modèles.
                </div>
              )}

              {cards.map((c, idx) => {
                const modele = carteModeles.find(m => m.id === c.carteModeleId);
                const hasCard = !!c.carteModeleId;
                return (
                  <div key={idx} style={{
                    background: TH.bgSurface, border: `1px solid ${hasCard ? TH.purple + "55" : TH.border}`,
                    borderRadius: "10px", padding: "12px", marginBottom: "8px",
                  }}>
                    {/* Ligne 1 : numéro + nom du slot */}
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                      <span style={{ fontFamily: "monospace", fontWeight: 700, color: TH.purple, fontSize: "12px", minWidth: "26px" }}>
                        {String(c.slotNum).padStart(2,"0")}
                      </span>
                      <div style={{ flex: 1 }}>
                        <input value={c.name} onChange={e => updateCard(idx, "name", e.target.value)}
                          placeholder="Nom du slot (ex. SL01)"
                          style={{ ...inp, padding: "6px 10px", fontSize: "12px" }} />
                      </div>
                      <button onClick={() => removeCard(idx)} disabled={cards.length === 1}
                        style={{ background: "none", border: "none",
                          color: cards.length === 1 ? TH.border : "#F87171",
                          cursor: cards.length === 1 ? "not-allowed" : "pointer",
                          fontSize: "18px", lineHeight: 1, padding: "0 4px" }}>
                        ×
                      </button>
                    </div>
                    {/* Ligne 2 : carte installée (optionnel) */}
                    <div style={{ background: TH.bgInput, borderRadius: "8px", padding: "10px",
                      border: `1px dashed ${hasCard ? TH.purple + "66" : TH.border + "66"}` }}>
                      <div style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase",
                        letterSpacing: "0.5px", color: hasCard ? TH.purple : TH.text3, marginBottom: "8px" }}>
                        🃏 Carte installée
                        {!hasCard && <span style={{ fontWeight: 400 }}> — optionnel</span>}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 70px", gap: "8px" }}>
                        <div>
                          <Lbl TH={TH}>Modèle de carte</Lbl>
                          <select value={c.carteModeleId} onChange={e => updateCard(idx, "carteModeleId", e.target.value)}
                            style={{ ...inp, padding: "5px 8px", fontSize: "11px", cursor: "pointer" }}>
                            <option value="">— Aucune carte —</option>
                            {filteredCarteModeles.map(m => (
                              <option key={m.id} value={m.id}>
                                {m.nom} · {m.ports_count}p{m.fabricant ? ` (${m.fabricant})` : ""}
                              </option>
                            ))}
                          </select>
                          {modele?.description && (
                            <div style={{ fontSize: "10px", color: TH.text3, marginTop: "3px" }}>{modele.description}</div>
                          )}
                        </div>
                        <div>
                          <Lbl TH={TH}>N° de série</Lbl>
                          <input value={c.carteSN} onChange={e => updateCard(idx, "carteSN", e.target.value)}
                            placeholder={hasCard ? "SN-XXXX…" : "—"} disabled={!hasCard}
                            style={{ ...inp, padding: "5px 8px", fontSize: "11px", opacity: hasCard ? 1 : 0.3 }} />
                          {hasCard && !c.carteSN.trim() && (
                            <div style={{ fontSize: "10px", color: "#F59E0B", marginTop: "3px" }}>⚠ Requis</div>
                          )}
                        </div>
                        <div>
                          <Lbl TH={TH}>Ports</Lbl>
                          <input type="number" min="1" max="256" value={c.portsCount}
                            onChange={e => updateCard(idx, "portsCount", e.target.value)}
                            style={{ ...inp, padding: "5px 8px", fontSize: "11px" }} />
                          {hasCard && modele && parseInt(c.portsCount) !== modele.ports_count && (
                            <div style={{ fontSize: "10px", color: TH.text3, marginTop: "3px" }}>Std: {modele.ports_count}p</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Ajout rapide de slots vides */}
              <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "8px",
                padding: "8px 10px", background: TH.bgSurface, borderRadius: "8px", border: `1px dashed ${TH.border}` }}>
                <span style={{ fontSize: "11px", color: TH.text3, whiteSpace: "nowrap" }}>⚡ Ajout rapide :</span>
                <input type="number" min="1" max="32" value={bulkCount}
                  onChange={e => setBulkCount(Math.max(1, parseInt(e.target.value) || 1))}
                  style={{ ...inp, width: "52px", padding: "4px 6px", fontSize: "11px" }} />
                <span style={{ fontSize: "11px", color: TH.text3, whiteSpace: "nowrap" }}>slots vides</span>
                <button onClick={addBulk} style={{
                  padding: "5px 12px", borderRadius: "6px", border: `1px solid ${TH.blue}`,
                  background: `${TH.blue}18`, color: TH.blue, fontSize: "11px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
                }}>Ajouter</button>
              </div>
            </Card>

            {/* Bouton créer */}
            <button onClick={doCreate} disabled={!canCreate || saving} style={{
              width: "100%", padding: "13px", borderRadius: "12px", border: "none",
              background: canCreate ? TH.purple : TH.border,
              color: canCreate ? "#fff" : TH.text3,
              fontSize: "14px", fontWeight: 700, cursor: canCreate ? "pointer" : "not-allowed",
            }}>
              {saving ? "Création en cours…" : `🖧 Créer l'équipement — ${cards.length} carte${cards.length > 1 ? "s" : ""} / ${totalPorts} ports`}
            </button>
            {!canCreate && !saving && (
              <div style={{ textAlign: "center", color: TH.text3, fontSize: "11px", marginTop: "8px" }}>
                💡 Complétez la localisation, le nom et au moins une carte valide.
              </div>
            )}
          </div>

          {/* Colonne droite : aperçu visuel du shelf (sticky) */}
          <div style={{ position: "sticky", top: "20px" }}>
            <div style={{ background: TH.bgCard, border: `1px solid ${TH.purple}44`, borderRadius: "12px", padding: "16px" }}>
              <div style={{ fontWeight: 700, color: TH.purple, fontSize: "12px", marginBottom: "6px" }}>🗂 Aperçu du shelf</div>

              {rack ? (
                <div style={{ fontSize: "10px", color: TH.text3, fontFamily: "monospace", marginBottom: "4px" }}>
                  ID prévu : {rack}-EQ?
                </div>
              ) : null}
              {eqName && <div style={{ fontSize: "13px", color: TH.text1, fontWeight: 700, marginBottom: "2px" }}>{eqName}</div>}
              <div style={{ fontSize: "10px", color: TH.purple, marginBottom: "12px" }}>{eqType}</div>

              {/* Représentation visuelle des slots / cartes */}
              <div style={{ background: TH.bgSurface, borderRadius: "8px", padding: "10px", border: `1px solid ${TH.border}`, marginBottom: "12px" }}>
                {cards.length === 0 ? (
                  <div style={{ textAlign: "center", color: TH.text3, fontSize: "11px", padding: "8px" }}>Aucun slot</div>
                ) : (
                  cards.map((c, idx) => {
                    const count = parseInt(c.portsCount, 10) || 0;
                    const modele = carteModeles.find(m => m.id === c.carteModeleId);
                    return (
                      <div key={idx} style={{
                        display: "flex", alignItems: "center", gap: "6px", marginBottom: "5px",
                        padding: "5px 7px", background: TH.bgInput, borderRadius: "5px",
                        border: `1px solid ${modele ? TH.purple + "44" : TH.border}`,
                      }}>
                        <span style={{ fontSize: "9px", color: TH.purple, fontFamily: "monospace", fontWeight: 700, minWidth: "22px" }}>
                          {String(c.slotNum).padStart(2,"0")}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "9px", color: modele ? TH.text1 : TH.text2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {modele ? modele.nom : (c.name || "—")}
                          </div>
                          {modele && c.carteSN && (
                            <div style={{ fontSize: "8px", color: TH.text3, fontFamily: "monospace" }}>S/N: {c.carteSN}</div>
                          )}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "1px" }}>
                          {Array.from({ length: Math.min(count, 24) }, (_, i) => (
                            <span key={i} style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%",
                              background: modele ? "#34D399" : "#9CA3AF", opacity: 0.75 }} />
                          ))}
                          {count > 24 && <span style={{ fontSize: "8px", color: TH.text3 }}>+{count - 24}</span>}
                        </div>
                        <span style={{ fontSize: "9px", color: TH.text3, whiteSpace: "nowrap" }}>{count}p</span>
                      </div>
                    );
                  })
                )}
              </div>

              <div style={{ padding: "8px 10px", background: `${TH.purple}11`, borderRadius: "8px", border: `1px solid ${TH.purple}33`, fontSize: "11px", color: TH.text2 }}>
                <span style={{ fontWeight: 700, color: TH.purple }}>{cards.length}</span> carte{cards.length > 1 ? "s" : ""} · {" "}
                <span style={{ fontWeight: 700, color: TH.green }}>{totalPorts}</span> ports au total
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════ VUE : LISTE ════════════════ */}
      {subView === "list" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "12px" }}>
            <button onClick={loadEquipList} style={{
              padding: "7px 14px", borderRadius: "8px", border: `1px solid ${TH.border}`,
              background: TH.bgInput, color: TH.text2, fontSize: "12px", cursor: "pointer",
            }}>🔄 Rafraîchir</button>
          </div>

          {loadingList ? (
            <div style={{ textAlign: "center", padding: "40px", color: TH.text3 }}>Chargement…</div>
          ) : equipList.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: TH.text3 }}>
              Aucun équipement enregistré. Créez-en un via "Créer un équipement".
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ background: TH.bgSurface, borderBottom: `2px solid ${TH.border}` }}>
                  {["", "ID", "Nom", "Type", "Site / Rack", "Cartes", "Ports", "Occupés", ""].map((h, i) => (
                    <th key={i} style={{ padding: "10px 12px", textAlign: "left", color: TH.text3, fontWeight: 600, fontSize: "11px" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {equipList.map((eq, i) => {
                  const isExp = expandedEq === eq.id;
                  const slotsArr = (eq.equipement_slots || []).sort((a, b) => a.slot_num - b.slot_num);
                  const totalP = slotsArr.reduce((s, sl) => s + (sl.ports_count || 0), 0);
                  const occP = slotsArr.reduce((s, sl) => s + (sl.equipement_ports || []).filter(p => p.statut === "OCCUPE").length, 0);
                  const pct = totalP > 0 ? Math.round(occP / totalP * 100) : 0;
                  const isAddingToThis = addingSlots === eq.id;

                  return (
                    <React.Fragment key={eq.id}>
                      <tr style={{ borderBottom: `1px solid ${TH.border}`, background: i % 2 === 0 ? "transparent" : TH.bgHover }}>
                        <td style={{ padding: "10px 12px", textAlign: "center", cursor: "pointer", color: TH.purple }}
                          onClick={() => setExpandedEq(isExp ? null : eq.id)}>
                          {isExp ? "▼" : "▶"}
                        </td>
                        <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: "10px", color: TH.text3 }}>{eq.id}</td>
                        <td style={{ padding: "10px 12px", fontWeight: 700, color: TH.text1 }}>{eq.name}</td>
                        <td style={{ padding: "10px 12px" }}>
                          <span style={{ background: `${TH.purple}22`, color: TH.purple, borderRadius: "5px", padding: "2px 7px", fontSize: "10px", fontWeight: 700 }}>
                            {eq.technologies?.name || eq.type || "—"}
                          </span>
                          {eq.type && eq.technologies?.name && (
                            <div style={{ fontSize: "9px", color: TH.text3, marginTop: "2px" }}>{eq.type}</div>
                          )}
                        </td>
                        <td style={{ padding: "10px 12px", color: TH.text2, fontSize: "11px" }}>
                          {eq.racks?.sites?.name} / {eq.racks?.name}
                        </td>
                        <td style={{ padding: "10px 12px", color: TH.text2 }}>{slotsArr.length}</td>
                        <td style={{ padding: "10px 12px", color: TH.green, fontWeight: 600 }}>{totalP}</td>
                        <td style={{ padding: "10px 12px" }}>
                          {occP > 0
                            ? <span style={{ color: "#F87171" }}>{occP} <span style={{ color: TH.text3, fontSize: "10px" }}>({pct}%)</span></span>
                            : <span style={{ color: TH.text3 }}>0</span>}
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <button onClick={() => { setExpandedEq(eq.id); startAddSlots(eq); }}
                            style={{ padding: "4px 10px", borderRadius: "6px", border: `1px solid ${TH.purple}`,
                              background: `${TH.purple}18`, color: TH.purple, fontSize: "10px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                            + Slot
                          </button>
                        </td>
                      </tr>

                      {isExp && (
                        <tr style={{ background: TH.bgSurface }}>
                          <td colSpan={9} style={{ padding: "14px 20px" }}>
                            {/* Grille des cartes existantes */}
                            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: isAddingToThis ? "14px" : "0" }}>
                              {slotsArr.map(sl => {
                                const ports = sl.equipement_ports || [];
                                const libres = ports.filter(p => p.statut === "LIBRE").length;
                                const occ = ports.filter(p => p.statut === "OCCUPE").length;
                                return (
                                  <div key={sl.id} style={{ background: TH.bgCard, border: `1px solid ${TH.border}`, borderRadius: "8px", padding: "10px 12px", minWidth: "140px" }}>
                                    <div style={{ fontFamily: "monospace", fontSize: "11px", fontWeight: 700, color: TH.purple, marginBottom: "6px" }}>
                                      {sl.name} <span style={{ color: TH.text3, fontWeight: 400 }}>({sl.ports_count}p)</span>
                                    </div>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "2px", marginBottom: "5px" }}>
                                      {ports.map((p, pi) => (
                                        <span key={pi} style={{
                                          display: "inline-block", width: 8, height: 8, borderRadius: "50%",
                                          background: p.statut === "LIBRE" ? "#34D399" : p.statut === "OCCUPE" ? "#F87171" : "#FBBF24",
                                        }} />
                                      ))}
                                    </div>
                                    <div style={{ fontSize: "10px", color: TH.text3 }}>
                                      <span style={{ color: "#34D399" }}>{libres}L</span> · <span style={{ color: occ > 0 ? "#F87171" : TH.text3 }}>{occ}O</span>
                                    </div>
                                  </div>
                                );
                              })}
                              {slotsArr.length === 0 && (
                                <div style={{ color: TH.text3, fontSize: "11px", padding: "8px" }}>Aucune carte dans cet équipement.</div>
                              )}
                            </div>

                            {/* Formulaire inline : ajouter des slots */}
                            {isAddingToThis && (
                              <div style={{ background: TH.bgCard, border: `1px solid ${TH.purple}44`, borderRadius: "10px", padding: "14px" }}>
                                <div style={{ fontWeight: 700, color: TH.purple, fontSize: "12px", marginBottom: "10px" }}>
                                  ➕ Nouveaux slots pour {eq.name}
                                </div>
                                {newSlots.map((s, idx) => {
                                  const modele = carteModeles.find(m => m.id === s.carteModeleId);
                                  const hasCard = !!s.carteModeleId;
                                  return (
                                    <div key={idx} style={{ background: TH.bgSurface, border: `1px solid ${hasCard ? TH.purple + "55" : TH.border}`, borderRadius: "10px", padding: "10px", marginBottom: "8px" }}>
                                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                                        <span style={{ fontFamily: "monospace", fontWeight: 700, color: TH.purple, fontSize: "11px", minWidth: "22px" }}>
                                          {String(s.slotNum).padStart(2,"0")}
                                        </span>
                                        <div style={{ flex: 1 }}>
                                          <input value={s.name}
                                            onChange={e => setNewSlots(p => p.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))}
                                            placeholder="Nom du slot" style={{ ...inp, padding: "5px 8px", fontSize: "11px" }} />
                                        </div>
                                        <button onClick={() => setNewSlots(p => p.filter((_, i) => i !== idx))}
                                          style={{ background: "none", border: "none", color: "#F87171", cursor: "pointer", fontSize: "16px", lineHeight: 1, padding: "0 2px" }}>×</button>
                                      </div>
                                      <div style={{ background: TH.bgInput, borderRadius: "7px", padding: "8px", border: `1px dashed ${hasCard ? TH.purple + "66" : TH.border + "66"}` }}>
                                        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 60px", gap: "6px" }}>
                                          <div>
                                            <Lbl TH={TH}>Modèle de carte</Lbl>
                                            <select value={s.carteModeleId}
                                              onChange={e => {
                                                const val = e.target.value;
                                                const m = carteModeles.find(x => x.id === val);
                                                setNewSlots(p => p.map((x, i) => i === idx ? { ...x, carteModeleId: val, portsCount: m ? m.ports_count : x.portsCount, carteSN: val ? x.carteSN : "" } : x));
                                              }}
                                              style={{ ...inp, padding: "4px 6px", fontSize: "10px", cursor: "pointer" }}>
                                              <option value="">— Aucune carte —</option>
                                              {filteredCarteModeles.map(m => (
                                                <option key={m.id} value={m.id}>{m.nom} · {m.ports_count}p</option>
                                              ))}
                                            </select>
                                          </div>
                                          <div>
                                            <Lbl TH={TH}>N° de série</Lbl>
                                            <input value={s.carteSN}
                                              onChange={e => setNewSlots(p => p.map((x, i) => i === idx ? { ...x, carteSN: e.target.value } : x))}
                                              placeholder={hasCard ? "S/N…" : "—"} disabled={!hasCard}
                                              style={{ ...inp, padding: "4px 6px", fontSize: "10px", opacity: hasCard ? 1 : 0.3 }} />
                                          </div>
                                          <div>
                                            <Lbl TH={TH}>Ports</Lbl>
                                            <input type="number" min="1" max="256" value={s.portsCount}
                                              onChange={e => setNewSlots(p => p.map((x, i) => i === idx ? { ...x, portsCount: e.target.value } : x))}
                                              style={{ ...inp, padding: "4px 6px", fontSize: "10px" }} />
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                                <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                                  <button onClick={() => {
                                    const n = slotsArr.length + newSlots.length + 1;
                                    setNewSlots(p => [...p, { slotNum: n, name: `SL${String(n).padStart(2,"0")}`, carteModeleId: "", carteSN: "", portsCount: 12 }]);
                                  }} style={{ padding: "6px 12px", borderRadius: "6px", border: `1px solid ${TH.green}`, background: `${TH.green}18`, color: TH.green, fontSize: "11px", fontWeight: 600, cursor: "pointer" }}>
                                    + Slot
                                  </button>
                                  <button onClick={() => doAddSlots(eq.id)}
                                    disabled={savingSlots || newSlots.length === 0 || newSlots.some(s => !s.name.trim() || (s.carteModeleId && !s.carteSN.trim()))}
                                    style={{ padding: "6px 14px", borderRadius: "6px", border: "none", background: TH.purple, color: "#fff", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}>
                                    {savingSlots ? "Sauvegarde…" : `✅ Sauvegarder (${newSlots.length} slot${newSlots.length > 1 ? "s" : ""})`}
                                  </button>
                                  <button onClick={() => setAddingSlots(null)}
                                    style={{ padding: "6px 12px", borderRadius: "6px", border: `1px solid ${TH.border}`, background: TH.bgInput, color: TH.text2, fontSize: "11px", cursor: "pointer" }}>
                                    Annuler
                                  </button>
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
