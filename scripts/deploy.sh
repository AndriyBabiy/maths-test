#!/usr/bin/env bash
# Manual deploy from your laptop. Pushes current branch, then SSHes to the
# Hetzner box and rebuilds the docker stack. Intentionally NOT run from CI.

set -euo pipefail

DEPLOY_HOST="${DEPLOY_HOST:-deploy@78.47.89.101}"
DEPLOY_KEY="${DEPLOY_KEY:-$HOME/.ssh/studyie_vps}"
DEPLOY_DIR="${DEPLOY_DIR:-/home/deploy/maths-test}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"

cd "$(dirname "$0")/.."

# Refuse to deploy with uncommitted changes.
if [[ -n "$(git status --porcelain)" ]]; then
  echo "✗ Working tree is dirty. Commit or stash first." >&2
  git status --short
  exit 1
fi

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$CURRENT_BRANCH" != "$DEPLOY_BRANCH" ]]; then
  echo "✗ Current branch is '$CURRENT_BRANCH' but DEPLOY_BRANCH is '$DEPLOY_BRANCH'." >&2
  echo "  Set DEPLOY_BRANCH=$CURRENT_BRANCH ./scripts/deploy.sh to override." >&2
  exit 1
fi

echo "→ Pushing $DEPLOY_BRANCH to origin"
git push origin "$DEPLOY_BRANCH"

LOCAL_SHA="$(git rev-parse --short HEAD)"
echo "→ Deploying $LOCAL_SHA to $DEPLOY_HOST:$DEPLOY_DIR"

ssh -i "$DEPLOY_KEY" "$DEPLOY_HOST" bash -se <<EOF
set -euo pipefail
cd "$DEPLOY_DIR"

echo "  · git fetch + reset to origin/$DEPLOY_BRANCH"
git fetch --quiet origin "$DEPLOY_BRANCH"
git reset --hard "origin/$DEPLOY_BRANCH"

REMOTE_SHA="\$(git rev-parse --short HEAD)"
echo "  · remote now at \$REMOTE_SHA"

echo "  · docker compose build"
docker compose build --pull

echo "  · docker compose up -d"
docker compose up -d --remove-orphans

echo "  · pruning dangling images"
docker image prune -f >/dev/null
EOF

echo "→ Tailing logs (10s)"
ssh -i "$DEPLOY_KEY" "$DEPLOY_HOST" "cd '$DEPLOY_DIR' && timeout 10 docker compose logs --tail=20 -f web || true"

echo "✓ Deploy complete: https://maths-test.andriybabiy.com"
