// Verify free-form polygon room → 3D walls follow the drawn footprint (RoomShell3D), 0 console errors.
import puppeteer from "puppeteer-core";
const CHROME = "C:/Users/hp/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe";
const BASE = "http://localhost:3000/?dev=1";
const OUT = "D:/BACKUP";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; console.log("  ✗ " + m); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function hasText(p, re) { return await p.evaluate((rs, fl) => { const r = new RegExp(rs, fl); return [...document.querySelectorAll("*")].some((e) => e.children.length === 0 && r.test(e.textContent || "")); }, re.source, re.flags); }
async function waitText(p, re, ms = 20000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await hasText(p, re)) return true; await sleep(300); } return false; }
async function click(p, re) { return await p.evaluate((rs, fl) => { const r = new RegExp(rs, fl); const el = [...document.querySelectorAll("button"), ...document.querySelectorAll("span,a,div")].find((e) => r.test((e.textContent || "").trim())); if (el) { el.scrollIntoView({ block: "center" }); el.click(); return true; } return false; }, re.source, re.flags); }
async function shotFirstCanvas(p, name) { const c = await p.$("canvas"); if (c) { await c.screenshot({ path: OUT + "/" + name }); console.log("  saved " + name); return true; } return false; }

const errs = [];
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist", "--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1600 });
page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
page.on("pageerror", (e) => errs.push(String(e)));
await page.goto(BASE, { waitUntil: "domcontentloaded" });
ok(await waitText(page, /Room shape|Generate Design|Empty room/i, 20000), "Generator/room setup loaded");

// switch to free-form + L-shape preset
ok(await click(page, /⬡ Free-form/), "clicked Free-form");
await sleep(600);
ok(await hasText(page, /Preset:/i), "free-form presets appeared");
ok(await click(page, /^L-shape$/i), "applied L-shape preset");
await sleep(1800);   // RoomShell3D rebuild (room dep)
ok(await shotFirstCanvas(page, "polywall-L.png"), "captured L-shape room 3D");

// U-shape preset
ok(await click(page, /^U-shape$/i), "applied U-shape preset");
await sleep(1800);
ok(await shotFirstCanvas(page, "polywall-U.png"), "captured U-shape room 3D");

// the "fit walls to drawn room" button (polygon → kitchen runs) — only for kitchen types in poly mode
ok(await hasText(page, /Fit walls to drawn room/i), "polygon→layout fit-walls control present");

ok(errs.length === 0, "0 console errors" + (errs.length ? " — " + errs.slice(0, 3).join(" | ") : ""));
await browser.close();
console.log("\n== " + pass + "/" + (pass + fail) + " passed ==");
process.exit(fail ? 1 : 0);
