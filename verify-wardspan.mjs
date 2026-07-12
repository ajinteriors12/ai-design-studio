// Verify §2 cross-partition span — a shelf/drawer inserted across N adjacent columns as ONE wide unit
// (span/covered model). Driven via window.__adsWardInsertAt(si,ci,k,clickMM,arg,{span,overwrite}).
// Asserts: overwrite span makes the master span=N with a matching covered band in each spanned column at
// the same height (column totals preserved); safe span never corrupts (totals preserved, no orphan band);
// the Span-cols selector markup shipped; zero console errors.
import puppeteer from "puppeteer-core";
const CHROME = "C:\\Users\\hp\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe";
const B = "http://127.0.0.1:3000";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  PASS " + m); } else { fail++; console.log("  FAIL " + m); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const errs = [];
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage();
page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
page.on("pageerror", (e) => errs.push(String(e)));

await page.goto(B + "/?dev=1&tab=Wardrobe%20AI", { waitUntil: "domcontentloaded" });
for (let i = 0; i < 40; i++) { if (await page.evaluate(() => /Wardrobe AI/.test(document.body.innerText))) break; await sleep(500); }
await page.evaluate(() => { const b = [...document.querySelectorAll("button,a,div")].find((e) => /Wardrobe AI/.test(e.textContent) && e.textContent.length < 40); if (b) b.click(); });
await sleep(800);
await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((e) => /Generate/i.test(e.textContent)); if (b) b.click(); });
for (let i = 0; i < 40; i++) { if (await page.evaluate(() => typeof window.__adsWardInsertAt === "function")) break; await sleep(600); }
await sleep(2000);
ok(await page.evaluate(() => typeof window.__adsWardInsertAt === "function"), "editor mounted + insert hook available");

// 1. OVERWRITE span across 2 columns — master.span=2, matching covered band in the neighbour, totals kept
const t1 = await page.evaluate(() => {
  const secs = window.__adsWardSecs();
  for (let si = 0; si < secs.length; si++) { const cols = secs[si].columns; if (cols.length < 2) continue; const ci = 0, cells = cols[ci].cells; let bot = 0; for (let k = 0; k < cells.length; k++) { const top = bot + cells[k].hMM; if (!cells[k].covered && !cells[k].locked && cells[k].hMM >= 300) { const before = cols[ci + 1].cells.reduce((a, c) => a + c.hMM, 0); const r = window.__adsWardInsertAt(si, ci, k, Math.round(bot + 250), "shelf", { span: 2, overwrite: true }); return { r, si, ci, nbBefore: before }; } bot = top; } }
  return null;
});
await sleep(900);
ok(t1 && t1.r, "found a 2+ column section and inserted a span-2 shelf (overwrite) " + JSON.stringify(t1 && t1.r));
const c1 = t1 && t1.r && await page.evaluate((t) => {
  const secs = window.__adsWardSecs(); const col = secs[t.r.si].columns[t.r.ci]; const master = col.cells[t.r.k]; const nb = secs[t.r.si].columns[t.r.ci + 1].cells;
  const cov = nb.find((c) => c.covered && c.mergeId === master.mergeId);
  return { span: master.span, mid: master.mergeId, mh: master.hMM, kind: master.kind, covH: cov ? cov.hMM : null, covKind: cov ? cov.kind : null, totM: col.cells.reduce((a, c) => a + c.hMM, 0), totN: nb.reduce((a, c) => a + c.hMM, 0), nbBefore: t.nbBefore };
}, t1);
ok(c1 && c1.span === 2, "master compartment spans 2 columns (span=" + (c1 && c1.span) + ")");
ok(c1 && c1.covH === c1.mh && c1.covKind === c1.kind, "neighbour has a matching covered band (h=" + (c1 && c1.covH) + " vs master " + (c1 && c1.mh) + ", kind " + (c1 && c1.covKind) + ")");
ok(c1 && Math.abs(c1.totM - c1.totN) <= 2, "both columns keep the same total height (" + (c1 && c1.totM) + " / " + (c1 && c1.totN) + ")");
ok(c1 && Math.abs(c1.totN - c1.nbBefore) <= 2, "neighbour column total unchanged by the span (" + (c1 && c1.nbBefore) + "→" + (c1 && c1.totN) + ")");

