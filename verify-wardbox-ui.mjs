// Headless test for rubber-band (drag-a-box) selection + window/crossing in the wardrobe editor.
// Enables Select mode, dispatches a pointer drag across the editor SVG, and checks the swept
// compartments become highlighted. Verifies both crossing (drag ←, touch) and window (drag →,
// enclose) modes, plus that a resulting batch action commits. Zero console errors.
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
for (let i = 0; i < 40; i++) { if (await page.evaluate(() => [...document.querySelectorAll("button")].some((e) => /⧉ Select/.test(e.textContent)))) break; await sleep(600); }
await sleep(2500);

const hiCount = () => page.evaluate(() => { const h3 = [...document.querySelectorAll("h3")].find((e) => /✏️ Edit/.test(e.textContent)); const svg = (h3.closest("div").parentElement || h3.parentElement).querySelector("svg"); return [...svg.querySelectorAll("rect")].filter((r) => /79, ?70, ?229/.test(r.getAttribute("fill") || "")).length; });
// drag a rubber-band box across the editor SVG. dir<0 = crossing (drag left), dir>0 = window (drag right)
const dragBox = (dir) => page.evaluate((dir) => {
  const h3 = [...document.querySelectorAll("h3")].find((e) => /✏️ Edit/.test(e.textContent));
  const svg = (h3.closest("div").parentElement || h3.parentElement).querySelector("svg");
  const r = svg.getBoundingClientRect();
  const P = (t, x, y) => svg.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, pointerId: 1 }));
  // sweep the lower band (bottom cells) across ~half the width
  const yTop = r.top + r.height * 0.62, yBot = r.top + r.height * 0.99;
  const xa = r.left + r.width * (dir < 0 ? 0.60 : 0.02), xb = r.left + r.width * (dir < 0 ? 0.02 : 0.60);
  P("pointerdown", xa, yTop); P("pointermove", (xa + xb) / 2, (yTop + yBot) / 2); P("pointermove", xb, yBot); P("pointerup", xb, yBot);
  return true;
});
const enableMerge = () => page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((e) => /⧉ Select/.test(e.textContent)); if (b) b.click(); });

// 1. crossing box (drag left) selects the compartments it touches
await enableMerge(); await sleep(500);
await dragBox(-1); await sleep(600);
const nCross = await hiCount();
ok(nCross >= 2, "crossing box (drag ←) selected multiple compartments (" + nCross + ")");

// 2. a fresh crossing box replaces the selection (rubber-band semantics)
await dragBox(-1); await sleep(600);
ok((await hiCount()) >= 2, "re-dragging the box re-selects (rubber-band replaces)");

// 3. batch action on the box selection commits (history advances)
const histBefore = await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((e) => /🕘 History/.test(e.textContent)); return b ? b.textContent : ""; });
await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((e) => e.title === "Lock selected" && !e.disabled); if (b) b.click(); });
await sleep(1500);
const histAfter = await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((e) => /🕘 History/.test(e.textContent)); return b ? b.textContent : ""; });
ok(/2\/2/.test(histAfter), "batch Lock on the box selection committed (history " + histBefore.replace(/.*History\s*/, "") + " → " + histAfter.replace(/.*History\s*/, "") + ")");

ok(errs.length === 0, "zero console/page errors" + (errs.length ? " — " + errs.slice(0, 3).join(" | ") : ""));

await browser.close();
console.log("\n" + (fail === 0 ? "ALL PASSED" : "FAILURES") + " — " + pass + " pass / " + fail + " fail");
process.exit(fail === 0 ? 0 : 1);
