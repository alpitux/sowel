#!/bin/sh
# ============================================================
# Sowel — One-command installer
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/mchacher/sowel/main/scripts/install.sh | sh
#
# Environment overrides:
#   SOWEL_DIR    Install directory (default: $HOME/sowel)
#   SOWEL_PORT   Host port to expose (default: 3000)
# ============================================================
set -eu

SOWEL_DIR="${SOWEL_DIR:-$HOME/sowel}"
SOWEL_PORT="${SOWEL_PORT:-3000}"
COMPOSE_URL="https://raw.githubusercontent.com/mchacher/sowel/main/docker-compose.yml"
HEALTH_URL="http://localhost:${SOWEL_PORT}/api/v1/health"

# ─── Pre-flight ─────────────────────────────────────────────
if ! command -v docker >/dev/null 2>&1; then
  echo "Error: Docker is not installed."
  echo "Install Docker first: https://docs.docker.com/get-docker/"
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Error: Docker Compose v2 is required (run 'docker compose version' to check)."
  echo "Update Docker Desktop, or install the docker-compose-plugin package."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Error: cannot reach the Docker daemon. Is it running? Do you need sudo?"
  exit 1
fi

# ─── Install directory ──────────────────────────────────────
if [ -e "$SOWEL_DIR/docker-compose.yml" ]; then
  echo "An existing Sowel install was found at: $SOWEL_DIR"
  echo "Refusing to overwrite. Use SOWEL_DIR=/some/other/path or remove it first."
  exit 1
fi

mkdir -p "$SOWEL_DIR"
cd "$SOWEL_DIR"

# ─── Fetch docker-compose.yml ───────────────────────────────
echo "Fetching docker-compose.yml…"
if ! curl -fsSL -o docker-compose.yml "$COMPOSE_URL"; then
  echo "Error: could not download $COMPOSE_URL"
  exit 1
fi

# ─── Detect host timezone, patch the compose ───────────────
HOST_TZ=""
if command -v timedatectl >/dev/null 2>&1; then
  HOST_TZ="$(timedatectl 2>/dev/null | awk -F': ' '/Time zone/ {print $2}' | awk '{print $1}')"
fi
if [ -z "$HOST_TZ" ] && [ -L /etc/localtime ]; then
  HOST_TZ="$(readlink /etc/localtime 2>/dev/null | sed 's|.*/zoneinfo/||')"
fi

if [ -n "${HOST_TZ:-}" ] && [ "$HOST_TZ" != "UTC" ]; then
  # Use a portable sed: macOS needs an empty -i suffix, GNU does not.
  if sed --version >/dev/null 2>&1; then
    sed -i "s|# - TZ=Europe/Paris|- TZ=$HOST_TZ|" docker-compose.yml
  else
    sed -i '' "s|# - TZ=Europe/Paris|- TZ=$HOST_TZ|" docker-compose.yml
  fi
  echo "Detected timezone: $HOST_TZ (set in docker-compose.yml)"
fi

# ─── Custom port ────────────────────────────────────────────
if [ "$SOWEL_PORT" != "3000" ]; then
  if sed --version >/dev/null 2>&1; then
    sed -i "s|\"3000:3000\"|\"$SOWEL_PORT:3000\"|" docker-compose.yml
  else
    sed -i '' "s|\"3000:3000\"|\"$SOWEL_PORT:3000\"|" docker-compose.yml
  fi
  echo "Exposing Sowel on host port $SOWEL_PORT"
fi

# ─── Pull + start ───────────────────────────────────────────
echo "Pulling images…"
docker compose pull

echo "Starting Sowel…"
docker compose up -d

# ─── Wait for /api/v1/health ────────────────────────────────
printf "Waiting for Sowel to be ready"
ready=0
i=0
while [ $i -lt 60 ]; do
  if curl -fs "$HEALTH_URL" >/dev/null 2>&1; then
    ready=1
    echo " ✓"
    break
  fi
  printf "."
  sleep 1
  i=$((i + 1))
done

if [ "$ready" -ne 1 ]; then
  echo
  echo "Warning: Sowel did not respond on $HEALTH_URL within 60 seconds."
  echo "Check the logs: docker compose -f $SOWEL_DIR/docker-compose.yml logs"
  exit 2
fi

# ─── Detect LAN IP for the final message ────────────────────
# Use the IP the host would use to reach the internet (avoids Docker bridges).
LAN_IP=""
if command -v ip >/dev/null 2>&1; then
  LAN_IP="$(ip route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src") print $(i+1)}' | head -1)"
fi
if [ -z "$LAN_IP" ] && command -v route >/dev/null 2>&1 && command -v ipconfig >/dev/null 2>&1; then
  iface="$(route get 1.1.1.1 2>/dev/null | awk '/interface:/ {print $2}')"
  [ -n "$iface" ] && LAN_IP="$(ipconfig getifaddr "$iface" 2>/dev/null)"
fi
if [ -z "$LAN_IP" ] && command -v hostname >/dev/null 2>&1; then
  LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
fi
[ -z "$LAN_IP" ] && LAN_IP="localhost"

URL="http://${LAN_IP}:${SOWEL_PORT}"

# ─── Done ───────────────────────────────────────────────────
cat <<EOF

Sowel is running.

  → ${URL}

First steps after you sign in:
  1. Create your admin account
  2. Name your home (Settings → Home)
  3. Set its location (latitude / longitude) — required to enable
     timezone, sunrise / sunset, and HP/HC tariff classification
  4. Install integrations: ${URL}/admin/plugins

Useful commands (run from $SOWEL_DIR):
  Logs     docker compose logs -f
  Update   docker compose pull && docker compose up -d
  Stop     docker compose down
  Wipe     docker compose down -v   # also deletes data volumes

Documentation: https://docs.sowel.org
EOF
