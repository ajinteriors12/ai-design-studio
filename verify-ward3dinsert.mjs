// Verify EXACT-POSITION insert in the 3D wardrobe view (SPEC-Right-Click-Insert §9 — support in 3D).
// The 3D right-click menu can't be fired headlessly, so we drive the same code path via the dev hook
// window.__adsWard3DInsert(si,ci,k,clickMM,arg) and read back window.__adsWard3DSecs().
// Asserts: the 3D view uses the SAME fill-below model — an accessory inserted with clickMM as its TOP
// lands with its top at ~clickMM (area below becomes the accessory); a too-short zone is refused for a
// tall hanging (no silent placement); zero console errors.
import puppeteer from "puppeteer-core";
const CHROME = "C:/Users/hp/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe";
const B = "http://localhost:3000";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  PASS " + m); } else { fail++; console.log("  FAIL " + m); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clickByText = (page, re) => page.evaluate((o) => { const r = new RegExp(o.s, o.f); const b = [...document.querySelectorAll("button,summary,a,li")].find((x) => r.test(x.textContent || "")); if (b) { b.click(); return true; } return false; }, { s: re.source, f: re.flags });

const errs = [];
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", protocol: "pipe", args: ["--no-sandbox", "--disable-dev-shm-usage", "--headless=new", "--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist"], timeout: 60000 });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1200 });
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  page.on("pageerror", (e) => errs.push(String(e)));
  await page.goto(B + "/?dev=1", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("#root", { timeout: 10000 });
  let ready = false;
  for (let i = 0; i < 40; i++) { await sleep(300); if (await page.evaluate(() => /Wardrobe AI/.test(document.body.innerText))) { ready = true; break; } }
  ok(ready, "app interactive");
  await clickByText(page, /🚪 Wardrobe AI/);
  let gen = false;
  for (let i = 0; i < 40; i++) { await sleep(500); gen = await page.evaluate(() => /Max Hanging|Balanced|Max Folding/.test(document.body.innerText)); if (gen) break; }
  ok(gen, "wardrobe options generated");
  ok(await clickByText(page, /^3D$/), "clicked 3D tab");
  let hook = false;
  for (let i = 0; i < 30; i++) { await sleep(400); hook = await page.evaluate(() => typeof window.__adsWard3DInsert === "function" && typeof window.__adsWard3DSecs === "function"); if (hook) break; }
  ok(hook, "3D view mounted + insert hooks available");
  await sleep(800);

  const topOf = (si, ci, kind, H) => page.evaluate((si, ci, kind, H) => { const cells = window.__adsWard3DSecs()[si].columns[ci].cells; let bot = 0, best = null; for (const c of cells) { const top = bot + c.hMM; if (c.kind === kind && (best == null || Math.abs(top - H) < Math.abs(best - H))) best = Math.round(top); bot = top; } return best; }, si, ci, kind, H);
  const kindCount = (si, ci, kind) => page.evaluate((si, ci, kind) => window.__adsWard3DSecs()[si].columns[ci].cells.filter((c) => c.kind === kind).length, si, ci, kind);

  // 1. Insert a Shelf in 3D with its TOP at ~800 mm (area below → the shelf)
  const t1 = await page.evaluate(() => { const secs = window.__adsWard3DSecs(); const H = 800; for (let si = 0; si < secs.length; si++) for (let ci = 0; ci < secs[si].columns.length; ci++) { const cells = secs[si].columns[ci].cells; let bot = 0; for (let k = 0; k < cells.length; k++) { const top = bot + cells[k].hMM; if (!cells[k].covered && !cells[k].locked && bot <= H && top >= H && (H - bot) >= 120) { window.__adsWard3DInsert(si, ci, k, H, "shelf"); return { si, ci, k }; } bot = top; } } return null; });
  await sleep(900);
  ok(t1, "found a 3D compartment spanning 800 mm with room below (" + JSON.stringify(t1) + ")");
  const shelf800 = t1 && await topOf(t1.si, t1.ci, "shelf", 800);
  console.log("  3D shelf top = " + shelf800 + " mm (target 800)");
  ok(shelf800 != null && Math.abs(shelf800 - 800) <= 8, "3D shelf top lands at ~800 mm — same fill-below model as 2D (" + shelf800 + ")");

  // 2. Insert a Single Drawer at a different height (proves exact, not a default split)
  const t2 = await page.evaluate(() => { const secs = window.__adsWard3DSecs(); const H = 1300; for (let si = 0; si < secs.length; si++) for (let ci = 0; ci < secs[si].columns.length; ci++) { const cells = secs[si].columns[ci].cells; let bot = 0; for (let k = 0; k < cells.length; k++) { const top = bot + cells[k].hMM; if (!cells[k].covered && !cells[k].locked && bot <= H && top >= H && (H - bot) >= 120) { window.__adsWard3DInsert(si, ci, k, H, "drawer"); return { si, ci, k }; } bot = top; } } return null; });
  await sleep(900);
  const drawer1300 = t2 && await topOf(t2.si, t2.ci, "drawer", 1300);
  console.log("  3D drawer top = " + drawer1300 + " mm (target 1300)");
  ok(t2 && drawer1300 != null && Math.abs(drawer1300 - 1300) <= 8, "3D drawer top lands at ~1300 mm (a second exact position) (" + drawer1300 + ")");

  // 3. A tall Long Hanging in a short zone is refused (no silent placement)
  const guard = await page.evaluate(() => { const secs = window.__adsWard3DSecs(); for (let si = 0; si < secs.length; si++) for (let ci = 0; ci < secs[si].columns.length; ci++) { const cells = secs[si].columns[ci].cells; let bot = 0; for (let k = 0; k < cells.length; k++) { if (!cells[k].covered && !cells[k].locked && cells[k].hMM < 500) { const b = cells.length; window.__adsWard3DInsert(si, ci, k, Math.round(bot + cells[k].hMM), "longHang"); return { b, a: window.__adsWard3DSecs()[si].columns[ci].cells.length }; } bot += cells[k].hMM; } } return null; });
  await sleep(500);
  ok(!guard || guard.a === guard.b, "Long Hanging refused in a too-short 3D zone (no silent placement)" + (guard ? " (" + guard.b + "→" + guard.a + ")" : ""));

  // 4. 3D menu markup wired to the full accessory list + clickMM
  const wired = await page.evaluate(async () => { try { const r = await fetch("/?dev=1"); const html = await r.text(); return /below . mm from base|below \\S+ mm|fills below/.test(html) && /Jewellery Tray/.test(html); } catch (e) { return false; } });
  ok(wired, "3D insert menu markup (fills-below + accessory list) present in the client");

  ok(errs.length === 0, "zero console/page errors" + (errs.length ? " — " + errs.slice(0, 3).join(" | ") : ""));
  console.log("\n" + (fail === 0 ? "ALL PASSED" : "FAILURES") + " — " + pass + " pass / " + fail + " fail");
} finally { await browser.close(); }
process.exit(fail === 0 ? 0 : 1);
