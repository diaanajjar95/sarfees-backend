#!/usr/bin/env bash
#
# 02-server-setup.sh
#
# One-time setup of a fresh Contabo Ubuntu 22.04 (or 24.04) VPS:
#   - apt update + basic tooling
#   - Docker Engine + Compose plugin
#   - UFW firewall (SSH + HTTP + HTTPS only)
#   - Non-root user 'sarfees' with docker + sudo rights
#   - /opt/sarfees checkout of the repo
#
# Run as root the first time you SSH into the box:
#   bash 02-server-setup.sh
#
# After it finishes, `su - sarfees` and continue with 03-deploy.sh.
#
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/diaanajjar95/sarfees-backend.git}"
REPO_BRANCH="${REPO_BRANCH:-main}"
DEPLOY_USER="${DEPLOY_USER:-sarfees}"
DEPLOY_DIR="/opt/sarfees"

if [ "$EUID" -ne 0 ]; then
	echo "Run as root: sudo bash $0"
	exit 1
fi

echo "==> apt update + baseline tools"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl gnupg git ufw postgresql-client

echo "==> Installing Docker Engine + Compose plugin"
if ! command -v docker >/dev/null 2>&1; then
	install -m 0755 -d /etc/apt/keyrings
	curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
	chmod a+r /etc/apt/keyrings/docker.asc
	echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
		> /etc/apt/sources.list.d/docker.list
	apt-get update -y
	apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

echo "==> UFW firewall (SSH + HTTP + HTTPS + admin :8080)"
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
# Admin portal — public port while there's no admin.sarfees.com
# domain to hide it behind. Close this once DNS is live and the
# named-domain Caddyfile block is swapped in.
ufw allow 8080/tcp
ufw --force enable

echo "==> Creating deploy user '$DEPLOY_USER'"
if ! id "$DEPLOY_USER" &>/dev/null; then
	adduser --disabled-password --gecos "" "$DEPLOY_USER"
	usermod -aG docker,sudo "$DEPLOY_USER"
	# Copy root's authorized_keys so the same SSH key works.
	mkdir -p "/home/$DEPLOY_USER/.ssh"
	if [ -f /root/.ssh/authorized_keys ]; then
		cp /root/.ssh/authorized_keys "/home/$DEPLOY_USER/.ssh/"
	fi
	chown -R "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
	chmod 700 "/home/$DEPLOY_USER/.ssh"
	chmod 600 "/home/$DEPLOY_USER/.ssh/authorized_keys" 2>/dev/null || true
	# Passwordless sudo (comment out if you'd rather keep sudo prompting)
	echo "$DEPLOY_USER ALL=(ALL) NOPASSWD:ALL" > "/etc/sudoers.d/$DEPLOY_USER"
fi

echo "==> Cloning repo (branch $REPO_BRANCH) into $DEPLOY_DIR"
if [ ! -d "$DEPLOY_DIR/.git" ]; then
	install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$DEPLOY_DIR"
	sudo -u "$DEPLOY_USER" git clone --branch "$REPO_BRANCH" "$REPO_URL" "$DEPLOY_DIR"
else
	echo "  $DEPLOY_DIR already exists — skipping clone (branch: $(sudo -u "$DEPLOY_USER" git -C "$DEPLOY_DIR" rev-parse --abbrev-ref HEAD))"
fi

echo ""
echo "──────────────────────────────────────────────────"
echo " Setup complete. Next steps:"
echo "   1. su - $DEPLOY_USER"
echo "   2. cd $DEPLOY_DIR/deploy/contabo"
echo "   3. cp .env.example .env && \$EDITOR .env      # fill DB_PASSWORD"
echo "   4. bash scripts/gen-secrets.sh              # fill the JWT_* rows"
echo "   5. bash scripts/03-deploy.sh"
echo "──────────────────────────────────────────────────"
