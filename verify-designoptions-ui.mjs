// verify-designoptions-ui.mjs — the universal "3 Balanced Options" comparison UI:
// button → modal with 3 option cards + recommendation + full comparison table → "Use this design".
import puppeteer from "puppeteer-core";
const CHROME = "C:\\Users\\hp\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe";
const B = "http://localhost:3000";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok  " + m); } else { fail++; console.log("FAIL  " + m); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clickByText = (page, txt) => page.evaluate((t) => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent.includes(t)); if (b) { b.click(); return true; } return false; }, txt);

const b = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist", "--no-sandbox"] });
const pg = await b.newPage();
let errs = 0; pg.on("pageerror", (e) => { errs++; console.log("  pageerror: " + String(e).slice(0, 120)); });
await pg.goto(B + "/?dev=1", { waitUntil: "domcontentloaded" });
// wait for Generator interactivity
for (let i = 0; i < 40; i++) { const rdy = await pg.evaluate(() => [...document.querySelectorAll("button")].some((x) => x.textContent.includes("Generate 3 Balanced Options"))); if (rdy) break; await sleep(500); }
ok(await pg.evaluate(() => [...document.querySelectorAll("button")].some((x) => x.textContent.includes("Generate 3 Balanced Options"))), "3-options button present in Generator");

await clickByText(pg, "Generate 3 Balanced Options");
// wait for modal + its 3 option cards to paint (3 large plan SVGs take a tick)
let cards = 0;
for (let i = 0; i < 40; i++) { cards = await pg.evaluate(() => { const g = document.querySelector(".grid.md\\:grid-cols-3.gap-3"); return g ? g.children.length : 0; }); if (cards >= 3) break; await sleep(500); }
ok(await pg.evaluate(() => document.body.textContent.includes("3 Balanced Design Options")), "comparison modal opened");
ok(await pg.evaluate(() => document.body.textContent.includes("AI recommends")), "recommendation shown");
ok(cards === 3, "all 3 option cards present (" + cards + ")");
const svgCards = await pg.evaluate(() => { const g = document.querySelector(".grid.md\\:grid-cols-3.gap-3"); return g ? [...g.children].filter((d) => d.querySelector("svg")).length : 0; });
ok(svgCards >= 3, "each option renders a plan SVG (" + svgCards + " svg cards)");
ok(await pg.evaluate(() => document.body.textContent.includes("Balanced Premium") && document.body.textContent.includes("Balanced Functional")), "option labels present");
ok(await pg.evaluate(() => document.body.textContent.includes("Plywood utilisation") && document.body.textContent.includes("Edge banding") && document.body.textContent.includes("AI design rating")), "comparison table has the metric rows");
const useBtns = await pg.evaluate(() => [...document.querySelectorAll("button")].filter((x) => x.textContent.trim() === "Use this design").length);
ok(useBtns === 3, "each card has a Use-this-design action (" + useBtns + ")");

// choose an option → modal closes, main result renders
await pg.evaluate(() => { const btn = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "Use this design"); btn && btn.click(); });
let closed = false;
for (let i = 0; i < 20; i++) { closed = await pg.evaluate(() => !document.querySelector(".fixed.inset-0")); if (closed) break; await sleep(400); }
ok(closed, "modal closes after choosing an option");
await sleep(1500);
ok(await pg.evaluate(() => document.body.textContent.includes("Confidence Scorecard") || document.body.textContent.includes("Cutting List")), "chosen design renders in the main view");
ok(errs === 0, "no page JS errors (" + errs + ")");

await b.close();
console.log("\n" + pass + "/" + (pass + fail) + " passed" + (fail ? " · " + fail + " FAILED" : ""));
process.exit(fail ? 1 : 0);
