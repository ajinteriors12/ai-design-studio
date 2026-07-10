// Headless test for ROOM WALL multi-select + downstream propagation (RoomPolygon2D).
// Picks an L-Shape kitchen, switches Room Setup to free-form + L preset, then:
//  - asserts the run-length inputs auto-fit to the drawn polygon (propagation),
//  - Shift-clicks two walls → batch bar, Lock all (🔒 appears), Split all (wall count grows),
//  - opens the longest wall → the propagated run length changes.
// Walls select on POINTERDOWN → we dispatch synthetic PointerEvents with shiftKey.
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
for (let i = 0; i < 40; i++) { if (await page.evaluate(() => document.querySelectorAll("select").length > 0)) break; await sleep(500); }
// choose L-Shape Kitchen
await page.evaluate(() => { const sel = [...document.querySelectorAll("select")].find((s) => [...s.options].some((o) => /L-Shape Kitchen/.test(o.textContent))); if (!sel) return; const opt = [...sel.options].find((o) => /L-Shape Kitchen/.test(o.textContent)); const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set; setter.call(sel, opt.value); sel.dispatchEvent(new Event("change", { bubbles: true })); });
await sleep(600);
// Room Setup → free-form
await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((e) => /⬡ Free-form/.test(e.textContent)); if (b) b.click(); });
await sleep(400);
// L-shape preset
await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((e) => e.textContent.trim() === "L-shape"); if (b) b.click(); });
for (let i = 0; i < 30; i++) { if (await page.evaluate(() => /Free-form plan/.test(document.body.innerText))) break; await sleep(400); }
await sleep(600);
ok(await page.evaluate(() => /Free-form plan/.test(document.body.innerText)), "free-form polygon room editor shown");
ok(await page.evaluate(() => /Shift\/Ctrl-click to multi-select walls/.test(document.body.innerText)), "editor advertises Shift/Ctrl-click wall multi-select");

// helpers: polygon wall hit-lines (transparent) + wall-length labels + run-length inputs
const polySvg = () => page.evaluate(() => { const t = [...document.querySelectorAll("div")].find((d) => /Free-form plan/.test(d.textContent) && d.querySelector("svg")); return t ? t.querySelectorAll('line[stroke="transparent"]').length : 0; });
const runLen = (nth) => page.evaluate((nth) => { const ins = [...document.querySelectorAll('input[type=number][max="8000"]')]; return ins[nth] ? Number(ins[nth].value) : -1; }, nth);
const wallLabels = () => page.evaluate(() => { const svg = [...document.querySelectorAll("svg")].find((s) => [...s.querySelectorAll("line")].some((l) => l.getAttribute("stroke") === "transparent")); if (!svg) return []; return [...svg.querySelectorAll("text")].map((t) => t.textContent).filter((t) => /^\d+/.test(t)).map((t) => parseInt(t, 10)); });
const shiftWall = (idx) => page.evaluate((idx) => { const svg = [...document.querySelectorAll("svg")].find((s) => [...s.querySelectorAll("line")].some((l) => l.getAttribute("stroke") === "transparent")); const hit = [...svg.querySelectorAll('line[stroke="transparent"]')][idx]; if (!hit) return false; hit.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, shiftKey: true, pointerId: 1, button: 0 })); return true; }, idx);
const highlighted = () => page.evaluate(() => { const svg = [...document.querySelectorAll("svg")].find((s) => [...s.querySelectorAll("line")].some((l) => l.getAttribute("stroke") === "transparent")); return svg ? [...svg.querySelectorAll("line")].filter((l) => l.getAttribute("stroke") === "#4338ca").length : 0; });

const nWalls0 = await polySvg();
ok(nWalls0 === 6, "L-shape polygon has 6 walls (" + nWalls0 + ")");

// 1. propagation: run length auto-fitted to the longest drawn wall
const labels = await wallLabels();
const maxEdge = Math.max.apply(null, labels);
const w0 = await runLen(0);
console.log("  wall labels=" + JSON.stringify(labels) + "  run-length input=" + w0);
ok(w0 === maxEdge, "run length auto-propagated to the longest wall (" + w0 + " = " + maxEdge + ")");

// 2. multi-select two walls → batch bar
await shiftWall(0); await sleep(250);
await shiftWall(2); await sleep(300);
const barN = await page.evaluate(() => { const m = document.body.innerText.match(/(\d+) walls selected/); return m ? +m[1] : 0; });
ok(barN === 2, "batch bar shows 2 walls selected (" + barN + ")");
ok((await highlighted()) === 2, "two walls show the multi-select highlight");

// 3. Lock all → 🔒 appears on labels
await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((e) => /🔒 Lock/.test(e.textContent)); if (b) b.click(); });
await sleep(500);
const locks = await page.evaluate(() => { const svg = [...document.querySelectorAll("svg")].find((s) => [...s.querySelectorAll("line")].some((l) => l.getAttribute("stroke") === "transparent")); return svg ? [...svg.querySelectorAll("text")].filter((t) => /🔒/.test(t.textContent)).length : 0; });
ok(locks >= 2, "batch Lock marked >=2 walls locked (" + locks + ")");

// 4. Split all → wall count grows (clear the prior selection, pick 2 fresh walls, split)
await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((e) => e.textContent.trim() === "Clear"); if (b) b.click(); });
await sleep(300);
await shiftWall(1); await sleep(200); await shiftWall(4); await sleep(250);
await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((e) => /✂ Split all/.test(e.textContent)); if (b) b.click(); });
await sleep(600);
const nWalls1 = await polySvg();
ok(nWalls1 === nWalls0 + 2, "Split all added two walls (" + nWalls0 + " → " + nWalls1 + ")");

// 5. propagation responds to a wall edit: open (doorway) the longest wall → run length drops
const beforeOpen = await runLen(0);
// select just the longest wall (plain click) then Delete/open it via single-wall toolbar
await page.evaluate(() => {
  const svg = [...document.querySelectorAll("svg")].find((s) => [...s.querySelectorAll("line")].some((l) => l.getAttribute("stroke") === "transparent"));
  const hits = [...svg.querySelectorAll('line[stroke="transparent"]')];
  // find index of the longest visible wall label
  const texts = [...svg.querySelectorAll("text")];
  let best = -1, bi = 0; hits.forEach((h, i) => {}); // labels align with walls in order
  const lens = texts.map((t) => parseInt(t.textContent, 10)).filter((v) => !isNaN(v));
  const maxV = Math.max.apply(null, lens);
  // click the wall whose label equals maxV (plain, single select)
  let targetIdx = 0; let acc = 0; const labelEls = texts.filter((t) => /^\d/.test(t.textContent));
  labelEls.forEach((t, i) => { if (parseInt(t.textContent, 10) === maxV) targetIdx = i; });
  hits[targetIdx] && hits[targetIdx].dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 1, button: 0 }));
});
await sleep(400);
await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((e) => /🗑 Delete/.test(e.textContent)); if (b) b.click(); });
await sleep(600);
const afterOpen = await runLen(0);
console.log("  run length before open=" + beforeOpen + " after open longest wall=" + afterOpen);
ok(afterOpen !== beforeOpen && afterOpen > 0, "opening a wall re-propagated the run length (" + beforeOpen + " → " + afterOpen + ")");

ok(errs.length === 0, "zero console/page errors" + (errs.length ? " — " + errs.slice(0, 3).join(" | ") : ""));

await browser.close();
console.log("\n" + (fail === 0 ? "ALL PASSED" : "FAILURES") + " — " + pass + " pass / " + fail + " fail");
process.exit(fail === 0 ? 0 : 1);
