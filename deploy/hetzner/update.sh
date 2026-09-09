#!/usr/bin/env bash
# Update the running site to whatever is on GitHub. Run ON THE SERVER:
#
#   cd /opt/tennisai && bash deploy/hetzner/update.sh
#
# The database volume and .env are untouched — both live outside git.
set -euo pipefail

cd "$(dirname "$0")/../.."
ROOT="$(pwd)"

echo "== before =="
git --no-pager log --oneline -1

echo
echo "== fetching =="
git fetch --quiet origin
git reset --hard "origin/$(git rev-parse --abbrev-ref HEAD)"

echo
echo "== after =="
git --no-pager log --oneline -1

echo
echo "== rebuild and restart =="
cd "$ROOT/deploy/hetzner"
docker compose up -d --build
sleep 8
docker compose ps

echo
echo "== health =="
# This used to curl once, swallow the failure and exit 0. On 2026-09-07 that
# reported a successful deploy while the API was dead: it threw at import,
# restart-looped, and the web container went on serving the app shell — so the
# site answered 200 and every request that needed data failed. A deploy script
# that exits 0 on a broken deploy is worse than one with no health check at
# all, because it is believed.
#
# So: give it a fair chance to boot, then FAIL LOUDLY with the logs that say
# why. The site is already live at this point, which is exactly why the person
# who ran this must not walk away thinking it worked.
#
# WHAT IT HAS TO CURL. The first version of this loop hit
# http://127.0.0.1/api/health. Caddy answers that with a 308 to HTTPS, and
# `curl -f` only fails on 4xx/5xx, so the redirect counted as healthy and the
# loop passed on its first iteration without ever reaching the API — the exact
# bug this block was written to kill, back in through a side door. Its
# mutation test missed it because a dead PORT gives a connection error, while a
# dead API behind a live Caddy gives a 308. Found on 2026-09-08 when a real
# deploy printed nothing under this banner.
#
# So it curls the public hostname over HTTPS: the request a user makes,
# certificate and proxy included. SITE_ADDRESS comes from the same .env compose
# already requires. The body must also carry "ok":true — a 200 with the wrong
# body is not health.
SITE_ADDRESS="$(grep -E '^SITE_ADDRESS=' .env | head -1 | cut -d= -f2- | tr -d '"')"
if [ -z "$SITE_ADDRESS" ]; then
  echo "!! SITE_ADDRESS is not set in .env, so health cannot be verified. Refusing to call this a success."
  exit 1
fi
HEALTH_URL="https://${SITE_ADDRESS}/api/health"
echo "GET $HEALTH_URL"
deadline=$((SECONDS + 90))
until body="$(curl -fsS --max-time 5 "$HEALTH_URL" 2>/dev/null)" && printf '%s' "$body" | grep -q '"ok":true'; do
  if [ "$SECONDS" -ge "$deadline" ]; then
    echo
    echo "!! The API did not become healthy within 90s. Last 50 lines:"
    echo
    docker compose logs --tail 50 api
    echo
    echo "!! DEPLOY FAILED. The site is still serving, but nothing that needs"
    echo "!! data works. Fix the cause above, or roll back with:"
    echo "!!   git reset --hard <previous-commit> && docker compose up -d --build"
    exit 1
  fi
  sleep 3
done
printf '%s\n' "$body"

echo
echo "== prune build cache =="
# Every deploy leaves BuildKit layers behind; by 2026-09-09 they had reached
# 3.9 GB on a 38 GB disk with nothing to say so until it filled. Keep the last
# week's layers so the next rebuild is still fast, drop the rest. Runs only
# after a HEALTHY deploy, so a failed one can still be rebuilt from cache.
docker builder prune -f --filter until=168h >/dev/null
docker system df
