// UI + API test: 💰 priced quotation (rate-card × BOQ → INR) in StructurePanel.
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
  await page.setViewport({ width: 1400, height: 1100 });
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  let designId = null;
  page.on("request", (rq) => { const m = rq.url().match(/\/api\/designs\/([0-9a-f-]{8,})\/quote/); if (m) designId = m[1]; });

  await page.goto(B + "/?dev=1", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("#root", { timeout: 10000 });
  await sleep(600);
  await clickByText(page, /generate design/i);
  await sleep(2500);
  await clickByText(page, /Structure & production jobs/);
  await sleep(900);

  ok("Estimate section present", await page.evaluate(() => /💰 Estimate/.test(document.body.innerText)));
  // headline total badge renders a rupee figure
  let hasTotal = false;
  for (let i = 0; i < 14; i++) { await sleep(400); hasTotal = await page.evaluate(() => /₹[\d,]+\s*incl\. GST/.test(document.body.innerText)); if (hasTotal) break; }
  ok("headline ₹ total (incl. GST) shown", hasTotal);
  ok("captured design id from /quote request", !!designId, designId || "none");

  // line-item table with a Total row
  ok("quotation table has Subtotal + GST + Total rows", await page.evaluate(() => { const t = document.body.innerText; return /Subtotal/.test(t) && /GST \(\d+%\)/.test(t) && /Total/.test(t); }));

  // read the displayed total, bump margin via React native setter, recalc, expect higher total
  const totBefore = await page.evaluate(() => { const m = document.body.innerText.match(/₹([\d,]+)\s*incl\. GST/); return m ? Number(m[1].replace(/,/g, "")) : 0; });
  await page.evaluate(() => {
    const lbl = [...document.querySelectorAll("label")].find((l) => /margin %/.test(l.textContent || ""));
    const i = lbl && lbl.querySelector("input");
    if (i) { const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set; set.call(i, "45"); i.dispatchEvent(new Event("input", { bubbles: true })); }
  });
  await clickByText(page, /Recalculate/);
  let totAfter = totBefore;
  for (let i = 0; i < 16; i++) { await sleep(400); totAfter = await page.evaluate(() => { const m = document.body.innerText.match(/₹([\d,]+)\s*incl\. GST/); return m ? Number(m[1].replace(/,/g, "")) : 0; }); if (totAfter > totBefore) break; }
  ok("raising margin to 45% increases the total", totAfter > totBefore, `before=${totBefore} after=${totAfter}`);

  // API-level invariants (deterministic, no key)
  if (designId) {
    const q1 = await fetch(B + "/api/designs/" + designId + "/quote").then((r) => r.json());
    const q2 = await fetch(B + "/api/designs/" + designId + "/quote").then((r) => r.json());
    ok("GET /quote is deterministic (identical twice)", JSON.stringify(q1.data) === JSON.stringify(q2.data));
    const q = q1.data;
    ok("invariant total == subtotal + margin + gst", q.total === q.subtotal + q.margin + q.gst, `${q.total} vs ${q.subtotal + q.margin + q.gst}`);
    ok("every line amount == qty × rate (rounded)", q.lines.every((l) => l.amount === Math.round(l.qty * l.rate)));
    const csv = await fetch(B + "/api/designs/" + designId + "/quote.csv");
    const body = await csv.text();
    ok("quote.csv → 200 text/csv with Total row", csv.status === 200 && /csv/.test(csv.headers.get("content-type") || "") && /Total,/.test(body));
  } else {
    ok("API invariants (skipped — no design id)", false);
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
