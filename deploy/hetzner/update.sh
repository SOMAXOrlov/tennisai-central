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
deadline=$((SECONDS + 90))
until curl -fsS --max-time 5 http://127.0.0.1/api/health; do
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
echo
