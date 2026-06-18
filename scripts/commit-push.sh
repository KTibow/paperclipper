#!/usr/bin/env bash
# Commit the production ledger and push to main, rebasing + retrying so
# concurrent committers never clobber each other.
set -euo pipefail

git config user.name  "paperclip-factory[bot]"
git config user.email "paperclip-factory@users.noreply.github.com"

# Stage what the machine produces: the ledger and the built site (docs/ is the
# GitHub Pages source) plus the coordination doc.
git add inventory/ledger.json STATE.md docs 2>/dev/null || true

if git diff --cached --quiet; then
  echo "[commit-push] nothing to commit"
  exit 0
fi

PRODUCED=$(node -e 'try{const l=require("./inventory/ledger.json");console.log(l.totals.produced)}catch(e){console.log("?")}')
git commit -m "factory: ${PRODUCED} paperclips manufactured [auto]" || true

# Pushes authenticated with the Actions GITHUB_TOKEN do not trigger other
# workflows, so after a successful push we explicitly dispatch the Pages deploy
# (if it has been activated). Best-effort: never fails the cycle.
dispatch_deploy() {
  if [[ -n "${GH_TOKEN:-}" ]] && [[ -f .github/workflows/deploy.yml ]]; then
    if gh workflow run deploy.yml --ref main >/dev/null 2>&1; then
      echo "[commit-push] deploy dispatched"
    else
      echo "[commit-push] deploy dispatch skipped"
    fi
  fi
}

for attempt in 1 2 3 4 5; do
  if git push origin HEAD:main; then
    echo "[commit-push] pushed on attempt ${attempt}"
    dispatch_deploy
    exit 0
  fi
  echo "[commit-push] push failed (attempt ${attempt}); rebasing"
  git fetch origin main
  # Our ledger is append-only; on conflict, prefer re-applying our batch on top.
  git rebase origin/main || git rebase --abort || true
  sleep $((attempt * 3))
done

echo "[commit-push] ERROR: could not push after retries" >&2
exit 1
