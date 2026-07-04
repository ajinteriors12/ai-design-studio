// Wardrobe Presentation Board: Board tab composes the sheet, 3D → 🖼 To Board sets a
// captured hero, and ⬇ Board PDF produces a valid PDF. 0 console errors.
import puppeteer from "puppeteer-core";
const CHROME = "C:/Users/hp/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe";
const B = "http://localhost:3000";
let pass = 0, fail = 0;
const ok = (n, c, e = "") => { console.log((c ? "PASS" : "FAIL") + " " + n + (e ? " — " + e : "")); c ? pass++ : fail++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clickByText = (page, re) => page.evaluate((o) => { const r = new RegExp(o.s, o.f); const b = [...document.querySelectorAll("button,summary,a,li")].find((x) => r.test(x.textContent || "")); if (b) { b.click(); return true; } return false; }, { s: re.source, f: re.flags });

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", protocol: "pipe", args: ["--no-sandbox", "--disable-dev-shm-usage", "--headless=new", "--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist"], timeout: 60000 });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 1300 });
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  // capture blob downloads (jsPDF blob → createObjectURL)
  await page.evaluateOnNewDocument(() => {
    window.__adsSaveSilent = true; window.__caught = null;
    const orig = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob) => { try { const fr = new FileReader(); fr.onload = () => { window.__caught = fr.result; }; fr.readAsDataURL(blob); } catch (e) {} return orig(blob); };
  });
  await page.goto(B + "/?dev=1", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("#root", { timeout: 10000 });
  let ready = false;
  for (let i = 0; i < 40; i++) { await sleep(300); if (await page.evaluate(() => /Wardrobe AI/.test(document.body.innerText))) { ready = true; break; } }
  ok("app interactive", ready);
  await clickByText(page, /🚪 Wardrobe AI/);
  let gen = false;
  for (let i = 0; i < 40; i++) { await sleep(500); gen = await page.evaluate(() => /Max Hanging|Balanced/.test(document.body.innerText)); if (gen) break; }
  ok("wardrobe generated", gen);
  await sleep(500);
  // Board tab
  ok("clicked 🖼 Board tab", await clickByText(page, /🖼 Board/));
  let board = false;
  for (let i = 0; i < 25; i++) { await sleep(400); board = await page.evaluate(() => { const s = [...document.querySelectorAll("svg")].find((x) => /3D PREVIEW/.test(x.textContent || "")); return !!s; }); if (board) break; }
  ok("board SVG composed (3D PREVIEW hero)", board);
  const parts = await page.evaluate(() => { const s = [...document.querySelectorAll("svg")].find((x) => /3D PREVIEW/.test(x.textContent || "")); const t = s ? s.textContent : ""; return { info: /PROJECT INFO/.test(t), top: /TOP VIEW/.test(t), side: /SIDE VIEW/.test(t), front: /FRONT ELEVATION/.test(t), mat: /BODY LAMINATE/.test(t) && /HANDLE/.test(t), pills: /MALE SECTION/.test(t) && /FEMALE SECTION/.test(t) }; });
  ok("board has PROJECT INFO + Top/Side/Front + Material + section pills", parts.info && parts.top && parts.side && parts.front && parts.mat && parts.pills, JSON.stringify(parts));

  // 3D → 🖼 To Board  (captured hero)
  ok("clicked 3D tab", await clickByText(page, /^3D$/));
  let canvas = false;
  for (let i = 0; i < 25; i++) { await sleep(400); canvas = await page.evaluate(() => !!document.querySelector("canvas")); if (canvas) break; }
  ok("3D canvas mounted", canvas);
  await sleep(1000);   // let a few frames render into the preserved buffer
  ok("clicked 🖼 To Board", await clickByText(page, /🖼 To Board/));
  let heroImg = false;
  for (let i = 0; i < 25; i++) { await sleep(400); heroImg = await page.evaluate(() => { const s = [...document.querySelectorAll("svg")].find((x) => /3D PREVIEW/.test(x.textContent || "")); return !!(s && s.querySelector("image")); }); if (heroImg) break; }
  ok("captured 3D render embedded as board hero <image>", heroImg);
  const heroNote = await page.evaluate(() => /Hero = your captured 3D render/.test(document.body.innerText));
  ok("board shows 'captured 3D render' note", heroNote);

  // Board PDF
  await page.evaluate(() => { window.__caught = null; });
  ok("clicked ⬇ Board PDF", await clickByText(page, /⬇ Board PDF/));
  let pdf = null;
  for (let i = 0; i < 40; i++) { await sleep(400); pdf = await page.evaluate(() => window.__caught); if (pdf) break; }
  ok("Board PDF produced (valid %PDF blob)", !!pdf && /^data:application\/pdf|^data:.*;base64,JVBER/.test(pdf), pdf ? pdf.slice(0, 40) : "none");

  ok("0 console errors", errors.length === 0, errors.slice(0, 3).join(" | "));
} finally { await browser.close(); }
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
