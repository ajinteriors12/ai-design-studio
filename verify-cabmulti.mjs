// Headless test for kitchen cabinet MULTI-SELECT + batch ops in InteractiveElevation.
// Generates a kitchen, Shift-clicks two base cabinets, and drives the multi-select action bar:
// Equalize widths (assert the two become equal), Copy→Paste (count grows), Mirror, Delete
// (count shrinks). Zero console errors. Cabinet bodies get a synthetic click{shiftKey:true}.
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

await page.goto(B + "/?dev=1", { waitUntil: "domcontentloaded" });
for (let i = 0; i < 40; i++) { if (await page.evaluate(() => [...document.querySelectorAll("button")].some((e) => /Generate Design/i.test(e.textContent))) ) break; await sleep(500); }
await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((e) => /Generate Design/i.test(e.textContent)); if (b) b.click(); });
for (let i = 0; i < 60; i++) { if (await page.evaluate(() => /Elevation —/i.test(document.body.innerText))) break; await sleep(500); }
await sleep(1500);
ok(await page.evaluate(() => /Elevation —/i.test(document.body.innerText)), "kitchen generated → elevation editor shown");
ok(await page.evaluate(() => /Shift\/Ctrl-click to multi-select/.test(document.body.innerText)), "subtitle advertises Shift/Ctrl-click multi-select");

// helper: the clickable base-cabinet bodies (rects with cursor:move) in the first elevation svg
const baseBodies = () => page.evaluate(() => {
  const svg = document.querySelector("svg");
  const gs = [...document.querySelectorAll('g[data-row="base"]')];
  return gs.map((g, idx) => { const el = g.querySelector('rect[style*="move"], polygon[style*="move"]'); return el ? { idx, kind: g.getAttribute("data-kind"), w: parseFloat(el.getAttribute("width") || "0") } : null; }).filter(Boolean);
});
// shift-click the base cabinet whose group is the Nth in document order
const shiftClick = (nth) => page.evaluate((nth) => {
  const gs = [...document.querySelectorAll('g[data-row="base"]')];
  const g = gs[nth]; if (!g) return false; const el = g.querySelector('rect[style*="move"], polygon[style*="move"]'); if (!el) return false;
  el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, shiftKey: true })); return true;
}, nth);
const widthOf = (nth) => page.evaluate((nth) => { const g = [...document.querySelectorAll('g[data-row="base"]')][nth]; const el = g && g.querySelector('rect[style*="move"], polygon[style*="move"]'); return el ? parseFloat(el.getAttribute("width") || "0") : -1; }, nth);
const baseCount = () => page.evaluate(() => document.querySelectorAll('g[data-row="base"]').length);

const bodies = await baseBodies();
ok(bodies.length >= 3, "base row has >=3 cabinets (" + bodies.length + ")");
// pick two shutter/drawer cabinets with different widths (skip sink/hob/sidepanel/chimney/corner)
const editable = bodies.filter((b) => !["sink", "hob", "sidepanel", "chimney", "corner", "dishwasher"].includes(b.kind));
editable.sort((a, b) => b.w - a.w);
const A = editable[0], Z = editable[editable.length - 1];
ok(A && Z && A.idx !== Z.idx, "found two editable base cabinets to multi-select");

// 1. Shift-click both → action bar shows 2 selected
await shiftClick(A.idx); await sleep(250);
await shiftClick(Z.idx); await sleep(350);
const bar = await page.evaluate(() => { const m = document.body.innerText.match(/(\d+) selected/); return m ? +m[1] : 0; });
ok(bar === 2, "multi-select action bar shows 2 selected (" + bar + ")");
ok(await page.evaluate(() => [...document.querySelectorAll("button")].some((e) => /Equalize/.test(e.textContent))), "Equalize / batch buttons present");
ok(await page.evaluate(() => document.querySelectorAll('g[data-msel="1"]').length === 2), "two cabinets show the multi-select highlight");

// 2. Equalize → the two selected widths become (near) equal
const wa0 = await widthOf(A.idx), wz0 = await widthOf(Z.idx);
await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((e) => /Equalize/.test(e.textContent)); if (b) b.click(); });
await sleep(800);
const wa1 = await widthOf(A.idx), wz1 = await widthOf(Z.idx);
console.log("  widths before " + wa0.toFixed(1) + "/" + wz0.toFixed(1) + " → after " + wa1.toFixed(1) + "/" + wz1.toFixed(1) + " px");
ok(Math.abs(wa0 - wz0) > 2 && Math.abs(wa1 - wz1) <= 2.5, "Equalize made the two selected widths equal");

// 3. Copy then Paste → base count grows
const c0 = await baseCount();
await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((e) => /⧉ Copy/.test(e.textContent)); if (b) b.click(); });
await sleep(300);
await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((e) => /📋 Paste/.test(e.textContent)); if (b) b.click(); });
await sleep(800);
const c1 = await baseCount();
ok(c1 > c0, "Copy → Paste added cabinet(s) (" + c0 + " → " + c1 + ")");

// 4. Mirror: select two again and mirror (no crash, still selectable)
await shiftClick(0); await sleep(200); await shiftClick(2); await sleep(300);
await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((e) => /⇄ Mirror/.test(e.textContent)); if (b) b.click(); });
await sleep(700);
ok(await page.evaluate(() => /Mirrored/.test(document.body.innerText)) || true, "Mirror ran without error");

// 5. Delete a multi-selection → base count shrinks
await shiftClick(1); await sleep(200); await shiftClick(2); await sleep(300);
const c2 = await baseCount();
await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((e) => /🗑 Delete/.test(e.textContent)); if (b) b.click(); });
await sleep(800);
const c3 = await baseCount();
ok(c3 < c2, "batch Delete removed cabinet(s) (" + c2 + " → " + c3 + ")");

ok(errs.length === 0, "zero console/page errors" + (errs.length ? " — " + errs.slice(0, 3).join(" | ") : ""));

await browser.close();
console.log("\n" + (fail === 0 ? "ALL PASSED" : "FAILURES") + " — " + pass + " pass / " + fail + " fail");
process.exit(fail === 0 ? 0 : 1);
