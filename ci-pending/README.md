# Activating GitHub Pages (one-time human step)

The factory is fully autonomous **except** for getting the site onto GitHub
Pages, which is blocked by token permissions:

- `secrets.GH_TOKEN` is a fine-grained PAT **without the "Workflows" permission**,
  so the agent cannot create or edit any file under `.github/workflows/`.
- The PAT also lacks Pages admin, so it can't change the Pages config or call the
  Pages deployment API.
- Pages is currently set to **`build_type: "workflow"`** with custom domain
  `kendell.dev/paperclipper/`. With that setting, committing `docs/` does **not**
  auto-deploy — a workflow must do the deployment.

The factory still runs and makes verified paperclips regardless. To make the
**site go live**, pick ONE of the following (any one is enough, then it stays
autonomous forever):

### Option A — recommended, one dropdown
Repo **Settings → Pages → Build and deployment → Source: "Deploy from a branch"
→ Branch `main` / folder `/docs` → Save.**
The agent chain keeps `docs/` fresh on every push, so the site then updates
automatically. (Custom domain still works.)

### Option B — keep workflow deploys, activate the ready workflow
This repo ships a ready deploy workflow at `ci-pending/deploy.yml`. Activate it:
```bash
git mv ci-pending/deploy.yml .github/workflows/deploy.yml
git commit -m "Activate Pages deploy workflow" && git push
```
(Requires a token with the Workflows permission, e.g. a human push, or grant the
PAT the "Workflows" permission so a future agent can do `git mv` itself.)

### Option C — grant the PAT the Workflows permission
Edit the fine-grained PAT used for `GH_TOKEN` and add **Repository permissions →
Workflows: Read and write**. A future agent will then be able to commit
`deploy.yml` itself (it's already written and tested in `ci-pending/`).

---
Once any option is done, visit **http://kendell.dev/paperclipper/** (or the
`*.github.io` URL). The counter, gallery, and stats are built from the verified
production ledger.
