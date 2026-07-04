// Verify G-Shape Kitchen — dropdown, Right-wall input, generate, plan/elevations render, 3D mounts, 0 errors.
import puppeteer from "puppeteer-core";
const CHROME = "C:/Users/hp/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe";
const BASE = "http://localhost:3000/?dev=1";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; console.log("  ✗ " + m); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function hasText(p, re) { return await p.evaluate((rs, fl) => { const r = new RegExp(rs, fl); return [...document.querySelectorAll("*")].some((e) => e.children.length === 0 && r.test(e.textContent || "")); }, re.source, re.flags); }
async function waitText(p, re, ms = 20000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await hasText(p, re)) return true; await sleep(300); } return false; }
async function click(p, re) { return await p.evaluate((rs, fl) => { const r = new RegExp(rs, fl); const el = [...document.querySelectorAll("button"), ...document.querySelectorAll("div,span,a")].find((e) => r.test((e.textContent || "").trim())); if (el) { el.scrollIntoView({ block: "center" }); el.click(); return true; } return false; }, re.source, re.flags); }

const errs = [];
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist", "--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 1300 });
page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
page.on("pageerror", (e) => errs.push(String(e)));

await page.goto(BASE, { waitUntil: "domcontentloaded" });
ok(await waitText(page, /Generate Design/i), "app mounted (Generator)");

// select G-Shape Kitchen in the type dropdown (native <select>)
const selected = await page.evaluate(() => {
  const sel = [...document.querySelectorAll("select")].find((s) => [...s.options].some((o) => /G-Shape Kitchen/.test(o.textContent)));
  if (!sel) return false;
  const opt = [...sel.options].find((o) => /G-Shape Kitchen/.test(o.textContent));
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
  setter.call(sel, opt.value); sel.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
});
ok(selected, "G-Shape Kitchen present + selected in dropdown");
await sleep(500);
ok(await hasText(page, /Right wall/i), "Right wall input shown for G-Shape");
ok(await hasText(page, /Back wall|Left wall/i), "Back/Left wall inputs shown");

// generate
await click(page, /^Generate Design$/i) || await click(page, /Generate Design/i);
ok(await waitText(page, /📄 Spec Sheet|Confidence|BOQ|Cutting/i, 25000), "G-Shape design generated");
ok(await hasText(page, /G-Shape . Plan|peninsula/i), "G-Shape plan (with peninsula) rendered");

// navigate to an elevation + the 3D view
await click(page, /Peninsula|Right Wall|Back Wall|Elevation/i);
await sleep(600);
ok(await click(page, /^🧊 3D$|3D View|\b3D\b/i), "opened 3D view");
await sleep(2500);
ok(await page.evaluate(() => !!document.querySelector("canvas")), "3D canvas mounted");

ok(errs.length === 0, "0 console errors" + (errs.length ? " — " + errs.slice(0, 3).join(" | ") : ""));
await browser.close();
console.log("\n== " + pass + "/" + (pass + fail) + " passed ==");
process.exit(fail ? 1 : 0);
