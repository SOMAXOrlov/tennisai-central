#!/usr/bin/env bash
# TennisAI backup-restore drill: prove that a nightly dump restores, without
# touching the live database. See RESTORE.md for the last recorded run.
#
# Run it on the production host, either in place
#     bash /opt/tennisai/deploy/hetzner/restore-drill.sh [dump.sql.gz]
# or piped from a workstation so nothing is written on the box
#     ssh root@HOST 'bash -c "$(cat)"' < deploy/hetzner/restore-drill.sh
#
# The only artefact is a throwaway Postgres container (+ its anonymous volume)
# that is removed at the end, including on every failure path. The live
# `tennisai-db-1` is only ever read with SELECTs: nothing is restored into it,
# no compose command runs, nothing under /opt/tennisai changes. Default dump is
# the newest scheduled backup, which is read in place and left in place.
#
# Output rules: no passwords, no connection strings, no .env, no table rows.
# Only counts, timings, and table/migration names (both are already in the repo).
set -uo pipefail

STAMP="$(date +%Y%m%d)"
DRILL="tennisai-restore-drill-${STAMP}"
DUMP="${1:-$(ls -1t /opt/tennisai/backups/tennisai_*.sql.gz 2>/dev/null | head -1)}"
LIVE="tennisai-db-1"
[ -n "$DUMP" ] && [ -r "$DUMP" ] || { echo "no dump found (looked in /opt/tennisai/backups); pass one as the first argument"; exit 1; }

now() { date +%s.%N; }
since() { awk "BEGIN{printf \"%.1f\", $(now) - $1}"; }
say() { printf '\n== %s ==\n' "$*"; }
live_sql()  { docker exec "$LIVE"  psql -U tennisai -d tennisai -X -At -v ON_ERROR_STOP=1 -c "$1"; }
drill_sql() { docker exec "$DRILL" psql -U tennisai -d tennisai -X -At -v ON_ERROR_STOP=1 -c "$1"; }

# Row count of every table in schema public, one "table|count" per line.
# query_to_xml lets one statement count all tables without dynamic SQL.
COUNT_SQL="select table_name || '|' || (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', table_name), false, true, '')))[1]::text
           from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by table_name;"

T_ALL=$(now)

say "0. preflight"
echo "host time: $(date +'%F %T %Z') = $(date -u +%FT%TZ)"
if [ -n "$(docker ps -aq --filter "name=^${DRILL}$")" ]; then
  echo "LEFTOVER: a container named $DRILL already existed; removing it (+volume) before starting"
  docker rm -f -v "$DRILL" >/dev/null
else
  echo "no leftover drill container"
fi
LIVE_BEFORE=$(docker ps --format '{{.Names}} {{.ID}} {{.Image}}' | grep '^tennisai-' | sort)
echo "live containers before:"; echo "$LIVE_BEFORE" | sed 's/^/  /'
echo "disk before: $(df -h / | awk 'NR==2{print $3" used, "$4" free"}')"
echo "dump: $DUMP ($(du -h "$DUMP" | cut -f1))"
if gzip -t "$DUMP"; then echo "gzip integrity: OK"; else echo "gzip integrity: FAILED"; exit 1; fi
gunzip -c "$DUMP" | grep -m2 -- '-- Dumped' | sed 's/^/  /'
echo "uncompressed: $(gunzip -c "$DUMP" | wc -c | awk '{printf "%.1f MB", $1/1048576}'), $(gunzip -c "$DUMP" | grep -c '^COPY public\.') COPY blocks"

say "1. start throwaway postgres:16-alpine (no published port, no network)"
T1=$(now)
# The password is random, used by nothing (all access is docker exec over the
# container's unix socket), and never printed.
docker run -d --name "$DRILL" --network none \
  --label tennisai.purpose=restore-drill \
  -e POSTGRES_USER=tennisai -e POSTGRES_DB=tennisai \
  -e POSTGRES_PASSWORD="$(head -c 32 /dev/urandom | base64 | tr -dc 'A-Za-z0-9')" \
  postgres:16-alpine >/dev/null || { echo "docker run failed"; exit 1; }
VOL=$(docker inspect -f '{{range .Mounts}}{{.Name}}{{end}}' "$DRILL")
echo "anonymous volume: ${VOL:0:12}..."
# The image runs a temporary server during initdb; wait for the real one.
for _ in $(seq 1 120); do
  if docker logs "$DRILL" 2>&1 | grep -q 'init process complete' && docker exec "$DRILL" pg_isready -q -U tennisai -d tennisai; then break; fi
  sleep 0.5
done
docker exec "$DRILL" pg_isready -U tennisai -d tennisai || { echo "drill db never became ready"; docker logs --tail 20 "$DRILL"; docker rm -f -v "$DRILL"; exit 1; }
echo "ready after $(since "$T1") s; server: $(drill_sql 'show server_version;')  (live: $(live_sql 'show server_version;'))"

