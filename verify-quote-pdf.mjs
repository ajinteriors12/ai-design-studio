// UI test: branded PDF quotation export (⬇ quote PDF) from StructurePanel's
// Estimate block. Captures the saved file via CDP download interception.
import puppeteer from "puppeteer-core";
import fs from "fs";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const B = "http://localhost:3000";
let pass = 0, fail = 0;
const ok = (n, c, e = "") => { console.log((c ? "✅" : "❌") + " " + n + (e ? " — " + e : "")); c ? pass++ : fail++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clickByText = (page, re) => page.evaluate((o) => { const r = new RegExp(o.s, o.f); const b = [...document.querySelectorAll("button,summary,a")].find((x) => r.test(x.textContent || "")); if (b) { b.click(); return true; } return false; }, { s: re.source, f: re.flags });

const dir = process.cwd();
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1100 });
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  const client = await page.target().createCDPSession();
  await client.send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: dir });

  await page.goto(B + "/?dev=1", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("#root", { timeout: 10000 });
  await page.evaluate(() => { window.__adsSaveSilent = true; });   // bypass the Save-As picker → plain download
  await sleep(600);
  await clickByText(page, /generate design/i);
  await sleep(2600);
  await page.evaluate(() => { window.__adsSaveSilent = true; });
  await clickByText(page, /Structure & production jobs/);
  await sleep(900);

  // the quote loads on panel mount; wait for the ⬇ quote PDF button to render
  let hasBtn = false;
  for (let i = 0; i < 16; i++) { await sleep(400); hasBtn = await page.evaluate(() => [...document.querySelectorAll("button")].some((b) => /⬇ quote PDF/.test(b.textContent || ""))); if (hasBtn) break; }
  ok("⬇ quote PDF button present", hasBtn);

  const before = new Set(fs.readdirSync(dir).filter((f) => f.endsWith(".pdf")));
  await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => /⬇ quote PDF/.test(x.textContent || "")); if (b) b.click(); });
  let saved = null;
  for (let i = 0; i < 18; i++) {
    await sleep(500);
    const fresh = fs.readdirSync(dir).filter((f) => f.endsWith(".pdf") && !before.has(f) && !f.endsWith(".crdownload"));
    if (fresh.length) { saved = fresh[0]; break; }
  }
  ok("a new quotation PDF file was written", !!saved, saved || "none");

  if (saved) {
    const buf = fs.readFileSync(dir + "/" + saved);
    ok("file name looks like a quotation", /quotation\.pdf$/.test(saved), saved);
    ok("file name is properly slugged (not all underscores)", /^[A-Za-z0-9][\w-]*-quotation\.pdf$/.test(saved), saved);
    ok("file is a valid PDF (%PDF- header)", buf.slice(0, 5).toString() === "%PDF-");
    ok("PDF is non-trivial size (> 2 KB)", buf.length > 2048, buf.length + " bytes");
    try { fs.unlinkSync(dir + "/" + saved); } catch {}
  }

  ok("no console errors throughout", errors.length === 0, errors.slice(0, 2).join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
} catch (e) {
  console.error("crashed:", e.message);
  await browser.close();
  process.exit(1);
}
