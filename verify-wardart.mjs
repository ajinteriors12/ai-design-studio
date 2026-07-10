// Verify shared garment/item artwork (wardCellArt) renders in Shop Drawing, Shutters (internal
// side) and the Internal elevation. The new art uses distinctive garment fills the old simple
// line-art never produced (#eef2ff shirt, #dbe3f4 coat, #fce7f3 saree, hanger <path> shoulders).
const B = "http://localhost:3000";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  PASS " + m); } else { fail++; console.log("  FAIL " + m); } };

// distinctive markers of the real item artwork (never present in the old simple lines)
const GARMENT = ["#eef2ff", "#dbe3f4", "#fce7f3", "#fdecf5", "#f3f4f6"]; // shirt/coat/saree/dress fills + folded-stack band
const hasGarment = (svg) => GARMENT.some((h) => svg.includes(h));
const countHangerShoulders = (svg) => (svg.match(/L[\d.]+,[\d.]+ L[\d.]+,[\d.]+ L[\d.]+,[\d.]+ Z/g) || []).length;

async function opt(body) {
  const r = await fetch(B + "/api/wardrobe/options", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  return j.data;
}

(async () => {
  // couple wardrobe, tall enough for a loft, mixed hang/fold -> lots of garment cells
  const data = await opt({ width: 2700, height: 2550, depth: 600, users: "couple" });
  ok(data && Array.isArray(data.options) && data.options.length >= 1, "options returned (" + (data.options ? data.options.length : 0) + ")");
  const o = data.options[0];
  const V = o.views || {};
  ok(!!V["Shop Drawing"], "Shop Drawing view exists");
  ok(!!V.Shutters, "Shutters view exists");
  ok(!!V.Internal, "Internal view exists");
  ok(!!V.Front, "Front view exists (control)");

  // 1. Shop Drawing keeps its garments (regression)
  ok(hasGarment(V["Shop Drawing"]), "Shop Drawing has garment artwork (regression)");

  // 2. Shutters view now has garment artwork in its internal side
  ok(hasGarment(V.Shutters), "Shutters view now has garment artwork");
  ok(V.Shutters.includes("WITHOUT SHUTTERS"), "Shutters view still labels the internal side");
  ok(V.Shutters.includes("WITH SHUTTERS"), "Shutters view still has the closed side");

  // 3. Internal elevation now has garment artwork
  ok(hasGarment(V.Internal), "Internal elevation now has garment artwork");

  // 4. all three carry the same style of hanger-shoulder paths
  const sc = countHangerShoulders(V["Shop Drawing"]), shu = countHangerShoulders(V.Shutters), inl = countHangerShoulders(V.Internal);
  console.log("  hanger-shoulder path counts -> Shop:" + sc + " Shutters:" + shu + " Internal:" + inl);
  ok(sc > 0 && shu > 0 && inl > 0, "hanger-shoulder garments present in all three views");

  // 5. rerender keeps the artwork (source-of-truth path)
  const rr = await fetch(B + "/api/wardrobe/rerender", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ option: o }) });
  const rj = await rr.json();
  const rv = (rj.data && rj.data.views) || {};
  ok(hasGarment(rv.Shutters || "") && hasGarment(rv.Internal || ""), "rerender preserves garment artwork in Shutters + Internal");

  // 6. valid SVG (balanced enough) — no template break
  ok(V.Internal.startsWith("<svg") && V.Internal.trimEnd().endsWith("</svg>"), "Internal SVG well-formed");
  ok(V.Shutters.startsWith("<svg") && V.Shutters.trimEnd().endsWith("</svg>"), "Shutters SVG well-formed");

  console.log("\n" + (fail === 0 ? "ALL CHECKS PASSED" : "FAILURES") + " — " + pass + "/" + (pass + fail));
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error("ERR", e); process.exit(2); });
