// Headless test for the wardrobe editor's LASSO (freeform) selection.
// Enters Select mode, toggles the ◌ Lasso tool, then dispatches a freeform PointerEvent path
// (pointerdown → several pointermove → pointerup) tracing a blob over the central compartments,
// and asserts the enclosed compartments (centre-in-polygon) become selected (indigo highlight).
// Uses synthetic PointerEvents on the SVG — page.mouse does not fire React SVG pointer handlers.
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

const clickText = (reSrc) => page.evaluate((reSrc) => { const re = new RegExp(reSrc); const b = [...document.querySelectorAll("button")].find((e) => re.test(e.textContent.trim()) && !e.disabled); if (b) { b.click(); return true; } return false; }, reSrc);
const editorSvg = () => page.evaluate(() => { const h3 = [...document.querySelectorAll("h3")].find((e) => /✏️ Edit/.test(e.textContent)); const svg = h3 && (h3.closest("div").parentElement || h3.parentElement).querySelector("svg"); return !!svg; });
const hiCount = () => page.evaluate(() => { const h3 = [...document.querySelectorAll("h3")].find((e) => /✏️ Edit/.test(e.textContent)); const svg = h3 && (h3.closest("div").parentElement || h3.parentElement).querySelector("svg"); if (!svg) return -1; return [...svg.querySelectorAll("rect")].filter((r) => /79, ?70, ?229/.test(r.getAttribute("fill") || "")).length; });

// 0. editor mounted
ok(await editorSvg(), "wardrobe editor SVG mounted");

// 1. enter Select mode, then the Lasso tool appears and toggles on
await clickText("⧉ Select"); await sleep(500);
const lassoBtnBefore = await page.evaluate(() => [...document.querySelectorAll("button")].some((e) => /◌ Lasso/.test(e.textContent)));
ok(lassoBtnBefore, "◌ Lasso tool appears in Select mode");
await clickText("◌ Lasso"); await sleep(400);
const lassoOn = await page.evaluate(() => [...document.querySelectorAll("button")].some((e) => /✓ Lasso/.test(e.textContent)));
ok(lassoOn, "Lasso toggles on (✓ Lasso)");
const hint = await page.evaluate(() => /drag to draw a freeform shape/.test(document.body.innerText));
ok(hint, "lasso hint text shown");

// baseline: nothing selected yet
const base = await hiCount();
ok(base === 0, "no compartments highlighted before lassoing (" + base + ")");

// 2. dispatch a freeform lasso path over the central compartments
const draw = await page.evaluate(() => {
  const h3 = [...document.querySelectorAll("h3")].find((e) => /✏️ Edit/.test(e.textContent));
  const svg = h3 && (h3.closest("div").parentElement || h3.parentElement).querySelector("svg"); if (!svg) return "no-svg";
  const r = svg.getBoundingClientRect();
  const P = (fx, fy) => ({ x: r.left + fx * r.width, y: r.top + fy * r.height });
  // a freeform blob covering the central body (below the loft, above the plinth)
  const pts = [P(0.12, 0.38), P(0.5, 0.30), P(0.88, 0.37), P(0.9, 0.72), P(0.6, 0.9), P(0.22, 0.86), P(0.1, 0.6)];
  const fire = (type, p) => svg.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: p.x, clientY: p.y, pointerId: 1, button: 0, buttons: 1, isPrimary: true }));
  fire("pointerdown", pts[0]);
  for (let i = 1; i < pts.length; i++) fire("pointermove", pts[i]);
  fire("pointermove", pts[0]);   // close the loop
  fire("pointerup", pts[0]);
  return "ok";
});
ok(draw === "ok", "lasso path dispatched (" + draw + ")");
await sleep(600);

// 3. compartments inside the lasso are now selected
const sel = await hiCount();
console.log("  highlighted after lasso: " + sel);
ok(sel >= 2, "lasso selected >=2 compartments by centre-in-polygon (" + sel + ")");

// 4. the freeform lasso overlay polygon is gone after release (path cleared)
const overlay = await page.evaluate(() => { const h3 = [...document.querySelectorAll("h3")].find((e) => /✏️ Edit/.test(e.textContent)); const svg = h3 && (h3.closest("div").parentElement || h3.parentElement).querySelector("svg"); return svg ? svg.querySelectorAll("polygon").length : -1; });
ok(overlay === 0, "lasso overlay cleared after release (" + overlay + " polygons)");

// 5. selection is actionable — batch Convert/Delete/Merge become live (Merge needs >=2)
const canMerge = await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((e) => /⊞ Merge/.test(e.textContent)); return b ? !b.disabled : false; });
ok(canMerge, "Merge button enabled for the lasso selection");

ok(errs.length === 0, "zero console/page errors" + (errs.length ? " — " + errs.slice(0, 3).join(" | ") : ""));

await browser.close();
console.log("\n" + (fail === 0 ? "ALL PASSED" : "FAILURES") + " — " + pass + " pass / " + fail + " fail");
process.exit(fail === 0 ? 0 : 1);
