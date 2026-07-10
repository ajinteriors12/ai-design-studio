# SPEC — Insert Shelf/Drawer/Accessory Exactly at Right-Click Position (Wardrobe editor)

**Objective:** right-click at any valid point inside the wardrobe → Insert Shelf / Drawer / accessory →
the component is inserted **at that exact clicked position** (exact height, exact compartment), not at a
default/center/top/bottom or a different compartment.

## 1. Capture the exact right-click position
- Capture exact mouse coords → convert to wardrobe-local (mm) coords.
- Identify the exact cabinet + compartment under the cursor; the exact horizontal + vertical insertion point.
- Highlight the target compartment before opening the menu; show a temporary insertion line/preview.
- Context menu opens beside the cursor without losing the target location.

## 2. Insert Shelf at the clicked height
- Insert at the exact vertical height clicked. Shelf spans only the clicked compartment's width (not across
  adjacent partitions unless chosen). Snap to a practical increment (1/5/10 mm or grid).
- Show shelf height from floor + from nearest shelf above/below. Allow immediate drag.
- e.g. right-click 950 mm above bottom in the female section → shelf at ~950 mm in that section.

## 3. Insert Drawer at the clicked position
- Insert within the exact clicked compartment; use clicked vertical position as placement reference.
- Auto-create drawer box, front, channel space, clearances, supporting partitions.
- Quick options: single / two / three / equal-height / custom-height / jewellery / deep / shoe / internal.
- Never insert in another section or at the bottom unless that's where clicked.

## 4. Context menu for empty wardrobe space (right-click any valid compartment, no need to pre-select)
Insert → Shelf · Adjustable Shelf · Fixed Shelf · Single Drawer · Double Drawer · Triple Drawer ·
Vertical Partition · Hanging Rod · Long Hanging · Short Hanging · Trouser Rack · Shoe Rack · Jewellery Tray ·
Safe Locker · Laundry Basket · Pull-out Basket · Mirror · LED Profile · Glass Shelf · Open Niche · Custom Accessory.

## 5. Intelligent placement preview
Live translucent preview at the clicked position: width/height/depth, distance from bottom, distance from
adjacent shelf, available clearance, collision warning, hardware suitability. Click to confirm · Esc to cancel ·
move mouse to adjust · type an exact dimension.

## 6. Compartment + boundary detection
Boundaries = left/right vertical partitions, upper/lower shelf or top/bottom panel, wardrobe depth, shutter/
hardware clearances. Inserted object stays inside; never crosses a partition, overlaps a drawer, intersects a
rod, extends outside, blocks hardware, or clashes with shutters/sliding tracks.

## 7. Smart auto-adjustment (no silent relocation)
If insufficient space: show e.g. "The selected position has only 110 mm available. A minimum of 150 mm is
required for this drawer." Then offer: reduce drawer height / move shelf above / move shelf below / replace
with jewellery drawer / insert at nearest valid position / cancel. User must approve any auto-reposition.

## 8. Right-click position must be preserved
Store a context target `{cabinetId, compartmentId, localX, localY, localZ, clickedFace, viewMode}` and use the
SAVED target when the command runs — do NOT recalculate from the current cursor after the menu opened.

## 9. Support in 2D and 3D
2D elevation, 2D section, 3D front, 3D perspective, walk-in, L-shape, U-shape. In 3D use ray casting to find
the exact cabinet face + local insertion coords.

## 10. Immediate editing after insertion
Keep new component selected; show resize/move handles; open properties; allow direct dimension entry; drag
up/down/left/right; Delete, Ctrl+Z/Y, copy, duplicate, right-click editing.

## 11. Automatic downstream updates (no manual regen)
2D drawing, 3D model, section dims, internal compartment dims, cut list, drawer component sizes, edge-banding,
hardware schedule, BOQ/costing, CNC drilling/cutting, panel numbering, packing list, install guide.

## 12. Undo/redo
Each insertion = one reversible transaction. Ctrl+Z fully removes it + restores prior state; Ctrl+Y recreates
it at the exact clicked position. History records e.g. "Inserted shelf at 950 mm in Female Section".

## 13. Acceptance tests
1. Right-click at 900 mm in a compartment → Insert Shelf → shelf at 900 mm in that compartment.
2. Right-click in female section → Insert Drawer → drawer only inside the female section.
3. Right-click near an existing shelf → preview shows collision, no silent relocate.
4. Insert shelf → Ctrl+Z → shelf disappears.
5. Ctrl+Y → shelf returns to the same position.
6. Same op in 3D → component at the corresponding 3D location.
7. Cut list, BOQ, panel numbering, 3D model update immediately.

---

## Build notes / status (fill in as built)
- Target component: `WardrobeDrawEditor` (client, inside frontendHTML) — 2D front-elevation editor with
  right-click menu (`openMenu` → `op("insert", kind)`), `commit()` (auto-propagates to all views/cutlist/BOQ/
  CNC/3D), and Undo/Redo history already present.
- Existing defect: `op("insert", kind)` splits the clicked cell with a FIXED default height and adds the new
  cell "below" — it does NOT honour the exact clicked Y height.
- **Phase 1 (DONE 2026-07-10, commit on master):** `openMenu` captures `clickMM` (mm from floor via
  `toSvg` + `floorY`/`scale`); new `insertAt(si,ci,k,clickMM,arg)` splits the clicked compartment at the
  snapped clicked height so the accessory bottom lands exactly there (no sliver cells; folds <40mm
  remainders in). `WARD_INSERTS` = the full §4 accessory list (shelf variants, single/double/triple drawer,
  hanging, trouser/shoe/jewellery/safe/basket/laundry/custom). Menu header shows "Insert here · N mm"; a red
  insertion line + target-compartment highlight (§1) render while the menu is open. Insufficient space is
  refused with a message (§7, no silent relocate). Commits via `commit()` → auto-propagates to all views/
  cutlist/BOQ/CNC/3D (§11) and is one Undo/Redo step with a "Insert <X> at <mm> mm · <section>" label (§12).
  Dev hook `window.__adsWardInsertAt` + `window.__adsWardSecs` (React onContextMenu on SVG cells can't be
  fired headlessly). **verify-wardinsert.mjs 11/11** (acceptance 1,4,5 + refusal + history label + list);
  regressions verify-wardedit-ui 8/8, verify-wardlasso 10/10.
- **Phase 2 (follow-ups, NOT built):** live translucent hover preview with live dims/clearance/collision
  (§5), full smart-adjust dialog with reduce/move/replace options (§7), 3D ray-cast insertion in the 3D
  views (§9), cross-partition span option (§2), keyboard exact-dimension entry, keep-selected-with-handles
  after insert (§10). The insertion-line preview + refusal message are the Phase-1 subset of §5/§7.
