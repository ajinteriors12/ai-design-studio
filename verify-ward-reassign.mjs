// §8.2 wardrobe section reassignment: move a column across the Male/Female/Kids split.
import puppeteer from "puppeteer-core";
const CHROME = "C:/Users/hp/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe";
const B = "http://localhost:3000";
let pass = 0, fail = 0;
const ok = (n, c, e = "") => { console.log((c ? "PASS" : "FAIL") + " " + n + (e ? " — " + e : "")); c ? pass++ : fail++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const post = (p, b) => fetch(B + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) }).then((r) => r.json());
const clickByText = (page, re) => page.evaluate((o) => { const r = new RegExp(o.s, o.f); const b = [...document.querySelectorAll("button,summary,a,li")].find((x) => r.test(x.textContent || "")); if (b) { b.click(); return true; } return false; }, { s: re.source, f: re.flags });

// ---- API: the server tolerates a cross-section reassigned option and re-derives cleanly ----
{
  const data = (await post("/api/wardrobe/options", { maleUsers: 1, femaleUsers: 1, width: 2800, height: 2400, maleRatio: 50 })).data;
  const opt = JSON.parse(JSON.stringify(data.options[1]));
  const male = opt.sections.find((s) => s.kind === "male"), female = opt.sections.find((s) => s.kind === "female");
  const beforeMaleCols = male.columns.length, beforeFemaleCols = female.columns.length, totalCols = opt.stats.columns;
  ok("couple wardrobe has male + female sections", !!male && !!female && beforeMaleCols > 0);
  // move male's last column into female (mirror the client reassign)
  const moving = male.columns.pop();
  female.columns.push(moving);
  const cleaned = opt.sections.filter((s) => s.columns.length > 0);
  let xx = 0; cleaned.forEach((s) => { s.x = xx; s.width = s.columns.reduce((a, c) => a + c.w, 0); let cxx = xx; s.columns.forEach((c) => { c.x = cxx; cxx += c.w; }); xx += s.width; });
  opt.sections = cleaned;
  const re = (await post("/api/wardrobe/rerender", { option: opt })).data;
  ok("rerender returns a valid re-derived option", !!re && Array.isArray(re.sections) && !!re.reports && !!re.boq);
  const rMale = re.sections.find((s) => s.kind === "male"), rFemale = re.sections.find((s) => s.kind === "female");
  ok("male shrank, female grew by one column", rMale.columns.length === beforeMaleCols - 1 && rFemale.columns.length === beforeFemaleCols + 1);
  ok("total column count preserved", re.stats.columns === totalCols);
  ok("section widths still tile the full width", Math.abs(re.sections.reduce((a, s) => a + s.width, 0) - re.width) < 5, re.sections.reduce((a, s) => a + s.width, 0) + " vs " + re.width);
  ok("BOQ grand total present after reassignment", re.boq.grandTotal > 0);
}

// ---- UI: right-click a male column → "Move to Female section" ----
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", protocol: "pipe", args: ["--no-sandbox", "--disable-dev-shm-usage", "--headless=new", "--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist"], timeout: 60000 });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1400 });
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(B + "/?dev=1", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("#root", { timeout: 10000 });
  let ready = false;
  for (let i = 0; i < 40; i++) { await sleep(300); if (await page.evaluate(() => /Wardrobe AI/.test(document.body.innerText))) { ready = true; break; } }
  ok("app interactive", ready);
  await clickByText(page, /🚪 Wardrobe AI/);
  let gen = false;
  for (let i = 0; i < 40; i++) { await sleep(500); gen = await page.evaluate(() => /Max Hanging|Balanced/.test(document.body.innerText)); if (gen) break; }
  ok("wardrobe generated", gen);
  await sleep(600);
  // dispatch a native contextmenu on the leftmost (male) editor cell
  const opened = await page.evaluate(() => {
    // the editor lives in the ✏️ Edit panel — its svg has touchAction none + the cells carry cursor:context-menu
    const cells = [...document.querySelectorAll('svg rect[style*="context-menu"]')];
    if (!cells.length) return "no-cells";
    cells.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
    const r = cells[0].getBoundingClientRect();
    cells[0].dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
    return "dispatched";
  });
  ok("contextmenu dispatched on a male cell", opened === "dispatched", opened);
  await sleep(400);
  const hasMenu = await page.evaluate(() => /Move column to…/.test(document.body.innerText) && /Female section/.test(document.body.innerText));
  ok("context menu shows 'Move column to… → Female'", hasMenu);
  ok("clicked Move to Female section", await clickByText(page, /→ ♀ Female section/));
  let editedNote = false;
  for (let i = 0; i < 20; i++) { await sleep(300); editedNote = await page.evaluate(() => /Edited ·|Reset edits/.test(document.body.innerText)); if (editedNote) break; }
  ok("edit committed (Edited note / Reset button appears)", editedNote);
  ok("0 console errors", errors.length === 0, errors.slice(0, 3).join(" | "));
} finally { await browser.close(); }
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
