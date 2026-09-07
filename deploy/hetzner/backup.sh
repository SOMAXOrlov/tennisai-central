#!/usr/bin/env bash
# Nightly backup: the database dump AND the uploaded profile photos. The
# database lives on the same disk as the app, so nothing else is keeping a
# copy — this script is the whole safety net.
#
# TWO ARCHIVES PER NIGHT, and the second one is why this file changed.
# `pg_dump` covers the database and nothing else, and since profile photos
# arrived (server/src/photos/) the product holds something that is not in the
# database: the files under UPLOADS_DIR, on the `uploads` volume. Dumping only
# PostgreSQL would restore an app in which every photo row points at a file
# that is not there — and, for the photograph of a child, would mean the only
# copy of it ever lived on one disk.
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
UPLOADS_FILE="$DEST/uploads_${STAMP}.tar.gz"
UPLOADS_PART="$UPLOADS_FILE.part"

# Write to a .part name and rename only once the archive is complete and
# verified. A pg_dump that dies half-way must not leave a truncated .sql.gz
# behind: the rotation below would count it as one of the 14 good backups.
trap 'rm -f -- "$PART" "$UPLOADS_PART"' EXIT
docker compose exec -T db pg_dump -U tennisai tennisai | gzip > "$PART"
gzip -t "$PART"
mv -- "$PART" "$FILE"
echo "$(date -u +%FT%TZ) wrote $FILE ($(du -h "$FILE" | cut -f1)); disk free: $(df -h / | awk 'NR==2{print $4}')"

# The uploaded profile photos, archived from INSIDE the api container so the
# path is the one the API actually writes to (UPLOADS_DIR=/data/uploads) rather
# than a guess at where Docker keeps the volume on the host.
#
# `tar -C /data uploads` stores paths as `uploads/<id>.webp`, which is what the
# restore in RESTORE.md unpacks. A missing directory is not an error: it means
# nobody has uploaded a photo yet, and a backup script must not start failing
# every night over that — it says so and carries on.
if docker compose exec -T api test -d /data/uploads; then
  docker compose exec -T api tar -C /data -czf - uploads > "$UPLOADS_PART"
  gzip -t "$UPLOADS_PART"
  mv -- "$UPLOADS_PART" "$UPLOADS_FILE"
  PHOTO_COUNT="$(docker compose exec -T api sh -c 'ls -1 /data/uploads | wc -l' | tr -dc '0-9')"
  echo "$(date -u +%FT%TZ) wrote $UPLOADS_FILE ($(du -h "$UPLOADS_FILE" | cut -f1)); ${PHOTO_COUNT:-?} file(s)"
else
  echo "$(date -u +%FT%TZ) no /data/uploads in the api container — nothing uploaded yet, no photo archive written"
fi

# Keep the most recent $KEEP of each kind, delete the rest. The globs exclude
# .part files. Both are rotated on the same count so a photo archive is never
# kept without a dump from around the same night, or the other way round.
ls -1t "$DEST"/tennisai_*.sql.gz | tail -n +$((KEEP + 1)) | xargs -r rm --
ls -1t "$DEST"/uploads_*.tar.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm --
