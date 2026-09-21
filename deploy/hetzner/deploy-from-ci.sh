#!/usr/bin/env bash
# ============================================================
# What GitHub Actions runs on the server (.github/workflows/deploy.yml).
#
# The deploy key in /root/.ssh/authorized_keys is pinned to this script:
#
#   command="/opt/tennisai/deploy/hetzner/deploy-from-ci.sh",no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty ssh-ed25519 AAAA... github-deploy
#
# so whoever holds that key can do one thing: back up, update to origin/main,
# and verify. Same steps as a person at the keyboard, in the same order —
# backup FIRST, so a bad migration is always one restore away (RESTORE.md).
#
# Setting up the key (once, as root on the server):
#   ssh-keygen -t ed25519 -N "" -C github-deploy -f /root/.ssh/github-deploy
#   printf 'command="/opt/tennisai/deploy/hetzner/deploy-from-ci.sh",no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty %s\n' "$(cat /root/.ssh/github-deploy.pub)" >> /root/.ssh/authorized_keys
#   cat /root/.ssh/github-deploy      # → paste into the DEPLOY_SSH_KEY repository secret
# ============================================================
set -euo pipefail

cd /opt/tennisai

echo "== $(date -u +%FT%TZ) deploy started by CI =="
echo "== backup =="
bash deploy/hetzner/backup.sh

echo
echo "== update =="
bash deploy/hetzner/update.sh

echo
echo "== migrations (newest first) =="
cd deploy/hetzner
docker compose exec -T db psql -U tennisai -d tennisai -Atc \
  "select migration_name, case when finished_at is null then 'PENDING' else 'applied' end from _prisma_migrations order by started_at desc limit 5"

# A migration that started and never finished means the API is restart-looping
# on it. update.sh's health check should already have failed; this is the belt.
if docker compose exec -T db psql -U tennisai -d tennisai -Atc \
  "select count(*) from _prisma_migrations where finished_at is null and rolled_back_at is null" | grep -qv '^0$'; then
  echo "!! a migration is unfinished — see RESTORE.md before retrying"
  exit 1
fi

echo
echo "== $(date -u +%FT%TZ) deploy finished =="
