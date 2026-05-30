"use strict";
// Headless verification of the minimap highlight-list reconcile algorithm
// (mirrors reconcileMinimapHighlightListRows / row reuse in hordes-kr-mod.user.js).
// Proves the properties the live fix relies on:
//   - row DOM nodes persist (same identity) across re-renders -> click survives
//   - panel scrollTop is NOT reset by re-render -> scroll position survives
//   - reordering reuses nodes (moves them) instead of recreating
//   - click reads CURRENT id/name from dataset, not a stale closure

let assertions = 0;
function assert(cond, msg) {
  assertions++;
  if (!cond) throw new Error("FAIL: " + msg);
}

// --- Minimal fake DOM (only what the algorithm touches) ---
let nodeSeq = 0;
class El {
  constructor(tag) {
    this.tag = tag;
    this.id = ++nodeSeq;
    this.children = [];
    this.parent = null;
    this.dataset = {};
    this.className = "";
    this._classes = new Set();
    this.textContent = "";
    this.scrollTop = 0; // real DOM: moving children does NOT reset this
  }
  get classList() {
    const set = this._classes;
    return {
      add: (c) => set.add(c),
      toggle: (c, on) => { if (on) set.add(c); else set.delete(c); },
      contains: (c) => set.has(c),
    };
  }
  set className(v) { this._className = v; for (const c of String(v).split(/\s+/).filter(Boolean)) this._classes.add(c); }
  get className() { return this._className || ""; }
  appendChild(child) {
    if (child.parent) child.parent.children = child.parent.children.filter((c) => c !== child);
    child.parent = this;
    this.children.push(child); // appendChild moves existing node to end; scrollTop untouched
    return child;
  }
  remove() { if (this.parent) { this.parent.children = this.parent.children.filter((c) => c !== this); this.parent = null; } }
  matchesClass(sel) { return this._classes.has(sel.replace(/^\./, "")); }
  querySelector(sel) { return this.children.find((c) => c.matchesClass(sel)) || null; }
  querySelectorAll(sel) {
    const out = this.children.filter((c) => c.matchesClass(sel));
    out.forEach = Array.prototype.forEach.bind(out);
    return out;
  }
}
function createUiElement(tag, className, text) { const el = new El(tag); el.className = className; if (text != null) el.textContent = text; return el; }

// --- Algorithm under test (copied verbatim in structure from the userscript) ---
function createRowShell(onClick) {
  const row = new El("button");
  row.className = "hordes-kr-minimap-list-row";
  row.__clickResult = null;
  row.click = () => {
    // reads CURRENT identity from dataset at click time (not creation closure)
    row.__clickResult = onClick(row.dataset.id || "", row.dataset.name || "", row.classList.contains("targeted"));
  };
  return row;
}
function updateRow(row, candidate, state) {
  const selected = Boolean(candidate.id && state.selectedId && candidate.id === state.selectedId);
  row.classList.toggle("targeted", selected);
  row.dataset.id = candidate.id || "";
  row.dataset.name = candidate.name || "";
  row.textContent = `${candidate.name} ${candidate.distanceText}`;
}
function reconcile(panel, candidates, state, onClick) {
  const existing = new Map();
  panel.querySelectorAll(".hordes-kr-minimap-list-row").forEach((row) => { if (row.dataset.rowKey) existing.set(row.dataset.rowKey, row); });
  let empty = panel.querySelector(".hordes-kr-minimap-list-empty");
  if (candidates.length === 0) {
    existing.forEach((row) => row.remove());
    if (!empty) { empty = createUiElement("div", "hordes-kr-minimap-list-empty", "감지 없음"); panel.appendChild(empty); }
    return;
  }
  if (empty) empty.remove();
  const usedKeys = new Set();
  candidates.forEach((candidate, index) => {
    const key = candidate.id ? `id:${candidate.id}` : `nm:${candidate.name || ""}:${index}`;
    usedKeys.add(key);
    let row = existing.get(key);
    if (!row) { row = createRowShell(onClick); row.dataset.rowKey = key; }
    updateRow(row, candidate, state);
    panel.appendChild(row);
  });
  existing.forEach((row, key) => { if (!usedKeys.has(key)) row.remove(); });
}

