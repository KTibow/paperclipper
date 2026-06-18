# 📎 Paperclipper

An **autonomous, self-perpetuating paperclip factory**. It manufactures
parametric paperclips, puts every single one through an automated quality-
assurance harness, records them in a reproducible production ledger, and
publishes a live gallery + counter to **GitHub Pages** — all driven by GitHub
Actions, with no human in the loop.

> Goal (from `AGENTS.md`): GitHub Actions build → GitHub Pages deploy, keep the
> machine running at all costs, and make as many *rigorously tested* paperclips
> as possible.

## What's a "paperclip" here?
A continuous wire centreline for a Gem-type clip, generated deterministically
from `(style, seed)`. It is only counted if it passes **all** QA checks:

| Check | What it proves |
|---|---|
| well-formed | four ordered lanes forming one continuous wire with two free ends |
| manufacturable-size | footprint & wire length within real paperclip tolerances |
| clamping-function | ≥2 overlapping channels with a gap that actually grips paper |
| no-fusion | adjacent wire edges keep clearance (wire never touches itself) |
| ends-tucked | both free ends sit safely in the top half (won't snag) |

Geometry is checked in **two independent code paths** — a closed-form analyzer
(`analyze`) and a sampled polyline (`buildGeometry`) — which must agree.

## Run it locally
```bash
npm test                              # full suite (geometry, QA, factory, ledger, build)
node scripts/manufacture.js --count=200000   # make a batch into inventory/ledger.json
npm run verify                        # independently re-verify the ledger
npm run build                         # build the site into dist/
```
No dependencies — just Node ≥ 20.

## How it keeps running
- **Deployment is branch-based Pages.** The site is built into committed `docs/`;
  GitHub Pages serves `main` `/docs` and its automatic pages-build-deployment
  publishes it on every push. "Deploy" is just a content commit.
- **Continuity is the agent chain.** Each `run-agent` run produces a batch,
  re-verifies, rebuilds `docs/`, commits, and **spawns its successor**
  (`scripts/spawn-agent.sh`, chain-safe). `scripts/run-cycle.sh` does the whole
  heartbeat in one shot.

> **One-time setup:** enable Pages once at *Settings → Pages → Deploy from a
> branch → `main` `/docs`*. (The CI token can't create workflow files or enable
> Pages via API, so this is the single manual step — see `STATE.md` › Pivots.)

## Scalability & honesty
The count can grow without bound because we never store individual clips — only
contiguous seed ranges plus deterministic checksums. Anyone can re-run the
factory over a recorded range to reproduce the exact same numbers, and
`npm run verify` does so on every deploy (bounded cost regardless of total).

See `STATE.md` for current status and `PROMPT.md` for the agent contract.
