#!/usr/bin/env bash
# Vercel "Ignored Build Step". Runs in apps/web (the project root directory).
# Exit 0 = skip the build, exit 1 = build.
# Builds only when apps/web or packages/contract changed since the last successful deployment of this branch,
# so engine-only pushes and PRs no longer create deployments.
set -u
WATCH=(. ../../packages/contract ../../pnpm-lock.yaml ../../pnpm-workspace.yaml ../../package.json)

base="${VERCEL_GIT_PREVIOUS_SHA:-}"
if [ -z "$base" ]; then
  # First deployment of this branch: compare with main.
  git fetch --quiet --depth=50 origin main 2>/dev/null || { echo "No base to compare; building."; exit 1; }
  base=$(git merge-base HEAD FETCH_HEAD 2>/dev/null) || { echo "No merge base; building."; exit 1; }
fi
if ! git cat-file -e "$base^{commit}" 2>/dev/null; then
  git fetch --quiet --depth=100 origin "$base" 2>/dev/null || { echo "Base $base not available; building."; exit 1; }
fi

if git diff --quiet "$base" HEAD -- "${WATCH[@]}"; then
  echo "No changes in apps/web or packages/contract since $base; skipping build."
  exit 0
fi
echo "Web or contract changed since $base; building."
exit 1