// 1b. Resizing the spanned master (double-click mm) propagates to the covered twin live
if (c1 && c1.span === 2) {
  const newH = c1.mh - 50;
  await page.evaluate((t, h) => window.__adsWardSetH(t.r.si, t.r.ci, t.r.k, h), t1, newH);
  await sleep(700);
  const c1b = await page.evaluate((t) => { const secs = window.__adsWardSecs(); const col = secs[t.r.si].columns[t.r.ci]; const master = col.cells[t.r.k]; const nb = secs[t.r.si].columns[t.r.ci + 1].cells; const cov = nb.find((c) => c.covered && c.mergeId === master.mergeId); return { mh: master.hMM, covH: cov ? cov.hMM : null, totM: col.cells.reduce((a, c) => a + c.hMM, 0), totN: nb.reduce((a, c) => a + c.hMM, 0) }; }, t1);
  ok(Math.abs(c1b.mh - newH) <= 1 && c1b.covH === c1b.mh, "resizing the spanned master updates the covered twin live (master " + c1b.mh + ", twin " + c1b.covH + ")");
  ok(Math.abs(c1b.totM - c1b.totN) <= 2, "spanned resize keeps both column totals equal (" + c1b.totM + "/" + c1b.totN + ")");
} else { ok(true, "span-resize test skipped (no span master)"); ok(true, "(skipped)"); }

// 2. SAFE span never corrupts — pick another column pair; whether it applies or refuses, totals stay equal
const t2 = await page.evaluate(() => {
  const secs = window.__adsWardSecs();
  for (let si = secs.length - 1; si >= 0; si--) { const cols = secs[si].columns; if (cols.length < 2) continue; const ci = cols.length - 2, cells = cols[ci].cells; let bot = 0; for (let k = 0; k < cells.length; k++) { const top = bot + cells[k].hMM; if (!cells[k].covered && !cells[k].locked && cells[k].hMM >= 300) { const r = window.__adsWardInsertAt(si, ci, k, Math.round(bot + 250), "shelf", { span: 2, overwrite: false }); return { r, si, ci }; } bot = top; } }
  return null;
});
await sleep(900);
if (t2 && t2.r) {
  const c2 = await page.evaluate((t) => { const secs = window.__adsWardSecs(); const col = secs[t.r.si].columns[t.r.ci]; const master = col.cells[t.r.k]; const nb = secs[t.r.si].columns[t.r.ci + 1].cells; const cov = nb.filter((c) => c.covered && c.mergeId === master.mergeId); return { span: master.span || 1, orphan: cov.length, applied: master.span === 2, totM: col.cells.reduce((a, c) => a + c.hMM, 0), totN: nb.reduce((a, c) => a + c.hMM, 0) }; }, t2);
  ok(Math.abs(c2.totM - c2.totN) <= 2, "safe span left both columns consistent (applied=" + c2.applied + ", totals " + c2.totM + "/" + c2.totN + ")");
  ok(c2.applied ? c2.orphan === 1 : c2.orphan === 0, "safe span is all-or-nothing — no orphan covered band when refused (applied=" + c2.applied + ", bands=" + c2.orphan + ")");
} else { ok(true, "no second column pair available for the safe-span test — acceptable"); ok(true, "(skipped orphan check)"); }

// 3. Span-cols selector markup shipped
const wired = await page.evaluate(async () => { try { const r = await fetch("/?dev=1"); const html = await r.text(); return /Span cols/.test(html) && /overwrite/.test(html); } catch (e) { return false; } });
ok(wired, "Span-cols selector + overwrite toggle markup present in the client");

ok(errs.length === 0, "zero console/page errors" + (errs.length ? " — " + errs.slice(0, 3).join(" | ") : ""));

await browser.close();
console.log("\n" + (fail === 0 ? "ALL PASSED" : "FAILURES") + " — " + pass + " pass / " + fail + " fail");
process.exit(fail === 0 ? 0 : 1);
