#!/usr/bin/env node
// Build the static GitHub Pages site from the production ledger.
// Output: dist/index.html (self-contained), dist/data.json, dist/.nojekyll.

import { readFileSync, writeFileSync, mkdirSync, existsSync, cpSync } from "node:fs";
import { emptyLedger } from "../src/ledger.js";
import { STYLE_NAMES, getStyle, catalogStyles, LATEST_CATALOG } from "../src/styles.js";
import { specFor, manufactureOne } from "../src/factory.js";
import { renderSVG } from "../src/paperclip.js";

// Default output is the committed `docs/` folder, which GitHub Pages serves
// directly (Settings -> Pages -> Deploy from branch -> main /docs). Publishing
// is therefore just a normal content commit -- no workflow file required.
const OUT = process.env.OUT_DIR || "docs";
const ledgerPath = process.env.LEDGER || "inventory/ledger.json";

const ledger = existsSync(ledgerPath)
  ? JSON.parse(readFileSync(ledgerPath, "utf8"))
  : emptyLedger();

mkdirSync(OUT, { recursive: true });

// ---- derived stats -------------------------------------------------------
const numStyles = STYLE_NAMES.length;
const totalProduced = ledger.totals.produced;
const totalInspected = ledger.totals.inspected;
const totalScrap = ledger.totals.scrap;
const overallYield = totalInspected ? totalProduced / totalInspected : 0;

const styleStats = STYLE_NAMES.map((name) => {
  const made = ledger.byStyle[name] || 0;
  const inspectedApprox = totalInspected / numStyles;
  const yld = inspectedApprox ? Math.min(1, made / inspectedApprox) : 0;
  return { name, label: getStyle(name).label, made, yield: yld };
});

// ---- gallery of real, QA-passed units ------------------------------------
function gatherGallery(perStyle = 6) {
  const palette = ["#cfd8e3", "#b8c4d1", "#d8c6a8", "#aebfcf", "#c9d6e0"];
  const cards = [];
  catalogStyles(LATEST_CATALOG).forEach((style, si) => {
    let found = 0;
    // Scan within produced range (fall back to a small window for empty ledger).
    const horizon = Math.max(2000, Math.min(ledger.nextSeed || 2000, 200000));
    for (let k = 0; k < horizon && found < perStyle; k++) {
      // spread seeds out for visual variety
      const seed = (k * 37 + si) % horizon;
      const unit = manufactureOne(seed);
      if (!unit.ok || unit.style !== style) continue;
      const spec = specFor(style, seed);
      const { svg } = renderSVG(spec, {
        size: 96,
        stroke: palette[si % palette.length],
      });
      cards.push({ style, seed, label: getStyle(style).label, svg });
      found++;
    }
  });
  return cards;
}
const gallery = gatherGallery();

// ---- recent production history -------------------------------------------
const recent = ledger.batches.slice(-40);
const historyPoints = recent.map((b) => b.made);
const maxMade = Math.max(1, ...historyPoints);

// ---- helpers -------------------------------------------------------------
const fmt = (n) => Number(n).toLocaleString("en-US");
const pct = (x) => (x * 100).toFixed(2) + "%";

function sparkline(values, w = 320, h = 48) {
  if (values.length === 0) return "";
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? w / (values.length - 1) : w;
  const pts = values
    .map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * (h - 4) - 2).toFixed(1)}`)
    .join(" ");
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none">
    <polyline fill="none" stroke="#7dd3fc" stroke-width="2" points="${pts}"/>
  </svg>`;
}

// ---- write data.json -----------------------------------------------------
const data = {
  totalProduced,
  totalInspected,
  totalScrap,
  overallYield,
  byStyle: ledger.byStyle,
  nextSeed: ledger.nextSeed,
  chainChecksum: ledger.chainChecksum,
  updatedAt: ledger.updatedAt,
  batches: recent.map((b) => ({
    seedStart: b.seedStart,
    made: b.made,
    scrap: b.scrap,
    passRate: b.passRate,
    timestamp: b.timestamp,
    runUrl: b.runUrl,
  })),
};
writeFileSync(`${OUT}/data.json`, JSON.stringify(data) + "\n");
writeFileSync(`${OUT}/.nojekyll`, "");

// ---- HTML ----------------------------------------------------------------
const repo = process.env.GITHUB_REPOSITORY || "KTibow/paperclipper";
const repoUrl = `https://github.com/${repo}`;
const updated = ledger.updatedAt
  ? new Date(ledger.updatedAt).toUTCString()
  : "never";

