// Verify version-compare: generate a design, snapshot it, mutate it, snapshot again, then the new
// GET /api/designs/:id/versions/:vid returns each stored snapshot's plan SVG + rich metrics so two
// versions can be diffed side by side. Asserts both snapshots load and their metrics actually differ.
const B = "http://localhost:3000";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  PASS " + m); } else { fail++; console.log("  FAIL " + m); } };
const J = (r) => r.json();

(async () => {
  // 1. generate + persist a U-Shape kitchen (returns {data:{id,...layout}})
  const gen = await fetch(B + "/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ designType: "U-Shape Kitchen", wall: 2700, wallB: 2400, wallC: 1800 }) }).then(J);
  const id = gen.data && gen.data.id;
  ok(!!id, "design generated + persisted (id " + (id || "?").slice(0, 8) + ")");

  // 2. snapshot "before"
  const s1 = await fetch(B + "/api/designs/" + id + "/version", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: "before" }) }).then(J);
  ok(s1.data && s1.data.ok, "snapshot 'before' created");

  // 3. mutate a base cabinet's width so metrics change
  const patched = await fetch(B + "/api/designs/" + id + "/cabinet", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ run: 0, index: 0, patch: { w: 900 } }) }).then(J);
  ok(patched.data && patched.data.ok, "cabinet width edited (creates a difference)");

  // 4. snapshot "after"
  const s2 = await fetch(B + "/api/designs/" + id + "/version", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: "after" }) }).then(J);
  ok(s2.data && s2.data.ok, "snapshot 'after' created");

  // 5. list has both
  const list = await fetch(B + "/api/designs/" + id + "/versions").then(J);
  const rows = list.data || [];
  ok(rows.length >= 2, "versions list has >=2 snapshots (" + rows.length + ")");
  const after = rows.find((r) => r.label === "after"), before = rows.find((r) => r.label === "before");
  ok(after && before, "both labelled snapshots present in list");

  // 6. NEW single-version endpoint returns planSvg + metrics for each
  const fullA = await fetch(B + "/api/designs/" + id + "/versions/" + before.id).then(J).then((j) => j.data);
  const fullB = await fetch(B + "/api/designs/" + id + "/versions/" + after.id).then(J).then((j) => j.data);
  ok(fullA && fullB, "single-version endpoint returns data for both");
  ok(fullA.planSvg && fullA.planSvg.indexOf("<svg") === 0, "version A carries a plan SVG (" + (fullA.planSvg || "").length + " bytes)");
  ok(fullB.planSvg && fullB.planSvg.indexOf("<svg") === 0, "version B carries a plan SVG (" + (fullB.planSvg || "").length + " bytes)");
  ok(fullA.metrics && typeof fullA.metrics.cabinets === "number", "version A carries rich metrics (cabinets=" + (fullA.metrics && fullA.metrics.cabinets) + ")");
  ok(fullB.metrics && typeof fullB.metrics.panels === "number", "version B carries rich metrics (panels=" + (fullB.metrics && fullB.metrics.panels) + ")");

  // 7. the edit actually moved a comparable metric (panels or board sqft)
  const dPanels = (fullB.metrics.panels || 0) - (fullA.metrics.panels || 0);
  const dBoard = (fullB.metrics.materialBoardSqft || 0) - (fullA.metrics.materialBoardSqft || 0);
  console.log("  Δ panels=" + dPanels + "  Δ board=" + dBoard.toFixed(1) + " sqft");
  ok(dPanels !== 0 || Math.abs(dBoard) > 0.05, "a comparable metric differs between the two versions");

  // 8. 404 on a bogus version id
  const bogus = await fetch(B + "/api/designs/" + id + "/versions/nope-nope").then((r) => r.status);
  ok(bogus === 404, "bogus version id → 404 (" + bogus + ")");

  console.log("\n" + (fail === 0 ? "ALL CHECKS PASSED" : "FAILURES") + " — " + pass + "/" + (pass + fail));
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error("ERR", e); process.exit(2); });
