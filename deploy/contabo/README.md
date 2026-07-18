# Contabo migration playbook

End-to-end walkthrough for moving the Sarfees API off Render onto a
fresh Contabo VPS, carrying the current Render Postgres data with you.

## Target stack

```
┌───────────────── Contabo VPS (Ubuntu 22.04 / 24.04) ─────────────────┐
│                                                                      │
│  ┌────────┐  :80/:443  ┌────────────┐  :3000  ┌──────────┐          │
│  │ Caddy  │───────────►│ sarfees-api│────────►│ postgres │          │
│  │ (TLS)  │            │ (NestJS)   │         │  (v15)   │          │
│  └────────┘            └────────────┘         └──────────┘          │
│      ▲                       │                      ▲                │
│      │                       │                      │                │
│      │                       ▼                      │                │
│  api.sarfees.com         /app/uploads         postgres_data          │
│  (Let's Encrypt)         (named volume)       (named volume)         │
└──────────────────────────────────────────────────────────────────────┘
```

Three docker services on one host, running behind Caddy for automatic
Let's Encrypt TLS. Uploads + DB live in named docker volumes so they
survive container rebuilds.

**Recommended box:** Contabo VPS S or M (4 GB RAM, 4 vCPU, 200 GB SSD).
For heavier load bump RAM before CPU.

## Prerequisites

- [ ] Contabo VPS provisioned with Ubuntu 22.04 or 24.04 —
      see [`00-CREATE-VPS.md`](00-CREATE-VPS.md) for the step-by-step
- [ ] Root SSH access confirmed (key-based, password auth disabled)
- [ ] Domain name (`api.sarfees.com`) with an A record pointing at the
      VPS IP — **optional for the initial cutover** (Caddyfile has a
      no-domain fallback), but required before you can serve production
      traffic over HTTPS.

## Timeline

| Phase | Where | Est. |
| --- | --- | --- |
| 0. Provision the VPS | Contabo panel + your Mac | 15 min + Contabo provisioning wait |
| 1. Back up Render DB | Local workstation | 5 min |
| 2. First-time server setup | Contabo VPS | 10 min |
| 3. Configure env + deploy | Contabo VPS | 5 min |
| 4. Restore DB | Contabo VPS | 5–15 min |
| 5. DNS cutover + TLS | Contabo VPS + registrar | 15 min |
| 6. Mobile app base URL swap | App team | separate |
| **Total** | | **~55 min** (+ Contabo provisioning + DNS propagation) |

---

## Phase 0 — Provision the Contabo VPS

Follow [`00-CREATE-VPS.md`](00-CREATE-VPS.md) end-to-end. That doc
covers plan selection, ordering, SSH key setup, first login, hardening
(disabling password auth), and DNS.

Once you have a reachable IP + confirmed SSH key access, continue with
Phase 1.

## Phase 1 — Back up the Render DB (do this first, on your Mac)

The Render free-tier DB suspends after inactivity and can take a while
to wake back up. Grab the dump the moment the DB is reachable.

```bash
# On your Mac
brew install libpq && brew link --force libpq       # only once
cd /path/to/sarfees-backend
bash deploy/contabo/scripts/01-backup-render-db.sh
```

Output lands in `deploy/contabo/backups/sarfees-render-YYYYMMDD-HHMMSS.dump`
(pg_dump custom format). **Keep this file safe** — it's the only copy of
your production data outside Render.

## Phase 2 — Server setup (on the Contabo VPS, one time)

SSH in as root:

```bash
ssh root@<contabo-ip>

# Pull the setup script and run it
curl -fsSL https://raw.githubusercontent.com/diaanajjar95/sarfees-backend/main/deploy/contabo/scripts/02-server-setup.sh \
	| bash
```

This installs docker + docker-compose, sets up a UFW firewall, creates
a non-root `sarfees` user, and clones the repo into `/opt/sarfees`.

## Phase 3 — Configure + deploy

```bash
# On the VPS, as the sarfees user
su - sarfees
cd /opt/sarfees/deploy/contabo

# 1. Prepare .env
cp .env.example .env
$EDITOR .env             # fill DB_PASSWORD with a random 32+ char string
bash scripts/gen-secrets.sh    # fills all six JWT_* rows

# 2. Bring the stack up
bash scripts/03-deploy.sh
```

Deploy script waits for postgres to accept connections + the api to
serve `/faq`. On success it prints the box's public IP so you can
sanity-check from another machine:

```bash
curl http://<contabo-ip>/faq       # should return the 10 seeded FAQ items
```

## Phase 4 — Restore the Render dump

Copy the dump from your Mac to the VPS:

```bash
# From your Mac
scp deploy/contabo/backups/sarfees-render-*.dump \
	sarfees@<contabo-ip>:/opt/sarfees/deploy/contabo/backups/
```

Then on the VPS:

```bash
cd /opt/sarfees/deploy/contabo
bash scripts/04-restore-db.sh
# Confirms row counts after restore.
```

**Alternative:** if you have `pg_dump`/`pg_restore` on the VPS itself
and the Render DB is reachable from there, you can pipe end-to-end
without the intermediate file:

