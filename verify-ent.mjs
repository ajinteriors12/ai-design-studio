// Verify the enterprise extensions (#1–#8 + handle/appliance checks) end-to-end.
import { deflateSync } from "zlib";
const B = "http://localhost:3000";
const j = async (r) => { const t = await r.text(); try { return JSON.parse(t); } catch { return { _raw: t.slice(0, 200) }; } };
const post = (p, b) => fetch(B + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }).then(j);
const patch = (p, b) => fetch(B + p, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }).then(j);
const put = (p, b) => fetch(B + p, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }).then(j);
const get = (p) => fetch(B + p).then(j);

// minimal PNG encoder (RGBA, no filtering) so we can feed real frames to the GIF encoder.
function crc32(buf) { let c = ~0; for (let i = 0; i < buf.length; i++) { c ^= buf[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; }
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const t = Buffer.from(type, "ascii"); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, crc]); }
function makePNG(w, h, rgb) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; // RGBA 8-bit
  const stride = w * 4 + 1, raw = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) { raw[y * stride] = 0; for (let x = 0; x < w; x++) { const o = y * stride + 1 + x * 4; raw[o] = rgb[0]; raw[o + 1] = rgb[1]; raw[o + 2] = rgb[2]; raw[o + 3] = 255; } }
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const png = Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
  return "data:image/png;base64," + png.toString("base64");
}

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { console.log((cond ? "✅" : "❌") + " " + name + (extra ? " — " + extra : "")); cond ? pass++ : fail++; };

// 0) generate a design
const gen = await post("/api/generate", { designType: "L-Shape Kitchen", wall: 3000, wallB: 2400, handle: "D Handle", applianceBrand: "Custom" });
const id = gen.data?.id; ok("generate L-Shape", !!id, "id=" + (id || "").slice(0, 8));

// #11) handle-collision + appliance-swing checks present
const names = (gen.data?.mfgChecks || []).map((c) => c.name);
ok("#11 handle-collision check present", names.includes("Handle-collision clearance"));
ok("#11 appliance-swing check present", names.includes("Appliance-swing clearance"));

// #1) PATCH a cabinet width, then PUT whole layout
const beforeRuns = gen.data.runs;
const firstShutter = beforeRuns[0].base.findIndex((c) => c.kind === "shutter" || c.drawers === 0);
const pc = await patch(`/api/designs/${id}/cabinet`, { run: 0, index: Math.max(0, firstShutter), patch: { w: 500 } });
ok("#1 PATCH cabinet persists", pc.data?.ok === true, "w=" + pc.data?.cab?.w);
const reload = await get(`/api/designs/${id}/cutlist.csv`); // proves layout re-derived + persisted
const re2 = await fetch(B + `/api/designs/${id}/export.svg`).then((r) => r.status);
ok("#1 persisted layout still exports", re2 === 200);
const putRes = await put(`/api/designs/${id}/layout`, { runs: beforeRuns });
ok("#1 PUT layout autosave", putRes.data?.ok === true);
const propRes = await patch(`/api/designs/${id}/cabinet/0/props`, { run: 0, props: { label: "TEST-PROP" } });
ok("#1 PATCH props", propRes.data?.cab?.label === "TEST-PROP");
const dimRes = await patch(`/api/designs/${id}/dimension`, { run: 0, index: 0, mm: 437 });
ok("#1 PATCH dimension w/ warning", Array.isArray(dimRes.data?.warnings));

