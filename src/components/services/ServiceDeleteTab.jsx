import React, { useState, useMemo } from "react";
import { supabase, deleteService, deleteServiceJonctions, addHistory } from "../../supabase.js";
import { Btn, Inp, Modal } from "../common/UI.jsx";

// ═══════════════════════════════════════════════════════════════════════════
// SERVICE DELETE TAB — onglet de suppression de service
// L'utilisateur doit rechercher par CID, sélectionner le service,
// puis confirmer la suppression avec son mot de passe.
// ═══════════════════════════════════════════════════════════════════════════

export function ServiceDeleteTab({ services, routes, user, userLabel, onDeleted, t, TH }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const userEmail = user?.email || user?.name || "";

  // Filtrer par CID uniquement
  const foundServices = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return services.filter(s =>
      (s.cid || s.id || "").toLowerCase().includes(q)
    );
  }, [services, search]);

  const handleSelect = (s) => {
    setSelected(s);
    setError("");
    setSuccess("");
  };

  const openConfirm = () => {
    if (!selected) return;
    setPassword("");
    setError("");
    setShowConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!selected) return;
    if (!password.trim()) {
      setError(t.deleteTabPasswordLabel);
      return;
    }

    setDeleting(true);
    setError("");

    try {
      // Vérifier le mot de passe via Supabase Auth
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: password,
      });

      if (authError) {
        setError(t.deleteTabWrongPassword);
        setDeleting(false);
        return;
      }

      const cid = selected.cid || selected.id;

      // 1. Libérer les ports associés au CID
      await supabase.from('ports').update({ statut: 'LIBRE', cid: null }).eq('cid', cid);

      // 2. Supprimer les jonctions du service
      await deleteServiceJonctions(selected.id);

      // 3. Supprimer le service
      const { error: delError } = await deleteService(selected.id);
      if (delError) throw delError;

      // 4. Historique
      await addHistory({
        action: `Service supprimé : ${cid} — ${selected.label}`,
        entity_type: 'service',
        entity_id: selected.id,
        user_email: userLabel,
      });

      setSuccess(t.deleteTabSuccess);
      setShowConfirm(false);
      setSelected(null);
      setSearch("");
      setPassword("");
      onDeleted();
    } catch (e) {
      setError("Erreur : " + e.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "20px" }}>
      {/* En-tête */}
      <div style={{ marginBottom: "16px" }}>
        <div style={{ color: TH.text1, fontSize: "15px", fontWeight: 700, marginBottom: "4px" }}>
          {t.deleteTabTitle}
        </div>
        <div style={{ color: TH.text3, fontSize: "12px" }}>
          {t.deleteTabSelectService}
        </div>
      </div>

      {/* Barre de recherche par CID */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px", maxWidth: "600px" }}>
        <Inp
          value={search}
          onChange={(v) => { setSearch(v); setSelected(null); setError(""); setSuccess(""); }}
          placeholder={t.deleteTabSearchPlaceholder}
          TH={TH}
        />
      </div>

      {/* Message de succès */}
      {success && (
        <div style={{
          background: `${TH.green}15`, border: `1px solid ${TH.green}`,
          borderRadius: "8px", padding: "10px 14px", marginBottom: "16px",
          color: TH.green, fontSize: "13px", fontWeight: 600
        }}>
          {success}
        </div>
      )}

      {/* Message d'erreur */}
      {error && !showConfirm && (
        <div style={{
          background: `${TH.red}15`, border: `1px solid ${TH.red}`,
          borderRadius: "8px", padding: "10px 14px", marginBottom: "16px",
          color: TH.red, fontSize: "13px", fontWeight: 600
        }}>
          {error}
        </div>
      )}

      {/* Résultats de recherche */}
      {search.trim() && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
          {foundServices.length === 0 && (
            <div style={{ textAlign: "center", color: TH.text3, paddingTop: "20px", fontSize: "13px" }}>
              {t.deleteTabNoResult}
            </div>
          )}
          {foundServices.map(s => {
            const st = s.statut || "ACTIF";
            const SC_SVC = { ACTIF: TH.green, SUSPENDU: TH.gold, RESILIE: TH.red };
            const col = SC_SVC[st] || TH.text2;
            const isSelected = selected?.id === s.id;

            return (
              <div
                key={s.id}
                onClick={() => handleSelect(s)}
                style={{
                  background: isSelected ? `${TH.blue}10` : TH.bgCard,
                  border: `1px solid ${isSelected ? TH.blue : TH.border}`,
                  borderRadius: "12px", padding: "14px 16px",
                  display: "flex", alignItems: "center", gap: "12px",
                  cursor: "pointer", transition: "all .2s"
                }}
              >
                <span className="font-mono" style={{ fontWeight: 700, color: TH.cyan, fontSize: "13px" }}>
                  {s.cid || s.id}
                </span>
                <span style={{
                  fontSize: "10px", fontWeight: 700, color: col,
                  border: `1px solid ${col}`, borderRadius: "6px", padding: "2px 8px"
                }}>{st}</span>
                <span style={{ color: TH.text1, fontSize: "13px", fontWeight: 600, flex: 1 }}>
                  {s.label}
                </span>
                <span style={{ color: TH.text3, fontSize: "11px" }}>
                  {s.clients?.nom || "—"}
                </span>
                {isSelected && (
                  <span style={{
                    color: TH.blue, fontSize: "11px", fontWeight: 700,
                    background: `${TH.blue}15`, borderRadius: "6px", padding: "3px 8px"
                  }}>
                    ✓ {t.deleteTabSelectService}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Détail du service sélectionné + bouton supprimer */}
      {selected && (
        <div style={{
          background: TH.bgCard, border: `1px solid ${TH.border}`,
          borderRadius: "12px", padding: "20px", maxWidth: "600px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
            <span className="font-mono" style={{ fontWeight: 700, color: TH.cyan, fontSize: "14px" }}>
              {selected.cid || selected.id}
            </span>
            <span style={{
              fontSize: "10px", fontWeight: 700,
              color: SC_SVC(selected, TH).col,
              border: `1px solid ${SC_SVC(selected, TH).col}`,
              borderRadius: "6px", padding: "2px 8px"
            }}>{selected.statut || "ACTIF"}</span>
          </div>

          <DetailRow label="Label" value={selected.label} TH={TH} />
          <DetailRow label="Client" value={selected.clients?.nom} TH={TH} />
          <DetailRow label="Fournisseur" value={selected.fournisseurs?.nom} TH={TH} />
          <DetailRow label="Source (câble)" value={selected.cables_fibre ? `${selected.cables_fibre.cable_reference}${selected.cables_fibre.nom ? " — " + selected.cables_fibre.nom : ""}` : null} TH={TH} />
          <DetailRow label="Port d'entrée" value={selected.ports?.slot_port} TH={TH} />
          <DetailRow label="Capacité" value={selected.capacite_gbps != null ? `${selected.capacite_gbps} Gbps` : null} TH={TH} />
          <DetailRow label="Jonctions" value={selected.service_jonctions?.length || 0} TH={TH} />

          <div style={{ marginTop: "18px", display: "flex", gap: "10px" }}>
            <Btn onClick={openConfirm} variant="danger" TH={TH}>
              🗑 {t.delete}
            </Btn>
            <Btn onClick={() => setSelected(null)} variant="ghost" TH={TH}>
              {t.cancel}
            </Btn>
          </div>
        </div>
      )}

      {/* Modal de confirmation avec mot de passe */}
      {showConfirm && selected && (
        <Modal title={t.deleteTabConfirmTitle} onClose={() => { setShowConfirm(false); setError(""); }} TH={TH} width="480px">
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {/* Avertissement */}
            <div style={{
              background: `${TH.red}10`, border: `1px solid ${TH.red}40`,
              borderRadius: "8px", padding: "12px 14px",
              color: TH.red, fontSize: "12px", fontWeight: 600
            }}>
              {t.deleteTabConfirmMsg}
            </div>

            {/* Récapitulatif du service */}
            <div style={{
              background: TH.bgInput, borderRadius: "8px", padding: "12px 14px",
              display: "flex", flexDirection: "column", gap: "6px"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: TH.text2, fontSize: "11px" }}>CID</span>
                <span className="font-mono" style={{ color: TH.cyan, fontSize: "12px", fontWeight: 700 }}>
                  {selected.cid || selected.id}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: TH.text2, fontSize: "11px" }}>Label</span>
                <span style={{ color: TH.text1, fontSize: "12px", fontWeight: 600 }}>
                  {selected.label}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: TH.text2, fontSize: "11px" }}>Client</span>
                <span style={{ color: TH.text1, fontSize: "12px", fontWeight: 600 }}>
                  {selected.clients?.nom || "—"}
                </span>
              </div>
            </div>

            {/* Champ mot de passe */}
            <div>
              <label style={{
                display: "block", color: TH.text2, fontSize: "11px",
                fontWeight: 600, marginBottom: "5px"
              }}>
                {t.deleteTabPasswordLabel}
              </label>
              <input
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(""); }}
                placeholder={t.deleteTabPasswordPlaceholder}
                autoFocus
                onKeyDown={e => { if (e.key === "Enter" && !deleting) handleConfirmDelete(); }}
                style={{
                  width: "100%", background: TH.bgInput,
                  border: `1px solid ${TH.border}`, borderRadius: "8px",
                  padding: "9px 12px", color: TH.text1, fontSize: "13px",
                  outline: "none", boxSizing: "border-box"
                }}
              />
            </div>

            {/* Erreur dans la modale */}
            {error && (
              <div style={{
                background: `${TH.red}15`, border: `1px solid ${TH.red}`,
                borderRadius: "8px", padding: "8px 12px",
                color: TH.red, fontSize: "12px", fontWeight: 600
              }}>
                {error}
              </div>
            )}

            {/* Boutons */}
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "4px" }}>
              <Btn
                onClick={() => { setShowConfirm(false); setError(""); setPassword(""); }}
                variant="ghost" TH={TH} disabled={deleting}
              >
                {t.cancel}
              </Btn>
              <Btn
                onClick={handleConfirmDelete}
                variant="danger" TH={TH} disabled={deleting || !password.trim()}
              >
                {deleting ? t.deleteTabDeleting : t.delete}
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SC_SVC(service, TH) {
  const st = service.statut || "ACTIF";
  const map = { ACTIF: TH.green, SUSPENDU: TH.gold, RESILIE: TH.red };
  return { col: map[st] || TH.text2 };
}

function DetailRow({ label, value, TH }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", gap: "12px",
      padding: "6px 0", borderBottom: `1px solid ${TH.border}`
    }}>
      <span style={{ color: TH.text2, fontSize: "12px" }}>{label}</span>
      <span style={{ color: TH.text1, fontSize: "12px", fontWeight: 600, textAlign: "right" }}>
        {value || "—"}
      </span>
    </div>
  );
}
