# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

ODF Manager — fiber/ODF (répartiteur optique) infrastructure management SPA for Omega Tech / Djibouti Telecom. React 18 + Vite frontend, Supabase (Postgres + Auth) backend. Domain language is French throughout the UI, DB, and most variable names.

## Commands

- `npm run dev` — Vite dev server
- `npm run build` — production build. **Requires Node ≥ 18.** The system `node` in this environment is v12.22.9 and `vite build`/`vite dev` will fail with `SyntaxError: Unexpected reserved word`. Use a newer version via nvm first: `bash -lc 'source ~/.nvm/nvm.sh; nvm use 20; npm run build'` (v18/v20/v22 are all installed via nvm).
- `npm run preview` — preview the production build
- No test framework, no linter config (no eslint/jest/vitest in `package.json`). The numerous `*.mjs`/`*.cjs`/`*.py` scripts at the repo root and in `scratch/` are one-off diagnostic/migration/seed scripts run directly with `node`/`python3` — not an automated suite. Verification is manual (run the app, check the DB).
- DB migrations live in `supabase/migrations/*.sql`, named `YYYYMMDD_vNN<letter>_description.sql` and meant to apply in that order. There is no migration-tracking table and no `supabase db push` workflow in use here — migrations are applied by hand, either by pasting into the Supabase SQL editor or via a small `pg`-based Node script (see `scratch/run_migration_v9f_local.mjs` for the pattern: reads a `.sql` file, runs it through `pg.Client`). Because nothing tracks "already applied" migrations, **write new migrations idempotently** (`ADD COLUMN IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, `DROP TRIGGER/CONSTRAINT IF EXISTS` before recreating).

### Environment

`.env` (not committed) needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (used client-side by `src/supabase.js`). `SUPABASE_SERVICE_KEY` is also present for local scripts only — never reference it from `src/`.

## Architecture

- No router. `App.jsx` holds a `view` string in state and switches between top-level screens via a `VIEWS` map (`dashboard`, `search`, `manage`, `odfConnect`, `services`).
- Auth has two parallel paths that most components must tolerate: a real Supabase auth `session.user`, or a client-only "demo user" fallback with no backend session (`DEMO_USERS` in `src/utils/constants.js`). `App.jsx` passes `session?.user || demoUser` down; treat that union shape (`.email`/`.name`) as "the current user" rather than assuming a real auth session.
- All Supabase access goes through `src/supabase.js` — it's the real data layer (CRUD helpers per table, plus multi-step aggregation helpers like `getTransitData`/`getSitePorts`). `src/supabaseClient.js` is a dead duplicate client, not imported anywhere; don't extend it.
- Data loading pattern used everywhere: fetch full lists into component state on mount, then filter/search/derive client-side (no server-side pagination or filtering). Follow this pattern for new list views rather than introducing paginated queries.
- `src/components/common/Theme.js` exports `THEMES.{dark,light}` (a `TH` palette object threaded as a prop through almost every component) and `T.{fr,en}` (`t`) translation strings. Coverage of `t.*` is partial — many components (especially under `services/`) hardcode French strings directly. Match the convention already used in the file you're editing rather than retrofitting translations everywhere.

### Domain model (telecom hierarchy)

`sites → salles (rooms) → racks → odfs → slots → ports`, with deterministic, human-readable text IDs built from the parent chain (e.g. port `ALP-S1-R1-ODF1_S01P01`), not UUIDs — see the comments above each `CREATE TABLE` in `supabase/migrations/master_migration.sql`. This is why JS code frequently derives ancestry by string-splitting an id instead of querying (e.g. `routingEngine.js: siteFromPortId`).

- Creating a site/salle/rack/odf auto-cascades a default child down to slots/ports via DB triggers (`fn_after_site_insert` → salle → `fn_after_salle_insert` → rack → `fn_after_rack_insert` → odf → `fn_after_odf_insert` → slots → `fn_after_slot_insert` → ports). Insert at one level only; don't replicate the cascade in JS.
- ODFs are typed `INTERNE` (intra-site patch panel) or `EXTERNE` (carries inter-site fiber). `cables_fibre.type_lien` is `EXTERNE` (inter-site), `JARRETIERE` (intra-site patch cord), or `EQUIPEMENT`. Inserting/updating a `cables_fibre` row with `port_source_id`/`port_dest_id` auto-flips both ports to `OCCUPE` via `fn_auto_port_actif[_update]` triggers — don't also set port status manually from JS on cable insert.
- Port status enum is `LIBRE/OCCUPE/MAUVAIS`; service status enum is `ACTIF/SUSPENDU/RESILIE` — easy to confuse, they're unrelated columns on unrelated tables.
- `services` = capacity sold to a client routed over a chain of cables/jarretières (`service_jonctions`, ordered hops). Creation is **not** a plain insert: it goes through the `create_service_with_jonctions_atomic` Postgres RPC (called from `ServiceWizard.jsx`) so the service row, its jonctions, and the port-status flips happen in one transaction. The RPC also stamps `created_by`/`updated_by`; a `trg_services_updated_at` trigger maintains `updated_at`. Any new service-mutation code path should keep passing a user label and writing to `history` (via `addHistory()`), since neither is automatic for plain `UPDATE`s.
- `routingEngine.js`'s `useRouteGraph` builds an in-memory site graph from `EXTERNE` cables for BFS pathfinding between sites (used by `ServiceWizard` to propose multi-hop routes); `findBestInternalPort` scores candidate internal (iODF) ports for a given transit hop.
- `vue_routes_service` (DB view) reconstructs each service's route as a display string at read time — fetched via `getServiceRoutes()` and merged into the services list by `service_id` in JS, never persisted.
- `history` + `addHistory()` is the audit trail shown in `HistoryView.jsx`. Coverage is inconsistent — don't assume every mutation is logged; check the calling code first.
