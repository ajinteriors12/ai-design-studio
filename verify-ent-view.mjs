// UI test: #4 inline render-result viewer (👁 view shows the artifact in the StructurePanel).
import puppeteer from "puppeteer-core";
import { deflateSync } from "zlib";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const B = "http://localhost:3000";
let pass = 0, fail = 0;
const ok = (n, c, e = "") => { console.log((c ? "✅" : "❌") + " " + n + (e ? " — " + e : "")); c ? pass++ : fail++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clickByText = (page, re) => page.evaluate((o) => { const r = new RegExp(o.s, o.f); const b = [...document.querySelectorAll("button,summary")].find((x) => r.test(x.textContent || "")); if (b) { b.click(); return true; } return false; }, { s: re.source, f: re.flags });
// tiny valid PNG (RGBA) so the render job has a real structure frame to pass through
function crc32(b) { let c = ~0; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; }
function chunk(t, d) { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const ty = Buffer.from(t, "ascii"); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc32(Buffer.concat([ty, d]))); return Buffer.concat([l, ty, d, cr]); }
function png(w, h) { const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6; const st = w * 4 + 1, raw = Buffer.alloc(st * h); for (let y = 0; y < h; y++) { for (let x = 0; x < w; x++) { const o = y * st + 1 + x * 4; raw[o] = 120; raw[o + 1] = 180; raw[o + 2] = 90; raw[o + 3] = 255; } } return "data:image/png;base64," + Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ih), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]).toString("base64"); }

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1000 });
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  let designId = null;
  page.on("request", (req) => { const m = req.url().match(/render\/jobs\?design=([\w-]+)/); if (m) designId = m[1]; });

  await page.goto(B + "/?dev=1", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("#root", { timeout: 10000 });
  await sleep(600);
  await clickByText(page, /generate design/i);
  await sleep(2500);
  // open the Structure panel → triggers the jobs fetch that reveals the design id
  await clickByText(page, /Structure & production jobs/);
  await sleep(1200);
  ok("captured design id from jobs poll", !!designId, designId || "");

  // enqueue an instant passthrough render job (photoreal:false) for THIS design via API
  const enq = await fetch(B + "/api/designs/" + designId + "/3d/render", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: png(16, 16), photoreal: false }) }).then((r) => r.json());
  ok("render job enqueued for UI design", !!(enq.data && enq.data.jobId), enq.data && enq.data.jobId);

  // wait for the panel to auto-poll + show a done job with the 👁 view button
  let hasView = false;
  for (let i = 0; i < 16; i++) { await sleep(700); hasView = await page.evaluate(() => [...document.querySelectorAll("button")].some((b) => /👁 view/.test(b.textContent || ""))); if (hasView) break; }
  ok("#4 done job shows 👁 view button", hasView);

  // click view → an <img> pointing at the artifact /file should appear
  await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => /👁 view/.test(x.textContent || "")); if (b) b.click(); });
  await sleep(800);
  const imgOk = await page.evaluate(() => { const im = [...document.querySelectorAll("img")].find((x) => /\/api\/render\/jobs\/.+\/file/.test(x.src)); return !!im && im.complete && im.naturalWidth > 0; });
  ok("#4 inline viewer renders the artifact image", imgOk);

  ok("no console errors throughout", errors.length === 0, errors.slice(0, 2).join(" | "));

  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
} catch (e) {
  console.error("crashed:", e.message);
  await browser.close();
  process.exit(1);
}
