// verify-designoptions.mjs — universal 3-balanced-option engine:
// kitchen + furniture produce 3 distinct, fully-costed options + measurable recommendation,
// and the continuous-learning choice/insights routes round-trip.
const B = "http://localhost:3000";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok  " + m); } else { fail++; console.log("FAIL  " + m); } };
const post = async (path, body) => (await fetch(B + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json();

// --- kitchen ---
const k = (await post("/api/design-options", { designType: "L-Shape Kitchen", wall: 3600, wallB: 2400 })).data;
ok(k && k.category === "kitchen", "kitchen category");
ok(k.options && k.options.length === 3, "3 options returned");
ok(k.options.map(o => o.key).join(",") === "storage,premium,functional", "profiles storage/premium/functional");
ok(k.options.every(o => o.svg && o.svg.startsWith("<svg")), "each option has a plan SVG");
ok(k.options.every(o => Array.isArray(o.layout.cutList) && o.layout.cutList.length > 0), "each option carries a full cut list");
const M = k.options[0].metrics;
const keys = ["storageScorePct", "spaceUtilPct", "manufacturingComplexity", "estCostInr", "materialBoardSqft", "hardwareCostInr", "installDifficulty", "installTimeHrs", "weightKg", "panels", "shutters", "drawers", "shelves", "edgeBandM", "plywoodUtilPct", "wastePct", "aiRating"];
ok(keys.every(kk => kk in M), "metrics block has all comparison fields");
ok(k.recommendation && typeof k.recommendation.bestIndex === "number" && k.recommendation.explanation.length > 30, "measurable recommendation present");
ok(Array.isArray(k.recommendation.ranked) && k.recommendation.ranked.length === 3, "ranked list of 3");

// --- distinctness (straight kitchen: drawer mix must differ across the 3) ---
const s = (await post("/api/design-options", { designType: "Straight Kitchen", wall: 3000 })).data;
const draws = s.options.map(o => o.metrics.drawers);
ok(new Set(draws).size >= 2, "options are distinct (drawer counts differ: " + draws.join("/") + ")");
const costs = s.options.map(o => o.metrics.estCostInr);
ok(new Set(costs).size >= 2, "options differ in cost (" + costs.join("/") + ")");

// --- furniture (TV unit) ---
const t = (await post("/api/design-options", { designType: "LCD/TV Panel", wall: 2400, wallB: 2100 })).data;
ok(t && t.category === "furniture" && t.options.length === 3, "furniture (TV) gives 3 options");
ok(new Set(t.options.map(o => o.metrics.drawers + ":" + o.metrics.shelves)).size >= 2, "furniture options differ in storage mix");

// --- continuous learning round-trip ---
const ch = await post("/api/design-options/choice", { designType: "Straight Kitchen", category: "kitchen", wall: 3000, chosenKey: "functional", recommendedKey: "storage", edited: false, metrics: {} });
ok(ch.data && ch.data.ok, "choice logged");
const ins = (await (await fetch(B + "/api/design-options/insights")).json()).data;
ok(ins && ins.total >= 1 && Array.isArray(ins.byTypeAndOption), "insights aggregate returns choices");

console.log("\n" + pass + "/" + (pass + fail) + " passed" + (fail ? " · " + fail + " FAILED" : ""));
process.exit(fail ? 1 : 0);