say "2. restore the dump into the throwaway"
T2=$(now)
RESTORE_ERR=$(gunzip -c "$DUMP" | docker exec -i "$DRILL" psql -X -q -U tennisai -d tennisai -v ON_ERROR_STOP=1 2>&1 >/dev/null)
RC=$?
echo "psql exit code: $RC; stderr lines: $(printf '%s' "$RESTORE_ERR" | grep -c .)  (took $(since "$T2") s)"
[ -n "$RESTORE_ERR" ] && printf '%s\n' "$RESTORE_ERR" | grep -i 'error' | cut -c1-120 | head -5 | sed 's/^/  /'
if [ "$RC" -ne 0 ]; then echo "RESTORE FAILED"; docker rm -f -v "$DRILL"; exit 1; fi

say "3. verify"
T3=$(now)
echo "-- migrations (applied count | newest):"
echo "  live : $(live_sql  "select count(*) || ' | ' || max(migration_name) from _prisma_migrations where finished_at is not null;")"
echo "  drill: $(drill_sql "select count(*) || ' | ' || max(migration_name) from _prisma_migrations where finished_at is not null;")"
echo "-- schema objects (tables | indexes | foreign keys):"
OBJ_SQL="select (select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE') || ' | ' || (select count(*) from pg_indexes where schemaname='public') || ' | ' || (select count(*) from pg_constraint where contype='f');"
echo "  live : $(live_sql "$OBJ_SQL")"
echo "  drill: $(drill_sql "$OBJ_SQL")"
echo "-- row counts per table (table | live | drill | same?):"
LIVE_COUNTS=$(live_sql "$COUNT_SQL")
DRILL_COUNTS=$(drill_sql "$COUNT_SQL")
DIFFS=0
while IFS='|' read -r tbl live_n; do
  drill_n=$(printf '%s\n' "$DRILL_COUNTS" | awk -F'|' -v t="$tbl" '$1==t{print $2}')
  [ -z "$drill_n" ] && drill_n="MISSING"
  if [ "$live_n" = "$drill_n" ]; then mark="="; else mark="DIFF"; DIFFS=$((DIFFS+1)); fi
  printf '  %-26s %6s %6s  %s\n' "$tbl" "$live_n" "$drill_n" "$mark"
done <<< "$LIVE_COUNTS"
echo "tables with differing counts: $DIFFS (the live side has kept changing since the dump was taken; tournaments grows at the 04:00 UTC feed import)"
echo "-- sample query, a three-way join (participants -> trainings -> users), count only:"
SAMPLE="select count(*) from training_participants tp join trainings t on t.id = tp.\"trainingId\" join users u on u.id = tp.\"playerId\";"
echo "  live : $(live_sql "$SAMPLE")"
echo "  drill: $(drill_sql "$SAMPLE")"
echo "-- sample query 2, users with a verified email vs total (counts only):"
SAMPLE2="select count(*) filter (where \"emailVerified\") || ' of ' || count(*) from users;"
echo "  live : $(live_sql "$SAMPLE2")"
echo "  drill: $(drill_sql "$SAMPLE2")"
echo "verify took $(since "$T3") s"

say "4. the documented re-restore path: wipe schema, restore again (in the throwaway only)"
T4=$(now)
drill_sql "set client_min_messages = warning; drop schema public cascade; create schema public;" >/dev/null
RESTORE2_ERR=$(gunzip -c "$DUMP" | docker exec -i "$DRILL" psql -X -q -U tennisai -d tennisai -v ON_ERROR_STOP=1 2>&1 >/dev/null)
RC2=$?
echo "second restore after wipe: exit code $RC2, stderr lines: $(printf '%s' "$RESTORE2_ERR" | grep -c .)  (took $(since "$T4") s)"
echo "  migrations after 2nd restore: $(drill_sql "select count(*) from _prisma_migrations where finished_at is not null;")"

say "5. tear down"
T5=$(now)
docker rm -f -v "$DRILL" >/dev/null
if [ -n "$(docker ps -aq --filter "name=^${DRILL}$")" ]; then echo "container STILL PRESENT"; else echo "container removed"; fi
if [ -n "$VOL" ] && [ -n "$(docker volume ls -q --filter "name=^${VOL}$")" ]; then echo "volume STILL PRESENT"; else echo "anonymous volume removed"; fi
echo "teardown took $(since "$T5") s"
echo "dump file: left in place — it is the scheduled nightly backup in its normal location, nothing was copied"
LIVE_AFTER=$(docker ps --format '{{.Names}} {{.ID}} {{.Image}}' | grep '^tennisai-' | sort)
if [ "$LIVE_BEFORE" = "$LIVE_AFTER" ]; then echo "live containers: unchanged (same ids, same images)"; else echo "live containers CHANGED:"; echo "$LIVE_AFTER"; fi
echo "disk after: $(df -h / | awk 'NR==2{print $3" used, "$4" free"}')"
echo "remaining drill volumes: $(docker volume ls -q --filter label=tennisai.purpose=restore-drill | wc -l)"

say "done — total $(since "$T_ALL") s"
