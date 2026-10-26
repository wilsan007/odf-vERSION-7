// MembersView v15 — gestion des membres de l'entreprise (admins uniquement)
// Toutes les opérations passent par des RPC qui revérifient le rôle admin côté base.
import React, { useState, useEffect } from "react";
import {
  getTenantMembers, addTenantMember, setTenantMemberRole, removeTenantMember,
} from "../supabase.js";
import { Btn, Inp, Sel, Spinner, Confirm } from "./common/UI.jsx";
import { fmtDt } from "../utils/constants.js";

const ROLES = [
  { v: "admin", label: "Administrateur" },
  { v: "technicien", label: "Technicien" },
  { v: "lecture", label: "Lecture seule" },
];

export default function MembersView({ t, TH, user, tenant }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("technicien");
  const [busy, setBusy] = useState(false);
  const [toRemove, setToRemove] = useState(null);

  const load = async () => {
    setLoading(true);
    const { data, error: err } = await getTenantMembers();
    if (err) setError(err.message);
    else setMembers(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const run = async (fn) => {
    setBusy(true);
    setError("");
    const { error: err } = await fn();
    if (err) setError(err.message);
    await load();
    setBusy(false);
    return !err;
  };

  const doAdd = () => {
    if (!email.trim()) return;
    run(() => addTenantMember(email.trim(), role)).then(ok => { if (ok) setEmail(""); });
  };

  const card = {
    background: TH.bgCard, border: `1px solid ${TH.border}`, borderRadius: "12px",
    padding: "16px", boxShadow: TH.cardShadow,
  };

  return (
    <div style={{ padding: "20px", height: "100%", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={card}>
        <div className="font-syne" style={{ color: TH.text1, fontWeight: 700, fontSize: "15px" }}>
          {tenant?.name}
        </div>
        <div style={{ color: TH.text3, fontSize: "12px", marginTop: "4px" }}>
          Ajoutez un utilisateur déjà invité dans Supabase (Authentication › Invite user).
          Chaque membre ne voit que les données de cette entreprise.
        </div>
        <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
          <Inp value={email} onChange={setEmail} placeholder="email@entreprise.com" type="email" TH={TH} style={{ flex: "1 1 220px" }} />
          <Sel value={role} onChange={setRole} TH={TH} style={{ width: "170px" }}>
            {ROLES.map(r => <option key={r.v} value={r.v}>{r.label}</option>)}
          </Sel>
          <Btn onClick={doAdd} disabled={busy || !email.trim()} TH={TH}>Ajouter</Btn>
        </div>
        {error && (
          <div style={{ marginTop: "10px", color: TH.red, fontSize: "12px" }}>{error}</div>
        )}
      </div>

      <div style={{ ...card, overflowX: "auto" }}>
        {loading ? <Spinner TH={TH} /> : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ color: TH.text3, textAlign: "left", fontSize: "11px", textTransform: "uppercase" }}>
                <th style={{ padding: "6px 8px" }}>E-mail</th>
                <th style={{ padding: "6px 8px" }}>Rôle</th>
                <th style={{ padding: "6px 8px" }}>Depuis</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {members.map(m => {
                const self = m.user_id === user?.id;
                return (
                  <tr key={m.user_id} style={{ borderTop: `1px solid ${TH.border}`, color: TH.text1 }}>
                    <td style={{ padding: "8px" }}>
                      {m.email}{self && <span style={{ color: TH.text3 }}> (vous)</span>}
                    </td>
                    <td style={{ padding: "8px" }}>
                      <Sel value={m.role} onChange={r => run(() => setTenantMemberRole(m.user_id, r))} TH={TH} style={{ minWidth: "150px" }}>
                        {ROLES.map(r => <option key={r.v} value={r.v}>{r.label}</option>)}
                      </Sel>
                    </td>
                    <td style={{ padding: "8px", color: TH.text3 }}>{fmtDt(m.created_at)}</td>
                    <td style={{ padding: "8px", textAlign: "right" }}>
                      <Btn variant="ghost" size="sm" disabled={busy} onClick={() => setToRemove(m)} TH={TH}>Retirer</Btn>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {toRemove && (
        <Confirm
          message={`Retirer ${toRemove.email} de ${tenant?.name} ?`}
          onYes={() => { const m = toRemove; setToRemove(null); run(() => removeTenantMember(m.user_id)); }}
          onNo={() => setToRemove(null)}
          TH={TH}
          t={t}
        />
      )}
    </div>
  );
}
