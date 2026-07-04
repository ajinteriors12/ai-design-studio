// UI + API test: 📂 My Designs gallery — list / reopen / delete saved designs.
import puppeteer from "puppeteer-core";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const B = "http://localhost:3000";
let pass = 0, fail = 0;
const ok = (n, c, e = "") => { console.log((c ? "✅" : "❌") + " " + n + (e ? " — " + e : "")); c ? pass++ : fail++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clickByText = (page, re) => page.evaluate((o) => { const r = new RegExp(o.s, o.f); const b = [...document.querySelectorAll("button,summary,a,li")].find((x) => r.test(x.textContent || "")); if (b) { b.click(); return true; } return false; }, { s: re.source, f: re.flags });
const post = (path, body) => fetch(B + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) }).then((r) => r.json());

// ---- API ----
const fresh = (await post("/api/generate", { designType: "U-Shape Kitchen", wall: 3600, wallB: 2400, wallC: 2400 })).data;
ok("generated a design to list", !!(fresh && fresh.id));
const list = (await fetch(B + "/api/designs").then((r) => r.json())).data;
ok("GET /api/designs returns a list with summaries", Array.isArray(list) && list.length > 0 && typeof list[0].cabinets === "number");
ok("the fresh design is present and newest-first", list.some((g) => g.id === fresh.id) && list[0].id === fresh.id);
const re = (await fetch(B + "/api/designs/" + fresh.id).then((r) => r.json())).data;
ok("GET /api/designs/:id reopens with the full editor shape", re && re.id === fresh.id && !!re.planSvg && Array.isArray(re.elevations) && Array.isArray(re.boq));
const del = (await fetch(B + "/api/designs/" + fresh.id, { method: "DELETE" }).then((r) => r.json())).data;
ok("DELETE /api/designs/:id succeeds", !!(del && del.ok));
const after = await fetch(B + "/api/designs/" + fresh.id);
ok("reopening a deleted design 404s", after.status === 404);

// ---- UI ----
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1100 });
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  // a known design to find + delete in the UI
  const victim = (await post("/api/generate", { designType: "Straight Kitchen", wall: 3000 })).data;
  const slug = String(victim.id).slice(0, 8);

  await page.goto(B + "/?dev=1", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("#root", { timeout: 10000 });
  // the app compiles JSX in-browser via Babel — wait until the UI is actually interactive
  // (can't use networkidle here: the app holds a persistent SSE connection, so it never goes idle)
  let ready = false;
  for (let i = 0; i < 40; i++) { await sleep(300); if (await page.evaluate(() => /📂 My Designs/.test(document.body.innerText))) { ready = true; break; } }
  ok("app became interactive (Babel-compiled)", ready);
  await sleep(400);
  await clickByText(page, /📂 My Designs/);
  let listed = false;
  for (let i = 0; i < 20; i++) { await sleep(400); listed = await page.evaluate(() => /Saved designs \(\d+\)/.test(document.body.innerText)); if (listed) break; }
  ok("My Designs gallery opens with a list", listed);

  // reopen the first row → editor shows a result (StructurePanel appears)
  await page.evaluate(() => { const li = document.querySelector("li[title='Click to reopen']"); if (li) li.click(); });
  let reopened = false;
  for (let i = 0; i < 16; i++) { await sleep(400); reopened = await page.evaluate(() => /Structure & production jobs/.test(document.body.innerText)); if (reopened) break; }
  ok("clicking a gallery row reopens the design into the editor", reopened);

  // delete the victim via its 🗑 button, then confirm it 404s server-side
  await clickByText(page, /📂 My Designs/);   // gallery closed on reopen → open it once
  let backOpen = false;
  for (let i = 0; i < 14; i++) { await sleep(400); backOpen = await page.evaluate(() => /Saved designs \(\d+\)/.test(document.body.innerText)); if (backOpen) break; }
  ok("gallery re-opens after a reopen", backOpen);
  const clicked = await page.evaluate((s) => {
    const li = [...document.querySelectorAll("li[title='Click to reopen']")].find((x) => (x.textContent || "").includes(s));
    if (!li) return false; const btn = li.querySelector("button"); if (!btn) return false; btn.click(); return true;
  }, slug);
  ok("found + clicked the victim's 🗑 delete button", clicked);
  let gone = false;
  for (let i = 0; i < 16; i++) { await sleep(400); const r = await fetch(B + "/api/designs/" + victim.id); if (r.status === 404) { gone = true; break; } }
  ok("deleting from the gallery removes it server-side (404)", gone);

  ok("no console errors throughout", errors.length === 0, errors.slice(0, 2).join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
} catch (e) {
  console.error("crashed:", e.message);
  await browser.close();
  process.exit(1);
}
