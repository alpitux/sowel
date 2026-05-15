#!/bin/bash
# ============================================================
# Sowel container entrypoint
# ============================================================
# - If running as root: idempotently chown data/plugins directories
#   so the non-root sowel user can write, then drop privileges via gosu.
# - If running as a non-root user (custom `user:` in compose): exec
#   the command directly; volume ownership is the operator's job.
#
# This pattern (Postgres / MySQL / MariaDB) makes upgrades from a
# previously root-running container transparent: no manual chown step.
# ============================================================
set -e

if [ "$(id -u)" = "0" ]; then
  # Idempotent — instant no-op if the volume is already sowel-owned.
  chown -R sowel:sowel /app/data /app/plugins 2>/dev/null || true

  # If /var/run/docker.sock is bind-mounted (opt-in self-update via
  # docker-compose.override.yml), align the sowel user with the socket's
  # host group so the in-app updater can talk to the Docker daemon as
  # non-root. The host GID is detected at runtime — no hard-coded value.
  if [ -e /var/run/docker.sock ]; then
    DOCKER_GID=$(stat -c '%g' /var/run/docker.sock 2>/dev/null || echo "")
    if [ -n "$DOCKER_GID" ] && [ "$DOCKER_GID" != "0" ]; then
      DOCKER_GROUP=$(getent group "$DOCKER_GID" 2>/dev/null | cut -d: -f1)
      if [ -z "$DOCKER_GROUP" ]; then
        groupadd -g "$DOCKER_GID" docker-host 2>/dev/null && DOCKER_GROUP=docker-host
      fi
      [ -n "$DOCKER_GROUP" ] && usermod -aG "$DOCKER_GROUP" sowel 2>/dev/null || true
    fi
  fi

  exec gosu sowel "$@"
fi

exec "$@"
