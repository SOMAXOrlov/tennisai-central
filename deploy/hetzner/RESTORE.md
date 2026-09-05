# Restoring the database — procedure and the drill that proved it

The nightly dump in `/opt/tennisai/backups` is the only copy of the database
that is not the database itself. A backup nobody has ever restored is a hope,
not a backup, so this file records a restore that was actually performed, the
exact commands, what came out, and how long it took — and the procedure to use
when it is not a drill.

Last drill: **2026-09-05 08:55 UTC**, on the production host, against a
throwaway container. Re-run it with [`restore-drill.sh`](./restore-drill.sh)
(safe: it never writes to the live database).

Post-drill check, 2026-09-05 09:20 UTC (the run that wrote this file was cut
off shortly after the drill, so the host was re-inspected before continuing):
`docker ps -a` showed only the three live `tennisai-*` containers and the
unrelated `nooma-bot`; `docker volume ls` only the four `tennisai_*` compose
volumes; no `tennisai-restore-drill-*` container, no drill-labelled volume, no
dump outside `/opt/tennisai/backups` (checked `/tmp` and `/root`). Nothing to
clean up — the teardown in step 5 had done its job.

## Where backups are

| | |
| --- | --- |
| Written by | `deploy/hetzner/backup.sh`, cron `17 3 * * *` (host clock is UTC) |
| Location | `/opt/tennisai/backups/tennisai_YYYY-MM-DD_HHMM.sql.gz` |
| Format | plain-SQL `pg_dump`, gzip; one `COPY` block per table (34 today) |
| Size | ~260 KB compressed, ~1.5 MB uncompressed (2026-09-05) |
| Retention | newest 14 files |
| Off-site copy | **none** — the backups share the disk with the database (see "Known gaps") |

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

- **No off-site copy.** Disk, database and backups are one `/dev/sda1`. A disk
  failure or a deleted server loses everything at once. Fix is small (nightly
  `rclone`/`scp` of the newest dump to a Hetzner Storage Box or object storage)
  but it is a topology change and was deliberately left out of this wave.
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
