// Headless UI test for version-compare: generate a design, expand the "Structure & production jobs"
// panel, take two snapshots, tick both, click ⇆ Compare, and assert the side-by-side modal is
// VISIBLE with two plan drawings + a metric diff table. Zero console errors.
// (StructurePanel lives inside a <details>; we force it open so the fixed modal isn't display:none.)
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
const openDetails = () => page.evaluate(() => { [...document.querySelectorAll("details")].forEach((d) => { if (/Structure & production/.test(d.textContent)) d.open = true; }); });
const hasBtn = (reSrc) => page.evaluate((s) => [...document.querySelectorAll("button")].some((e) => new RegExp(s).test(e.textContent)), reSrc);

await page.goto(B + "/?dev=1", { waitUntil: "domcontentloaded" });
for (let i = 0; i < 40; i++) { if (await hasBtn("Generate Design")) break; await sleep(500); }
await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((e) => /Generate Design/i.test(e.textContent)); if (b) b.click(); });
// wait until the version-history snapshot button exists in the DOM (StructurePanel mounted)
for (let i = 0; i < 90; i++) { if (await hasBtn("📸 Snapshot")) break; await sleep(500); }
await openDetails(); await sleep(400);
ok(await hasBtn("📸 Snapshot"), "design generated → StructurePanel with 📸 Snapshot present");
ok(await page.evaluate(() => /Version history/.test(document.body.innerText)), "Structure panel expanded → Version history visible");

const clickSnap = () => page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((e) => /📸 Snapshot/.test(e.textContent) && !e.disabled); if (b) { b.click(); return true; } return false; });
await clickSnap(); await sleep(1200);
await clickSnap(); await sleep(1400);
await openDetails();
const nRows = await page.evaluate(() => document.querySelectorAll('input[type=checkbox][title="Pick for compare (max 2)"]').length);
ok(nRows >= 2, "two snapshots created → " + nRows + " compare checkboxes");

// tick the first two checkboxes
await page.evaluate(() => { const cbs = [...document.querySelectorAll('input[type=checkbox][title="Pick for compare (max 2)"]')]; cbs.slice(0, 2).forEach((cb) => cb.click()); });
await sleep(400);
const cmpBtn = await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((e) => /⇆ Compare/.test(e.textContent)); return b ? { text: b.textContent, disabled: b.disabled } : null; });
ok(cmpBtn && /2\/2/.test(cmpBtn.text) && !cmpBtn.disabled, "Compare button enabled at 2/2 (" + (cmpBtn ? cmpBtn.text : "?") + ")");

// open the compare modal
await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((e) => /⇆ Compare/.test(e.textContent) && !e.disabled); if (b) b.click(); });
for (let i = 0; i < 30; i++) { if (await page.evaluate(() => [...document.querySelectorAll("h3")].some((e) => /Version compare/.test(e.textContent))) ) break; await sleep(400); }

// inspect the modal: must be VISIBLE (offsetParent set / real size), show 2 SVGs + the diff table
const modal = await page.evaluate(() => {
  const h = [...document.querySelectorAll("h3")].find((e) => /Version compare/.test(e.textContent));
  if (!h) return null;
  const box = h.closest("div.bg-white") || h.closest("div");
  const overlay = h.closest("div.fixed") || box;
  const rect = overlay.getBoundingClientRect();
  const visible = overlay.offsetParent !== null || (rect.width > 100 && rect.height > 100);
  const root = box;
  return { visible, svgs: root.querySelectorAll("svg").length, hasTable: /Metric/.test(root.innerText) && /Δ \(B−A\)/.test(root.innerText), hasPanels: /Panels/.test(root.innerText) && /Cabinets/.test(root.innerText), hasRestoreB: [...root.querySelectorAll("button")].some((e) => /Restore B/.test(e.textContent)) };
});
ok(modal, "compare modal rendered");
ok(modal && modal.visible, "modal is actually visible (not hidden in the collapsed details)");
ok(modal && modal.svgs >= 2, "modal renders both version plan drawings (" + (modal ? modal.svgs : 0) + " svgs)");
ok(modal && modal.hasTable, "modal has the metric diff table with Δ (B−A) column");
ok(modal && modal.hasPanels, "diff table lists Cabinets + Panels rows");
ok(modal && modal.hasRestoreB, "modal offers ↩ Restore B");

// close it
await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((e) => e.textContent.trim() === "Close"); if (b) b.click(); });
await sleep(300);
ok(await page.evaluate(() => ![...document.querySelectorAll("h3")].some((e) => /Version compare/.test(e.textContent))), "modal closes");

ok(errs.length === 0, "zero console/page errors" + (errs.length ? " — " + errs.slice(0, 3).join(" | ") : ""));

await browser.close();
console.log("\n" + (fail === 0 ? "ALL PASSED" : "FAILURES") + " — " + pass + " pass / " + fail + " fail");
process.exit(fail === 0 ? 0 : 1);
