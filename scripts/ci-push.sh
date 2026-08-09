#!/usr/bin/env bash
# Resilient commit+push for CI-generated data files.
# Avoids merge conflicts by resetting to latest remote before committing.
# Usage: scripts/ci-push.sh "commit message" file1 [file2 ...]
set -euo pipefail

msg="$1"; shift
files=("$@")

git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"

stash=$(mktemp -d)
for f in "${files[@]}"; do cp "$f" "$stash/"; done

for attempt in 1 2 3; do
  git fetch origin main
  git reset --hard origin/main
  for f in "${files[@]}"; do cp "$stash/$(basename "$f")" "$f"; done

  # Guard: refuse to shrink a non-trivial *.json file down to a stub (<200 bytes).
  # Catches scripts that wrote empty results after their fetches all failed.
  for f in "${files[@]}"; do
    [[ "$f" == *.json ]] || continue
    new_size=$(wc -c < "$f" | tr -d ' ')
    # `|| true`: a brand-new file has no origin baseline — git show exits 128,
    # which set -eo pipefail would otherwise turn fatal. Missing baseline → 0.
    old_size=$(git show "origin/main:$f" 2>/dev/null | wc -c | tr -d ' ' || true)
    if [ "$new_size" -lt 200 ] && [ "$old_size" -gt 1000 ]; then
      echo "Refusing to shrink $f from $old_size to $new_size bytes — looks like an empty/stub write."
      exit 1
    fi
  done

  git add "${files[@]}"
  if git diff --cached --quiet; then
    echo "No changes to commit."
    exit 0
  fi
  git commit -m "$msg"
  git push && { echo "Pushed."; exit 0; }
  echo "Attempt $attempt failed, retrying..."
  sleep $((attempt * 2))
done
echo "Failed to push after 3 attempts."
exit 1
