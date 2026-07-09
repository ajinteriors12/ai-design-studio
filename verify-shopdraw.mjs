// verify-shopdraw.mjs — checks the wardrobe "Shop Drawing" fully-dimensioned front elevation:
// server view present + valid SVG + ft-in dims/thada/profile-light, and rasterizes it to a PNG.
import puppeteer from "puppeteer-core";
import fs from "fs";
const CHROME = "C:\\Users\\hp\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe";
const B = "http://localhost:3000";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok  " + m); } else { fail++; console.log("FAIL  " + m); } };

const body = { maleUsers: 1, femaleUsers: 1, children: 0, professionals: 1, width: 1830, height: 2740, depth: 600, traditional: 40, western: 60, winter: 30, luxury: "medium" };
const res = await fetch(B + "/api/wardrobe/options", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const j = await res.json();
const opt = j.data.options[0];
const sd = opt.views["Shop Drawing"];
ok(!!sd, "Shop Drawing view exists");
ok(sd.startsWith("<svg"), "valid SVG root");
ok(/all dimensions in mm/.test(sd) && !/'-/.test(sd) && !/\d'/.test(sd), "shop drawing dimensioned in mm (no feet-inches)");
ok(/THADA/.test(sd), "thada labelled");
ok(/PROFILE/.test(sd), "profile-light annotation");
ok(/FRONT ELEVATION/.test(sd), "title present");
ok((sd.match(/rotate\(-90/g) || []).length >= 4, "vertical dim chain (rotated ticks)");
// Shutters ⇄ Open side-by-side view (all mm)
const shut = opt.views["Shutters"];
ok(!!shut && shut.startsWith("<svg"), "Shutters (with/without) view exists");
ok(/WITH SHUTTERS/.test(shut) && /WITHOUT SHUTTERS/.test(shut), "shows both closed + internal elevations");
ok(/all dimensions in mm/.test(shut) && !/'-/.test(shut), "measurements in mm (no feet-inches)");
// also confirm rerender keeps them
const rr = await fetch(B + "/api/wardrobe/rerender", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ option: opt }) });
const rj = await rr.json();
ok(rj.data && rj.data.views && !!rj.data.views["Shop Drawing"] && !!rj.data.views["Shutters"], "rerender preserves Shop Drawing + Shutters");

const b = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist", "--no-sandbox"] });
const pg = await b.newPage();
await pg.setViewport({ width: 900, height: 1100, deviceScaleFactor: 2 });
await pg.setContent('<!doctype html><body style="margin:0;background:#fff">' + sd + '</body>', { waitUntil: "domcontentloaded" });
const el = await pg.$("svg");
const outPng = (process.env.TEMP || ".") + "\\ward-shop.png";
await el.screenshot({ path: outPng });
let errs = 0; pg.on("pageerror", () => errs++);
await b.close();
ok(fs.existsSync(outPng) && fs.statSync(outPng).size > 3000, "rasterized PNG written (" + (fs.existsSync(outPng) ? fs.statSync(outPng).size : 0) + " bytes)");
console.log("\n" + pass + "/" + (pass + fail) + " passed" + (fail ? " · " + fail + " FAILED" : ""));
console.log("PNG: " + outPng);
process.exit(fail ? 1 : 0);
