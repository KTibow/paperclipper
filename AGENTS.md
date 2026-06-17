We are trying to port as many browsers to the web as possible.

Tips:
- You may use `gh` to read broader GitHub, spawn more `run-agent.yaml`, or anything
- You may use `git` within this repo
- You run on an ephemeral GitHub Actions runner so installing software or running tests is fine/encouraged
- You could synchronize by using Markdown files to plan out work
- You always have to commit and push your work at the end (no more than 6 hours runtime), and most likely, spawn another agent to pick up where you left off and carry the flame
- Always check your work; I trust that you can make good tests and harnesses to actually verify your work works and is usable instead of just compiles
- Never lie about not giving up; avoid pivots, but be transparent if you choose them

Goal:
- GitHub Actions build -> GitHub Pages deployment
- Root page (kendell.dev/browser-port-experiments/?) has links to each browser (or engine, if we really can't port over the chrome) we have
- Each browser works completely in your browser, and this has been rigorously tested to actually function
- Logic probably uses WASM
- Graphics probably use canvases and ideally acceleration
- Networking probably uses [Wisp](https://github.com/MercuryWorkshop/wisp-protocol) defaulted to `wss://anura.pro`

Good luck!
