// Verify L/U-shape wardrobe with corner solutions — shape selector, wing inputs, folded plan,
// corner hardware in BOQ, 3D mounts, 0 console errors.
import puppeteer from "puppeteer-core";
const CHROME = "C:/Users/hp/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe";
const BASE = "http://localhost:3000/?tab=" + encodeURIComponent("🚪 Wardrobe AI");
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; console.log("  ✗ " + m); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function hasText(p, re) { return await p.evaluate((rs, fl) => { const r = new RegExp(rs, fl); return [...document.querySelectorAll("*")].some((e) => e.children.length === 0 && r.test(e.textContent || "")); }, re.source, re.flags); }
async function waitText(p, re, ms = 20000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await hasText(p, re)) return true; await sleep(300); } return false; }
async function click(p, re) { return await p.evaluate((rs, fl) => { const r = new RegExp(rs, fl); const el = [...document.querySelectorAll("button"), ...document.querySelectorAll("div,span,a")].find((e) => r.test((e.textContent || "").trim())); if (el) { el.scrollIntoView({ block: "center" }); el.click(); return true; } return false; }, re.source, re.flags); }
// set a native <select> by matching an option label
async function selectByLabel(p, optRe) { return await p.evaluate((rs, fl) => { const r = new RegExp(rs, fl); const sel = [...document.querySelectorAll("select")].find((s) => [...s.options].some((o) => r.test(o.textContent))); if (!sel) return false; const opt = [...sel.options].find((o) => r.test(o.textContent)); const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set; setter.call(sel, opt.value); sel.dispatchEvent(new Event("change", { bubbles: true })); return true; }, optRe.source, optRe.flags); }

const errs = [];
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist", "--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1400 });
page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
page.on("pageerror", (e) => errs.push(String(e)));

await page.goto(BASE, { waitUntil: "domcontentloaded" });
ok(await waitText(page, /Max Hanging|Balanced|Wardrobe/i, 20000), "Wardrobe AI module loaded (default straight)");

// switch shape → L-Shape
ok(await selectByLabel(page, /^L-Shape$/i), "selected L-Shape in the Shape dropdown");
await sleep(2600);   // debounced regen (400ms) + generate
ok(await hasText(page, /Wall B \(mm\)/i), "Wall B (wing) input appeared for L-shape");
ok(await hasText(page, /Corner solution/i), "Corner solution selector appeared");

// switch to Top view → folded plan
await click(page, /^Top$/i);
await sleep(700);
ok(await waitText(page, /L-Shape Wardrobe . Plan|Corner \(/i, 8000), "folded L-Shape plan rendered in Top view");

// BOQ tab → corner hardware line
await click(page, /^BOQ$/i);
await sleep(700);
ok(await waitText(page, /LeMans|Corner/i, 8000), "corner hardware line present in BOQ");

// switch to U-Shape
await click(page, /^Reports$/i); await sleep(300);
ok(await selectByLabel(page, /^U-Shape$/i), "selected U-Shape");
await sleep(2800);
ok(await hasText(page, /Right wing \(mm\)/i), "Right wing input appeared for U-shape");
await click(page, /^Top$/i); await sleep(700);
ok(await waitText(page, /U-Shape Wardrobe . Plan/i, 8000), "folded U-Shape plan rendered");

// 3D still mounts
await click(page, /^3D$/i);
await sleep(2500);
ok(await page.evaluate(() => !!document.querySelector("canvas")), "3D canvas mounts for shaped wardrobe");

ok(errs.length === 0, "0 console errors" + (errs.length ? " — " + errs.slice(0, 3).join(" | ") : ""));
await browser.close();
console.log("\n== " + pass + "/" + (pass + fail) + " passed ==");
process.exit(fail ? 1 : 0);
