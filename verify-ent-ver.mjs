// UI test: design version history (📸 snapshot + ↩ restore) in StructurePanel.
import puppeteer from "puppeteer-core";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const B = "http://localhost:3000";
let pass = 0, fail = 0;
const ok = (n, c, e = "") => { console.log((c ? "✅" : "❌") + " " + n + (e ? " — " + e : "")); c ? pass++ : fail++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clickByText = (page, re) => page.evaluate((o) => { const r = new RegExp(o.s, o.f); const b = [...document.querySelectorAll("button,summary")].find((x) => r.test(x.textContent || "")); if (b) { b.click(); return true; } return false; }, { s: re.source, f: re.flags });

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1000 });
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(B + "/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("#root", { timeout: 10000 });
  await sleep(600);
  await clickByText(page, /generate design/i);
  await sleep(2500);
  await clickByText(page, /Structure & production jobs/);
  await sleep(800);
  ok("version history section present", await page.evaluate(() => /Version history \(\d+\)/.test(document.body.innerText)));

  // type a label via React's native value setter (controlled input), then snapshot
  await page.evaluate(() => {
    const i = [...document.querySelectorAll("input")].find((x) => x.placeholder === "label (optional)");
    if (i) { const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set; set.call(i, "qa-snap"); i.dispatchEvent(new Event("input", { bubbles: true })); }
  });
  await clickByText(page, /📸 Snapshot/);
  let listed = false;
  for (let i = 0; i < 14; i++) { await sleep(400); listed = await page.evaluate(() => /qa-snap/.test(document.body.innerText) && [...document.querySelectorAll("button")].some((b) => /↩ restore/.test(b.textContent || ""))); if (listed) break; }
  ok("snapshot (custom label) appears in list with ↩ restore", listed);

  // restore it
  await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => /↩ restore/.test(x.textContent || "")); if (b) b.click(); });
  let restored = false;
  // after restore the server auto-snapshots → version count becomes 2 ("Auto-save before restore" appears)
  for (let i = 0; i < 14; i++) { await sleep(400); restored = await page.evaluate(() => /Auto-save before restore/.test(document.body.innerText)); if (restored) break; }
  ok("restore works + auto-snapshots prior state", restored);

  ok("no console errors throughout", errors.length === 0, errors.slice(0, 2).join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
} catch (e) {
  console.error("crashed:", e.message);
  await browser.close();
  process.exit(1);
}
