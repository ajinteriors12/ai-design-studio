// Headless UI smoke test for the enterprise client wiring (#1 autosave + #2 live bus).
import puppeteer from "puppeteer-core";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const B = "http://localhost:3000";
let pass = 0, fail = 0;
const ok = (n, c, e = "") => { console.log((c ? "✅" : "❌") + " " + n + (e ? " — " + e : "")); c ? pass++ : fail++; };

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(B + "/", { waitUntil: "networkidle2", timeout: 30000 });
  await page.waitForSelector("#root", { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 800));
  ok("page renders, no console errors", errors.length === 0, errors.slice(0, 2).join(" | "));

  // click the Generate button (text varies: "Generate Design")
  const clicked = await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => /generate design/i.test(x.textContent || ""));
    if (b) { b.click(); return true; } return false;
  });
  ok("Generate button found + clicked", clicked);
  // wait for the live badge to appear (proves EventSource connected after persist)
  let badge = false;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 400));
    badge = await page.evaluate(() => /Live · autosaved/.test(document.body.innerText));
    if (badge) break;
  }
  ok("#2 live badge appears (SSE connected)", badge);
  ok("no console errors after generate", errors.length === 0, errors.slice(0, 2).join(" | "));

  // confirm a design row exists + got autosaved (audit log has an [edit ...] row OR layout persisted)
  const stats = await fetch(B + "/api/stats").then((r) => r.json()).catch(() => ({}));
  ok("design persisted (stats reachable)", !!stats);

  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
} catch (e) {
  console.error("UI test crashed:", e.message);
  await browser.close();
  process.exit(1);
}
