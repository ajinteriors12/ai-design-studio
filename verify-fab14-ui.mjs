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
  await page.setViewport({ width: 1500, height: 1300 });
  const errs = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  page.on("pageerror", (e) => errs.push(String(e)));
  await page.goto(B + "/?dev=1", { waitUntil: "domcontentloaded", timeout: 60000 });
  for (let i = 0; i < 40; i++) { if (await page.evaluate(() => /Fabrik/i.test(document.body.innerText))) break; await sleep(400); }
  ok("Fabrik tab present", await clickBtnRe(page, /Fabrik/i));
  await sleep(1500);
  // hardware selects present
  const selCount = await page.evaluate(() => document.querySelectorAll("select").length);
  ok("hardware selection panel rendered", await page.evaluate(() => /Drawer hardware/i.test(document.body.innerText) && [...document.querySelectorAll("option")].some(o => /TANDEMBOX|Soft-close|Telescopic/i.test(o.textContent||""))), "selects=" + selCount);
  // set a cabinet drawer count to 3 (find the Drawers number input in the cabinet row)
  const setDrawers = await page.evaluate(() => {
    const rows = [...document.querySelectorAll("table tr")];
    for (const r of rows) { const inps = [...r.querySelectorAll("input[type=number]")]; if (inps.length >= 5) { const dn = inps[inps.length - 1]; const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; setter.call(dn, "3"); dn.dispatchEvent(new Event("input", { bubbles: true })); return true; } }
    return false;
  });
  ok("set drawer count = 3", setDrawers);
  // pick Blum Tandembox in the hardware select
  const pickedHw = await page.evaluate(() => {
    const sels = [...document.querySelectorAll("select")];
    const hs = sels.find(s => [...s.options].some(o => /TANDEMBOX/i.test(o.textContent || "")));
    if (!hs) return false; const opt = [...hs.options].find(o => /TANDEMBOX/i.test(o.textContent || "")); const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set; setter.call(hs, opt.value); hs.dispatchEvent(new Event("change", { bubbles: true })); return true;
  });
  ok("selected Blum Tandembox hardware", pickedHw);
  await sleep(300);
  ok("clicked Generate", await clickBtnRe(page, /Generate production package/i));
  await sleep(2500);
  ok("Drawers view tab present", await clickBtnRe(page, /^Drawers$/i));
  await sleep(800);
  const body = await page.evaluate(() => document.body.innerText);
  ok("Drawers view shows hardware model", /TANDEMBOX/i.test(body), body.slice(0, 0));
  ok("Drawers view shows box sizes + load", /\d+kg/.test(body) && /metal|under/i.test(body));
  ok("hardware chip summary present", /Hardware:/i.test(body));
  ok("no console errors", errs.length === 0, errs.slice(0, 3).join(" | "));
} finally { await browser.close(); }
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
