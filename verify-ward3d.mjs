// Smoke: Wardrobe 3D — orthographic front/side/top + LED + LOD, 0 console errors.
import puppeteer from "puppeteer-core";
const CHROME = "C:/Users/hp/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe";
const B = "http://localhost:3000";
let pass = 0, fail = 0;
const ok = (n, c, e = "") => { console.log((c ? "PASS" : "FAIL") + " " + n + (e ? " — " + e : "")); c ? pass++ : fail++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clickByText = (page, re) => page.evaluate((o) => { const r = new RegExp(o.s, o.f); const b = [...document.querySelectorAll("button,summary,a,li")].find((x) => r.test(x.textContent || "")); if (b) { b.click(); return true; } return false; }, { s: re.source, f: re.flags });

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", protocol: "pipe", args: ["--no-sandbox", "--disable-dev-shm-usage", "--headless=new", "--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist"], timeout: 60000 });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1200 });
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(B + "/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("#root", { timeout: 10000 });
  let ready = false;
  for (let i = 0; i < 40; i++) { await sleep(300); if (await page.evaluate(() => /Wardrobe AI/.test(document.body.innerText))) { ready = true; break; } }
  ok("app interactive", ready);
  ok("clicked Wardrobe AI tab", await clickByText(page, /🚪 Wardrobe AI/));
  let gen = false;
  for (let i = 0; i < 40; i++) { await sleep(500); gen = await page.evaluate(() => /Max Hanging|Balanced|Max Folding/.test(document.body.innerText)); if (gen) break; }
  ok("wardrobe options generated", gen);
  // switch to the 3D report tab
  ok("clicked 3D tab", await clickByText(page, /^3D$/));
  let canvas = false;
  for (let i = 0; i < 25; i++) { await sleep(400); canvas = await page.evaluate(() => !!document.querySelector("canvas")); if (canvas) break; }
  ok("3D canvas mounted", canvas);
  await sleep(800);
  // ortho views
  ok("clicked Front (ortho)", await clickByText(page, /^Front$/));
  await sleep(500);
  ok("clicked Top (ortho)", await clickByText(page, /^Top$/));
  await sleep(500);
  ok("clicked Side (ortho)", await clickByText(page, /^Side$/));
  await sleep(500);
  ok("clicked Perspective", await clickByText(page, /^Perspective$/));
  await sleep(400);
  // LED toggle
  const ledToggled = await page.evaluate(() => { const l = [...document.querySelectorAll("label")].find((x) => /LED/.test(x.textContent || "")); const cb = l && l.querySelector("input[type=checkbox]"); if (cb) { cb.click(); return true; } return false; });
  ok("LED toggled", ledToggled);
  await sleep(1000);
  const ctxAlive = await page.evaluate(() => { const c = document.querySelector("canvas"); if (!c) return false; const gl = c.getContext("webgl2") || c.getContext("webgl"); return !!gl && !gl.isContextLost(); });
  ok("WebGL context alive after LED", ctxAlive);
  const canvasSize = await page.evaluate(() => { const c = document.querySelector("canvas"); return c ? c.width + "x" + c.height : "none"; });
  ok("canvas has real size", /\d+x\d+/.test(canvasSize) && canvasSize !== "0x0", canvasSize);
  ok("0 console errors", errors.length === 0, errors.slice(0, 3).join(" | "));
} finally { await browser.close(); }
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
