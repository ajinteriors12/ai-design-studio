// Verify Module 6 Mathematical Design Engine — Generator panel + Wardrobe AI tab, 0 console errors.
import puppeteer from "puppeteer-core";
const CHROME = "C:/Users/hp/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe";
const BASE = "http://localhost:3000/";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; console.log("  ✗ " + m); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitText(page, re, ms = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const found = await page.evaluate((rs, fl) => { const r = new RegExp(rs, fl); return [...document.querySelectorAll("*")].some((e) => e.children.length === 0 && r.test(e.textContent || "")); }, re.source, re.flags); if (found) return true; await sleep(300); }
  return false;
}
async function clickText(page, re) {
  return await page.evaluate((rs, fl) => { const r = new RegExp(rs, fl); const els = [...document.querySelectorAll("button"), ...document.querySelectorAll("a"), ...document.querySelectorAll("div,span")]; const el = els.find((e) => r.test((e.textContent || "").trim())); if (el) { el.scrollIntoView({ block: "center" }); el.click(); return true; } return false; }, re.source, re.flags);
}

const errs = [];
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist", "--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 1400 });
page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
page.on("pageerror", (e) => errs.push(String(e)));

console.log("\n== Generator: kitchen Math Engine ==");
await page.goto(BASE, { waitUntil: "domcontentloaded" });
ok(await waitText(page, /Generate Design/i), "app mounted");
// set U-Shape kitchen if a type selector exists, then generate
await clickText(page, /^Generate Design$/i) || await clickText(page, /Generate Design/i);
ok(await waitText(page, /Mathematical Design Engine/i, 25000), "Math Engine panel rendered after generate");
await sleep(700);
let clicked = false; for (let i = 0; i < 5 && !clicked; i++) { clicked = await clickText(page, /^Run analysis$/i); if (!clicked) await sleep(500); }
ok(clicked, "clicked Run analysis (generator)");
ok(await waitText(page, /Grade [A-D] ·/i, 15000), "grade chip appeared");
ok(await waitText(page, /Structural ·/i, 8000), "structural summary line rendered");
ok(await waitText(page, /Storage/i, 4000) && await waitText(page, /Movement/i, 4000), "optimisation metric tiles rendered");
ok(await waitText(page, /Sheet-size constraint|Transportation constraint/i, 4000), "constraint solver rows rendered");

console.log("\n== Wardrobe AI tab: Math tab ==");
await clickText(page, /🚪 Wardrobe AI|Wardrobe AI/i);
await sleep(800);
ok(await waitText(page, /Generate|Max Hanging|Balanced/i, 12000), "wardrobe module opened");
// generate options if needed
await clickText(page, /Generate 3 Options|Generate Options|Generate/i);
await sleep(2500);
ok(await clickText(page, /🔬 Math/i), "clicked 🔬 Math tab");
await sleep(500);
ok(await clickText(page, /^Run analysis$/i), "clicked Run analysis (wardrobe)");
ok(await waitText(page, /Grade [A-D] ·/i, 15000), "wardrobe grade chip appeared");
ok(await waitText(page, /shelves OK/i, 8000), "wardrobe structural line rendered");
ok(await waitText(page, /Centre of gravity/i, 6000), "wardrobe centre-of-gravity rendered");

ok(errs.length === 0, "0 console errors" + (errs.length ? " — " + errs.slice(0, 3).join(" | ") : ""));
await browser.close();
console.log("\n== " + pass + "/" + (pass + fail) + " passed ==");
process.exit(fail ? 1 : 0);
