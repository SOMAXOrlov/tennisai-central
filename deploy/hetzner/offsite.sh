#!/usr/bin/env bash
# Off-site copy of the newest backups — the one part of the safety net that
# does not live on the same disk as the database.
#
# backup.sh calls this after it has written and rotated the night's archives.
# Until the operator creates the configuration file it does nothing except say
# so in the log, so installing this script changes nothing on a box that has no
# Storage Box yet. When the file exists, the newest OFFSITE_KEEP dumps and photo
# archives are pushed with rsync over SSH and the copy is verified.
#
# Configuration: /etc/tennisai/offsite.env, root-only (chmod 600), OUTSIDE
# /opt/tennisai so `update.sh` (git reset --hard) can never touch it:
#
#   OFFSITE_TARGET=u123456@u123456.your-storagebox.de:tennisai-backups/
#   OFFSITE_SSH_PORT=23                          # Hetzner Storage Box; 22 elsewhere
#   OFFSITE_SSH_KEY=/root/.ssh/tennisai-offsite  # dedicated key, no passphrase
#   OFFSITE_KEEP=14                              # how many of each kind to push
#
# The remote is never pruned and never mirrored with --delete: a deletion on
# this server, by accident or by an intruder, must not propagate to the copy.
# A year of nightly dumps is on the order of 100 MB; the operator trims the
# remote by hand (sftp) or relies on the Storage Box's own snapshots.
#
# Output rules, same as backup.sh: no secrets, no connection strings beyond
# the target the operator wrote themselves, no table rows.
#
# Manual run:            bash /opt/tennisai/deploy/hetzner/offsite.sh
# Test with dummy files: OFFSITE_CONF=/tmp/x.env OFFSITE_SRC=/tmp/fake bash offsite.sh
set -euo pipefail

CONF="${OFFSITE_CONF:-/etc/tennisai/offsite.env}"
SRC="${OFFSITE_SRC:-/opt/tennisai/backups}"

log() { echo "$(date -u +%FT%TZ) offsite: $*"; }

if [ ! -r "$CONF" ]; then
  log "not configured ($CONF missing) — no off-site copy taken; see RESTORE.md, 'Off-site copy'"
  exit 0
fi

# shellcheck disable=SC1090
set -a; . "$CONF"; set +a
: "${OFFSITE_TARGET:?OFFSITE_TARGET must be set in $CONF}"
OFFSITE_KEEP="${OFFSITE_KEEP:-14}"
OFFSITE_SSH_PORT="${OFFSITE_SSH_PORT:-23}"
OFFSITE_SSH_KEY="${OFFSITE_SSH_KEY:-/root/.ssh/tennisai-offsite}"

# A target with a colon is remote (user@host:path) and goes over SSH with the
# dedicated key. A plain path is local — only useful for testing the script.
RSH=()
case "$OFFSITE_TARGET" in
  *:*)
    [ -r "$OFFSITE_SSH_KEY" ] || { log "FAILED: SSH key $OFFSITE_SSH_KEY is missing or unreadable"; exit 1; }
    # accept-new pins the host key on first contact and refuses a changed one
    # afterwards; the operator may pre-seed /root/.ssh/known_hosts instead.
    RSH=(-e "ssh -p $OFFSITE_SSH_PORT -i $OFFSITE_SSH_KEY -o BatchMode=yes -o StrictHostKeyChecking=accept-new")
    ;;
esac

# Newest first by NAME: the timestamp is in the file name, so this is exact
# and does not depend on mtimes (a restored or re-touched file sorts right).
mapfile -t FILES < <(
  { ls -1 "$SRC"/tennisai_*.sql.gz 2>/dev/null | sort -r | head -n "$OFFSITE_KEEP"
    ls -1 "$SRC"/uploads_*.tar.gz 2>/dev/null | sort -r | head -n "$OFFSITE_KEEP"; } || true
)
if [ "${#FILES[@]}" -eq 0 ]; then
  log "nothing to copy: no archives in $SRC"
  exit 0
fi

# -t keeps mtimes so the verification below can compare size+time; no -a, no
# --delete (see the header), no ownership or permission games on the remote.
rsync -t ${RSH[@]+"${RSH[@]}"} "${FILES[@]}" "$OFFSITE_TARGET"

# Verify: a dry run of the same transfer must have nothing left to send. Any
# itemized file line ('<f' when pushing over SSH, '>f' for a local target) is
# a file whose size or mtime still differs.
PENDING="$(rsync -t -n -i ${RSH[@]+"${RSH[@]}"} "${FILES[@]}" "$OFFSITE_TARGET" | grep -c '^[<>]f' || true)"
if [ "$PENDING" != "0" ]; then
  log "VERIFY FAILED: $PENDING file(s) differ at $OFFSITE_TARGET after the copy"
  exit 1
fi

log "copied and verified ${#FILES[@]} file(s) to $OFFSITE_TARGET; newest dump $(basename "${FILES[0]}")"
