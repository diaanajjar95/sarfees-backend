# Phase 0 — Create the Contabo VPS

Before any scripts run, you need a Contabo VPS that's provisioned,
reachable over SSH, and running Ubuntu 22.04 (or 24.04). This doc walks
you through it end-to-end (~15 min of clicking + 5–10 min waiting for
Contabo to provision).

Once the box is reachable, jump to
[`README.md → Phase 2`](README.md#phase-2--server-setup-on-the-contabo-vps-one-time).

---

## Step 1 — Generate an SSH key on your Mac (skip if you already have one)

You'll paste the **public** half into Contabo when creating the server.
The private half stays on your Mac.

```bash
# One-time. Use ed25519 — modern, faster than the default RSA.
ssh-keygen -t ed25519 -C "you@sarfees.com" -f ~/.ssh/sarfees-contabo
# Enter to accept default passphrase-less key, or set one for extra safety.

# Copy the public half to your clipboard for the Contabo form
pbcopy < ~/.ssh/sarfees-contabo.pub
```

**Sanity check** — the file should be a single line starting with
`ssh-ed25519 AAAA…` and ending with your email comment.

---

## Step 2 — Pick a Contabo plan

Contabo runs two product lines. Both work; pricing at time of writing
(Jul 2026, subject to change):

| Product line | Recommended tier | Specs | Price/mo |
| --- | --- | --- | --- |
| **VPS** | **VPS S** | 4 vCPU · 8 GB RAM · 100 GB NVMe | ~€4.50 |
| **VPS** | VPS M | 6 vCPU · 12 GB RAM · 200 GB NVMe | ~€8.50 |
| **Cloud VPS** | Cloud VPS 10 | 2 vCPU · 6 GB RAM · 100 GB NVMe | ~€6.99 |

**Recommendation:** **VPS S** is the sweet spot to start — plenty of RAM
for Postgres + the NestJS app + Caddy, cheap enough that you can size
up later once you know real traffic patterns. Bump to VPS M if you
foresee > 500 concurrent driver sessions.

Avoid the **Storage VPS** line — HDD-backed, too slow for Postgres.

---

## Step 3 — Order the VPS

1. Go to <https://contabo.com/en/vps/> and pick **VPS S** (or your chosen tier).
2. Click **Configure Now**.
3. On the configuration screen fill in:

   | Field | Value |
   | --- | --- |
   | **Contract term** | 1 month (upgrade to 12-month later once you're sure) |
   | **Region** | Closest to your users. Jordan → **Frankfurt (Germany)** for lowest latency to MENA |
   | **Storage type** | **NVMe** (the default; do NOT pick SSD/HDD) |
   | **Image** | **Ubuntu 24.04 LTS** (or 22.04 LTS — both work, 24.04 gets support until 2029) |
   | **Add-ons** | Skip all — you don't need Contabo's cPanel/Plesk/backup addons |
   | **Login** | **SSH-Key** → paste the public key from Step 1 |
   | **Object Storage** | Skip |
   | **Hostname** | Something like `sarfees-api-1` (or leave blank) |
   | **Root password** | Contabo forces one anyway; use a strong random string and save it in your password manager. You'll disable it in Step 5. |

4. Proceed to checkout and pay.

---

## Step 4 — Wait for the provisioning email

Contabo usually provisions within **5–15 minutes** for VPS-line
products (the older "VPS" naming). Cloud VPS can take up to a few
hours in worst cases. You'll get an email with:

- The **IPv4 address** (looks like `144.126.155.203`)
- The **root password** (the one you set)
- Confirmation your SSH key was installed

If you don't see the email within an hour:

- Check spam
- Log into <https://my.contabo.com> → **Your Services** → look for a
  "provisioning" status — it might be stuck awaiting fraud review, in
  which case a Contabo agent will email or call
- Contact support: <support@contabo.com>

---

## Step 5 — First SSH login + verify prereqs

Once you have the IP:

```bash
# From your Mac
ssh -i ~/.ssh/sarfees-contabo root@<contabo-ip>
```

If SSH prompts for a password even though you pasted a key — jump to
[Troubleshooting → SSH key wasn't accepted](#troubleshooting) below.

Once logged in, verify the OS + resources:

```bash
# OS
lsb_release -d          # → "Description:  Ubuntu 24.04 LTS"  (or 22.04)

# RAM
free -h                 # →  8Gi or so

# Disk
df -h /                 # → 100 GB usable

# Network
ip -4 addr show | grep inet | head -3
curl -s ifconfig.me     # → your public IP
```

---

## Step 6 — Harden the box (before you run anything else)

The root password Contabo assigned you is fine for the first login,
but you want to disable password auth entirely so only your SSH key
gets in.

```bash
# On the VPS as root

# 1. Confirm your key works. Don't skip this — if the key isn't in
#    /root/.ssh/authorized_keys, disabling passwords locks you out.
cat /root/.ssh/authorized_keys | head -1
# → should show your `ssh-ed25519 AAAA…` from Step 1

# 2. Disable password auth
sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#*PermitEmptyPasswords.*/PermitEmptyPasswords no/'   /etc/ssh/sshd_config
sed -i 's/^#*ChallengeResponseAuthentication.*/ChallengeResponseAuthentication no/' /etc/ssh/sshd_config

# 3. Reload sshd (won't drop your current session)
systemctl reload sshd

# 4. **In a NEW terminal window**, verify you can still SSH in with
#    your key. Do NOT close your current session until this works.
```

Also worth doing (one-liners on the VPS as root):

```bash
# Set timezone (matches Amman; adjust to your ops team's TZ)
timedatectl set-timezone Asia/Amman

# Enable + configure unattended-upgrades so security patches auto-apply
apt-get install -y unattended-upgrades
dpkg-reconfigure -f noninteractive unattended-upgrades
```

**Skip installing a firewall (UFW) manually** — `02-server-setup.sh`
handles that as part of the automated setup.

---

## Step 7 — Save the connection details somewhere

Before moving on, record:

- **Public IP:** `_____________________`
- **SSH command:** `ssh -i ~/.ssh/sarfees-contabo root@<ip>`
- **Root password:** *(disabled after Step 6 — kept only for Contabo panel VNC console emergencies)*
- **Contabo panel:** <https://my.contabo.com>

You'll want the IP for:
- Step 8 (below) — DNS
- Phase 4 — `scp` the DB dump up
- The mobile team — provisional testing URL

---

## Step 8 (optional, do it now if you have the domain) — Point DNS

If you own `sarfees.com` (or whatever domain you plan to use), create
the A record now so it has time to propagate:

| Record type | Name | Value | TTL |
| --- | --- | --- | --- |
| A | `api` | `<contabo-ip>` | 300 (5 min) |

Verify propagation from your Mac:

```bash
dig api.sarfees.com +short          # should return the Contabo IP
```

TTL of 300 gives you flexibility if you need to move again. Bump to
3600 (1 hr) once you're settled.

**If you don't have the domain yet** — skip this step. The Caddyfile
in this repo has a `:80` no-domain fallback that works over the raw
IP, so you can test end-to-end before DNS is set up.

---

## Next

You now have a reachable, hardened Ubuntu box. Continue with
[`README.md → Phase 2`](README.md#phase-2--server-setup-on-the-contabo-vps-one-time)
to install Docker + clone the repo + run the app.

---

## Troubleshooting

**"SSH key wasn't accepted" — asked for password on first login**
: Contabo occasionally doesn't install the pasted key. Log in with the
  root password Contabo emailed, then manually install the key:

  ```bash
  mkdir -p ~/.ssh
  cat > ~/.ssh/authorized_keys <<'KEY'
  ssh-ed25519 AAAA…                  # paste the public half of your key
  KEY
  chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys
  ```

  Then `exit` and re-`ssh` in with `-i` to confirm the key now works.

**"Connection refused" on `ssh root@<ip>`**
: Contabo hasn't finished provisioning. Wait 5–10 more minutes and try
  again. If it persists past an hour, contact Contabo support.

**"IPv6 only" — no IPv4 shown in the email**
: Most Contabo tiers include IPv4 by default, but some Cloud VPS
  configurations skip it. Check the Contabo panel → your service → Add
  IPv4. If it's an add-on, order it — mobile clients rarely support
  IPv6-only endpoints reliably.

**Box shows as "provisioning" for hours**
: Contabo's fraud review flagged the order. They usually email you or
  call within a business day. If you're in a hurry, reach out to
  <support@contabo.com> with your order ID.

**Can't SSH in but the Contabo panel shows the VPS running**
: Use the Contabo panel's VNC console (Services → your VPS → Console).
  Log in as root with the emailed password, then debug from there
  (usually a bad sshd_config or the SSH key wasn't installed).
