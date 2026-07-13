// Smoke: Wardrobe 3D item art (garments/folds/shoes/pants) — built, visible by default, toggle hides/shows, 0 console errors.
import puppeteer from "puppeteer-core";
const CHROME = "C:/Users/hp/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe";
const B = "http://localhost:3000";
let pass = 0, fail = 0;
const ok = (n, c, e = "") => { console.log((c ? "PASS" : "FAIL") + " " + n + (e ? " — " + e : "")); c ? pass++ : fail++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clickByText = (page, re) => page.evaluate((o) => { const r = new RegExp(o.s, o.f); const b = [...document.querySelectorAll("button,summary,a,li")].find((x) => r.test(x.textContent || "")); if (b) { b.click(); return true; } return false; }, { s: re.source, f: re.flags });

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", protocol: "pipe", args: ["--no-sandbox", "--disable-dev-shm-usage", "--headless=new", "--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist"], timeout: 60000 });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1200 });
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(B + "/?dev=1", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("#root", { timeout: 10000 });
  let ready = false;
  for (let i = 0; i < 40; i++) { await sleep(300); if (await page.evaluate(() => /Wardrobe AI/.test(document.body.innerText))) { ready = true; break; } }
  ok("app interactive", ready);
  ok("clicked Wardrobe AI tab", await clickByText(page, /🚪 Wardrobe AI/));
  let gen = false;
  for (let i = 0; i < 40; i++) { await sleep(500); gen = await page.evaluate(() => /Max Hanging|Balanced|Max Folding/.test(document.body.innerText)); if (gen) break; }
  ok("wardrobe options generated", gen);
  ok("clicked 3D tab", await clickByText(page, /^3D$/));
  let canvas = false;
  for (let i = 0; i < 25; i++) { await sleep(400); canvas = await page.evaluate(() => !!document.querySelector("canvas")); if (canvas) break; }
  ok("3D canvas mounted", canvas);

  // wait for the debug hook + item meshes to exist
  let items = null;
  for (let i = 0; i < 25; i++) { await sleep(400); items = await page.evaluate(() => (window.__adsWard3DItems ? window.__adsWard3DItems() : null)); if (items && items.n > 0) break; }
  ok("item meshes built (n>0)", !!items && items.n > 0, items ? JSON.stringify(items) : "hook missing");
  ok("all items visible by default", !!items && items.vis === items.n, items ? JSON.stringify(items) : "");

  // toggle 🧥 Items OFF
  const toggledOff = await page.evaluate(() => { const l = [...document.querySelectorAll("label")].find((x) => /Items/.test(x.textContent || "") && x.querySelector("input[type=checkbox]")); const cb = l && l.querySelector("input[type=checkbox]"); if (cb && cb.checked) { cb.click(); return true; } return false; });
  ok("🧥 Items toggle found + turned off", toggledOff);
  let off = null;
  for (let i = 0; i < 20; i++) { await sleep(300); off = await page.evaluate(() => window.__adsWard3DItems()); if (off.vis === 0) break; }
  ok("items hidden after toggle off (vis=0)", !!off && off.vis === 0, off ? JSON.stringify(off) : "");
  ok("meshes NOT rebuilt on toggle (n unchanged)", !!off && !!items && off.n === items.n, off && items ? off.n + " vs " + items.n : "");

  // toggle back ON
  await page.evaluate(() => { const l = [...document.querySelectorAll("label")].find((x) => /Items/.test(x.textContent || "") && x.querySelector("input[type=checkbox]")); const cb = l && l.querySelector("input[type=checkbox]"); if (cb && !cb.checked) cb.click(); });
  let on = null;
  for (let i = 0; i < 20; i++) { await sleep(300); on = await page.evaluate(() => window.__adsWard3DItems()); if (on.vis === on.n) break; }
  ok("items shown again after toggle on (vis=n)", !!on && on.vis === on.n && on.n > 0, on ? JSON.stringify(on) : "");

  // selection still works with items non-pickable: WebGL alive + canvas real size
  const ctxAlive = await page.evaluate(() => { const c = document.querySelector("canvas"); if (!c) return false; const gl = c.getContext("webgl2") || c.getContext("webgl"); return !!gl && !gl.isContextLost(); });
  ok("WebGL context alive", ctxAlive);
  const canvasSize = await page.evaluate(() => { const c = document.querySelector("canvas"); return c ? c.width + "x" + c.height : "none"; });
  ok("canvas has real size", /\d+x\d+/.test(canvasSize) && canvasSize !== "0x0", canvasSize);
  ok("0 console errors", errors.length === 0, errors.slice(0, 3).join(" | "));
} finally { await browser.close(); }
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
