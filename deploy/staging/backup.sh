#!/usr/bin/env bash
set -euo pipefail
# Only for the dedicated AcademyOS STAGING database. Never put dumps into Git.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${STAGING_ENV_FILE:-${ROOT}/.env.staging}"
BACKUP_DIR="${STAGING_BACKUP_DIR:-${ROOT}/backups}"
umask 077
mkdir -p "$BACKUP_DIR"
backup="$BACKUP_DIR/academy-staging-$(date -u +%Y%m%dT%H%M%SZ).dump"
temp="${backup}.partial"
trap 'rm -f "$temp"' EXIT
docker compose --env-file "$ENV_FILE" -f "$ROOT/compose.staging.yaml" exec -T postgres \
  pg_dump -U academy -d academy_os --format=custom --no-owner --no-privileges > "$temp"
mv "$temp" "$backup"
printf 'Created staging backup: %s\n' "$backup"
