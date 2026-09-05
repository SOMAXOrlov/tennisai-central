#!/usr/bin/env bash
# Nightly database dump. The database now lives on the same disk as the app, so
# nothing else is keeping a copy — this script is the whole safety net.
#
# Installed by setup-backup.sh as a daily cron job; can also be run by hand:
#   bash /opt/tennisai/deploy/hetzner/backup.sh
#
# Restoring (and the drill that proves these dumps restore): see RESTORE.md.
set -euo pipefail

cd "$(dirname "$0")"
DEST="/opt/tennisai/backups"
KEEP=14

mkdir -p "$DEST"
STAMP="$(date +%Y-%m-%d_%H%M)"
FILE="$DEST/tennisai_${STAMP}.sql.gz"
PART="$FILE.part"

# Write to a .part name and rename only once the archive is complete and
# verified. A pg_dump that dies half-way must not leave a truncated .sql.gz
# behind: the rotation below would count it as one of the 14 good backups.
trap 'rm -f -- "$PART"' EXIT
docker compose exec -T db pg_dump -U tennisai tennisai | gzip > "$PART"
gzip -t "$PART"
mv -- "$PART" "$FILE"
echo "$(date -u +%FT%TZ) wrote $FILE ($(du -h "$FILE" | cut -f1)); disk free: $(df -h / | awk 'NR==2{print $4}')"

# Keep the most recent $KEEP, delete the rest. The glob excludes .part files.
ls -1t "$DEST"/tennisai_*.sql.gz | tail -n +$((KEEP + 1)) | xargs -r rm --
