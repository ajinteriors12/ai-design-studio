// API smoke: editable loftCells propagate into the Shop Drawing (divider lines) + cut list (divider shelf panels).
const B = "http://127.0.0.1:3000";
let pass = 0, fail = 0;
const ok = (n, c, e = "") => { console.log((c ? "PASS" : "FAIL") + " " + n + (e ? " — " + e : "")); c ? pass++ : fail++; };
const post = async (p, body) => { const r = await fetch(B + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); return r.json(); };
const cutQty = (rep, part) => (rep && rep.cut ? rep.cut.filter((r) => r.part === part).reduce((a, r) => a + r.qty, 0) : 0);
const countDiv = (svg) => (svg.match(/class="loft-div"/g) || []).length;

try {
  // 1) generate a wardrobe with a loft
  const g = await post("/api/wardrobe/options", { width: 2700, height: 2700, depth: 600 });
  const opt = g && g.data && g.data.options && g.data.options[0];
  ok("options generated", !!opt, opt ? "" : JSON.stringify(g).slice(0, 200));
  ok("has loft", !!(opt && opt.hasLoft), "hasLoft=" + (opt && opt.hasLoft) + " loftH=" + (opt && opt.loftH));

  // 2) BASELINE — single loft band: shop drawing has 0 dividers, cut list has no "Loft divider shelf"
  const base = await post("/api/wardrobe/rerender", { option: opt });
  const b = base.data;
  ok("baseline rerender ok", !!(b && b.views && b.views["Shop Drawing"]));
  const baseDiv = countDiv(b.views["Shop Drawing"]);
  ok("baseline: 0 loft dividers in Shop Drawing", baseDiv === 0, "found " + baseDiv);
  ok("baseline: 1 full-width Loft shelf in cut list", cutQty(b.reports, "Loft shelf") === 1, "qty=" + cutQty(b.reports, "Loft shelf"));
  ok("baseline: no Loft divider shelf yet", cutQty(b.reports, "Loft divider shelf") === 0);

  // 3) inject 2 loftCells (loft + shelf) into the FIRST column of every section
  const injected = JSON.parse(JSON.stringify(b));
  let colsInjected = 0;
  for (const sec of injected.sections) {
    const col = sec.columns[0];
    if (!col) continue;
    const half = Math.round((injected.loftH || 400) / 2);
    col.loftCells = [{ kind: "loft", label: "Loft", hMM: half, color: "#fcd34d" }, { kind: "shelf", label: "Shelf", hMM: injected.loftH - half, color: "#22c55e" }];
    colsInjected++;
  }
  ok("injected loftCells into " + colsInjected + " column(s)", colsInjected > 0);

  // 4) rerender with loftCells → dividers should appear in BOTH views
  const re = await post("/api/wardrobe/rerender", { option: injected });
  const d = re.data;
  ok("rerender-with-loftCells ok", !!(d && d.views && d.views["Shop Drawing"] && d.reports));
  const div = countDiv(d.views["Shop Drawing"]);
  ok("Shop Drawing now shows loft divider(s)", div === colsInjected, "dividers=" + div + " expected=" + colsInjected);
  ok("cut list now has Loft divider shelf", cutQty(d.reports, "Loft divider shelf") === colsInjected, "qty=" + cutQty(d.reports, "Loft divider shelf"));
  ok("full-width Loft shelf still present (x1)", cutQty(d.reports, "Loft shelf") === 1);
  // loftCells persisted through the sanitizer
  const persisted = d.sections[0].columns[0].loftCells;
  ok("loftCells persisted through rerender", Array.isArray(persisted) && persisted.length === 2, JSON.stringify(persisted));
  // SVG is well-formed
  ok("Shop Drawing SVG well-formed", d.views["Shop Drawing"].startsWith("<svg") && d.views["Shop Drawing"].endsWith("</svg>"));
} catch (e) { ok("threw", false, String(e)); }
console.log("\n" + pass + " passed, " + fail + " failed");
process.exitCode = fail ? 1 : 0;   // set code, let the loop drain (avoids a Windows fetch/libuv teardown assert on hard exit)
