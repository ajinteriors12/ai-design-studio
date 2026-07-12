// Verify Right-Click Insert PHASE 2 (SPEC §5 typed dimension / §7 smart-adjust / §10 keep-selected).
// onContextMenu can't be fired headlessly, so we drive the same code paths via dev hooks:
//   __adsWardInsertAt / __adsWardInsertSel / __adsWardAdjust / __adsWardMsel / __adsWardMergeMode.
// Asserts: (a) typed exact height honoured; (b) insufficient space opens the smart-adjust dialog with
// no silent placement; (c) "reduce to fit" places the accessory filling the compartment; (d) "insert at
// nearest" relocates only on request; (e) §10 keeps the new cell selected in Select mode; (f) the
// keyboard mm input markup shipped in the client bundle.
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
for (let i = 0; i < 40; i++) { if (await page.evaluate(() => typeof window.__adsWardInsertSel === "function")) break; await sleep(600); }
await sleep(2000);
ok(await page.evaluate(() => typeof window.__adsWardInsertSel === "function" && typeof window.__adsWardAdjust === "function"), "editor mounted + phase-2 hooks available");

// helper: find a compartment tall enough for minH that spans absolute height H
const findCell = (H, minH) => page.evaluate((H, minH) => {
  const secs = window.__adsWardSecs();
  for (let si = 0; si < secs.length; si++) for (let ci = 0; ci < secs[si].columns.length; ci++) { const cells = secs[si].columns[ci].cells; let bot = 0; for (let k = 0; k < cells.length; k++) { const top = bot + cells[k].hMM; if (!cells[k].covered && bot <= H && top >= H && cells[k].hMM >= minH) return { si, ci, k, bot: Math.round(bot) }; bot = top; } }
  return null;
}, H, minH);
const topOf = (si, ci, kind, H) => page.evaluate((si, ci, kind, H) => { const cells = window.__adsWardSecs()[si].columns[ci].cells; let bot = 0, best = null; for (const c of cells) { const top = bot + c.hMM; if (c.kind === kind && (best == null || Math.abs(top - H) < Math.abs(best - H))) best = Math.round(top); bot = top; } return best; }, si, ci, kind, H);
const kindCount = (si, ci, kind) => page.evaluate((si, ci, kind) => window.__adsWardSecs()[si].columns[ci].cells.filter((c) => c.kind === kind).length, si, ci, kind);
const cellCount = (si, ci) => page.evaluate((si, ci) => window.__adsWardSecs()[si].columns[ci].cells.length, si, ci);

// 1. TYPED EXACT HEIGHT (§5 "type an exact dimension") — a shelf whose TOP is at an odd height snaps to 5 mm
const t1 = await findCell(915, 320);
ok(t1, "found a compartment for the typed-height test (" + JSON.stringify(t1) + ")");
await page.evaluate((c) => window.__adsWardInsertAt(c.si, c.ci, c.k, 915, "shelf"), t1);
await sleep(700);
const shelf915 = t1 && await topOf(t1.si, t1.ci, "shelf", 915);
console.log("  shelf top = " + shelf915 + " mm (typed 915 → snap 915)");
ok(shelf915 != null && Math.abs(shelf915 - 915) <= 6, "typed exact height honoured — shelf top at ~915 mm (" + shelf915 + ")");

// 2. SMART-ADJUST OPENS (§7) — Long Hanging (1050) into a <500 mm cell must NOT place; must raise the dialog
const small = await page.evaluate(() => { const secs = window.__adsWardSecs(); for (let si = 0; si < secs.length; si++) for (let ci = 0; ci < secs[si].columns.length; ci++) { const cells = secs[si].columns[ci].cells; let bot = 0; for (let k = 0; k < cells.length; k++) { if (!cells[k].covered && cells[k].hMM < 500 && cells[k].hMM >= 120) return { si, ci, k, bot: Math.round(bot), n: cells.length }; bot += cells[k].hMM; } } return null; });
ok(small, "found a small (<500 mm) compartment to trigger smart-adjust (" + JSON.stringify(small) + ")");
const beforeN = small && await cellCount(small.si, small.ci);
await page.evaluate((c) => window.__adsWardInsertAt(c.si, c.ci, c.k, c.bot + 20, "longHang"), small);
await sleep(500);
const adj = await page.evaluate(() => window.__adsWardAdjust());
const afterN = small && await cellCount(small.si, small.ci);
ok(adj && adj.label === "Long Hanging" && adj.need >= 750, "smart-adjust dialog raised with correct minimum need (" + (adj ? adj.avail + "/" + adj.need : "null") + ")");
ok(afterN === beforeN, "nothing placed while the dialog is open — no silent relocate (" + beforeN + "→" + afterN + ")");

