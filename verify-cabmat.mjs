// §2 per-cabinet material override — API correctness + headless UI (Paint mode + live re-skin).
import puppeteer from "puppeteer-core";
const CHROME = "C:/Users/hp/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe";
const B = "http://localhost:3000";
let pass = 0, fail = 0;
const ok = (n, c, e = "") => { console.log((c ? "PASS" : "FAIL") + " " + n + (e ? " — " + e : "")); c ? pass++ : fail++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const j = async (u, o) => (await fetch(B + u, o)).json();
const POST = (u, b) => j(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) });
const PUT = (u, b) => j(u, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) });
const clickByText = (page, re) => page.evaluate((o) => { const r = new RegExp(o.s, o.f); const b = [...document.querySelectorAll("button,summary,a,li")].find((x) => r.test(x.textContent || "")); if (b) { b.click(); return true; } return false; }, { s: re.source, f: re.flags });

// ── API correctness ──────────────────────────────────────────────────────────
const cat = await j("/api/materials?category=acrylic&limit=20");
const mats = (cat.data && cat.data.materials) || [];
const m1 = mats.find((m) => Number(m.customerRate) > 0) || mats[0];
ok("catalog material with rate found", !!(m1 && m1.code), m1 && (m1.brand + " " + m1.colorName));

const gen = await POST("/api/generate", { designType: "L-Shape Kitchen", wall: 2400, wallB: 1800 });
const id = gen.data && gen.data.id;
ok("generate returned id", !!id);

// find a real (non-filler) base cabinet index to target
const run0 = gen.data.runs[0];
const bi = run0.base.findIndex((c) => c.kind !== "filler" && c.kind !== "sidepanel" && c.kind !== "chimney" && c.kind !== "hob");
const CK = "base:0:" + bi;
ok("found a paintable base cabinet", bi >= 0, CK);

const q0 = await j("/api/designs/" + id + "/quote");
const total0 = q0.data.total;

const put = await PUT("/api/designs/" + id + "/material", { ...m1, scope: "cabinet", cabinetKey: CK });
ok("PUT scope:cabinet ok", !!(put.data && put.data.ok));
ok("cabinets map persisted", !!(put.data && put.data.scopes && put.data.scopes.cabinets && put.data.scopes.cabinets[CK]));

const bad = await PUT("/api/designs/" + id + "/material", { ...m1, scope: "cabinet", cabinetKey: "bogus" });
ok("invalid cabinetKey rejected (400)", !!bad.error);

const p1 = await j("/api/designs/" + id + "/production");
ok("cabinet schedule shows override colourName", p1.data.cabinetSchedule.some((r) => String(r[8] || "").includes(m1.colorName)));
ok("cut list face panel shows override material", p1.data.cutList.some((r) => String(r.material || "").includes(m1.colorName)));
ok("BOQ has a custom per-cabinet finish line", p1.data.boq.some((r) => /Custom · per-cabinet/.test(r.item) && r.item.includes(m1.colorName)));

const q1 = await j("/api/designs/" + id + "/quote");
const custom = q1.data.lines.find((l) => /Custom · per-cabinet/.test(l.item));
ok("quote has Custom per-cabinet finish line", !!custom, custom && ("₹" + custom.amount));
ok("quote total increased (override is billed)", q1.data.total > total0, total0 + " → " + q1.data.total);

// override survives a whole-unit (scope:all) write
await PUT("/api/designs/" + id + "/material", { ...m1, scope: "all" });
const afterAll = await j("/api/designs/" + id + "/material");
ok("override preserved across scope:all write", !!(afterAll.data && afterAll.data.cabinets && afterAll.data.cabinets[CK]));

// history snapshot captured the per-cabinet override (revert restores it)
const hist = await j("/api/designs/" + id + "/material-history");
ok("material history recorded the change", (hist.data || []).length > 0);

// clear the override
await PUT("/api/designs/" + id + "/material", { scope: "cabinet", cabinetKey: CK, clear: true });
const afterClr = await j("/api/designs/" + id + "/material");
ok("override cleared", !(afterClr.data && afterClr.data.cabinets && afterClr.data.cabinets[CK]));

// regression: a design with NO override produces the same quote shape (no Custom line)
const g2 = await POST("/api/generate", { designType: "Straight Kitchen", wall: 3000 });
const q2 = await j("/api/designs/" + g2.data.id + "/quote");
ok("no-override design has no Custom finish line (regression)", !q2.data.lines.some((l) => /Custom · per-cabinet/.test(l.item)));

