// Headless test for the wardrobe editor's professional editing upgrade:
// Undo/Redo history engine + toolbar + batch multi-select. Drives merge-mode selection (dispatch
// click, which fires reliably headless), performs a batch Lock (a real commit), then verifies the
// Undo/Redo history advances/reverts and the timeline panel works. Zero console errors throughout.
// (The right-click Split menu uses the same pre-existing openMenu, which real-user right-clicks
//  drive but headless cannot dispatch — so it is covered by compile + logic, not simulated here.)
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
for (let i = 0; i < 40; i++) { if (await page.evaluate(() => [...document.querySelectorAll("button")].some((e) => /🕘 History/.test(e.textContent)))) break; await sleep(600); }
await sleep(2500);

const histText = () => page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((e) => /🕘 History/.test(e.textContent)); return b ? b.textContent.replace(/.*History\s*/, "").trim() : "?"; });
const clickBtn = (reSrc) => page.evaluate((reSrc) => { const re = new RegExp(reSrc); const b = [...document.querySelectorAll("button")].find((e) => re.test(e.textContent.trim()) && !e.disabled); if (b) { b.click(); return true; } return false; }, reSrc);
const enableMerge = () => page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((e) => /⧉ Select/.test(e.textContent)); if (b) b.click(); });
const dispatchCol = (colIndex) => page.evaluate((colIndex) => {
  const h3 = [...document.querySelectorAll("h3")].find((e) => /✏️ Edit/.test(e.textContent));
  const svg = (h3.closest("div").parentElement || h3.parentElement).querySelector("svg"); if (!svg) return false;
  const rects = [...svg.querySelectorAll("rect")].filter((r) => /context-menu|pointer/.test(r.getAttribute("style") || ""));
  const xsRaw = [...new Set(rects.map((r) => Math.round(parseFloat(r.getAttribute("x")))))].sort((a, b) => a - b);
  const xs = []; for (const x of xsRaw) { if (!xs.length || x - xs[xs.length - 1] > 12) xs.push(x); }
  const tx = xs[colIndex]; if (tx == null) return false;
  const c = rects.filter((r) => Math.abs(Math.round(parseFloat(r.getAttribute("x"))) - tx) <= 12).sort((a, b) => (parseFloat(b.getAttribute("height")) || 0) - (parseFloat(a.getAttribute("height")) || 0))[0];
  if (!c) return false; c.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); return true;
}, colIndex);
const waitHi = (n) => page.waitForFunction((n) => { const h3 = [...document.querySelectorAll("h3")].find((e) => /✏️ Edit/.test(e.textContent)); const svg = (h3.closest("div").parentElement || h3.parentElement).querySelector("svg"); return svg && [...svg.querySelectorAll("rect")].filter((r) => /79, ?70, ?229/.test(r.getAttribute("fill") || "")).length >= n; }, { timeout: 2500 }, n).then(() => true).catch(() => false);

// 1. toolbar has the pro-editing controls
const toolbar = await page.evaluate(() => { const t = document.body.innerText; return /↶ Undo/.test(t) && /↷ Redo/.test(t) && /🕘 History/.test(t) && /⧉ Select/.test(t); });
ok(toolbar, "toolbar has Undo / Redo / History / Select");
ok(/^1\//.test(await histText()), "history starts at step 1 (" + (await histText()) + ")");

// 2. select two compartments (merge mode) and run a batch Lock — a real committed edit
await enableMerge(); await sleep(500);
await dispatchCol(2); const g1 = await waitHi(1);
await dispatchCol(3); const g2 = await waitHi(2);
ok(g1 && g2, "selected two compartments in merge mode");
const lockClicked = await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((e) => e.title === "Lock selected" && !e.disabled); if (b) { b.click(); return true; } return false; });
await sleep(1500);
const h1 = await histText();
ok(lockClicked && /^2\/2/.test(h1), "batch Lock committed → history advanced to 2/2 (" + h1 + ")");

// 3. Undo → step 1 of 2
await clickBtn("↶ Undo"); await sleep(1200);
const h2 = await histText();
ok(/^1\/2/.test(h2), "Undo moved back to 1/2 (" + h2 + ")");

// 4. Redo → step 2 of 2
await clickBtn("↷ Redo"); await sleep(1200);
const h3v = await histText();
ok(/^2\/2/.test(h3v), "Redo moved forward to 2/2 (" + h3v + ")");

// 5. history timeline panel lists the steps and is clickable
await clickBtn("🕘 History"); await sleep(400);
const timeline = await page.evaluate(() => /click any step to restore/.test(document.body.innerText) && /Lock/.test(document.body.innerText));
ok(timeline, "history timeline panel opens and lists the Lock step");

ok(errs.length === 0, "zero console/page errors" + (errs.length ? " — " + errs.slice(0, 3).join(" | ") : ""));

await browser.close();
console.log("\n" + (fail === 0 ? "ALL PASSED" : "FAILURES") + " — " + pass + " pass / " + fail + " fail");
process.exit(fail === 0 ? 0 : 1);
