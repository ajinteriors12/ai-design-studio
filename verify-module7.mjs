// Verify Module 7 — Dashboard, module locking, nav gating, admin login + control. 0 console errors.
import puppeteer from "puppeteer-core";
const CHROME = "C:/Users/hp/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe";
const BASE = "http://localhost:3000/";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; console.log("  ✗ " + m); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function hasText(page, re) { return await page.evaluate((rs, fl) => { const r = new RegExp(rs, fl); return [...document.querySelectorAll("*")].some((e) => e.children.length === 0 && r.test(e.textContent || "")); }, re.source, re.flags); }
async function waitText(page, re, ms = 15000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await hasText(page, re)) return true; await sleep(250); } return false; }
async function click(page, re) { return await page.evaluate((rs, fl) => { const r = new RegExp(rs, fl); const els = [...document.querySelectorAll("button"), ...document.querySelectorAll("div,span,a")]; const el = els.find((e) => r.test((e.textContent || "").trim())); if (el) { el.scrollIntoView({ block: "center" }); el.click(); return true; } return false; }, re.source, re.flags); }
async function setInput(page, sel, val) { await page.evaluate((s, v) => { const el = document.querySelector(s); const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; setter.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); }, sel, val); }

const errs = [];
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist", "--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 1300 });
page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
page.on("pageerror", (e) => errs.push(String(e)));

console.log("\n== Dashboard landing + nav gating ==");
await page.goto(BASE, { waitUntil: "domcontentloaded" });
ok(await waitText(page, /Design Studio Dashboard/i, 20000), "Dashboard is the landing view");
ok(await hasText(page, /Modular Kitchen/i) && await hasText(page, /Wardrobe/i), "active module tiles present");
ok(await hasText(page, /Coming Soon/i), "Coming Soon tiles present");
ok(await hasText(page, /Request Access/i) && await hasText(page, /Notify Me/i), "locked tiles show Request Access / Notify Me");
// nav should NOT show Fabrik/Library for a non-admin
const navFabrik = await page.evaluate(() => [...document.querySelectorAll("button")].some((b) => /^🏭 Fabrik$|^Fabrik$/.test((b.textContent || "").trim())));
ok(!navFabrik, "non-admin nav hides workspace tools (Fabrik)");

console.log("\n== Active tile opens the module ==");
ok(await click(page, /^🍳$|Modular Kitchen/i), "clicked Modular Kitchen tile");
await sleep(600);
ok(await waitText(page, /Generate Design/i, 12000), "kitchen Generator opened");

console.log("\n== Notify Me on a locked tile ==");
await click(page, /^🏠 Dashboard$/i); await sleep(500);
ok(await click(page, /Notify Me/i), "clicked Notify Me");
ok(await waitText(page, /notify you/i, 5000), "access-request confirmation shown");

console.log("\n== Admin login + control panel ==");
await click(page, /Admin Dashboard/i); await sleep(500);
ok(await waitText(page, /Super Admin Login/i, 8000), "admin login gate shown");
ok(await hasText(page, /Role-based access/i), "RBAC matrix shown on the gate");
await setInput(page, 'input[type="password"]', "246810");
ok(await click(page, /Unlock Admin/i), "submitted admin PIN");
ok(await waitText(page, /Module & Access Control|Module &amp; Access Control/i, 8000), "admin control panel unlocked");
ok(await hasText(page, /Feature locks/i), "feature-lock toggles present");
// after admin login, workspace tools appear in nav
const navFabrik2 = await page.evaluate(() => [...document.querySelectorAll("button")].some((b) => /Fabrik/.test((b.textContent || "").trim())));
ok(navFabrik2, "admin nav reveals workspace tools (Fabrik)");

ok(errs.length === 0, "0 console errors" + (errs.length ? " — " + errs.slice(0, 3).join(" | ") : ""));
await browser.close();
console.log("\n== " + pass + "/" + (pass + fail) + " passed ==");
process.exit(fail ? 1 : 0);
