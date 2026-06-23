// UI test: 📄 Spec Sheet button → preview modal renders the presentation SVG, 0 console errors.
import puppeteer from "puppeteer-core";
const CHROME = "C:/Users/hp/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe";
const B = "http://localhost:3000";
let pass = 0, fail = 0;
const ok = (n, c, e = "") => { console.log((c ? "PASS" : "FAIL") + " " + n + (e ? " — " + e : "")); c ? pass++ : fail++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clickByText = (page, re) => page.evaluate((o) => { const r = new RegExp(o.s, o.f); const b = [...document.querySelectorAll("button,summary,a,li")].find((x) => r.test(x.textContent || "")); if (b) { b.click(); return true; } return false; }, { s: re.source, f: re.flags });

// API smoke — every type (incl. the new Mandir / Wall Panel) returns a valid presentation sheet.
const post = (p, b) => fetch(B + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) }).then((r) => r.json());
for (const t of ["L-Shape Kitchen", "U-Shape Kitchen", "Wardrobe", "Vanity Unit", "LCD/TV Panel", "Crockery Unit", "Mandir", "Wall Panel"]) {
  const d = (await post("/api/generate", { designType: t, wall: 1500, wallB: 2100 })).data;
  const r = await fetch(B + "/api/designs/" + d.id + "/spec-sheet.svg?inline=1");
  const svg = await r.text();
  ok("spec sheet — " + t, r.status === 200 && svg.startsWith("<svg") && /MATERIAL PALETTE/.test(svg) && /SPECIFICATIONS/.test(svg));
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", protocol: "pipe", args: ["--no-sandbox", "--disable-dev-shm-usage", "--headless=new", "--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist"], timeout: 60000 });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1100 });
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(B + "/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("#root", { timeout: 10000 });
  let ready = false;
  for (let i = 0; i < 40; i++) { await sleep(300); if (await page.evaluate(() => /Generate Design|Generate \(AI/.test(document.body.innerText))) { ready = true; break; } }
  ok("app became interactive", ready);
  await sleep(400);
  ok("clicked Generate", await clickByText(page, /Generate Design|Generate \(AI/));
  let gen = false;
  for (let i = 0; i < 40; i++) { await sleep(500); gen = await page.evaluate(() => /📄 Spec Sheet/.test(document.body.innerText)); if (gen) break; }
  ok("design generated — '📄 Spec Sheet' button visible", gen);

  ok("clicked Spec Sheet", await clickByText(page, /📄 Spec Sheet/));
  let modal = false;
  for (let i = 0; i < 25; i++) { await sleep(400); modal = await page.evaluate(() => /Presentation Spec Sheet/.test(document.body.innerText)); if (modal) break; }
  ok("preview modal opens", modal);
  const svgInfo = await page.evaluate(() => {
    const overlay = [...document.querySelectorAll("div")].find((d) => /Presentation Spec Sheet/.test(d.textContent || "") && d.querySelector("svg"));
    const svg = overlay && overlay.querySelector("svg");
    return { hasSvg: !!svg, w: svg ? svg.getAttribute("width") : null, pal: svg ? /MATERIAL PALETTE/.test(svg.textContent || "") : false, det: svg ? /DETAILING DRAWINGS/.test(svg.textContent || "") : false, spec: svg ? /SPECIFICATIONS/.test(svg.textContent || "") : false };
  });
  ok("modal contains spec-sheet SVG", svgInfo.hasSvg, "width=" + svgInfo.w);
  ok("SVG has MATERIAL PALETTE", svgInfo.pal);
  ok("SVG has DETAILING DRAWINGS", svgInfo.det);
  ok("SVG has SPECIFICATIONS", svgInfo.spec);
  await clickByText(page, /✕ Close/);
  await sleep(300);
  ok("modal closes", await page.evaluate(() => !/Presentation Spec Sheet/.test(document.body.innerText)));
  ok("no console/page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
} finally { try { await browser.close(); } catch (e) { /* pipe-protocol close can throw on Windows — teardown only, ignore */ } }
console.log("\nRESULT " + pass + "/" + (pass + fail) + " passed");
process.exit(fail ? 1 : 0);