```bash
PGPASSWORD=... pg_dump \
	--host=dpg-...oregon-postgres.render.com --port=5432 \
	--username=sarfees_db_user --dbname=sarfees_db \
	--format=custom --no-owner --no-privileges \
| docker compose exec -T postgres pg_restore \
	-U "$(grep DB_USERNAME .env | cut -d= -f2)" \
	-d "$(grep DB_NAME .env | cut -d= -f2)" \
	--no-owner --no-privileges --clean --if-exists
```

## Phase 5 — DNS + TLS

1. In your DNS provider, create an A record: `api.sarfees.com → <contabo-ip>`
2. Wait for propagation (`dig api.sarfees.com +short` should return the IP)
3. Edit `deploy/contabo/Caddyfile` — replace `api.sarfees.com` with your
   real hostname if different (the template already uses it)
4. `docker compose restart caddy`
5. Caddy will auto-fetch a Let's Encrypt cert on the first HTTPS request
6. Test: `curl https://api.sarfees.com/faq`

## Phase 6 — Mobile cutover

Point the mobile app at the new base URL:

```
old:  https://sarfees-api.onrender.com
new:  https://api.sarfees.com
```

Push a release. Watch for 401 spikes (JWT secrets changed, so every
existing session is invalid — users re-login once). After 24h with no
issues, decommission the Render service to stop the billing.

---

## Operations

### Deploy new code

```bash
# On the VPS, as sarfees
cd /opt/sarfees/deploy/contabo
bash scripts/03-deploy.sh          # git pulls + rebuilds + restarts
```

### Take a fresh backup

```bash
cd /opt/sarfees/deploy/contabo
docker compose exec -T postgres pg_dump \
	-U "$(grep DB_USERNAME .env | cut -d= -f2)" \
	-d "$(grep DB_NAME .env | cut -d= -f2)" \
	--format=custom --no-owner --no-privileges \
	> "backups/sarfees-$(date -u +%Y%m%d-%H%M%S).dump"
```

Set up a cron for daily automatic dumps to be safe:

```
0 3 * * * cd /opt/sarfees/deploy/contabo && \
	docker compose exec -T postgres pg_dump -U sarfees_user -d sarfees_db --format=custom \
	> backups/sarfees-$(date -u +\%Y\%m\%d).dump && \
	find backups -name '*.dump' -mtime +14 -delete
```

### View logs

```bash
docker compose logs api --tail=200 -f     # NestJS output
docker compose logs postgres --tail=100   # DB output
docker compose logs caddy --tail=100      # reverse proxy
```

### Roll back a bad deploy

```bash
cd /opt/sarfees
git log --oneline -10                # find the last known-good commit
git checkout <sha>
cd deploy/contabo && docker compose up -d --build
```

### Rotate JWT secrets

```bash
cd /opt/sarfees/deploy/contabo
bash scripts/gen-secrets.sh
docker compose restart api
# All existing sessions invalidated — clients will 401 and hit /refresh.
```

---

## Troubleshooting

**`docker compose up` says "no space left on device"**
: `docker system prune -af --volumes` to reclaim old images/layers.
  Won't touch named volumes (postgres_data / uploads_data are safe).

**Caddy stuck getting a cert**
: DNS hasn't propagated yet. Verify: `dig api.sarfees.com +short` returns
  the VPS IP. Ports 80 + 443 must be open on the firewall
  (`02-server-setup.sh` does this).

**API 500 on driver login**
: Almost always missing JWT secrets. `grep '^JWT_' .env` — all six lines
  must have values. If any are blank, `bash scripts/gen-secrets.sh` then
  `docker compose restart api`.

**Data missing after restore**
: `pg_restore` prints per-table row counts. Compare against
  Render dashboard's DB metrics. If a table is short, the dump may have
  been taken mid-write; re-dump and re-restore.

**Uploads returning 404 after restore**
: Restore only moves DB rows, not files. Render's ephemeral disk means
  the files never left Render — after cutover, drivers need to re-upload
  their documents. The metadata (`driver_documents` rows) is intact,
  but the `fileUrl` points at paths that don't exist on the new host.
  Mark those docs `status=pending_review` and let drivers re-upload:
  ```sql
  UPDATE driver_documents SET status='pending_review';
  ```

---

## File map

```
deploy/contabo/
├── README.md              this file — phase 1 onwards
├── 00-CREATE-VPS.md       Contabo panel walkthrough (phase 0)
├── docker-compose.yml     postgres + api + caddy
├── .env.example           template for the local .env
├── Caddyfile              reverse proxy config (with no-domain fallback)
├── backups/               (created on first backup; gitignored)
└── scripts/
    ├── 01-backup-render-db.sh    (run local)  dump the Render DB
    ├── 02-server-setup.sh        (run on VPS) provision the box
    ├── 03-deploy.sh              (run on VPS) build + up -d + health
    ├── 04-restore-db.sh          (run on VPS) restore a .dump into postgres
    └── gen-secrets.sh            (run on VPS) rotate JWT_* in .env
```