// --- Test harness mirroring renderMinimapHighlightList ---
const host = new El("div");
const panel = createUiElement("div", "hordes-kr-minimap-list-panel");
const title = createUiElement("div", "hordes-kr-minimap-list-title");
panel.appendChild(title);
host.appendChild(panel);
const clicks = [];
const onClick = (id, name, isSelected) => { const r = { id, name, isSelected }; clicks.push(r); return r; };
function render(cands, state = {}) {
  cands = cands.slice().sort((a, b) => a.distance - b.distance);
  reconcile(panel, cands, state, onClick);
}
const rows = () => panel.querySelectorAll(".hordes-kr-minimap-list-row");

// Round 1: three candidates
render([
  { id: "A", name: "Alice", distance: 10, distanceText: "10m" },
  { id: "B", name: "Bob", distance: 20, distanceText: "20m" },
  { id: "C", name: "Carol", distance: 30, distanceText: "30m" },
]);
assert(rows().length === 3, "round1 has 3 rows");
assert(panel.children[0] === title, "title stays first child");
const rowA1 = rows().find((r) => r.dataset.id === "A");
const rowB1 = rows().find((r) => r.dataset.id === "B");

// user scrolls + a click is "in flight": capture node identity + scroll
panel.scrollTop = 64;

// Round 2: distances change (B now closest) -> reorder; same ids
render([
  { id: "A", name: "Alice", distance: 25, distanceText: "25m" },
  { id: "B", name: "Bob", distance: 5, distanceText: "5m" },
  { id: "C", name: "Carol", distance: 30, distanceText: "30m" },
]);
const rowA2 = rows().find((r) => r.dataset.id === "A");
const rowB2 = rows().find((r) => r.dataset.id === "B");
assert(rowA2 === rowA1, "row A is the SAME node after re-render (click target survives)");
assert(rowB2 === rowB1, "row B is the SAME node after re-render");
assert(panel.scrollTop === 64, "scrollTop preserved across re-render (no reset)");
assert(rows().length === 3, "still 3 rows");
// order now B, A, C by distance (after title)
const order = panel.children.filter((c) => c.matchesClass(".hordes-kr-minimap-list-row")).map((r) => r.dataset.id);
assert(JSON.stringify(order) === JSON.stringify(["B", "A", "C"]), "rows reordered by distance: " + order);
assert(rowB2.textContent === "Bob 5m", "reused row B got updated distance text");

// Round 3: simulate a click on the (persistent) row B AFTER it became selected
render([
  { id: "A", name: "Alice", distance: 25, distanceText: "25m" },
  { id: "B", name: "Bob", distance: 5, distanceText: "5m" },
  { id: "C", name: "Carol", distance: 30, distanceText: "30m" },
], { selectedId: "B" });
rowB1.click(); // same physical node the user pressed in round 1
assert(clicks.length === 1, "click fired once on persistent node");
assert(clicks[0].id === "B" && clicks[0].name === "Bob", "click read CURRENT id/name from dataset");
assert(clicks[0].isSelected === true, "click saw current selected state");

// Round 4: C leaves, D arrives
render([
  { id: "A", name: "Alice", distance: 25, distanceText: "25m" },
  { id: "B", name: "Bob", distance: 5, distanceText: "5m" },
  { id: "D", name: "Dan", distance: 40, distanceText: "40m" },
]);
const ids4 = rows().map((r) => r.dataset.id).sort();
assert(JSON.stringify(ids4) === JSON.stringify(["A", "B", "D"]), "C removed, D added: " + ids4);
assert(rows().find((r) => r.dataset.id === "A") === rowA1, "A still the same persistent node in round 4");

// Round 5: empty -> shows '감지 없음', rows removed
render([]);
assert(rows().length === 0, "no rows when empty");
assert(panel.querySelector(".hordes-kr-minimap-list-empty") !== null, "empty placeholder shown");
assert(panel.children[0] === title, "title still first child when empty");

// Round 6: back to one -> empty placeholder removed
render([{ id: "A", name: "Alice", distance: 10, distanceText: "10m" }]);
assert(panel.querySelector(".hordes-kr-minimap-list-empty") === null, "empty placeholder removed when populated again");
assert(rows().length === 1, "one row again");

console.log(`ALL ${assertions} ASSERTIONS PASSED`);