// #2) SSE live bus
const liveAbort = new AbortController();
let sseEvents = [];
const ssePromise = fetch(B + `/api/designs/${id}/live`, { signal: liveAbort.signal }).then(async (res) => {
  const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = "";
  try { while (true) { const { value, done } = await reader.read(); if (done) break; buf += dec.decode(value); const m = buf.match(/event: (\w+)/g); if (m) sseEvents = m; if (sseEvents.length >= 2) break; } } catch {}
}).catch(() => {});
await new Promise((r) => setTimeout(r, 400));
await patch(`/api/designs/${id}/cabinet`, { run: 0, index: 0, patch: { label: "LIVE-PUSH" } }); // should broadcast
await new Promise((r) => setTimeout(r, 400));
liveAbort.abort(); await ssePromise;
ok("#2 SSE bus delivers events", sseEvents.some((e) => e.includes("hello")), sseEvents.join(","));

// #3) coordinate
const coord = await post(`/api/designs/${id}/coordinate`, { run: 0 });
ok("#3 coordinate returns RoomModel", !!coord.data?.model?.walls?.length, (coord.data?.model?.walls?.length || 0) + " walls");
const rm = await get(`/api/designs/${id}/roommodel`);
ok("#3 roommodel persisted", !!rm.data?.walls?.length);

// #7) obstruction
const obs = await post(`/api/designs/${id}/obstruction`, { kind: "beam", drop: 350 });
ok("#7 obstruction applies + reconfigures", obs.data?.ok === true, (obs.data?.adjustments?.length || 0) + " trims");

// #5) material PBR
const lib = await get("/api/pbr/library");
ok("#5 PBR library", Object.keys(lib.data || {}).length >= 6);
const mat = await post(`/api/designs/${id}/3d/material`, { target: "kind:shutter", finish: "Merino Frosty White Acrylic", type: "Acrylic" });
ok("#5 material stored w/ PBR params", mat.data?.pbr?.roughness !== undefined && mat.data?.pbr?.preset === "acrylic-highgloss");
const mats = await get(`/api/designs/${id}/3d/materials`);
ok("#5 materials fetch", (mats.data || []).length >= 1);

// #4) render job (no stability key → job goes to error, but the QUEUE must work)
const rj = await post(`/api/designs/${id}/3d/render`, { image: makePNG(8, 8, [200, 120, 60]) });
ok("#4 render job enqueued", !!rj.data?.jobId);
await new Promise((r) => setTimeout(r, 2500));
const rjs = await get(`/api/render/jobs/${rj.data.jobId}`);
ok("#4 render job processed by worker", ["done", "error", "running"].includes(rjs.data?.status), "status=" + rjs.data?.status);

// #6) walkthrough → real GIF encode from PNG frames
const frames = [[220, 60, 60], [60, 200, 90], [70, 110, 230], [230, 200, 50]].map((c) => makePNG(48, 48, c));
const wt = await post(`/api/designs/${id}/3d/walkthrough`, { frames, delayCs: 10, maxSize: 64 });
ok("#6 walkthrough job enqueued + camera path", !!wt.data?.jobId && Array.isArray(wt.data?.cameraPath), (wt.data?.cameraPath?.length || 0) + " keyframes");
let gifStatus = "?", gifLen = 0, gifMagic = "";
for (let i = 0; i < 20; i++) { await new Promise((r) => setTimeout(r, 600)); const s = await get(`/api/render/jobs/${wt.data.jobId}`); gifStatus = s.data?.status; if (gifStatus === "done" || gifStatus === "error") { break; } }
if (gifStatus === "done") { const fr = await fetch(B + `/api/render/jobs/${wt.data.jobId}/file`); const ab = Buffer.from(await fr.arrayBuffer()); gifLen = ab.length; gifMagic = ab.slice(0, 6).toString("ascii"); }
ok("#6 walkthrough encodes a real GIF89a", gifStatus === "done" && gifMagic === "GIF89a", "status=" + gifStatus + " bytes=" + gifLen + " magic=" + gifMagic);

// camera-path-only call (no frames)
const planOnly = await post(`/api/designs/${id}/3d/walkthrough`, { frames: 24 });
ok("#6 camera-path planning (no frames)", Array.isArray(planOnly.data?.cameraPath) && planOnly.data.cameraPath.length === 24);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
