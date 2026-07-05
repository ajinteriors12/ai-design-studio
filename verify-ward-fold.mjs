// Capture the folded L/U-shape wardrobe 3D (perspective + top) to images for visual confirmation.
import puppeteer from "puppeteer-core";
import fs from "fs";
const CHROME = "C:/Users/hp/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe";
const OUT = "D:/BACKUP";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function hasText(p, re) { return await p.evaluate((rs, fl) => { const r = new RegExp(rs, fl); return [...document.querySelectorAll("*")].some((e) => e.children.length === 0 && r.test(e.textContent || "")); }, re.source, re.flags); }
async function waitText(p, re, ms = 20000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await hasText(p, re)) return true; await sleep(300); } return false; }
async function click(p, re) { return await p.evaluate((rs, fl) => { const r = new RegExp(rs, fl); const el = [...document.querySelectorAll("button"), ...document.querySelectorAll("div,span,a")].find((e) => r.test((e.textContent || "").trim())); if (el) { el.scrollIntoView({ block: "center" }); el.click(); return true; } return false; }, re.source, re.flags); }
async function selectByLabel(p, optRe) { return await p.evaluate((rs, fl) => { const r = new RegExp(rs, fl); const sel = [...document.querySelectorAll("select")].find((s) => [...s.options].some((o) => r.test(o.textContent))); if (!sel) return false; const opt = [...sel.options].find((o) => r.test(o.textContent)); const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set; setter.call(sel, opt.value); sel.dispatchEvent(new Event("change", { bubbles: true })); return true; }, optRe.source, optRe.flags); }
async function shot(p, name) { const cnv = await p.$("canvas"); if (cnv) { await cnv.screenshot({ path: OUT + "/" + name }); console.log("  saved " + name); } else console.log("  NO canvas for " + name); }

const BASE = "http://localhost:3000/?tab=" + encodeURIComponent("🚪 Wardrobe AI");
const errs = [];
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist", "--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1400 });
page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
page.on("pageerror", (e) => errs.push(String(e)));
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await waitText(page, /Max Hanging|Balanced|Wardrobe/i, 20000);

// L-shape
await selectByLabel(page, /^L-Shape$/i); await sleep(2800);
await click(page, /^3D$/i); await sleep(2600);
await shot(page, "ward-fold-L-persp.png");
await click(page, /^Top$/i); await sleep(1200);
await shot(page, "ward-fold-L-top.png");

// U-shape
await click(page, /^Reports$/i); await sleep(300);
await selectByLabel(page, /^U-Shape$/i); await sleep(2900);
await click(page, /^3D$/i); await sleep(2600);
await shot(page, "ward-fold-U-persp.png");
await click(page, /^Top$/i); await sleep(1200);
await shot(page, "ward-fold-U-top.png");

console.log("console errors: " + errs.length + (errs.length ? " — " + errs.slice(0, 3).join(" | ") : ""));
await browser.close();
process.exit(0);
