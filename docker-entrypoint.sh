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
  exec gosu sowel "$@"
fi

exec "$@"
