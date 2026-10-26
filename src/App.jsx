// ODF Manager V6 — Omega Tech · Djibouti Telecom
// Clean modularized App.jsx entry point

import React, { useState, useEffect } from "react";
import { THEMES, T, BASE_CSS } from "./components/common/Theme.js";
import { Spinner } from "./components/common/UI.jsx";
import { supabase, getSession, signOut, getPortsFlat, getMyTenants, setActiveTenant } from "./supabase.js";

import AuthScreen from "./components/AuthScreen.jsx";
import Sidebar from "./components/Sidebar.jsx";
import Topbar from "./components/Topbar.jsx";
import Dashboard from "./components/Dashboard.jsx";
import SearchView from "./components/SearchView.jsx";
import ManageInfra from "./components/ManageInfra.jsx";
import OdfConnectView from "./components/OdfConnectView.jsx";
import ServicesView from "./components/ServicesView.jsx";
import InventoryView from "./components/InventoryView.jsx";
import TopologyView from "./components/TopologyView.jsx";
import DocumentsView from "./components/DocumentsView.jsx";
import CatalogueView from "./components/CatalogueView.jsx";
import MaintenanceView from "./components/MaintenanceView.jsx";
import MembersView from "./components/MembersView.jsx";
import { getOpenMaintenances } from "./supabase.js";

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  // Multi-tenant : entreprises de l'utilisateur et entreprise active
  const [tenants, setTenants] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [lang, setLang] = useState("fr");
  const [theme, setTheme] = useState("dark");
  const [view, setView] = useState("dashboard");
  const [col, setCol] = useState(false);
  const [alertCount, setAlertCount] = useState(0);
  const [maintAlert, setMaintAlert] = useState(0);

  const TH = THEMES[theme];
  const t = T[lang];

  // Inject CSS
  useEffect(() => {
    let el = document.getElementById("odf-base-css");
    if (!el) {
      el = document.createElement("style");
      el.id = "odf-base-css";
      document.head.appendChild(el);
    }
    el.textContent = BASE_CSS;
  }, []);

  // Supabase session listener
  useEffect(() => {
    getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) =>
      setSession(session)
    );
    return () => subscription.unsubscribe();
  }, []);

  // Entreprises de l'utilisateur connecté → entreprise active
  useEffect(() => {
    if (!session) { setTenants(null); setTenant(null); setActiveTenant(null); return; }
    getMyTenants().then(({ data }) => {
      const list = data || [];
      let last = null;
      try { last = localStorage.getItem("odf-tenant"); } catch { /* stockage indisponible */ }
      const pick = list.find(x => x.tenant_id === last) || list[0] || null;
      setActiveTenant(pick?.tenant_id);
      setTenants(list);
      setTenant(pick);
    });
  }, [session?.user?.id]);

  const switchTenant = (id) => {
    const next = (tenants || []).find(x => x.tenant_id === id);
    if (!next) return;
    try { localStorage.setItem("odf-tenant", id); } catch { /* stockage indisponible */ }
    setActiveTenant(id);
    setTenant(next);
    setView("dashboard");
  };

  // Alert count
  useEffect(() => {
    if (!session || !tenant) return;
    getPortsFlat().then(r => {
      const u = (r.data || []).filter(p => p.statut === "INCONNU").length;
      setAlertCount(u);
    });
    // Maintenances en retard (date prévue dépassée, non terminées)
    getOpenMaintenances().then(r => {
      if (r.error) { setMaintAlert(0); return; }
      const today = new Date().toISOString().slice(0, 10);
      setMaintAlert((r.data || []).filter(m => m.date_prevue < today).length);
    }).catch(() => setMaintAlert(0));
  }, [session, view, tenant]);

  const doLogout = async () => {
    await signOut();
  };

  if (authLoading || (session && tenants === null)) {
    return (
      <div style={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: THEMES.dark.bgBase
      }}>
        <Spinner TH={THEMES.dark} />
      </div>
    );
  }

  if (!session) {
    return (
      <AuthScreen
        lang={lang}
        setLang={setLang}
        theme={theme}
        setTheme={setTheme}
        t={t}
        TH={TH}
        onLogin={() => {}}
      />
    );
  }

  // Connecté mais rattaché à aucune entreprise : aucun accès aux données
  if (!tenant) {
    return (
      <div style={{ height: "100vh", background: TH.bgBase, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "14px", color: TH.text2, fontSize: "14px", textAlign: "center", padding: "20px" }}>
        <div className="font-syne" style={{ color: TH.text1, fontSize: "20px", fontWeight: 800 }}>Accès en attente</div>
        <div>Votre compte ({session.user.email}) n'est rattaché à aucune entreprise.<br />Demandez à un administrateur de vous ajouter.</div>
        <div><button onClick={doLogout} style={{ background: TH.bgInput, border: `1px solid ${TH.border}`, borderRadius: "8px", padding: "8px 14px", color: TH.text1, cursor: "pointer" }}>{t.logout}</button></div>
      </div>
    );
  }

  const user = { ...session.user, name: session.user.email, role: tenant.role };
  const isAdmin = tenant.role === "admin";
  const currentView = view === "members" && !isAdmin ? "dashboard" : view;

  const VIEWS = {
    dashboard: <Dashboard t={t} TH={TH} />,
    search: <SearchView t={t} TH={TH} />,
    manage: <ManageInfra t={t} TH={TH} />,
    odfConnect: <OdfConnectView t={t} TH={TH} />,
    services: <ServicesView t={t} TH={TH} user={user} />,
    inventory: <InventoryView t={t} TH={TH} />,
    topology: <TopologyView t={t} TH={TH} />,
    documents: <DocumentsView t={t} TH={TH} />,
    catalogue: <CatalogueView t={t} TH={TH} />,
    maintenance: <MaintenanceView t={t} TH={TH} user={user} />,
    members: <MembersView t={t} TH={TH} user={user} tenant={tenant} />,
  };

  const VIEW_TITLES = {
    dashboard: t.dashboard,
    search: t.search,
    manage: t.manage,
    odfConnect: t.odfConnect,
    services: t.services,
    inventory: t.inventory,
    topology: t.topology,
    documents: t.documents,
    catalogue: t.catalogue,
    maintenance: t.maintenance,
    members: t.members,
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: TH.bgBase, overflow: "hidden" }}>
      <Sidebar
        view={currentView}
        setView={setView}
        col={col}
        setCol={setCol}
        lang={lang}
        setLang={setLang}
        theme={theme}
        setTheme={setTheme}
        t={t}
        TH={TH}
        user={user}
        tenant={tenant}
        tenants={tenants}
        onSwitchTenant={switchTenant}
        isAdmin={isAdmin}
        onLogout={doLogout}
        alertCount={alertCount}
        maintAlert={maintAlert}
      />
      <div style={{ flex: 1, display: "flex", flexTriangle: "column", flexDirection: "column", overflow: "hidden" }}>
        <Topbar title={VIEW_TITLES[currentView]} t={t} TH={TH} />
        {/* key : remonte toutes les vues au changement d'entreprise (aucun état croisé) */}
        <div key={tenant.tenant_id} style={{ flex: 1, overflow: "hidden" }}>
          {VIEWS[currentView]}
        </div>
      </div>
    </div>
  );
}
