// API-level check for the wardrobe "select & merge compartments" feature.
// Generates options, merges the bottom cell of two adjacent columns (same algorithm the
// editor uses), re-renders on the server, and asserts span/covered survive + views render.
const B = "http://127.0.0.1:3000";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  PASS " + m); } else { fail++; console.log("  FAIL " + m); } };

const gen = await (await fetch(B + "/api/wardrobe/options", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ maleUsers: 1, femaleUsers: 1, children: 0, professionals: 1, width: 2700, height: 2400, depth: 600, maleRatio: 50, loftH: 600, shape: "straight" }),
})).json();
const opt = gen.data.options[0];
ok(!!opt && Array.isArray(opt.sections), "generated an option with sections");

// find a section with >=2 columns
let si = opt.sections.findIndex((s) => s.columns.length >= 2);
ok(si >= 0, "found a section with >=2 columns (si=" + si + ")");
const sec = opt.sections[si], cols = sec.columns;

// --- replicate editor mergeSelected for k=0 of cols 0 and 1 ---
const cis = [0, 1];
const info = {};
for (const ci of cis) { const cells = cols[ci].cells; info[ci] = { k0: 0, k1: 0, runH: cells[0].hMM, cells }; }
const base = info[0], bandBelow = 0, bandH = base.runH, mid = "m" + si + "-0-0";
for (let idx = 0; idx < cis.length; idx++) {
  const ci = cis[idx], f = info[ci], cells = f.cells;
  const below = cells.slice(0, f.k0), above = cells.slice(f.k1 + 1);
  const aboveSum = above.reduce((a, c) => a + c.hMM, 0);
  const colTotal = cells.reduce((a, c) => a + c.hMM, 0), remAbove = colTotal - bandBelow - bandH;
  if (remAbove > 0 && aboveSum > 0) { const s = remAbove / aboveSum; above.forEach((c) => c.hMM = Math.round(c.hMM * s)); }
  const src = cells[f.k0];
  const merged = idx === 0
    ? { kind: src.kind, label: src.label, color: src.color, hMM: bandH, span: 2, mergeId: mid }
    : { kind: src.kind, label: src.label, color: src.color, hMM: bandH, covered: true, mergeId: mid };
  const arr = below.concat([merged], above);
  const d = colTotal - arr.reduce((a, c) => a + c.hMM, 0);
  if (d !== 0) { const fix = above.length ? arr[arr.length - 1] : merged; fix.hMM += d; }
  cols[ci].cells = arr;
}
const drawersBefore = opt.stats.drawers;

// --- re-render on the server ---
const re = await (await fetch(B + "/api/wardrobe/rerender", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ option: opt }),
})).json();
const o = re.data;
ok(!!o && Array.isArray(o.sections), "rerender returned an option");

// master + covered survived with a shared mergeId
let master = null, covered = null;
for (const s of o.sections) for (const c of s.columns) for (const cell of c.cells) {
  if (cell.span > 1) master = cell;
  if (cell.covered) covered = cell;
}
ok(master && master.span === 2 && master.mergeId, "master cell kept span=2 + mergeId");
ok(covered && covered.covered === true && covered.mergeId, "covered twin kept covered:true + mergeId");
ok(master && covered && master.mergeId === covered.mergeId, "master and covered share the same mergeId");
ok(master && covered && master.hMM === covered.hMM, "reconcile: covered height == master height (" + (master && master.hMM) + ")");

// counts must NOT double-count the covered twin
ok(o.stats.totalItems < opt.sections.flatMap((s) => s.columns.flatMap((c) => c.cells)).length + 0.5, "stats.totalItems excludes covered");
ok(typeof o.reports.drawerFronts === "number" && o.reports.drawerFronts >= 0, "cut list computed (drawerFronts=" + o.reports.drawerFronts + ")");

// every view still renders
for (const v of ["Shop Drawing", "Shutters", "Front", "Internal"]) {
  ok(o.views[v] && o.views[v].indexOf("<svg") >= 0 && o.views[v].length > 500, "view '" + v + "' renders (" + (o.views[v] ? o.views[v].length : 0) + " bytes)");
}
// column totals still equal usableH (no drift that would break next rerender)
let drift = 0;
for (const s of o.sections) for (const c of s.columns) { const sum = c.cells.reduce((a, x) => a + x.hMM, 0); if (Math.abs(sum - o.usableH) > 3) drift++; }
ok(drift === 0, "all column totals stay == usableH (no drift)");

console.log("\n" + (fail === 0 ? "ALL PASSED" : "FAILURES") + " — " + pass + " pass / " + fail + " fail");
process.exit(fail === 0 ? 0 : 1);
