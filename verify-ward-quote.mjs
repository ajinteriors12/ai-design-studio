// Wardrobe → kitchen quote adapter: a saved wardrobe returns its OWN costed BOQ
// through /quote + /quote.csv (not an empty ₹0 kitchen quote).
const B = "http://localhost:3000";
let pass = 0, fail = 0;
const ok = (n, c, e = "") => { console.log((c ? "PASS" : "FAIL") + " " + n + (e ? " — " + e : "")); c ? pass++ : fail++; };
const post = (p, b) => fetch(B + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) }).then((r) => r.json());
const get = (p) => fetch(B + p).then((r) => r.json());

const data = (await post("/api/wardrobe/options", { maleUsers: 1, femaleUsers: 1, width: 2800, height: 2400, maleRatio: 50 })).data;
const selIdx = (data.recommendation && data.recommendation.bestIndex) || 0;
const sel = data.options[selIdx];
ok("wardrobe option has its own BOQ grand total", sel.boq && sel.boq.grandTotal > 0, "₹" + (sel.boq && sel.boq.grandTotal));

const saved = (await post("/api/wardrobe/save", { data, input: { maleUsers: 1, femaleUsers: 1 }, selIdx })).data;
ok("wardrobe saved into gallery", !!saved && !!saved.id);
const id = saved.id;

const full = (await get("/api/designs/" + id)).data;
ok("reopened design carries layout.wardrobe", !!full && !!full.wardrobe);

const q = (await get("/api/designs/" + id + "/quote")).data;
ok("quote flagged as wardrobe-adapted", q && q.wardrobe === true);
ok("quote total === wardrobe BOQ grand total", q.total === sel.boq.grandTotal, q.total + " vs " + sel.boq.grandTotal);
ok("quote has real line items (not empty kitchen quote)", Array.isArray(q.lines) && q.lines.length === sel.boq.lines.length && q.lines.length > 3, q.lines.length + " lines");
ok("quote subtotal + margin + gst reconcile", q.subtotal + q.margin === q.taxable && q.taxable + q.gst === q.total);
ok("no 'Cabinets (carcasses)' kitchen row leaked in", !q.lines.some((l) => /Cabinets \(carcasses\)/.test(l.item)));

const csvRes = await fetch(B + "/api/designs/" + id + "/quote.csv");
const csv = await csvRes.text();
ok("quote.csv → 200 with Total row + a ply line", csvRes.status === 200 && /Total,/.test(csv) && /ply/.test(csv));

// a regular kitchen design is unaffected (regression guard)
const k = (await post("/api/generate", { designType: "L-Shape Kitchen", wall: 3000, wallB: 2400 })).data;
const kq = (await get("/api/designs/" + k.id + "/quote")).data;
ok("kitchen quote unchanged (no wardrobe flag, has cabinet row)", !kq.wardrobe && kq.lines.some((l) => /Cabinets \(carcasses\)/.test(l.item)) && kq.total > 0);

// cleanup
await fetch(B + "/api/designs/" + id, { method: "DELETE" });
await fetch(B + "/api/designs/" + k.id, { method: "DELETE" });
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
