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
  await clickBtnRe(page, /Fabrik/i); await sleep(1200);
  // tick Float on the default cabinet + set wall drywall (to force a warning)
  const floated = await page.evaluate(() => {
    const rows = [...document.querySelectorAll("table tr")];
    for (const r of rows) { const cbs = [...r.querySelectorAll("input[type=checkbox]")]; if (cbs.length >= 2) { cbs[1].click(); return true; } }
    return false;
  });
  ok("ticked Float on a cabinet", floated);
  await sleep(300);
  ok("clicked Generate", await clickBtnRe(page, /Generate production package/i));
  await sleep(2500);
  ok("Floating tab present", await clickBtnRe(page, /^Floating$/i));
  await sleep(600);
  ok("Floating view shows wall capacity", await page.evaluate(() => /Wall capacity|Required|Fixing points|Suspension/i.test(document.body.innerText)));
  ok("Install Guide tab", await clickBtnRe(page, /Install Guide/i));
  await sleep(500);
  ok("Install guide shows steps", await page.evaluate(() => /Step 1:|Assemble carcasses|Site check/i.test(document.body.innerText)));
  ok("Packing tab", await clickBtnRe(page, /^Packing$/i));
  await sleep(500);
  ok("Packing shows cartons + panel no", await page.evaluate(() => /BOX-0\d/.test(document.body.innerText)));
  ok("Suppliers tab", await clickBtnRe(page, /^Suppliers$/i));
  await sleep(900);
  ok("Suppliers listed (masked)", await page.evaluate(() => /\(unlock\)/.test(document.body.innerText)));
  ok("clicked Unlock", await clickBtnRe(page, /Unlock contacts/i));
  await sleep(1000);
  ok("contacts revealed after unlock", await page.evaluate(() => /Contacts unlocked/.test(document.body.innerText) && /\+91 \d/.test(document.body.innerText)));
  ok("no console errors", errs.length === 0, errs.slice(0, 3).join(" | "));
} finally { await browser.close(); }
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
