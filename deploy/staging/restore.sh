#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${STAGING_ENV_FILE:-${ROOT}/.env.staging}"
BACKUP="${1:-}"
if [[ ! -f "$BACKUP" ]]; then
  printf 'Usage: RESTORE_CONFIRM=RESTORE_STAGING %s /absolute/path/to/backup.dump\n' "$0" >&2
  exit 2
fi
if [[ "${RESTORE_CONFIRM:-}" != "RESTORE_STAGING" ]]; then
  printf 'Refusing destructive restore. Set RESTORE_CONFIRM=RESTORE_STAGING and stop app writers first.\n' >&2
  exit 2
fi
# Restore while the API is stopped and ensure a separate validated backup exists.
docker compose --env-file "$ENV_FILE" -f "$ROOT/compose.staging.yaml" exec -T postgres \
  pg_restore -U academy -d academy_os --clean --if-exists --no-owner --no-privileges < "$BACKUP"
printf 'Staging restore completed. Validate app data and migrational state before startup.\n'