const galleryHtml = gallery
  .map(
    (c) => `<figure class="clip" title="${c.label} #${c.seed}">
      ${c.svg}
      <figcaption>${c.style} <span>#${c.seed}</span></figcaption>
    </figure>`,
  )
  .join("\n");

const styleRows = styleStats
  .map(
    (s) => `<tr>
      <td>${s.label}</td>
      <td class="num">${fmt(s.made)}</td>
      <td class="num">${pct(s.yield)}</td>
      <td><div class="bar"><span style="width:${Math.max(2, (s.made / Math.max(1, totalProduced)) * 100).toFixed(1)}%"></span></div></td>
    </tr>`,
  )
  .join("\n");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Paperclipper — autonomous paperclip factory</title>
<meta name="description" content="An autonomous, self-perpetuating factory that manufactures rigorously QA-tested paperclips. ${fmt(totalProduced)} made and counting."/>
<meta property="og:title" content="Paperclipper"/>
<meta property="og:description" content="${fmt(totalProduced)} rigorously tested paperclips manufactured and counting."/>
<style>
  :root{
    --bg:#0b0f14; --panel:#121a23; --panel2:#0f161e; --ink:#e6edf3; --muted:#8b9aa9;
    --line:#1e2a36; --accent:#7dd3fc; --good:#34d399; --wire:#cfd8e3;
  }
  *{box-sizing:border-box}
  html,body{margin:0;background:var(--bg);color:var(--ink);
    font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
    -webkit-font-smoothing:antialiased}
  a{color:var(--accent);text-decoration:none}
  a:hover{text-decoration:underline}
  .wrap{max-width:980px;margin:0 auto;padding:28px 18px 64px}
  header{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
  .brand{display:flex;align-items:center;gap:12px;font-weight:700;font-size:18px}
  .brand svg{filter:drop-shadow(0 2px 6px rgba(0,0,0,.5))}
  .live{display:inline-flex;align-items:center;gap:8px;font-size:13px;color:var(--muted)}
  .dot{width:9px;height:9px;border-radius:50%;background:var(--good);box-shadow:0 0 0 0 rgba(52,211,153,.6);
    animation:pulse 1.8s infinite}
  @keyframes pulse{0%{box-shadow:0 0 0 0 rgba(52,211,153,.5)}70%{box-shadow:0 0 0 10px rgba(52,211,153,0)}100%{box-shadow:0 0 0 0 rgba(52,211,153,0)}}
  .hero{margin:34px 0 10px;text-align:center}
  .hero h1{font-size:15px;letter-spacing:.18em;text-transform:uppercase;color:var(--muted);font-weight:600;margin:0 0 10px}
  .counter{font-variant-numeric:tabular-nums;font-weight:800;line-height:1;
    font-size:clamp(48px,12vw,120px);background:linear-gradient(180deg,#fff,#9fb3c6);
    -webkit-background-clip:text;background-clip:text;color:transparent}
  .sub{color:var(--muted);margin-top:12px;font-size:15px}
  .badge{display:inline-block;border:1px solid var(--line);background:var(--panel);
    padding:4px 10px;border-radius:999px;font-size:12px;color:var(--muted);margin:0 4px}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin:26px 0}
  .stat{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px}
  .stat .k{color:var(--muted);font-size:12px;letter-spacing:.08em;text-transform:uppercase}
  .stat .v{font-size:26px;font-weight:700;margin-top:6px;font-variant-numeric:tabular-nums}
  section{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:20px;margin:18px 0}
  section h2{margin:0 0 14px;font-size:16px}
  .clips{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:14px}
  .clip{margin:0;background:var(--panel2);border:1px solid var(--line);border-radius:12px;
    padding:10px;display:flex;flex-direction:column;align-items:center;gap:6px}
  .clip svg{height:84px;width:auto}
  .clip figcaption{font-size:11px;color:var(--muted)}
  .clip figcaption span{opacity:.6}
  table{width:100%;border-collapse:collapse;font-size:14px}
  th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line)}
  th{color:var(--muted);font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.06em}
  td.num{text-align:right;font-variant-numeric:tabular-nums}
  .bar{background:var(--panel2);border-radius:6px;height:10px;overflow:hidden}
  .bar span{display:block;height:100%;background:linear-gradient(90deg,#38bdf8,#34d399)}
  .qa{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
  .qa .item{background:var(--panel2);border:1px solid var(--line);border-radius:12px;padding:14px}
  .qa .item b{display:block;margin-bottom:4px}
  .qa .item p{margin:0;color:var(--muted);font-size:13px;line-height:1.5}
  footer{color:var(--muted);font-size:13px;text-align:center;margin-top:30px;line-height:1.7}
  code{background:var(--panel2);padding:2px 6px;border-radius:6px;font-size:12px}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="brand">
      ${renderSVG(specFor("standard", 7), { size: 34, stroke: "var(--wire)" }).svg}
      Paperclipper
    </div>
    <div class="live"><span class="dot"></span> Factory online · updated ${updated}</div>
  </header>

  <div class="hero">
    <h1>Paperclips manufactured &amp; verified</h1>
    <div class="counter" id="counter" data-target="${totalProduced}">0</div>
    <div class="sub">
      <span class="badge">✔ each unit passed automated QA</span>
      <span class="badge">${pct(overallYield)} yield</span>
      <span class="badge">chain ${ledger.chainChecksum}</span>
    </div>
  </div>

  <div class="grid">
    <div class="stat"><div class="k">Total produced</div><div class="v">${fmt(totalProduced)}</div></div>
    <div class="stat"><div class="k">Units inspected</div><div class="v">${fmt(totalInspected)}</div></div>
    <div class="stat"><div class="k">Scrapped (failed QA)</div><div class="v">${fmt(totalScrap)}</div></div>
    <div class="stat"><div class="k">Styles in catalog</div><div class="v">${numStyles}</div></div>
  </div>

  <section>
    <h2>Live sample from the line</h2>
    <div class="clips">
      ${galleryHtml || "<p style='color:var(--muted)'>No units yet — start the factory.</p>"}
    </div>
  </section>

  <section>
    <h2>Catalog &amp; yield by style</h2>
    <table>
      <thead><tr><th>Style</th><th class="num">Made</th><th class="num">Yield</th><th>Share</th></tr></thead>
      <tbody>${styleRows}</tbody>
    </table>
  </section>

  <section>
    <h2>Recent production (per batch)</h2>
    ${sparkline(historyPoints) || "<p style='color:var(--muted)'>No batches yet.</p>"}
    <p style="color:var(--muted);font-size:13px;margin:10px 0 0">
      Last ${recent.length} batches · max ${fmt(maxMade)} made/batch · next seed
      <code>${fmt(ledger.nextSeed)}</code>
    </p>
  </section>

  <section>
    <h2>How a paperclip is tested</h2>
    <p style="color:var(--muted);font-size:13.5px;margin:0 0 14px">
      Every unit is a continuous wire centreline checked in two independent code paths
      (closed-form &amp; sampled). It only ships if it passes all of:
    </p>
    <div class="qa">
      <div class="item"><b>Well-formed wire</b><p>Four ordered, finite lanes forming a single continuous wire with two free ends.</p></div>
      <div class="item"><b>Manufacturable size</b><p>Footprint and wire length fall within real paperclip tolerances.</p></div>
      <div class="item"><b>Clamping function</b><p>At least two overlapping channels with a gap that actually captures &amp; grips paper.</p></div>
      <div class="item"><b>No fusion</b><p>Adjacent wire edges keep clearance, so the wire never touches or crosses itself.</p></div>
      <div class="item"><b>Ends tucked</b><p>Both free ends sit safely in the top half so the clip won't snag.</p></div>
      <div class="item"><b>Reproducible</b><p>Every batch carries a deterministic checksum; the whole ledger is independently re-verified.</p></div>
    </div>
  </section>

  <footer>
    Autonomous factory · pure-Node, dependency-free · built &amp; deployed by GitHub Actions.<br/>
    <a href="${repoUrl}">source</a> ·
    <a href="${repoUrl}/actions">actions</a> ·
    <a href="./data.json">data.json</a> ·
    chain checksum <code>${ledger.chainChecksum}</code>
  </footer>
</div>

<script>
  // Animated odometer up to the verified total.
  (function(){
    var el = document.getElementById('counter');
    var target = Number(el.getAttribute('data-target')) || 0;
    if (target <= 0){ el.textContent = '0'; return; }
    var dur = 1400, t0 = performance.now();
    function ease(x){ return 1 - Math.pow(1 - x, 3); }
    function tick(t){
      var p = Math.min(1, (t - t0) / dur);
      var v = Math.floor(ease(p) * target);
      el.textContent = v.toLocaleString('en-US');
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = target.toLocaleString('en-US');
    }
    requestAnimationFrame(tick);
  })();
</script>
</body>
</html>
`;

writeFileSync(`${OUT}/index.html`, html);

// Copy the verified ledger so it's downloadable/inspectable from the site.
if (existsSync(ledgerPath)) {
  cpSync(ledgerPath, `${OUT}/ledger.json`);
}

console.log(
  `[build] wrote ${OUT}/index.html — ${fmt(totalProduced)} clips, ` +
    `${gallery.length} gallery samples, ${recent.length} batches.`,
);
