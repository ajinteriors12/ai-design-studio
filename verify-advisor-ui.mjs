import puppeteer from "puppeteer-core";
const CHROME = "C:/Users/hp/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe";
const B = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (n, c, e = "") => { console.log((c ? "PASS" : "FAIL") + " " + n + (e ? " — " + e : "")); c ? pass++ : fail++; };
const clickBtnRe = (page, re) => page.evaluate((o) => { const r = new RegExp(o.s, o.f); const b = [...document.querySelectorAll("button")].find((x) => r.test((x.textContent || "").trim())); if (b) { b.click(); return true; } return false; }, { s: re.source, f: re.flags });

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", protocol: "pipe", args: ["--no-sandbox", "--disable-dev-shm-usage", "--headless=new", "--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist"], timeout: 60000 });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1400 });
  const errs = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  page.on("pageerror", (e) => errs.push(String(e)));
  await page.goto(B, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("#root", { timeout: 15000 });
  await sleep(1500);
  ok("Generate button present", await clickBtnRe(page, /generate design/i));
  await sleep(4000);
  ok("result rendered (scorecard)", await page.evaluate(() => /Confidence Scorecard/i.test(document.body.innerText)));
  ok("AI Layout Advisor panel present", await page.evaluate(() => /AI Layout Advisor/i.test(document.body.innerText)));
  ok("clicked Analyse design", await clickBtnRe(page, /Analyse design/i));
  let graded = false;
  for (let i = 0; i < 15; i++) { graded = await page.evaluate(() => /Grade [A-D] ·/.test(document.body.innerText)); if (graded) break; await sleep(500); }
  ok("advisor returned a grade", graded);
  ok("advisor shows a Fix recommendation", await page.evaluate(() => /Fix:/.test(document.body.innerText)));
  ok("no console errors", errs.length === 0, errs.slice(0, 3).join(" | "));
} finally { await browser.close(); }
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
