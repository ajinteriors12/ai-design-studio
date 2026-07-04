import puppeteer from "puppeteer-core";
const CHROME = "C:/Users/hp/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe";
const B = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clickByText = (page, re) => page.evaluate((o) => { const r = new RegExp(o.s, o.f); const b = [...document.querySelectorAll("button,summary,a")].find((x) => r.test((x.textContent || "").trim())); if (b) { b.click(); return true; } return false; }, { s: re.source, f: re.flags });
const clickBtnEq = (page, txt) => page.evaluate((t) => { const b = [...document.querySelectorAll("button")].find((x) => (x.textContent || "").trim() === t); if (b) { b.click(); return true; } return false; }, txt);
let pass = 0, fail = 0;
const ok = (n, c, e = "") => { console.log((c ? "PASS" : "FAIL") + " " + n + (e ? " — " + e : "")); c ? pass++ : fail++; };

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", protocol: "pipe", args: ["--no-sandbox", "--disable-dev-shm-usage", "--headless=new", "--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist"], timeout: 60000 });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 1300 });
  const errs = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  page.on("pageerror", (e) => errs.push(String(e)));
  await page.goto(B + "/?dev=1", { waitUntil: "domcontentloaded", timeout: 60000 });
  // wait for app mount
  for (let i = 0; i < 40; i++) { if (await page.evaluate(() => /Wardrobe/i.test(document.body.innerText)) ) break; await sleep(400); }
  ok("Wardrobe AI tab present", await clickByText(page, /Wardrobe AI/i));
  await sleep(3000);   // initial options generate
  ok("Board tab present", await clickBtnEq(page, "🖼 Board"));
  await sleep(1500);
  const hasSchem = await page.evaluate(() => document.querySelector("svg") && /PROJECT INFO|3D PREVIEW/i.test(document.body.innerHTML));
  ok("schematic board rendered", hasSchem);
  ok("Photoreal Board button present", await page.evaluate(() => [...document.querySelectorAll("button")].some((b) => /Photoreal Board/i.test(b.textContent || ""))));
  const clicked = await clickByText(page, /Photoreal Board/i);
  ok("clicked ✨ Photoreal Board", clicked);
  // wait for photoreal render (3 stability calls ~12-25s)
  let jpg = false;
  for (let i = 0; i < 60; i++) { jpg = await page.evaluate(() => /data:image\/jpe?g;base64/i.test(document.querySelector('[class*="overflow-auto"]') ? document.querySelector('[class*="overflow-auto"]').innerHTML : document.body.innerHTML)); if (jpg) break; await sleep(1000); }
  ok("photoreal JPEG heroes in board", jpg);
  ok("Schematic-board revert button appears", await page.evaluate(() => [...document.querySelectorAll("button")].some((b) => /Schematic board/i.test(b.textContent || ""))));
  ok("no console errors", errs.length === 0, errs.slice(0, 3).join(" | "));
} finally { await browser.close(); }
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
