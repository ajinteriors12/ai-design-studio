// Headless UI test for the #5/#6 3D-panel buttons (Walkthrough GIF + Save finish PBR).
import puppeteer from "puppeteer-core";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const B = "http://localhost:3000";
let pass = 0, fail = 0;
const ok = (n, c, e = "") => { console.log((c ? "✅" : "❌") + " " + n + (e ? " — " + e : "")); c ? pass++ : fail++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(B + "/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("#root", { timeout: 10000 });
  await sleep(600);

  // generate
  await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => /generate design/i.test(x.textContent || "")); if (b) b.click(); });
  await sleep(2500);
  ok("generated, no console errors", errors.length === 0, errors.slice(0, 2).join(" | "));

  // open the 3D view (Project Tree node or a "3D" button)
  const opened3d = await page.evaluate(() => {
    const el = [...document.querySelectorAll("button, span, a, div")].find((x) => /(^|\s)(🧊|3D|View in 3D|3-D)(\s|$)/i.test((x.textContent || "").trim()) && (x.textContent || "").length < 40);
    if (el) { el.click(); return (el.textContent || "").trim().slice(0, 24); } return null;
  });
  await sleep(2500);

  // the new buttons should be present in the DOM
  const hasGif = await page.evaluate(() => [...document.querySelectorAll("button")].some((b) => /Walkthrough GIF/.test(b.textContent || "")));
  const hasMat = await page.evaluate(() => [...document.querySelectorAll("button")].some((b) => /Save finish \(PBR\)/.test(b.textContent || "")));
  ok("#6 'Walkthrough GIF' button present", hasGif, "opened=" + opened3d);
  ok("#5 'Save finish (PBR)' button present", hasMat);

  // click Save finish (PBR) — fast server round-trip, should show a ✓ toast
  if (hasMat) {
    await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => /Save finish \(PBR\)/.test(x.textContent || "")); if (b) b.click(); });
    let toast = "";
    for (let i = 0; i < 12; i++) { await sleep(300); toast = await page.evaluate(() => { const m = document.body.innerText.match(/✓ [a-z-]+ · rough[^\n]*/i); return m ? m[0] : ""; }); if (toast) break; }
    ok("#5 PBR material saved (toast shows preset+params)", /rough/.test(toast), toast.slice(0, 60));
  }
  ok("no console errors after 3D interaction", errors.length === 0, errors.slice(0, 2).join(" | "));

  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
} catch (e) {
  console.error("crashed:", e.message);
  await browser.close();
  process.exit(1);
}
