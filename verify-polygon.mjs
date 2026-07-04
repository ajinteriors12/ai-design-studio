import puppeteer from "puppeteer-core";
const CHROME = "C:/Users/hp/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe";
const B = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (n, c, e = "") => { console.log((c ? "PASS" : "FAIL") + " " + n + (e ? " — " + e : "")); c ? pass++ : fail++; };
const clickBtnRe = (page, re) => page.evaluate((o) => { const r = new RegExp(o.s, o.f); const b = [...document.querySelectorAll("button")].find((x) => r.test((x.textContent || "").trim())); if (b) { b.click(); return true; } return false; }, { s: re.source, f: re.flags });
const wallCount = (page) => page.evaluate(() => { const m = (document.body.innerText.match(/(\d+)\s+walls/) || [])[1]; return m ? +m : -1; });
// click a polygon wall edge (transparent hit line) inside the Free-form svg
const clickPolyWall = (page) => page.evaluate(() => { const svg = [...document.querySelectorAll("svg")].find((s) => /Free-form plan/.test(s.parentElement ? s.parentElement.textContent : "")); if (!svg) return false; const l = [...svg.querySelectorAll("line")].find((x) => x.getAttribute("stroke") === "transparent"); if (!l) return false; l.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 10, clientY: 10 })); return true; });
const clickPolyVertex = (page) => page.evaluate(() => { const svg = [...document.querySelectorAll("svg")].find((s) => /Free-form plan/.test(s.parentElement ? s.parentElement.textContent : "")); if (!svg) return false; const c = svg.querySelector("circle"); if (!c) return false; c.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 10, clientY: 10 })); return true; });

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", protocol: "pipe", args: ["--no-sandbox", "--disable-dev-shm-usage", "--headless=new", "--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist"], timeout: 60000 });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1300 });
  const errs = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  page.on("pageerror", (e) => errs.push(String(e)));
  await page.goto(B, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("#root", { timeout: 15000 });
  await sleep(1800);
  ok("switched to Free-form", await clickBtnRe(page, /⬡ Free-form/));
  await sleep(500);
  ok("polygon editor rendered (4 walls)", await wallCount(page) === 4, "count=" + await wallCount(page));
  ok("applied L-shape preset", await clickBtnRe(page, /L-shape/));
  await sleep(400);
  const nL = await wallCount(page); ok("L-shape has 6 walls", nL === 6, "count=" + nL);
  ok("selected a polygon wall", await clickPolyWall(page)); await sleep(300);
  ok("poly wall toolbar shows", await page.evaluate(() => /🧱\s*Wall \d/.test(document.body.innerText)));
  ok("clicked ✂ Split", await clickBtnRe(page, /✂ Split/)); await sleep(400);
  const nS = await wallCount(page); ok("split added a wall (7)", nS === nL + 1, "count=" + nS);
  ok("selected a vertex", await clickPolyVertex(page)); await sleep(300);
  ok("vertex toolbar shows", await page.evaluate(() => /📍\s*Vertex \d/.test(document.body.innerText)));
  ok("clicked ⛓ Join", await clickBtnRe(page, /⛓ Join/)); await sleep(400);
  const nJ = await wallCount(page); ok("join removed a wall", nJ === nS - 1, "count=" + nJ);
  ok("no console errors", errs.length === 0, errs.slice(0, 3).join(" | "));
} finally { await browser.close(); }
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
