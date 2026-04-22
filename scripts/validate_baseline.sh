#!/usr/bin/env bash
# Readonly endpoint baseline capture — records status + body hash for each GET.
# Used by the security-hardening validation protocol (Gates 2 and 4).
set -u
HOST="${HOST:-http://localhost:8000}"

endpoints=(
  "/health"
  "/api/all-data"
  "/api/industries"
  "/api/workflow-steps"
  "/api/prerequisites"
  "/api/config/prompts/latest"
  "/api/config/workshop-parameters"
  "/api/config/section-tags"
  "/api/config/disabled-steps"
  "/api/session/default"
  "/api/leaderboard"
  "/api/config/workshop-parameters-dict"
)

for ep in "${endpoints[@]}"; do
  status=$(curl -s -o /tmp/_body -w "%{http_code}" "${HOST}${ep}")
  hash=$(shasum -a 256 /tmp/_body | awk '{print $1}')
  size=$(wc -c < /tmp/_body | tr -d ' ')
  echo "${ep} status=${status} size=${size} sha256=${hash}"
done
rm -f /tmp/_body