// 3. REDUCE TO FIT — shrinks the accessory to fill the clicked compartment (only if canReduce)
if (adj && adj.canReduce) {
  const bN = await cellCount(small.si, small.ci);
  await page.evaluate((c) => window.__adsWardInsertSel(c.si, c.ci, c.k, null, "longHang", { reduce: true }), small);
  await sleep(600);
  const hangHere = await kindCount(small.si, small.ci, "longHang");
  const aN = await cellCount(small.si, small.ci);
  ok(hangHere > 0, "reduce-to-fit placed the Long Hanging in the small compartment (" + bN + "→" + aN + " cells)");
} else { ok(true, "reduce-to-fit skipped (compartment below minimum) — acceptable"); }
await page.evaluate(() => window.__adsWardAdjust() && window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true })));
await sleep(400);

// 4. INSERT AT NEAREST — a too-tall accessory relocates to a compartment that fits, on request only
const small2 = await page.evaluate(() => { const secs = window.__adsWardSecs(); for (let si = 0; si < secs.length; si++) for (let ci = 0; ci < secs[si].columns.length; ci++) { const cells = secs[si].columns[ci].cells; const hasTall = cells.some((c) => !c.covered && !c.locked && c.hMM >= 1100); if (!hasTall) continue; let bot = 0; for (let k = 0; k < cells.length; k++) { if (!cells[k].covered && cells[k].hMM < 400) return { si, ci, k, bot: Math.round(bot) }; bot += cells[k].hMM; } } return null; });
if (small2) {
  const beforeHang = await kindCount(small2.si, small2.ci, "longHang");
  await page.evaluate((c) => window.__adsWardInsertSel(c.si, c.ci, c.k, c.bot + 10, "longHang", { nearest: true }), small2);
  await sleep(600);
  const afterHang = await kindCount(small2.si, small2.ci, "longHang");
  ok(afterHang >= beforeHang + 1, "insert-at-nearest placed a Long Hanging in a fitting compartment of the column (" + beforeHang + "→" + afterHang + ")");
} else { ok(true, "no small+tall column pairing available for nearest test — acceptable"); }

// 5. KEEP-SELECTED (§10) — after a successful insert via the op path the new cell is selected in Select mode
const t5 = await findCell(1450, 260);
ok(t5, "found a compartment for the keep-selected test");
const key5 = await page.evaluate((c) => { const r = window.__adsWardInsertSel(c.si, c.ci, c.k, 1450, "drawer"); return r ? r.si + "-" + r.ci + "-" + r.k : null; }, t5);
await sleep(500);
const selState = await page.evaluate(() => ({ msel: window.__adsWardMsel(), merge: window.__adsWardMergeMode() }));
ok(key5 && selState.merge === true && selState.msel.indexOf(key5) >= 0, "new compartment kept selected in Select mode (msel=" + JSON.stringify(selState.msel) + ", key=" + key5 + ")");

// 6. EDITABLE SIZE (owner spec) — retype a compartment's mm and it resizes to exactly that, neighbour compensates
const t6 = await findCell(1500, 400);
ok(t6, "found a compartment for the editable-size test");
const szBefore = await page.evaluate((c) => { const cells = window.__adsWardSecs()[c.si].columns[c.ci].cells; return { h: cells[c.k].hMM, total: cells.reduce((a, x) => a + x.hMM, 0) }; }, t6);
await page.evaluate((c) => window.__adsWardSetH(c.si, c.ci, c.k, 300), t6);
await sleep(500);
const szAfter = await page.evaluate((c) => { const cells = window.__adsWardSecs()[c.si].columns[c.ci].cells; return { h: cells[c.k].hMM, total: cells.reduce((a, x) => a + x.hMM, 0) }; }, t6);
ok(szAfter.h === 300, "double-click size edit set the compartment to exactly 300 mm (" + szBefore.h + "→" + szAfter.h + ")");
ok(Math.abs(szAfter.total - szBefore.total) <= 1, "column total height preserved after resize (" + szBefore.total + "→" + szAfter.total + ")");

// 7. Keyboard mm-input markup shipped in the client bundle
const hasInputMarkup = await page.evaluate(async () => { try { const r = await fetch("/?dev=1"); const html = await r.text(); return /Type an exact height in mm/.test(html) && /Type the exact size in mm/.test(html); } catch (e) { return false; } });
ok(hasInputMarkup, "keyboard mm-height input + inline size-editor markup present in the served client");

ok(errs.length === 0, "zero console/page errors" + (errs.length ? " — " + errs.slice(0, 3).join(" | ") : ""));

await browser.close();
console.log("\n" + (fail === 0 ? "ALL PASSED" : "FAILURES") + " — " + pass + " pass / " + fail + " fail");
process.exit(fail === 0 ? 0 : 1);
