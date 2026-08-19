#!/usr/bin/env bash
# Retry frozen dependency installs on transient registry/cache failures.
set -euo pipefail

max_attempts="${BUN_INSTALL_ATTEMPTS:-3}"
attempt=1

while ((attempt <= max_attempts)); do
  echo "::group::Install dependencies (attempt $attempt/$max_attempts)"
  if bun install --frozen-lockfile; then
    echo "::endgroup::"
    exit 0
  else
    status=$?
  fi
  echo "::endgroup::"

  if ((attempt == max_attempts)); then
    echo "::error::Dependency install failed after $max_attempts attempts."
    exit "$status"
  fi

  delay=$((attempt * 5))
  echo "::warning::Dependency install failed; clearing Bun's cache and retrying in ${delay}s."
  bun pm cache rm || echo "::warning::Could not clear Bun's cache; retrying anyway."
  sleep "$delay"
  ((attempt += 1))
done
