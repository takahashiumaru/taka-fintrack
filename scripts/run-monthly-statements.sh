#!/usr/bin/env bash
set -euo pipefail

APP_URL="${APP_URL:-http://127.0.0.1:3001}"
SECRET="${STATEMENT_CRON_SECRET:-}"

if [[ -n "$SECRET" ]]; then
  curl -fsS -X POST "$APP_URL/api/statements/generate" -H "Authorization: Bearer $SECRET"
else
  curl -fsS -X POST "$APP_URL/api/statements/generate"
fi
