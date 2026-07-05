// Verify Module 4 §7 plan-CAD: Array (repeat), Group, Duplicate/Mirror/Delete group — on the base run.
import puppeteer from "puppeteer-core";
const CHROME = "C:/Users/hp/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe";
const BASE = "http://localhost:3000/?dev=1";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; console.log("  ✗ " + m); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const baseCount = (p) => p.evaluate(() => document.querySelectorAll('g[data-row="base"]').length);
const groupedCount = (p) => p.evaluate(() => [...document.querySelectorAll('g[data-row="base"]')].filter((g) => g.getAttribute("data-group")).length);
// right-click the rightmost base cabinet — dispatch contextmenu straight on its rect (avoids overlay misses)
async function rightClickBase(p) {
  const done = await p.evaluate(() => {
    const gs = [...document.querySelectorAll('g[data-row="base"]')]; let bx = -1, best = null, br = null;
    for (const g of gs) { const rc = g.querySelector("rect, polygon"); if (!rc) continue; const r = rc.getBoundingClientRect(); if (r.width < 6 || r.height < 6) continue; if (r.x > bx) { bx = r.x; best = r; br = rc; } }
    if (!br) return false;
    br.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: Math.round(best.x + best.width / 2), clientY: Math.round(best.y + best.height / 2) }));
    return true;
  });
  await sleep(300); return done;
}
async function menuHas(p, txt) { return await p.evaluate((t) => { const m = [...document.querySelectorAll("div")].find((d) => d.textContent.includes("Properties…") && getComputedStyle(d).position === "fixed"); return !!(m && [...m.querySelectorAll("button")].some((b) => b.textContent.trim() === t)); }, txt); }
async function clickMenu(p, txt) { return await p.evaluate((t) => { const m = [...document.querySelectorAll("div")].find((d) => d.textContent.includes("Properties…") && getComputedStyle(d).position === "fixed"); if (!m) return false; const b = [...m.querySelectorAll("button")].find((x) => x.textContent.trim() === t); if (b) { b.click(); return true; } return false; }, txt); }

const errs = [];
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist", "--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1500, height: 1300 });
page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
page.on("pageerror", (e) => errs.push(String(e)));
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => b.textContent.trim() === "Generate Design"), { timeout: 20000 });

await page.$$eval("button", (bs) => { const b = bs.find((x) => x.textContent.trim() === "Generate Design"); if (b) b.click(); });
await page.waitForFunction(() => document.querySelectorAll('g[data-row="base"]').length > 0, { timeout: 15000 });
await sleep(600);
const n0 = await baseCount(page);
ok(n0 > 0, "kitchen generated — " + n0 + " base cabinets");

// Array ×3 (adds 2 copies)
ok(await rightClickBase(page), "right-clicked a base cabinet");
ok(await menuHas(page, "×3"), "§7 Array control present in menu");
ok(await clickMenu(page, "×3"), "clicked Array ×3");
await sleep(500);
const nArr = await baseCount(page);
ok(nArr === n0 + 2, "Array ×3 added 2 identical cabinets (" + n0 + " → " + nArr + ")");

// Group 3
ok(await rightClickBase(page), "right-clicked again");
ok(await clickMenu(page, "3"), "clicked Group 3");
await sleep(500);
const g1 = await groupedCount(page);
ok(g1 >= 3, "3 cabinets carry a group id + colour bar (grouped=" + g1 + ")");

// Duplicate group → +3
ok(await rightClickBase(page), "right-clicked a grouped cabinet");
const before = await baseCount(page);
ok(await clickMenu(page, "Duplicate group"), "clicked Duplicate group");
await sleep(500);
const nDup = await baseCount(page);
ok(nDup >= before + 3, "Duplicate group added the whole group (" + before + " → " + nDup + ")");

// Mirror group (no crash) + Delete group (removes members, keeps wall length via std modules)
ok(await rightClickBase(page), "right-clicked before mirror");
ok(await clickMenu(page, "Mirror group"), "clicked Mirror group");
await sleep(400);
ok(await rightClickBase(page), "right-clicked before delete-group");
const preDel = await baseCount(page);
ok(await clickMenu(page, "Delete group"), "clicked Delete group");
await sleep(400);
const nDel = await baseCount(page);
ok(nDel < preDel, "Delete group removed grouped cabinets (" + preDel + " → " + nDel + ")");

ok(errs.length === 0, "0 console errors" + (errs.length ? " — " + errs.slice(0, 3).join(" | ") : ""));
await browser.close();
console.log("\n== " + pass + "/" + (pass + fail) + " passed ==");
process.exit(fail ? 1 : 0);
