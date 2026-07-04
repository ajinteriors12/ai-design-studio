import puppeteer from "puppeteer-core";
const CHROME = "C:/Users/hp/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe";
const B = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (n, c, e = "") => { console.log((c ? "PASS" : "FAIL") + " " + n + (e ? " — " + e : "")); c ? pass++ : fail++; };

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", protocol: "pipe", args: ["--no-sandbox", "--disable-dev-shm-usage", "--headless=new", "--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist"], timeout: 60000 });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1400 });
  const errs = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  page.on("pageerror", (e) => errs.push(String(e)));
  await page.goto(B + "/?dev=1", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("#root", { timeout: 15000 });
  await sleep(1800);
  // The RoomPlan2D top-view is on the Generator page by default. Find the wall hit-lines.
  // Dispatch a pointerdown on a wall hit line (transparent stroke width 14) to select it.
  const selectedWall = await page.evaluate(() => {
    // find an svg containing our wall length labels ("open" or numeric near wall) — use the plan svg
    const svgs = [...document.querySelectorAll("svg")];
    // the plan svg has <text> "Wall A" etc.
    const plan = svgs.find((s) => /Wall A/.test(s.textContent || "") && /Top View/.test(s.parentElement ? s.parentElement.textContent : ""));
    if (!plan) return "no-plan";
    // wall B (right) hit line: a transparent line with big stroke-width. Click via React handler → dispatch pointerdown.
    const lines = [...plan.querySelectorAll("line")].filter((l) => (l.getAttribute("stroke") === "transparent"));
    if (!lines.length) return "no-hitlines";
    // pick the right wall (vertical line at max x). Compute.
    let best = null, bx = -1; lines.forEach((l) => { const x = +l.getAttribute("x1"); if (Math.abs(x - +l.getAttribute("x2")) < 1 && x > bx) { bx = x; best = l; } });
    (best || lines[0]).dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 10, clientY: 10 }));
    return "clicked";
  });
  ok("clicked a wall hit-line", selectedWall === "clicked", selectedWall);
  await sleep(600);
  ok("wall toolbar appears (🧱 Wall)", await page.evaluate(() => /🧱\s*Wall [ABCD]/.test(document.body.innerText)));
  ok("toolbar has Lock + Delete", await page.evaluate(() => /Lock/.test(document.body.innerText) && /🗑|Delete/.test(document.body.innerText)));
  // click Delete (open wall)
  const del = await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => /🗑\s*Delete/.test(x.textContent || "")); if (b) { b.click(); return true; } return false; });
  ok("clicked Delete (open wall)", del);
  await sleep(500);
  ok("wall now shows 'open' in plan", await page.evaluate(() => { const svg = [...document.querySelectorAll("svg")].find((s) => /Wall A/.test(s.textContent || "")); return svg && /open/.test(svg.textContent || ""); }));
  ok("no console errors", errs.length === 0, errs.slice(0, 3).join(" | "));
} finally { await browser.close(); }
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
