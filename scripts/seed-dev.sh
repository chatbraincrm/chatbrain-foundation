#!/usr/bin/env bash
#
# Seed de desenvolvimento — carrega .env.local e executa o script.
#
# Uso:
#   chmod +x scripts/seed-dev.sh
#   ./scripts/seed-dev.sh
#
# O script espera encontrar .env.local na raiz do projeto com:
#   SUPABASE_URL=https://xxx.supabase.co
#   SUPABASE_SERVICE_ROLE_KEY=eyJ...
#   SUPABASE_PUBLISHABLE_KEY=eyJ...
#
# Ou você pode definir as variáveis diretamente no ambiente.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Load .env.local if it exists
ENV_FILE="$PROJECT_ROOT/.env.local"
if [ -f "$ENV_FILE" ]; then
  echo "📂 Carregando variáveis de $ENV_FILE"
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

# Also load .env as fallback for VITE_ vars
ENV_DEFAULT="$PROJECT_ROOT/.env"
if [ -f "$ENV_DEFAULT" ]; then
  echo "📂 Carregando variáveis de $ENV_DEFAULT"
  set -a
  # shellcheck disable=SC1090
  source "$ENV_DEFAULT"
  set +a
fi

echo ""
exec npx tsx "$SCRIPT_DIR/seed-dev.ts"
