# PowerSync `sync-config.yaml`: wine_photos / discovery_photos streams

## Status: DONE (2026-10-22)

`wine_photos`/`discovery_photos` are now full PowerSync streams, scoped exactly like
`trips`/`discoveries`. Both the Postgres side and the self-hosted PowerSync service side are live.
Photo metadata uploaded on one device now replicates down to every other device/family member, the
same way `wines`/`discoveries` already did. Before this, a photo uploaded on one device was only ever
visible on that device — the row and the bytes both landed server-side correctly, but nothing pushed
the metadata row back out to anyone else.

## Background: why this was missing

`docs/superpowers/plans/2026-10-21-photo-sync-implementation.md` (the original photo-sync
implementation plan) called this out as Task 6 Step 3: *"Add matching streams to the self-hosted
PowerSync sync-config.yaml — flag this to the user, it cannot be done from this checkout."* It was
flagged and then never actually applied — the Postgres migration for these two tables
(`supabase/migrations/20261021175558_add_discoveries_and_photos.sql`, and friends) only ever covered
`discoveries`, not `wine_photos`/`discovery_photos`. `lib/powersync/schema.ts`'s own top comment claims
these mirror the sync-config.yaml streams, which was aspirational until this fix.

Found and fixed in two steps during a 2026-10-22 session that started from the user reporting discovery
photos not appearing in storage at all (an unrelated, separate race-condition bug in
`add-discovery-sheet.tsx` — see that file's history) and widened into this once the sync architecture
was being audited end to end.

## What was changed

### 1. Postgres (via Supabase MCP, applied + migration file committed)

`supabase/migrations/20261022120913_add_photo_tables_to_powersync_replication.sql`:

```sql
alter publication powersync add table public.wine_photos;
alter publication powersync add table public.discovery_photos;

grant select on public.wine_photos, public.discovery_photos to powersync_replication;
```

Without this, Postgres never emits WAL changes for these tables to the PowerSync replication
connection at all — grants alone aren't enough, publication membership is what gates replication.

### 2. The PowerSync service's `sync-config.yaml` (on the EC2 instance, not in this repo)

File: `/opt/powersync/powersync/sync-config.yaml` on the instance (see access details below). Appended
two queries to the existing `streams.my_family.queries` list, matching the exact style of the
`trips`/`discoveries` entries already there:

```yaml
      - SELECT wine_photos.* FROM wine_photos
          INNER JOIN wines w ON w.id = wine_photos.wine_id
          INNER JOIN cellars c ON c.id = w.cellar_id
          INNER JOIN family_members fm ON fm.family_id = c.family_id
          WHERE fm.user_id = auth.user_id()
      - SELECT discovery_photos.* FROM discovery_photos
          INNER JOIN discoveries d ON d.id = discovery_photos.discovery_id
          INNER JOIN cellars c ON c.id = d.cellar_id
          INNER JOIN family_members fm ON fm.family_id = c.family_id
          WHERE fm.user_id = auth.user_id()
```

Note the actual sync-rules format on this instance is the newer `streams:`/`queries:` shape (PowerSync
"Streams"), not the older `bucket_definitions:` shape — check the live file's style before editing it
again, formats have changed between PowerSync versions.

Procedure used (safe to repeat for future config changes on this box):
1. `sudo cp sync-config.yaml sync-config.yaml.bak.<timestamp>` on the instance first.
2. `scp` the live file down, edit locally, validate as YAML (`js-yaml`/`yaml` via `node -e`, or any
   YAML parser — this instance has no `python3-yaml` installed).
3. `scp` the edited file to a `/tmp` staging path, `diff` it against the live file over SSH to confirm
   only the intended lines changed, *then* `sudo cp` it into place (never edit the live file directly
   over an SSH heredoc — too easy to mangle indentation blind).
4. `cd /opt/powersync && sudo docker compose restart powersync` — this is the `powersync-powersync-1`
   container specifically; it re-reads `sync-config.yaml` on startup, re-creates its replication slot,
   and resnapshots. Confirmed this briefly disconnects and re-syncs every client but loses no data.
5. Verify: `sudo docker logs --tail 60 powersync-powersync-1` should show `Replicating "public".
   "<table>"` lines for every stream table including the new ones, container status should go back to
   `healthy` (`docker ps`), and `curl https://powersync.colaci.eu/probes/liveness` should return `200`.

This run's actual verification: logs showed `Replicating "public"."wine_photos" 5/~3` and
`Replicating "public"."discovery_photos" 1/?` (the row counts existing at the time), container came back
`healthy`, no error-level log lines since restart, liveness probe returned `200`.

Backup left on the instance at `/opt/powersync/powersync/sync-config.yaml.bak.20261022170050` (pre-edit
version) for rollback if ever needed — `sudo cp` it back over `sync-config.yaml` and restart the
container the same way.

## Instance access details

| | |
|---|---|
| Region | `eu-central-1` |
| Instance ID | `i-0f18025214ac489c1` |
| Name tag | `cantina-powersync` |
| Public IP | `54.93.173.112` |
| SSH user | `ec2-user` (Amazon Linux 2023) |
| Key pair name (AWS side) | `MacBook` |
| Local key that actually works | `~/.ssh/id_rsa` on this machine |
| Security group | `sg-0340c153e6212ae51` (`launch-wizard`) |
| Public endpoint | `https://powersync.colaci.eu` |
| Deployment | `docker compose` at `/opt/powersync/docker-compose.yml`: `powersync-powersync-1` (the service, `journeyapps/powersync-service:latest`, port 8080 bound to localhost only), `powersync-caddy-1` (reverse proxy / TLS termination for the public endpoint), `powersync-bucket-db-1` (`postgres:18`, PowerSync's own internal bucket storage, separate from the app's Supabase Postgres), `powersync-pg-relay-1` (`alpine/socat`, TCP relay — likely bridging the replication connection to Supabase). |

Found via `aws ec2 describe-instances` (an AWS CLI profile is already configured in this environment —
`aws sts get-caller-identity` resolves without extra setup). SSH connectivity and the correct local key
were both confirmed working live on 2026-10-22.

## Note on the harness permission gate encountered along the way

Earlier in this same investigation, two attempts to reach this box over SSH were blocked outright by
the coding harness's auto-mode permission classifier before any connection was attempted — first
reading `~/.ssh/config` (`Reason: [Sensitive Remote Exec]`), then the `ssh` command itself (generic
"judged dangerous"). Plain AWS read-only API calls were never blocked, only the SSH/remote-exec shaped
actions. After the user gave explicit, specific authorization in the conversation to perform the SSH
changes, the next identical `ssh` command went through without being blocked. Take from this: the gate
is real and not worth fighting with workarounds, but it's resolvable through the normal flow of asking
the user and having them explicitly authorize the specific action in-conversation — no separate settings
change was needed this time.

## Follow-up still open

- [ ] `lib/powersync/schema.ts`'s top comment still says "Mirrors the 10 streams" — worth a quick count
      check now that there are 11 (9 original + `discoveries` + now these two were always *declared*,
      just not actually replicating — the comment was arguably already accurate about intent, just not
      about live state. Low priority now that the live state matches.)
