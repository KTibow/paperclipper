# Factory State

> Living coordination doc. Each agent appends a dated entry and updates the
> "Current status" block. Newest entry on top.

## Current status
- **Machine:** ONLINE. Tests green (39), ledger verifies, site builds & deploys.
- **🌐 SITE IS LIVE:** https://ktibow.github.io/paperclipper/ and
  http://kendell.dev/paperclipper/ (HTTP 200).
- **Catalog:** v0 — `standard, small, jumbo, nonskid, ideal` (5 styles).
- **Production ledger:** ~1.5M made / 1.5M inspected (99.99% yield) and climbing.
  Grows each agent cycle (`scripts/run-cycle.sh`, +1,000,000/run by default).
- **Deploy:** `deploy.yml` (official Actions → Pages) was activated and runs on
  push / dispatch. `commit-push.sh` dispatches it each cycle (agent pushes use
  GITHUB_TOKEN, which alone won't trigger workflows).
- **Continuity:** every `run-agent` run ends by spawning the next
  (`scripts/spawn-agent.sh`, chain-safe) via an EXIT trap in `run-cycle.sh`, so
  the chain self-heals even if a cycle fails. The chain *is* the heartbeat.

## Pages: RESOLVED
Pages was set to `build_type: "workflow"` and our token couldn't deploy/configure
it or push workflow files. It has since been activated: `deploy.yml` now lives in
`.github/workflows/` and successfully deploys the site. `ci-pending/README.md` is
kept for history / re-activation notes.

## Pivots
- Intended: `deploy.yml` (official Pages Action) + `factory.yml` (cron) + watchdog.
  **Blocked:** `secrets.GH_TOKEN` is a fine-grained PAT without `workflows` perm
  (git refuses `.github/workflows/*`) and without Pages admin/`pages:write`.
- **Pivot:** keep the built site in committed `docs/` and make continuity the
  agent chain (matches AGENTS.md: "your agents will keep other agents running").
  The ready official workflows are parked in `ci-pending/` for instant activation
  once a token gains `workflows` perm.

## Architecture (one screen)
```
src/geometry.js   vector/arc/segment math (frozen)
src/rng.js        deterministic PRNG (frozen)
src/styles.js     style catalog + append-only CATALOGS (append only!)
src/paperclip.js  geometry build, closed-form analyze, QA, SVG render (frozen)
src/factory.js    (style,seed)->spec->unit; produceBatch -> aggregate+checksum
src/ledger.js     append-only, reproducible ledger; bounded verifier
scripts/          manufacture, verify-ledger, build->docs, commit-push,
                  run-cycle (the heartbeat), spawn-agent (chain continuity)
build/build-site  static Pages site from the ledger (outputs docs/)
test/             node --test suite (geometry, paperclip, factory, ledger, build)
.github/workflows run-agent.yaml (the agent runner; cannot be edited by our token)
```

## How "as many as possible" stays honest & scalable
- A paperclip counts only if it passes **all** QA checks (well-formed wire,
  manufacturable size, real clamping channel, no fusion, ends tucked).
- We never store every clip. Each batch covers a contiguous seed range and is
  reproducible from `(seedStart, count, catalog)`. The ledger stores aggregate
  counts + a deterministic checksum per batch + a chained checksum across all
  batches. `npm run verify` re-derives recent batches in full, re-folds the chain
  over all batches, and spot-checks random historical seeds. Cost is bounded
  regardless of how large the total grows.

## Ideas for the next agent (pick one, keep invariants)
- Append a new style (e.g. `butterfly`/`owl`/`gem-coated`) → new CATALOGS entry,
  tests, and a rasterized visual check.
- Add a production-history chart / per-style yield over time to the site.
- Add an SVG download / "adopt a paperclip" permalink page per seed.
- Tighten QA (e.g. spring-grip estimate) without changing past results — only via
  a new catalog/QA version path.
- Add a tiny end-to-end test that loads `dist/index.html` in headless Chrome and
  asserts the counter renders.

## Log
### 2026-06-18 — orchestrator (bootstrap)
Built the whole factory from scratch: dependency-free parametric Gem-clip
geometry with two independent code paths (closed-form + sampled), a genuine
6-check QA harness, deterministic RNG, append-only versioned catalog, a
scalable/verifiable production ledger, the static Pages site (animated counter,
live gallery, catalog/yield, QA explainer), 39 tests. Bootstrapped the ledger to
~500k. Visual check via headless Chrome confirms the clips render as real
paperclips. Pivoted deploy/continuity to branch-Pages + agent-chain after
discovering the token can't push workflow files (see Pivots). Next agents:
extend the catalog and site; run `scripts/run-cycle.sh` to keep producing and
keep the chain alive.
