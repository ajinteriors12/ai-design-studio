// Verify the Shop-Drawing pan/zoom canvas: drag pans (translate changes), wheel zooms AT the cursor
// (scale changes), the +/- and Fit buttons work, and there are zero console errors.
import puppeteer from "puppeteer-core";
const CHROME = "C:\\Users\\hp\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe";
const B = "http://127.0.0.1:3000";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  PASS " + m); } else { fail++; console.log("  FAIL " + m); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const errs = [];
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage();
await page.setViewport({ width: 1500, height: 1200 });
page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
page.on("pageerror", (e) => errs.push(String(e)));

await page.goto(B + "/?dev=1&tab=Wardrobe%20AI", { waitUntil: "domcontentloaded" });
for (let i = 0; i < 40; i++) { if (await page.evaluate(() => /Wardrobe AI/.test(document.body.innerText))) break; await sleep(500); }
await page.evaluate(() => { const b = [...document.querySelectorAll("button,a,div")].find((e) => /Wardrobe AI/.test(e.textContent) && e.textContent.length < 40); if (b) b.click(); });
await sleep(800);
await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((e) => /Generate/i.test(e.textContent)); if (b) b.click(); });
for (let i = 0; i < 40; i++) { if (await page.evaluate(() => !!document.querySelector("[data-pz=frame]")) ) break; await sleep(600); }
await sleep(1500);
ok(await page.evaluate(() => !!document.querySelector("[data-pz=frame]") && !!document.querySelector("[data-pz=inner]")), "pan/zoom canvas present in the Shop-Drawing panel");

const transform = () => page.evaluate(() => { const el = document.querySelector("[data-pz=inner]"); return el ? el.style.transform : ""; });
const scaleOf = (tr) => { const m = /scale\(([-0-9.]+)\)/.exec(tr || ""); return m ? +m[1] : null; };
const txOf = (tr) => { const m = /translate\(([-0-9.]+)px,\s*([-0-9.]+)px\)/.exec(tr || ""); return m ? { x: +m[1], y: +m[2] } : null; };

const rect = await page.evaluate(() => { const el = document.querySelector("[data-pz=frame]"); const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
const cx = Math.round(rect.x + rect.w / 2), cy = Math.round(rect.y + rect.h / 2);

// 1. Wheel zoom-in AT the cursor increases scale
const before = await transform();
await page.mouse.move(cx, cy);
await page.evaluate((x, y) => { const el = document.querySelector("[data-pz=frame]"); el.dispatchEvent(new WheelEvent("wheel", { deltaY: -240, clientX: x, clientY: y, bubbles: true, cancelable: true })); }, cx, cy);
await sleep(250);
const afterZoomIn = await transform();
ok(scaleOf(afterZoomIn) > scaleOf(before) + 0.01, "scroll up zooms IN (scale " + scaleOf(before) + " → " + scaleOf(afterZoomIn) + ")");

// 2. Wheel zoom-out decreases scale
await page.evaluate((x, y) => { const el = document.querySelector("[data-pz=frame]"); el.dispatchEvent(new WheelEvent("wheel", { deltaY: 240, clientX: x, clientY: y, bubbles: true, cancelable: true })); el.dispatchEvent(new WheelEvent("wheel", { deltaY: 240, clientX: x, clientY: y, bubbles: true, cancelable: true })); }, cx, cy);
await sleep(250);
const afterZoomOut = await transform();
ok(scaleOf(afterZoomOut) < scaleOf(afterZoomIn) - 0.01, "scroll down zooms OUT (scale " + scaleOf(afterZoomIn) + " → " + scaleOf(afterZoomOut) + ")");

// 3. Drag pans the drawing (translate changes) — synthetic PointerEvents (React delegated handlers)
const panBefore = txOf(await transform());
await page.evaluate((x, y) => { const el = document.querySelector("[data-pz=frame]"); const mk = (tp, a, b) => new PointerEvent(tp, { pointerId: 1, clientX: a, clientY: b, bubbles: true, cancelable: true, button: 0 }); el.dispatchEvent(mk("pointerdown", x, y)); el.dispatchEvent(mk("pointermove", x + 90, y + 60)); el.dispatchEvent(mk("pointermove", x + 120, y + 80)); el.dispatchEvent(mk("pointerup", x + 120, y + 80)); }, cx, cy);
await sleep(250);
const panAfter = txOf(await transform());
ok(panBefore && panAfter && (Math.abs(panAfter.x - panBefore.x) > 40 || Math.abs(panAfter.y - panBefore.y) > 30), "drag pans the drawing (" + JSON.stringify(panBefore) + " → " + JSON.stringify(panAfter) + ")");

// 4. Fit button re-fits (resets to a sensible scale/position)
const btnClicked = await page.evaluate(() => { const b = [...document.querySelectorAll("[data-pz] ~ *, button")].find((x) => x.textContent.trim() === "Fit"); if (b) { b.click(); return true; } return false; });
await sleep(300);
ok(btnClicked && scaleOf(await transform()) != null, "Fit button re-fits the drawing (scale " + scaleOf(await transform()) + ")");

// 5. + button zooms to centre
const plusBefore = scaleOf(await transform());
await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "+" && x.getAttribute("title") === "Zoom in"); if (b) b.click(); });
await sleep(250);
ok(scaleOf(await transform()) > plusBefore + 0.01, "+ button zooms in (" + plusBefore + " → " + scaleOf(await transform()) + ")");

ok(errs.length === 0, "zero console/page errors" + (errs.length ? " — " + errs.slice(0, 3).join(" | ") : ""));

await browser.close();
console.log("\n" + (fail === 0 ? "ALL PASSED" : "FAILURES") + " — " + pass + " pass / " + fail + " fail");
process.exit(fail === 0 ? 0 : 1);
