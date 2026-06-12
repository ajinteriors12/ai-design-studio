// UI + API test: 🧾 Bill To / client details — persisted per design and flowed
// into the quotation CSV (and the quote/proposal PDFs).
import puppeteer from "puppeteer-core";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const B = "http://localhost:3000";
let pass = 0, fail = 0;
const ok = (n, c, e = "") => { console.log((c ? "✅" : "❌") + " " + n + (e ? " — " + e : "")); c ? pass++ : fail++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clickByText = (page, re) => page.evaluate((o) => { const r = new RegExp(o.s, o.f); const b = [...document.querySelectorAll("button,summary,a")].find((x) => r.test(x.textContent || "")); if (b) { b.click(); return true; } return false; }, { s: re.source, f: re.flags });
const post = (path, body) => fetch(B + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) }).then((r) => r.json());
const put = (path, body) => fetch(B + path, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) }).then((r) => r.json());
const setInput = (page, placeholder, value) => page.evaluate((o) => {
  const i = [...document.querySelectorAll("input")].find((x) => x.placeholder === o.p);
  if (i) { const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set; set.call(i, o.v); i.dispatchEvent(new Event("input", { bubbles: true })); return true; }
  return false;
}, { p: placeholder, v: value });

// ---- API ----
const gen = await post("/api/generate", { designType: "L-Shape Kitchen", wall: 3600, wallB: 2400 });
const id = gen.data && gen.data.id;
ok("generated design", !!id);
const w = await put("/api/designs/" + id + "/client", { name: "Rahul Sharma", phone: "+91 98765 43210", site: "B-12 Green Park, Delhi", ref: "Q-2026-014" });
ok("PUT client returns saved record", !!(w.data && w.data.ok && w.data.client.name === "Rahul Sharma"));
const g = await fetch(B + "/api/designs/" + id + "/client").then((r) => r.json());
ok("GET client persists the fields", g.data.name === "Rahul Sharma" && g.data.ref === "Q-2026-014");
const csv = await fetch(B + "/api/designs/" + id + "/quote.csv").then((r) => r.text());
ok("quote.csv embeds the Bill To block", /Bill To,"Rahul Sharma"/.test(csv) && /Quote Ref,"Q-2026-014"/.test(csv));
ok("comma in site address is CSV-escaped", /Site,"B-12 Green Park, Delhi"/.test(csv));
ok("only declared fields persist (no injection of stray keys)", Object.keys(g.data).every((k) => ["name", "phone", "email", "site", "ref", "notes"].includes(k)));

// ---- UI ----
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1100 });
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  let uiId = null;
  page.on("request", (rq) => { const m = rq.url().match(/\/api\/designs\/([0-9a-f-]{8,})\/client/); if (m) uiId = m[1]; });

  await page.goto(B + "/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("#root", { timeout: 10000 });
  await sleep(600);
  await clickByText(page, /generate design/i);
  await sleep(2600);
  await clickByText(page, /Structure & production jobs/);
  await sleep(900);
  await clickByText(page, /🧾 Bill To/);
  await sleep(400);
  ok("Bill To form present", await page.evaluate(() => [...document.querySelectorAll("input")].some((i) => i.placeholder === "Client name")));
  ok("captured UI design id", !!uiId, uiId || "none");

  await setInput(page, "Client name", "Anjali Verma");
  await setInput(page, "Quote ref", "Q-2026-099");
  await clickByText(page, /^Save$/);
  // confirm it persisted server-side
  let persisted = false;
  for (let i = 0; i < 16; i++) { await sleep(400); if (!uiId) continue; const j = await fetch(B + "/api/designs/" + uiId + "/client").then((r) => r.json()).catch(() => ({})); if (j.data && j.data.name === "Anjali Verma" && j.data.ref === "Q-2026-099") { persisted = true; break; } }
  ok("Save persists the typed Bill To via PUT", persisted);
  ok("summary chip shows the saved client name", await page.evaluate(() => /🧾 Bill To \/ client details\s*—\s*Anjali Verma/.test(document.body.innerText)));

  ok("no console errors throughout", errors.length === 0, errors.slice(0, 2).join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
} catch (e) {
  console.error("crashed:", e.message);
  await browser.close();
  process.exit(1);
}
