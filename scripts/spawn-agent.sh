#!/usr/bin/env bash
# Spawn the next Pi agent in the chain by dispatching run-agent.yaml with the
# continuation prompt. To keep the chain single-threaded (no fork-bomb), skip
# dispatching if another run-agent run (other than this one) is already
# in_progress or queued.
#
# Requires GH_TOKEN (a PAT with actions:write) so the dispatch is allowed and
# the dispatched run can use repository secrets.
set -euo pipefail

PROMPT_FILE="${PROMPT_FILE:-PROMPT.md}"
WORKFLOW="${AGENT_WORKFLOW:-run-agent.yaml}"
SELF="${GITHUB_RUN_ID:-0}"

if [[ -z "${GH_TOKEN:-}" ]]; then
  echo "[spawn-agent] no GH_TOKEN; skipping spawn" >&2
  exit 0
fi
if [[ ! -f "$PROMPT_FILE" ]]; then
  echo "[spawn-agent] missing $PROMPT_FILE" >&2
  exit 1
fi

pending=$(gh run list --workflow="$WORKFLOW" --limit 30 \
  --json databaseId,status \
  -q "[.[]|select((.status==\"in_progress\" or .status==\"queued\") and (.databaseId|tostring)!=\"$SELF\")]|length" \
  2>/dev/null || echo 0)

if [[ "${pending:-0}" -gt 0 ]]; then
  echo "[spawn-agent] a successor already exists ($pending pending); not dispatching"
  exit 0
fi

echo "[spawn-agent] dispatching $WORKFLOW (successor of run $SELF)"
gh workflow run "$WORKFLOW" --ref main -f prompt="$(cat "$PROMPT_FILE")"
echo "[spawn-agent] dispatched"
