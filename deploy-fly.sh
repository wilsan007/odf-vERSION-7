#!/usr/bin/env bash
# Déploie sur Fly.io. Lit VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY dans .env
# (clé publique « anon » : elle finit de toute façon dans le JavaScript du site ;
#  la sécurité repose sur les règles RLS, jamais sur le secret de cette clé).
set -euo pipefail
cd "$(dirname "$0")"
set -a; source .env; set +a
: "${VITE_SUPABASE_URL:?manquant dans .env}" "${VITE_SUPABASE_ANON_KEY:?manquant dans .env}"
exec fly deploy \
  --build-arg "VITE_SUPABASE_URL=$VITE_SUPABASE_URL" \
  --build-arg "VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY" "$@"
