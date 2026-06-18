#!/usr/bin/env bash
# One full production cycle of the paperclip machine. This is the heartbeat:
# every run-agent run should finish by calling it.
#   1. test the factory
#   2. manufacture a QA-gated batch into the ledger
#   3. independently re-verify the ledger
#   4. build the GitHub Pages site into docs/
#   5. commit + push (publishes via branch Pages once enabled)
#   6. spawn the next agent so the chain keeps running
#
# CONTINUITY GUARANTEE: spawning the successor runs in an EXIT trap, so even if a
# step above fails (e.g. a future change broke the tests), a fresh agent is still
# dispatched to diagnose and fix it. spawn-agent.sh guards against piling up more
# than one queued successor, so this cannot fork-bomb.
set -uo pipefail

COUNT="${COUNT:-1000000}"
CHUNK="${CHUNK:-50000}"
VERIFY_SAMPLE="${VERIFY_SAMPLE:-3000}"
export VERIFY_SAMPLE

spawn_successor() {
  echo "::group::spawn next agent"
  bash scripts/spawn-agent.sh || echo "[run-cycle] spawn skipped/failed (non-fatal)"
  echo "::endgroup::"
}
trap spawn_successor EXIT

set -e

echo "::group::test"
npm test
echo "::endgroup::"

echo "::group::manufacture ($COUNT)"
node scripts/manufacture.js --count="$COUNT" --chunk="$CHUNK"
echo "::endgroup::"

echo "::group::verify"
npm run verify
echo "::endgroup::"

echo "::group::build"
npm run build
echo "::endgroup::"

echo "::group::commit + push"
bash scripts/commit-push.sh
echo "::endgroup::"

echo "[run-cycle] production complete; successor will be spawned on exit"
