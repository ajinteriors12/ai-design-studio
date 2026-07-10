// Verify EXACT-POSITION right-click Insert in the wardrobe editor (SPEC-Right-Click-Insert §2/§13).
// React onContextMenu on SVG cells can't be fired headlessly, so we drive the same code path via the
// dev hook window.__adsWardInsertAt(si,ci,k,clickMM,arg) and read back window.__adsWardSecs().
// Asserts: an accessory inserted at height H lands at ~H mm in the compartment that contains H; history
// records the exact height; Ctrl+Z removes it and Ctrl+Y restores it at the same height; a too-tall
// accessory in a small cell is refused (no silent relocate); the accessory list is wired.
import puppeteer from "puppeteer-core";
const CHROME = "C:\\Users\\hp\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe";
const B = "http://127.0.0.1:3000";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  PASS " + m); } else { fail++; console.log("  FAIL " + m); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const errs = [];
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage();
page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
page.on("pageerror", (e) => errs.push(String(e)));

await page.goto(B + "/?dev=1&tab=Wardrobe%20AI", { waitUntil: "domcontentloaded" });
for (let i = 0; i < 40; i++) { if (await page.evaluate(() => /Wardrobe AI/.test(document.body.innerText))) break; await sleep(500); }
await page.evaluate(() => { const b = [...document.querySelectorAll("button,a,div")].find((e) => /Wardrobe AI/.test(e.textContent) && e.textContent.length < 40); if (b) b.click(); });
await sleep(800);
await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((e) => /Generate/i.test(e.textContent)); if (b) b.click(); });
for (let i = 0; i < 40; i++) { if (await page.evaluate(() => typeof window.__adsWardInsertAt === "function")) break; await sleep(600); }
await sleep(2000);
ok(await page.evaluate(() => typeof window.__adsWardInsertAt === "function"), "editor mounted + insert hook available");

// insert `arg` at absolute height H into the compartment that CONTAINS H (fresh find each time so no stale index)
const insertAtHeight = (H, arg, minH) => page.evaluate((H, arg, minH) => {
  const secs = window.__adsWardSecs();
  for (let si = 0; si < secs.length; si++) for (let ci = 0; ci < secs[si].columns.length; ci++) { const cells = secs[si].columns[ci].cells; let bot = 0; for (let k = 0; k < cells.length; k++) { const top = bot + cells[k].hMM; if (!cells[k].covered && bot <= H && top >= H && cells[k].hMM >= minH) { window.__adsWardInsertAt(si, ci, k, H, arg); return { si, ci, k, bot: Math.round(bot) }; } bot = top; } }
  return null;
}, H, arg, minH);
// floor height of the accessory kind nearest H in column (si,ci)
const floorOf = (si, ci, kind, H) => page.evaluate((si, ci, kind, H) => { const cells = window.__adsWardSecs()[si].columns[ci].cells; let bot = 0, best = null; for (const c of cells) { if (c.kind === kind && (best == null || Math.abs(bot - H) < Math.abs(best - H))) best = Math.round(bot); bot += c.hMM; } return best; }, si, ci, kind, H);
const kindCount = (si, ci, kind) => page.evaluate((si, ci, kind) => window.__adsWardSecs()[si].columns[ci].cells.filter((c) => c.kind === kind).length, si, ci, kind);

// 1. Insert a Shelf at exactly 900 mm
const t1 = await insertAtHeight(900, "shelf", 320);
await sleep(900);
ok(t1, "found a compartment spanning 900 mm (" + JSON.stringify(t1) + ")");
const shelf900 = t1 && await floorOf(t1.si, t1.ci, "shelf", 900);
console.log("  shelf floor = " + shelf900 + " mm (target 900)");
ok(shelf900 != null && Math.abs(shelf900 - 900) <= 6, "shelf inserted at ~900 mm in the clicked compartment (" + shelf900 + ")");

// 2. History records the exact height + section (render tick before reading)
await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((e) => /🕘 History/.test(e.textContent)); if (b) b.click(); });
await sleep(500);
ok(await page.evaluate(() => /Insert Shelf at 900 mm/.test(document.body.innerText)), "history step reads 'Insert Shelf at 900 mm'");
await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((e) => /🕘 History/.test(e.textContent)); if (b) b.click(); });
await sleep(300);

// 3. Ctrl+Z removes the shelf, Ctrl+Y restores it at the same 900 mm
const before = await kindCount(t1.si, t1.ci, "shelf");
await page.evaluate(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true })));
await sleep(700);
const afterUndo = await kindCount(t1.si, t1.ci, "shelf");
ok(afterUndo === before - 1, "Ctrl+Z removed the inserted shelf (" + before + " → " + afterUndo + ")");
await page.evaluate(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "y", ctrlKey: true, bubbles: true })));
await sleep(700);
const shelfBack = await floorOf(t1.si, t1.ci, "shelf", 900);
ok(shelfBack != null && Math.abs(shelfBack - 900) <= 6, "Ctrl+Y restored the shelf at 900 mm (" + shelfBack + ")");

// 4. A Single Drawer at a DIFFERENT height lands where clicked (proves it's not a default position)
const t2 = await insertAtHeight(1500, "drawer", 240);
await sleep(800);
ok(t2, "found a compartment spanning 1500 mm (" + JSON.stringify(t2) + ")");
const drawer1500 = t2 && await floorOf(t2.si, t2.ci, "drawer", 1500);
console.log("  drawer floor = " + drawer1500 + " mm (target 1500)");
ok(drawer1500 != null && Math.abs(drawer1500 - 1500) <= 6, "drawer inserted at ~1500 mm (a second exact position) (" + drawer1500 + ")");

// 5. Insufficient space is refused (no silent relocation) — Long Hanging (1050) in a <500 mm cell
const guard = await page.evaluate(() => { const secs = window.__adsWardSecs(); for (let si = 0; si < secs.length; si++) for (let ci = 0; ci < secs[si].columns.length; ci++) { const cells = secs[si].columns[ci].cells; let bot = 0; for (let k = 0; k < cells.length; k++) { if (!cells[k].covered && cells[k].hMM < 500) { const b = cells.length; window.__adsWardInsertAt(si, ci, k, Math.round(bot + 20), "longHang"); return { b, a: window.__adsWardSecs()[si].columns[ci].cells.length }; } bot += cells[k].hMM; } } return null; });
ok(!guard || guard.a === guard.b, "Long Hanging refused in a too-small compartment (no silent relocate)" + (guard ? " (" + guard.b + "→" + guard.a + ")" : ""));

// 6. Accessory list wired — a jewellery tray inserts
const t3 = await insertAtHeight(600, "jewellery", 130);
await sleep(500);
ok(t3 && (await kindCount(t3.si, t3.ci, "jewellery")) > 0, "Jewellery Tray inserts (accessory list wired)");

ok(errs.length === 0, "zero console/page errors" + (errs.length ? " — " + errs.slice(0, 3).join(" | ") : ""));

await browser.close();
console.log("\n" + (fail === 0 ? "ALL PASSED" : "FAILURES") + " — " + pass + " pass / " + fail + " fail");
process.exit(fail === 0 ? 0 : 1);