// painted-cabinets list (review panel) + clear-all
const g3 = await POST("/api/generate", { designType: "L-Shape Kitchen", wall: 2400, wallB: 1800 });
const id3 = g3.data.id;
const bi3 = g3.data.runs[0].base.findIndex((c) => c.kind !== "filler" && c.kind !== "sidepanel" && c.kind !== "chimney" && c.kind !== "hob");
const wbi3 = (g3.data.runs[0].wallCabs || []).findIndex((c) => c.kind !== "filler" && c.kind !== "sidepanel" && c.kind !== "chimney");
await PUT("/api/designs/" + id3 + "/material", { ...m1, scope: "cabinet", cabinetKey: "base:0:" + bi3 });
if (wbi3 >= 0) await PUT("/api/designs/" + id3 + "/material", { ...m1, scope: "cabinet", cabinetKey: "wall:0:" + wbi3 });
const lst = await j("/api/designs/" + id3 + "/cabinet-materials");
ok("cabinet-materials lists every override", lst.data.length === (wbi3 >= 0 ? 2 : 1), lst.data.length + " listed");
ok("override rows carry a resolved label (not the raw key)", lst.data[0] && lst.data[0].label && !lst.data[0].label.includes(":"), lst.data[0] && lst.data[0].label);
await PUT("/api/designs/" + id3 + "/material", { ...m1, scope: "cabinet", cabinetKey: "base:0:" + bi3, clear: true });
ok("clearing one leaves the rest", (await j("/api/designs/" + id3 + "/cabinet-materials")).data.length === (wbi3 >= 0 ? 1 : 0));
await PUT("/api/designs/" + id3 + "/material", { scope: "cabinet", clearAll: true });
ok("clearAll wipes every override", (await j("/api/designs/" + id3 + "/cabinet-materials")).data.length === 0);

// ── headless UI: Paint mode + live 3D re-skin ─────────────────────────────────
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", protocol: "pipe", args: ["--no-sandbox", "--disable-dev-shm-usage", "--headless=new", "--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist"], timeout: 60000 });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1100 });
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(B + "/?dev=1", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("#root", { timeout: 10000 });
  let ready = false;
  for (let i = 0; i < 40; i++) { await sleep(300); if (await page.evaluate(() => /Generate Design|Generate \(AI/.test(document.body.innerText))) { ready = true; break; } }
  ok("app became interactive", ready);
  await sleep(400);
  await clickByText(page, /Generate Design|Generate \(AI/);
  let gen2 = false;
  for (let i = 0; i < 40; i++) { await sleep(500); gen2 = await page.evaluate(() => /📄 Spec Sheet/.test(document.body.innerText)); if (gen2) break; }
  ok("design generated in UI", gen2);

  // switch to the 3D view so the toolbar (and Room3D scene) is active
  await clickByText(page, /^🧊 3D$|3D View|\b3D\b/);
  await sleep(1500);
  // the Paint-cabinet button exists and toggles paint mode
  ok("Paint cabinet button present", await page.evaluate(() => /Paint cabinet/.test(document.body.innerText)));
  await clickByText(page, /🖌 Paint cabinet/);
  let painting = false;
  for (let i = 0; i < 12; i++) { await sleep(200); painting = await page.evaluate(() => typeof window.__adsPaintMode === "function" && window.__adsPaintMode() === true); if (painting) break; }
  ok("toggling Paint flips paint mode ON", painting);
  await clickByText(page, /🖌 Painting/);
  await sleep(300);
  ok("toggling again turns paint mode OFF", await page.evaluate(() => window.__adsPaintMode() === false));

  // prove the live scene ingests a per-cabinet override: pick the open design, PUT an override, fire the bus
  const openId = await page.evaluate(async () => { const r = await fetch("/api/designs"); const j = await r.json(); return (j.data && j.data[0] && j.data[0].id) || null; });
  ok("read the open design id", !!openId);
  const before = await page.evaluate(() => (typeof window.__adsCabMatN === "function" ? window.__adsCabMatN() : -1));
  await page.evaluate(async (o) => {
    await fetch("/api/designs/" + o.id + "/material", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...o.m, scope: "cabinet", cabinetKey: "base:0:" + o.bi }) });
    window.dispatchEvent(new CustomEvent("ads-material", { detail: { designId: o.id } }));
  }, { id: openId, m: m1, bi: Math.max(0, bi) });
  let skinned = false;
  for (let i = 0; i < 20; i++) { await sleep(300); skinned = await page.evaluate(() => window.__adsCabMatN() >= 1); if (skinned) break; }
  ok("live 3D scene ingested the per-cabinet override", skinned, "before=" + before);

  // the Material Catalog shows the "Painted cabinets" review panel for the override we just applied
  await clickByText(page, /🎨 Material Catalog/);
  let panel = false;
  for (let i = 0; i < 20; i++) { await sleep(300); panel = await page.evaluate(() => /Painted cabinets \(\d+\)/.test(document.body.innerText)); if (panel) break; }
  ok("Painted cabinets review panel lists the override", panel);
  // clear-all empties the panel
  await clickByText(page, /Clear all/);
  let gone = false;
  for (let i = 0; i < 16; i++) { await sleep(300); gone = await page.evaluate(() => !/Painted cabinets \(/.test(document.body.innerText)); if (gone) break; }
  ok("Clear all removes the painted-cabinets panel", gone);

  ok("no console/page errors during UI flow", errors.length === 0, errors.slice(0, 3).join(" | "));
} finally { await browser.close(); }

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
