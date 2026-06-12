// UI + API test: full multi-view propagation engine (single source-of-truth
// RoomModel · idempotent corner reconciliation) in StructurePanel.
import puppeteer from "puppeteer-core";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const B = "http://localhost:3000";
let pass = 0, fail = 0;
const ok = (n, c, e = "") => { console.log((c ? "✅" : "❌") + " " + n + (e ? " — " + e : "")); c ? pass++ : fail++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clickByText = (page, re) => page.evaluate((o) => { const r = new RegExp(o.s, o.f); const b = [...document.querySelectorAll("button,summary")].find((x) => r.test(x.textContent || "")); if (b) { b.click(); return true; } return false; }, { s: re.source, f: re.flags });
const post = (path, body) => fetch(B + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) }).then((r) => r.json());

// ---- API-level invariants (deterministic, no external key) ------------------
const gen = await post("/api/generate", { designType: "L-Shape Kitchen", wall: 3600, wallB: 2400 });
const id = gen.data && gen.data.id;
ok("generated L-Shape design", !!id, id || "no id");

const p0 = await post("/api/designs/" + id + "/propagate", {});
const r0 = p0.data && p0.data.report;
ok("baseline propagate returns a report", !!r0);
ok("L-Shape has ≥1 shared corner in the model", r0 && r0.corners.length >= 1, r0 && (r0.corners.length + " corners"));
ok("baseline pass is idempotent", !!(r0 && r0.idempotent));

// locate a corner unit and drift it off the canonical depth
let ri = -1, ci = -1;
const runs0 = p0.data.runs || [];
for (let i = 0; i < runs0.length && ri < 0; i++) for (let j = 0; j < (runs0[i].base || []).length; j++) if (runs0[i].base[j].kind === "corner") { ri = i; ci = j; break; }
ok("found a corner unit in the runs model", ri >= 0, `run=${ri} idx=${ci}`);

if (ri >= 0) {
  const pd = await post("/api/designs/" + id + "/propagate", { edit: { wall: ri, index: ci, w: 720 } });
  const snapped = pd.data.report.snapped || [];
  ok("drifting a corner to 720 mm is reported as snapped", snapped.length >= 1 && /720/.test(snapped.join(" ")), snapped.join("; "));
  ok("corner snapped back to canonical 600 mm (single source of truth)", Math.round(pd.data.runs[ri].base[ci].w) === 600, "w=" + pd.data.runs[ri].base[ci].w);
  ok("edit pass stays idempotent", !!pd.data.report.idempotent);
}

// a wall-length edit must propagate to that wall's view
const pl = await post("/api/designs/" + id + "/propagate", { edit: { wall: 0, length: 4200 } });
ok("wall-length edit reports the changed view", (pl.data.report.changedViews || []).length >= 1 && Math.round(pl.data.runs[0].length) === 4200, (pl.data.report.changedViews || []).join(", "));

// two consecutive clean passes are byte-identical (idempotent at API level)
const a = JSON.stringify((await post("/api/designs/" + id + "/propagate", {})).data.runs);
const bb = JSON.stringify((await post("/api/designs/" + id + "/propagate", {})).data.runs);
ok("two clean passes produce identical runs", a === bb);
ok("production docs re-derived (mfgChecks present)", Array.isArray(p0.data.mfgChecks) && p0.data.mfgChecks.length > 0);

// ---- UI smoke test ----------------------------------------------------------
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1100 });
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(B + "/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("#root", { timeout: 10000 });
  await sleep(600);
  await clickByText(page, /generate design/i);
  await sleep(2500);
  await clickByText(page, /Structure & production jobs/);
  await sleep(800);
  ok("Multi-view propagation control present", await page.evaluate(() => /Multi-view propagation/.test(document.body.innerText)));
  await clickByText(page, /🔗 Propagate/);
  let reported = false;
  for (let i = 0; i < 16; i++) { await sleep(400); reported = await page.evaluate(() => /corners reconciled · \d+ views updated · idempotent ✓/.test(document.body.innerText)); if (reported) break; }
  ok("propagate report shows reconciled corners + idempotent ✓", reported);
  ok("no console errors throughout", errors.length === 0, errors.slice(0, 2).join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
} catch (e) {
  console.error("crashed:", e.message);
  await browser.close();
  process.exit(1);
}
