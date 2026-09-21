# Restoring — procedure and the drill that proved it

The nightly archives in `/opt/tennisai/backups` are the only copies of this
product's data that are not the running product itself. A backup nobody has
ever restored is a hope, not a backup, so this file records a restore that was
actually performed, the exact commands, what came out, and how long it took —
and the procedure to use when it is not a drill.

**There are now two things to restore, not one.** Profile photos
(`server/src/photos/`) are files on the `uploads` volume and `pg_dump` has
never seen them. A restore that brings back only the database produces an app
in which every photo row points at a file that is not there: avatars quietly
revert to initials, and nobody can tell whether a picture was deleted on
purpose or lost. `backup.sh` therefore writes a second archive every night,
`uploads_YYYY-MM-DD_HHMM.tar.gz`, and
["Restoring the uploaded files"](#restoring-the-uploaded-files) is the other
half of the procedure. **That half has not been drilled** — it is listed under
"Known gaps" rather than presented as proven.

Last drill: **2026-09-21 10:16 UTC**, on the production host, against a
throwaway container, using the dump taken that morning *before* the finance
migration was deployed — so it also shows what a restore across a schema
change looks like; see ["Verification output (2026-09-21)"](#verification-output-2026-09-21).
The first drill was 2026-09-05 08:55 UTC. Re-run it with
[`restore-drill.sh`](./restore-drill.sh) (safe: it never writes to the live
database).

Post-drill check, 2026-09-05 09:20 UTC (the run that wrote this file was cut
off shortly after the drill, so the host was re-inspected before continuing):
`docker ps -a` showed only the three live `tennisai-*` containers and the
unrelated `nooma-bot`; `docker volume ls` only the four `tennisai_*` compose
volumes; no `tennisai-restore-drill-*` container, no drill-labelled volume, no
dump outside `/opt/tennisai/backups` (checked `/tmp` and `/root`). Nothing to
clean up — the teardown in step 5 had done its job.

## Where backups are

Two archives per night, from the same `backup.sh` run and the same timestamp.

### The database

| | |
| --- | --- |
| Written by | `deploy/hetzner/backup.sh`, cron `17 3 * * *` (host clock is UTC) |
| Location | `/opt/tennisai/backups/tennisai_YYYY-MM-DD_HHMM.sql.gz` |
| Format | plain-SQL `pg_dump`, gzip; one `COPY` block per table (34 on 2026-09-05, 49 on 2026-09-21) |
| Size | 192 KB compressed, 1.1 MB uncompressed (2026-09-21); ~260 KB / ~1.5 MB on 2026-09-05 |
| Retention | newest 14 files |
| Off-site copy | [`offsite.sh`](./offsite.sh), run by `backup.sh` after rotation, pushes the newest 14 over rsync/SSH — **a no-op until `/etc/tennisai/offsite.env` exists**, and it does not yet (see "Off-site copy") |

### The uploaded profile photos

| | |
| --- | --- |
| Written by | the same `backup.sh` run, immediately after the dump |
| Location | `/opt/tennisai/backups/uploads_YYYY-MM-DD_HHMM.tar.gz` |
| Source | `UPLOADS_DIR` inside the `api` container (`/data/uploads`), the `uploads` compose volume |
| Format | gzipped tar, paths stored as `uploads/<32-hex-id>.webp` |
| Size | one 512×512 WebP per person with a photo, typically 20–60 KB each |
| Retention | newest 14 files |
| Skipped when | `/data/uploads` does not exist yet — nobody has uploaded a photo; the run logs that and does not fail |
| Off-site copy | same `offsite.sh` run, same condition — not configured yet |

These files are photographs of people, some of whom may be children. Handle the
archive the way the "Data-handling rules" below handle a dump: do not copy it
anywhere, and delete any copy you take by hand.

## The drill, as run

Everything below ran on the production host over SSH, piped from the
workstation (`ssh root@HOST 'bash -c "$(cat)"' < restore-drill.sh`), so no file
was written to the server. The dump used was the existing scheduled backup
`tennisai_2026-09-05_0317.sql.gz`, read in place and left in place.

Data-handling rules that the script enforces and that any repeat must keep:

- Restore only into a **throwaway** container named `tennisai-restore-drill-YYYYMMDD`
  (`postgres:16-alpine`, **no published port, `--network none`**, its own
  anonymous volume). All access is `docker exec` over the container's unix socket.
- The live `tennisai-db-1` is only ever read with `SELECT`s. Never `psql`/`pg_restore`
  **into** it, never `docker compose` anything, nothing under `/opt/tennisai` changes.
- Print counts, timings, table and migration names — never rows, passwords,
  connection strings or `.env` contents. Raw `psql` stderr is never pasted into
  a document because an `ERROR:` line can quote a data value.
- Remove the container **and its volume** at the end. A dump taken for the drill
  (there was no need this time) is deleted afterwards; the scheduled backup in its
  normal location is not.

### Steps and timings

| # | Step | Command (abridged) | Result | Time |
| --- | --- | --- | --- | --- |
| 0 | Preflight | `gzip -t dump`; live container ids; `df -h /` | no leftover drill container; gzip OK; "Dumped from database version 16.15 / by pg_dump 16.15"; 8.1 G used / 28 G free | — |
| 1 | Start throwaway | `docker run -d --name tennisai-restore-drill-20260905 --network none -e POSTGRES_USER=tennisai -e POSTGRES_DB=tennisai -e POSTGRES_PASSWORD=<random, unused> postgres:16-alpine`, wait for `init process complete` + `pg_isready` | ready; server 16.15 (live: 16.15) | **3.3 s** |
| 2 | Restore | `gunzip -c dump \| docker exec -i <drill> psql -X -q -U tennisai -d tennisai -v ON_ERROR_STOP=1` | exit code 0, **0 lines on stderr** | **1.1 s** |
| 3 | Verify | see below | all checks equal, one explained difference | 1.4 s |
| 4 | Re-restore path | in the drill DB: `drop schema public cascade; create schema public;` then step 2 again | exit code 0, 0 stderr lines, 8 migrations present again | 1.5 s |
| 5 | Tear down | `docker rm -f -v <drill>` | container removed, anonymous volume removed, live containers unchanged (same ids), disk 8.1 G / 28 G as before, 0 drill volumes left | 0.3 s |
| | **Total** | | | **8.2 s** |

### Verification output (2026-09-05)

```
-- migrations (applied count | newest):
  live : 8 | 20260904073337_calendar_preferences
  drill: 8 | 20260904073337_calendar_preferences
-- schema objects (tables | indexes | foreign keys):
  live : 34 | 95 | 45
  drill: 34 | 95 | 45
-- row counts per table (table | live | drill | same?):   33 of 34 identical
  _prisma_migrations              8      8  =
  calendar_events                 4      4  =
  connection_requests             4      4  =
  hidden_tournaments              5      5  =
  notifications                  11     11  =
  player_profiles                 2      2  =
  teams                           1      1  =
  tournaments                  3742   3656  DIFF
  training_participants           2      2  =
  trainings                       2      2  =
  users                           9      9  =
  (23 further tables: 0 = 0)
-- sample query, a three-way join (participants -> trainings -> users), count only:
  live : 2
  drill: 2
-- sample query 2, users with a verified email vs total (counts only):
  live : 9 of 9
  drill: 9 of 9
```

The single difference is expected: the dump was taken at 03:17 UTC and the
tournament feed refresh runs at 04:00 UTC (`FEED_REFRESH_HOUR_UTC`), which
imported 86 new `tournaments` rows before the drill ran at 08:55. Every table
that people write to was identical.

### Verification output (2026-09-21)

Run at 10:16 UTC from a workstation over SSH (`ssh root@HOST 'bash
/opt/tennisai/deploy/hetzner/restore-drill.sh'`), against
`tennisai_2026-09-21_0930.sql.gz` — a dump taken by hand at 09:30 as the
pre-migration snapshot for PR #52, which then deployed at 10:08 and applied
`20260921120000_finance_budget_income_access`. The restore therefore lands one
migration behind the live database, on purpose; the three `DIFF` rows below
are exactly that and nothing else.

```
dump: tennisai_2026-09-21_0930.sql.gz (192K); gzip integrity: OK
uncompressed: 1.1 MB, 49 COPY blocks; pg_dump 16.15 -> postgres 16.15 (live: 16.15)
throwaway ready after 2.7 s
restore: psql exit code 0, stderr lines 0 (1.6 s)
migrations   live:  18 | 20260921120000_finance_budget_income_access
             drill: 17 | 20260910120000_match_racket_link
schema       live:  51 tables | 147 indexes | 78 foreign keys
             drill: 49 | 142 | 73
row counts   46 tables identical (tournaments 2379, notifications 28,
             calendar_events 15, users 11, connection_requests 4, ...)
             _prisma_migrations     18 vs 17       DIFF (the deploy)
             finance_budgets         0 vs MISSING  DIFF (created by it)
             finance_access_grants   0 vs MISSING  DIFF (created by it)
sample joins participants->trainings->users: 3 = 3; verified e-mail: 11 of 11 = 11 of 11
verify took 1.5 s
re-restore after wipe (throwaway only): exit code 0, stderr 0 (2.1 s), 17 migrations
teardown: container + anonymous volume removed (0.2 s); live containers unchanged;
          disk 9.3G used / 27G free; remaining drill volumes: 0
total 8.8 s
```

What this run adds to the 2026-09-05 one: the dump restores cleanly on a
database that has since moved forward one migration, which is the situation
a real restore is most likely to be in. The two new tables come back empty
the moment the API boots (`prisma migrate deploy`), and had zero rows in the
live database anyway. Photos: the `uploads_2026-09-21_0930.tar.gz` beside the
dump is 112 bytes — nobody has uploaded a photo yet — so the photo half is
still undrilled (see "Known gaps").

## Off-site copy

Everything above is on one disk. `backup.sh` now ends by calling
[`offsite.sh`](./offsite.sh), which pushes the newest 14 dumps and 14 photo
archives to an rsync-over-SSH target and verifies the copy with a dry run
that must have nothing left to send. It never deletes on the remote and never
mirrors with `--delete`, so a deletion on this server cannot reach the copy.
Until the configuration file exists it logs one line and exits 0, which is
the state today.

Switching it on is the operator's action, because it needs an account and a
key that only they should create:

1. Order a Hetzner Storage Box (the smallest is enough for years of these
   files), enable SSH support on it in the Hetzner console, and note the
   `uXXXXXX` user and host.
2. On the production host, as root, create a dedicated key with no
   passphrase and add its public half to the box:

   ```bash
   ssh-keygen -t ed25519 -N "" -f /root/.ssh/tennisai-offsite -C tennisai-offsite
   # paste /root/.ssh/tennisai-offsite.pub into the Storage Box's SSH keys
   ssh -p 23 -i /root/.ssh/tennisai-offsite uXXXXXX@uXXXXXX.your-storagebox.de mkdir tennisai-backups
   ```
3. Write the configuration, root-only, outside `/opt/tennisai`:

   ```bash
   install -d -m 700 /etc/tennisai
   cat > /etc/tennisai/offsite.env <<'CONF'
   OFFSITE_TARGET=uXXXXXX@uXXXXXX.your-storagebox.de:tennisai-backups/
   OFFSITE_SSH_PORT=23
   OFFSITE_SSH_KEY=/root/.ssh/tennisai-offsite
   OFFSITE_KEEP=14
   CONF
   chmod 600 /etc/tennisai/offsite.env
   ```
4. Run it once by hand and read the last line:

   ```bash
   bash /opt/tennisai/deploy/hetzner/offsite.sh
   ```

   It should end with `copied and verified 28 file(s)`. Failures say
   `VERIFY FAILED` or `FAILED:` and exit 1; the nightly `backup.sh` records
   that as `OFF-SITE COPY FAILED` in `/var/log/tennisai-backup.log` and keeps
   the local archives regardless.
5. Then drill a restore *from the copy*: fetch one dump back with `rsync`
   into `/opt/tennisai/backups/` under a new name and pass it to
   `restore-drill.sh`. Until that has been done once, the off-site copy is
   in the same category the local one was in before 2026-09-05: a hope.

The remote is never pruned by this script. A year of nightly dumps at
today's size is under 100 MB; trim by hand over `sftp -P 23` when it
matters, or turn on the Storage Box's snapshots as a second layer.

## Restoring for real

This is the path to take after data loss or a bad migration. **The live half of
it (stopping the API and wiping the live schema) was not executed in the drill**
— only the throwaway rehearsal above. Step 4 of the drill is the evidence that
"wipe schema, then pipe the dump in" restores cleanly onto a database that
already has the schema; the same two statements are what you run against the
live database here.

```bash
cd /opt/tennisai/deploy/hetzner

# 0. Pick the dump. Newest is usually right; check its integrity first.
DUMP=$(ls -1t /opt/tennisai/backups/tennisai_*.sql.gz | head -1)
gzip -t "$DUMP" && echo "$DUMP"

# 1. Nothing may write while you restore. Stop the API only; db and web stay up
#    (Caddy answers 502 for /api meanwhile — the monitor will alert, expected).
docker compose stop api

# 2. Keep what is there now, in case the restore is the mistake.
docker compose exec -T db pg_dump -U tennisai tennisai | gzip > /opt/tennisai/backups/pre-restore_$(date +%F_%H%M).sql.gz

# 3. Wipe the schema. The dump recreates every table, type, index and FK; it
#    does NOT drop existing ones, so restoring onto a populated schema fails
#    half-way with duplicate-key errors. Wipe first, always.
docker compose exec -T db psql -U tennisai -d tennisai -v ON_ERROR_STOP=1 \
  -c 'drop schema public cascade; create schema public;'

# 4. Restore. ON_ERROR_STOP makes a partial restore impossible to miss.
gunzip -c "$DUMP" | docker compose exec -T db psql -X -q -U tennisai -d tennisai -v ON_ERROR_STOP=1
echo "restore exit code: $?"          # must be 0

# 5. Check before starting the API: migrations count and a couple of tables.
docker compose exec -T db psql -U tennisai -d tennisai -Atc \
  "select count(*) from _prisma_migrations where finished_at is not null; select count(*) from users;"

# 6. Back up. The API applies any migrations newer than the dump at boot
#    (`migrate deploy`), then serves.
docker compose start api
curl -s localhost/api/health | head -c 200      # "ok":true,"db":"up"
```

Expected duration for today's database size: well under a minute, most of it
the API restarting. Restoring onto a **fresh** server (new box, empty volume) is
the same from step 3 on, after `setup.sh` has brought the stack up once.

**Then restore the photos as well** — the section below. A database-only
restore leaves the app looking healthy and every avatar reverted to initials.

## Restoring the uploaded files

The photo archive belongs to the same night as the dump you just restored, so
take the `uploads_*.tar.gz` with the matching timestamp. Restoring a photo
archive from a different night is not harmful — a row whose file is missing
answers 404 and shows initials, and a file with no row is simply never read —
but it is avoidable confusion.

**Not drilled.** The commands below are the inverse of what `backup.sh` writes
and have not been executed against the live volume; see "Known gaps".

```bash
cd /opt/tennisai/deploy/hetzner

# 0. Pick the archive from the same night as the dump, and check it.
UPLOADS=/opt/tennisai/backups/uploads_2026-09-05_0317.tar.gz
gzip -t "$UPLOADS" && tar -tzf "$UPLOADS" | head -3      # paths must be uploads/<id>.webp

# 1. Nothing may write while you restore. If the API is already stopped from
#    the database restore above, leave it stopped and skip this.
docker compose stop api

# 2. Unpack into the volume. `docker compose run` starts a throwaway container
#    with the same volume mounted, so this works whether or not `api` is up,
#    and never needs the volume's path on the host.
#
#    The API never overwrites a file (every upload gets a new random id), so
#    unpacking on top of what is there is safe and additive: it restores what
#    is missing and leaves newer photos alone. Wipe first ONLY if you mean to
#    return the store to exactly its state that night:
#      docker compose run --rm --no-deps --entrypoint sh api -c 'rm -rf /data/uploads/*'
gunzip -c "$UPLOADS" | docker compose run --rm --no-deps -T --entrypoint sh api \
  -c 'tar -C /data -xzf -'

# 3. Check the count matches what the archive holds.
tar -tzf "$UPLOADS" | grep -c '\.webp$'
docker compose run --rm --no-deps --entrypoint sh api -c 'ls -1 /data/uploads | wc -l'

# 4. Start the API and confirm a photo actually serves. Any 200 will do; a 404
#    on a user who should have one means the files did not land.
docker compose start api
curl -s localhost/api/health | head -c 60
```

To confirm end to end, sign in as an account that had a photo and look at the
profile page: the picture, not initials. There is deliberately no unauthenticated
URL to `curl` for an image — that is the whole design of the read endpoint.

Things that make a restore fail, in the order they have been seen or foreseen:

- **Skipping the wipe** — errors like `relation "users" already exists`, and the
  `COPY` blocks then fail on duplicate keys. Wipe and retry.
- **psql older than pg_dump.** From PostgreSQL 16.10 on, `pg_dump` writes
  `\restrict` meta-commands that older `psql` rejects. Restore with the same
  `postgres:16-alpine` image tag the box already runs — the drill used it.
- **Wrong role.** The dump has no `CREATE ROLE`; it assumes role `tennisai`
  exists, which the compose file guarantees.
- **API left running.** Prisma's connection pool holds open transactions;
  `drop schema` blocks or the API errors mid-request. Stop it first.

## Known gaps — honest list

- **The off-site copy is built but not switched on.** `offsite.sh` ships
  with this repo and `backup.sh` calls it every night, but
  `/etc/tennisai/offsite.env` does not exist, so it logs "not configured" and
  exits. Until the operator completes the five steps under "Off-site copy",
  disk, database, uploaded photos and backups are still one `/dev/sda1`, and
  the only copy of a child's photograph is on that one disk plus its nightly
  tarball beside it. Restoring *from* the off-site copy has, by construction,
  never been drilled.
- **The photo restore has not been drilled.** "Restoring the uploaded files"
  above is the exact inverse of what `backup.sh` writes, read from the script
  and reasoned through, but it has not been executed — not even against a
  throwaway volume. The next drill should extend `restore-drill.sh` to unpack a
  photo archive into a scratch volume and count the files, which is cheap and
  needs nothing from the live stack.
- **The live restore path was rehearsed, not executed.** Steps 1–6 above have not
  been run against `tennisai-db-1`; the throwaway proves the dump and the
  wipe-then-restore sequence, not the `docker compose stop/start` choreography.
- **Nobody is alerted when the nightly backup fails.** `backup.sh` now writes
  atomically and verifies the gzip (a failed dump leaves no file behind instead
  of a truncated one that the 14-file rotation would count as good), and it logs
  free disk space — but the log is only read by a human who thinks to look.
  `deploy/hetzner/monitoring/README.md` lists this as out of scope for an
  external HTTP monitor.
- **The dump is unencrypted on disk** and readable by root only. It contains
  users' names, e-mail addresses and bcrypt password hashes. That is why the
  drill never copies a dump anywhere and why any dump taken by hand outside the
  backups folder must be deleted afterwards.

## Repeating the drill

```bash
# from a workstation with SSH access; nothing is written on the box
ssh root@46.225.83.85 'bash -c "$(cat)"' < deploy/hetzner/restore-drill.sh
# or, on the box itself, against a specific dump:
bash /opt/tennisai/deploy/hetzner/restore-drill.sh /opt/tennisai/backups/tennisai_2026-09-05_0317.sql.gz
```

Once a month is plenty at this size. Paste the "verify" block and the total
time into this file under a new date; if any `=` turns into `DIFF` on a table
that is not `tournaments`, find out why before trusting the next backup.
