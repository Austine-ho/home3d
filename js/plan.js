// 2D floor-plan editor: rooms, walls, rails, doors, windows, furniture, stairs, floors
import { S, $, toast, PRESETS, presetColor, clamp } from './core.js';
import { CAT, footprint } from './catalog.js';
import { stairGeom, stairBounds, DOOR_STYLE_NAMES } from './house.js';

const cvs = $('#planCanvas'), ctx = cvs.getContext('2d');
const P = { fi: 0, tool: 'select', sel: null, s: 40, ox: 0, oy: 0, drag: null, snap: true, hist: [], fut: [], onChange: null, placing: null };
export const Plan = P;
const OPS = { door: '單開門', door2: '雙開門', sliding: '拉門', window: '窗戶', opening: '開口(無門)' };
const TOOLS = [['select', '👆', '選取/移動'], ['wall', '🧱', '畫牆'], ['rail', '🚧', '欄杆'], ['room', '⬛', '新增空間'], ['door', '🚪', '加門'], ['window', '🪟', '加窗'], ['opening', '⬜', '加開口'], ['stair', '🪜', '加樓梯'], ['furn', '🛋', '加家具']];
const nid = p => p + (S.data.nextId++);
const fl = () => S.data.floors[P.fi];
const snapV = v => P.snap ? Math.round(v / .05) * .05 : Math.round(v / .01) * .01;
// The plan is a true top-down view as seen when you stand at the front door facing into the house:
// street at the bottom, walking in goes UP the screen, and the left/right walls are on the same side as in 3D.
const F = -1; // depth axis points up the screen
const toS = (x, d) => [P.ox + x * P.s, P.oy + F * d * P.s];
const toP = (sx, sy) => [(sx - P.ox) / P.s, F * (sy - P.oy) / P.s];

export function openPlan() {
  $('#plan').classList.add('show'); resize(); if (!P.hist.length) pushHist(); fit(); buildToolbar(); renderProps(); draw();
}
export function closePlan() { $('#plan').classList.remove('show'); P.sel = null; }
function resize() { const r = cvs.getBoundingClientRect(); cvs.width = r.width * devicePixelRatio; cvs.height = r.height * devicePixelRatio; }
addEventListener('resize', () => { if ($('#plan').classList.contains('show')) { resize(); draw(); } });
function fit() {
  const f = fl(); let x0 = 0, x1 = 5, d0 = -3, d1 = 16;
  const pts = [...f.rooms.flatMap(r => [[r.x0, r.d0], [r.x1, r.d1]]), ...f.walls.flatMap(w => [[w.x1, w.d1], [w.x2, w.d2]])];
  if (pts.length) { x0 = Math.min(...pts.map(p => p[0])); x1 = Math.max(...pts.map(p => p[0])); d0 = Math.min(...pts.map(p => p[1])); d1 = Math.max(...pts.map(p => p[1])); }
  const r = cvs.getBoundingClientRect(), pad = 30;
  P.s = Math.min((r.width - pad * 2) / (x1 - x0 + 1), (r.height - pad * 2) / (d1 - d0 + 1));
  P.ox = r.width / 2 - (x0 + x1) / 2 * P.s; P.oy = r.height / 2 - F * (d0 + d1) / 2 * P.s;
}
function pushHist() { P.hist.push(JSON.stringify(S.data)); if (P.hist.length > 60) P.hist.shift(); P.fut = []; }
function commit() { pushHist(); S.save && S.save(); P.onChange && P.onChange(); renderProps(); draw(); }
function undo() { if (P.hist.length < 2) return; P.fut.push(P.hist.pop()); S.data = JSON.parse(P.hist[P.hist.length - 1]); P.sel = null; afterLoad(); }
function redo() { if (!P.fut.length) return; const s = P.fut.pop(); P.hist.push(s); S.data = JSON.parse(s); P.sel = null; afterLoad(); }
function afterLoad() { P.fi = Math.min(P.fi, S.data.floors.length - 1); S.save && S.save(); P.onChange && P.onChange(); buildToolbar(); renderProps(); draw(); }

// ---------- toolbar ----------
function buildToolbar() {
  $('#pfloors').innerHTML = S.data.floors.map((f, i) => `<button data-f="${i}" class="${i === P.fi ? 'on' : ''}">${f.name}</button>`).join('') + `<button id="pAddF" title="新增樓層">＋</button>`;
  $('#pfloors').querySelectorAll('[data-f]').forEach(b => b.onclick = () => { P.fi = +b.dataset.f; P.sel = null; buildToolbar(); renderProps(); fit(); draw(); });
  $('#pAddF').onclick = addFloor;
  $('#ptools').innerHTML = TOOLS.map(([id, ic, n]) => `<button data-t="${id}" class="${P.tool === id ? 'on' : ''}"><span>${ic}</span>${n}</button>`).join('');
  $('#ptools').querySelectorAll('[data-t]').forEach(b => b.onclick = () => { P.tool = b.dataset.t; if (P.tool === 'furn') showCatalog(); buildToolbar(); hintTool(); });
  $('#pSnap').classList.toggle('on', P.snap);
}
function hintTool() {
  const h = { select: '點選物件後拖曳；拖曳空白處平移；雙指縮放', wall: '按住拖曳畫一道牆（自動對齊水平/垂直）', rail: '按住拖曳畫欄杆', room: '按住拖曳框出新的空間', door: '點一下牆壁加入門', window: '點一下牆壁加入窗戶', opening: '點一下牆壁加入無門開口', stair: '點一下放置樓梯（通往上一層）', furn: '從清單選一件家具' }[P.tool];
  $('#phint').textContent = h;
}
$('#pUndo').onclick = undo; $('#pRedo').onclick = redo; $('#pFit').onclick = () => { fit(); draw(); };
$('#pSnap').onclick = () => { P.snap = !P.snap; buildToolbar(); };
function addFloor() {
  const top = S.data.floors[S.data.floors.length - 1];
  const nf = { name: (S.data.floors.length + 1) + 'F', rooms: top.rooms.map(r => ({ ...r, id: nid('r') })), walls: top.walls.filter(w => w.kind !== 'rail').map(w => ({ ...w, id: nid('w'), ops: (w.ops || []).filter(o => o.type === 'window').map(o => ({ ...o, id: nid('o') })) })), furniture: [] };
  const lastSt = S.data.stairs.filter(s => s.floor === S.data.floors.length - 2).pop() || S.data.stairs[S.data.stairs.length - 1];
  S.data.floors.push(nf);
  if (lastSt) S.data.stairs.push({ ...lastSt, id: nid('st'), floor: S.data.floors.length - 2 });
  P.fi = S.data.floors.length - 1; P.sel = null; toast(`已新增 ${nf.name}（複製上一層的空間與牆）`); buildToolbar(); commit(); fit(); draw();
}
function delFloor() {
  if (S.data.floors.length <= 1) return toast('至少要保留一層');
  if (P.fi !== S.data.floors.length - 1) return toast('只能刪除最上面一層');
  if (!confirm(`刪除 ${fl().name}？`)) return;
  S.data.floors.pop(); S.data.stairs = S.data.stairs.filter(s => s.floor < S.data.floors.length - 1); P.fi--; P.sel = null; buildToolbar(); commit();
}

// ---------- draw ----------
function draw() {
  const r = cvs.getBoundingClientRect(); ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  ctx.fillStyle = '#161a1f'; ctx.fillRect(0, 0, r.width, r.height);
  // grid
  const [qa, qb] = toP(0, 0), [qc, qd] = toP(r.width, r.height), gx0 = Math.min(qa, qc), gx1 = Math.max(qa, qc), gd0 = Math.min(qb, qd), gd1 = Math.max(qb, qd);
  const step = P.s > 60 ? .5 : 1;
  ctx.lineWidth = 1;
  for (let x = Math.floor(gx0); x <= gx1; x += step) { const [sx] = toS(x, 0); ctx.strokeStyle = x % 1 === 0 ? '#262c34' : '#1e232a'; ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, r.height); ctx.stroke(); }
  for (let d = Math.floor(gd0); d <= gd1; d += step) { const [, sy] = toS(0, d); ctx.strokeStyle = d % 1 === 0 ? '#262c34' : '#1e232a'; ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(r.width, sy); ctx.stroke(); }
  const f = fl();
  // lower floor ghost
  if (P.fi > 0) { ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); for (const w of S.data.floors[P.fi - 1].walls) { ctx.beginPath(); ctx.moveTo(...toS(w.x1, w.d1)); ctx.lineTo(...toS(w.x2, w.d2)); ctx.stroke(); } ctx.setLineDash([]); }
  // rooms
  for (const rm of f.rooms) {
    const [a, b] = toS(rm.x0, rm.d0), [c, d] = toS(rm.x1, rm.d1);
    ctx.fillStyle = presetColor(rm.floor) + 'aa'; ctx.fillRect(a, b, c - a, d - b);
    ctx.strokeStyle = isSel('room', rm) ? '#ffb020' : 'rgba(255,255,255,.25)'; ctx.lineWidth = isSel('room', rm) ? 3 : 1; ctx.strokeRect(a, b, c - a, d - b);
  }
  // stairs
  for (const st of S.data.stairs) {
    const G = stairGeom(st), B = G.bounds, cx = (B.x0 + B.x1) / 2, cd = (B.d0 + B.d1) / 2;
    if (st.floor === P.fi) {
      for (const s of G.steps) { const [a, b] = toS(s.x0, s.d0), [c, d] = toS(s.x1, s.d1); ctx.fillStyle = `rgba(170,170,170,${.25 + s.top / 6})`; ctx.fillRect(a, b, c - a, d - b); ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.strokeRect(a, b, c - a, d - b); }
      ctx.strokeStyle = '#ffd08a'; ctx.lineWidth = 2; ctx.beginPath(); G.path.forEach((p, i) => i ? ctx.lineTo(...toS(...p)) : ctx.moveTo(...toS(...p))); ctx.stroke();
      const [ex, ey] = toS(...G.path[3]), [px, py] = toS(...G.path[2]), an = Math.atan2(ey - py, ex - px);
      ctx.fillStyle = '#ffd08a'; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex - 10 * Math.cos(an - .5), ey - 10 * Math.sin(an - .5)); ctx.lineTo(ex - 10 * Math.cos(an + .5), ey - 10 * Math.sin(an + .5)); ctx.fill();
      label(`樓梯 ↑ ${S.data.floors[st.floor + 1]?.name || ''}`, cx, cd, '#fff');
    }
    if (st.floor === P.fi - 1) {
      for (const h of G.holes) { const [a, b] = toS(h.x0, h.d0), [c, d] = toS(h.x1, h.d1); ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(a, b, c - a, d - b); }
      const [ax, ad] = G.arrive; label('樓梯口 ↓', cx, cd, '#aaa'); const [sx, sy] = toS(ax, ad); ctx.fillStyle = '#7cff9a'; ctx.beginPath(); ctx.arc(sx, sy, 5, 0, 7); ctx.fill();
    }
    if ((st.floor === P.fi || st.floor === P.fi - 1) && isSel('stair', st)) { const [a, b] = toS(B.x0, B.d0), [c, d] = toS(B.x1, B.d1); ctx.strokeStyle = '#ffb020'; ctx.lineWidth = 3; ctx.strokeRect(a, b, c - a, d - b); }
  }
  // furniture
  for (const fu of f.furniture) {
    if (!CAT[fu.type]) continue;
    const fp = footprint(fu.type), [sx, sy] = toS(fu.x, fu.d);
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(-(fu.rot || 0) * Math.PI / 180);
    ctx.fillStyle = isSel('furn', fu) ? 'rgba(255,176,32,.6)' : 'rgba(210,170,110,.45)'; ctx.strokeStyle = isSel('furn', fu) ? '#ffb020' : 'rgba(255,230,190,.6)'; ctx.lineWidth = 1.5;
    const x = (fp.cx - fp.w / 2) * P.s, y = (fp.cz - fp.d / 2) * P.s;
    ctx.fillRect(x, y, fp.w * P.s, fp.d * P.s); ctx.strokeRect(x, y, fp.w * P.s, fp.d * P.s);
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(x, y + fp.d * P.s - 2, fp.w * P.s, 2); // front edge marker
    ctx.restore();
    if (P.s > 45) label(CAT[fu.type].n, fu.x, fu.d, 'rgba(255,255,255,.75)', 10);
  }
  // walls
  for (const w of f.walls) {
    const sel = isSel('wall', w), A = toS(w.x1, w.d1), B = toS(w.x2, w.d2);
    ctx.lineCap = 'butt'; ctx.strokeStyle = sel ? '#ffb020' : (w.kind === 'rail' ? '#9aa' : '#eceae4'); ctx.lineWidth = w.kind === 'rail' ? Math.max(2, .06 * P.s) : Math.max(3, .14 * P.s);
    if (w.kind === 'rail') ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(...A); ctx.lineTo(...B); ctx.stroke(); ctx.setLineDash([]);
    const L = Math.hypot(w.x2 - w.x1, w.d2 - w.d1), ux = (w.x2 - w.x1) / L, ud = (w.d2 - w.d1) / L;
    for (const o of w.ops || []) {
      const a = clamp(o.at - o.w / 2, 0, L), b = clamp(o.at + o.w / 2, 0, L);
      const pa = toS(w.x1 + ux * a, w.d1 + ud * a), pb = toS(w.x1 + ux * b, w.d1 + ud * b);
      ctx.strokeStyle = '#161a1f'; ctx.lineWidth = Math.max(3, .14 * P.s) + 2; ctx.beginPath(); ctx.moveTo(...pa); ctx.lineTo(...pb); ctx.stroke();
      const os = isSel('op', o);
      ctx.strokeStyle = os ? '#ffb020' : o.type === 'window' ? '#7cc4ff' : '#ffd08a'; ctx.lineWidth = 2;
      if (o.type === 'window') { for (const k of [-.03, .03]) { ctx.beginPath(); ctx.moveTo(pa[0] - ud * k * P.s, pa[1] + ux * k * P.s); ctx.lineTo(pb[0] - ud * k * P.s, pb[1] + ux * k * P.s); ctx.stroke(); } }
      else if (o.type === 'door' || o.type === 'door2') {
        const leaves = o.type === 'door2' ? [[a, 1, o.w / 2], [b, -1, o.w / 2]] : [[o.hinge === 'e' ? b : a, o.hinge === 'e' ? -1 : 1, o.w]];
        const nside = o.swing === 'a' ? 1 : -1; // a side normal = (ud, -ux)
        for (const [h, dir, lw] of leaves) {
          const hx = w.x1 + ux * h, hd = w.d1 + ud * h, ex = hx + ud * nside * lw, ed = hd - ux * nside * lw;
          ctx.beginPath(); ctx.moveTo(...toS(hx, hd)); ctx.lineTo(...toS(ex, ed)); ctx.stroke();
          const a0 = Math.atan2(F * ud * dir, ux * dir), a1 = Math.atan2(F * -ux * nside, ud * nside);
          ctx.beginPath(); const [cx, cy] = toS(hx, hd); let s0 = a0, s1 = a1; let df = s1 - s0; while (df > Math.PI) df -= 2 * Math.PI; while (df < -Math.PI) df += 2 * Math.PI;
          ctx.setLineDash([3, 3]); ctx.arc(cx, cy, lw * P.s, s0, s0 + df, df < 0); ctx.stroke(); ctx.setLineDash([]);
        }
      } else if (o.type === 'sliding') { for (const k of [-.03, .03]) { ctx.beginPath(); const off = k > 0 ? 0 : .1; ctx.moveTo(pa[0] - ud * k * P.s, pa[1] + ux * k * P.s); ctx.lineTo(pb[0] - ud * k * P.s, pb[1] + ux * k * P.s); ctx.stroke(); } }
      else { ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(...pa); ctx.lineTo(...pb); ctx.stroke(); ctx.setLineDash([]); }
    }
    if (sel) { handle(...A); handle(...B); if (P.s > 25) label(L.toFixed(2) + 'm', (w.x1 + w.x2) / 2, (w.d1 + w.d2) / 2 - F * .25, '#ffb020', 11); }
  }
  // room labels on top
  for (const rm of f.rooms) {
    const w = rm.x1 - rm.x0, d = rm.d1 - rm.d0;
    label(rm.name, (rm.x0 + rm.x1) / 2, (rm.d0 + rm.d1) / 2 - F * (P.s > 30 ? .15 : 0), '#fff', 12, true);
    if (P.s > 30) label(`${w.toFixed(2)}×${d.toFixed(2)}m`, (rm.x0 + rm.x1) / 2, (rm.d0 + rm.d1) / 2 + F * .25, 'rgba(255,255,255,.7)', 10);
    if (isSel('room', rm)) for (const [hx, hd] of roomHandles(rm)) handle(...toS(hx, hd));
  }
  // previews
  const dg = P.drag;
  if (dg && (dg.mode === 'newwall') && dg.end) { ctx.strokeStyle = '#ffb020'; ctx.lineWidth = Math.max(3, .14 * P.s); ctx.beginPath(); ctx.moveTo(...toS(...dg.start)); ctx.lineTo(...toS(...dg.end)); ctx.stroke(); label(Math.hypot(dg.end[0] - dg.start[0], dg.end[1] - dg.start[1]).toFixed(2) + 'm', (dg.start[0] + dg.end[0]) / 2, (dg.start[1] + dg.end[1]) / 2 - F * .3, '#ffb020'); }
  if (dg && dg.mode === 'newroom' && dg.end) { const [a, b] = toS(Math.min(dg.start[0], dg.end[0]), Math.min(dg.start[1], dg.end[1])), [c, d] = toS(Math.max(dg.start[0], dg.end[0]), Math.max(dg.start[1], dg.end[1])); ctx.fillStyle = 'rgba(255,176,32,.25)'; ctx.fillRect(a, b, c - a, d - b); ctx.strokeStyle = '#ffb020'; ctx.strokeRect(a, b, c - a, d - b); }
  // compass: street side
  ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; const [sx0, sy0] = toS(2.5, -3.75); ctx.fillText('▼ 馬路・大門（前）', sx0, sy0); const [sx1, sy1] = toS(2.5, 16.9); ctx.fillText('▲ 後面', sx1, sy1);
}
function label(t, x, d, c, size = 12, bold) { const [sx, sy] = toS(x, d); ctx.font = `${bold ? 'bold ' : ''}${size}px -apple-system,"PingFang TC",sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillText(t, sx + 1, sy + 1); ctx.fillStyle = c; ctx.fillText(t, sx, sy); }
function handle(sx, sy) { ctx.fillStyle = '#ffb020'; ctx.fillRect(sx - 6, sy - 6, 12, 12); ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.strokeRect(sx - 6, sy - 6, 12, 12); }
function roomHandles(r) { const mx = (r.x0 + r.x1) / 2, md = (r.d0 + r.d1) / 2; return [[r.x0, md, 'x0'], [r.x1, md, 'x1'], [mx, r.d0, 'd0'], [mx, r.d1, 'd1'], [r.x0, r.d0, 'x0d0'], [r.x1, r.d0, 'x1d0'], [r.x0, r.d1, 'x0d1'], [r.x1, r.d1, 'x1d1']]; }
const isSel = (k, o) => P.sel && P.sel.k === k && P.sel.o === o;

// ---------- hit test ----------
function segInfo(x, d, w) {
  const vx = w.x2 - w.x1, vd = w.d2 - w.d1, L = Math.hypot(vx, vd) || 1e-6; let t = ((x - w.x1) * vx + (d - w.d1) * vd) / (L * L); t = clamp(t, 0, 1);
  return { dist: Math.hypot(x - (w.x1 + vx * t), d - (w.d1 + vd * t)), s: t * L, L };
}
function pick(x, d) {
  const f = fl(), tol = 10 / P.s;
  if (P.sel) {
    if (P.sel.k === 'room') for (const [hx, hd, h] of roomHandles(P.sel.o)) if (Math.abs(x - hx) < tol && Math.abs(d - hd) < tol) return { k: 'room', o: P.sel.o, h };
    if (P.sel.k === 'wall') { const w = P.sel.o; if (Math.hypot(x - w.x1, d - w.d1) < tol * 1.3) return { k: 'wall', o: w, h: 1 }; if (Math.hypot(x - w.x2, d - w.d2) < tol * 1.3) return { k: 'wall', o: w, h: 2 }; }
  }
  for (const w of f.walls) { const si = segInfo(x, d, w); if (si.dist > tol + .1) continue; for (const o of w.ops || []) if (si.s > o.at - o.w / 2 - .05 && si.s < o.at + o.w / 2 + .05) return { k: 'op', o, w }; }
  let best = null;
  for (const w of f.walls) { const si = segInfo(x, d, w); if (si.dist < tol * .7 + .07 && (!best || si.dist < best.dist)) best = { k: 'wall', o: w, dist: si.dist }; }
  if (best) return best;
  for (let i = f.furniture.length - 1; i >= 0; i--) {
    const fu = f.furniture[i]; if (!CAT[fu.type]) continue; const fp = footprint(fu.type), a = (fu.rot || 0) * Math.PI / 180;
    const lx = (x - fu.x) * Math.cos(a) - (-(d - fu.d)) * Math.sin(a), lz = (x - fu.x) * Math.sin(a) + (-(d - fu.d)) * Math.cos(a);
    if (Math.abs(lx - fp.cx) < fp.w / 2 + .05 && Math.abs(lz - fp.cz) < fp.d / 2 + .05) return { k: 'furn', o: fu };
  }
  for (const st of S.data.stairs) { const B = stairBounds(st); if ((st.floor === P.fi || st.floor === P.fi - 1) && x > B.x0 && x < B.x1 && d > B.d0 && d < B.d1) return { k: 'stair', o: st }; }
  let rb = null;
  for (const r of f.rooms) if (x > r.x0 && x < r.x1 && d > r.d0 && d < r.d1) { const a = (r.x1 - r.x0) * (r.d1 - r.d0); if (!rb || a < rb.a) rb = { k: 'room', o: r, a }; }
  return rb;
}
function nearestWall(x, d, maxD = .6) { let b = null; for (const w of fl().walls) { if (w.kind === 'rail') continue; const si = segInfo(x, d, w); if (si.dist < maxD && (!b || si.dist < b.si.dist)) b = { w, si }; } return b; }
function snapPoint(x, d, exclude) {
  let best = null; const tol = Math.max(.12, 12 / P.s);
  for (const w of fl().walls) for (const [px, pd] of [[w.x1, w.d1], [w.x2, w.d2]]) { if (exclude && exclude(w)) continue; const dd = Math.hypot(px - x, pd - d); if (dd < tol && (!best || dd < best[2])) best = [px, pd, dd]; }
  return best ? [best[0], best[1]] : [snapV(x), snapV(d)];
}

// ---------- pointer ----------
const pts = new Map(); let pinch = null;
cvs.addEventListener('pointerdown', e => {
  cvs.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
  if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), s: P.s, cx: (a[0] + b[0]) / 2, cy: (a[1] + b[1]) / 2, ox: P.ox, oy: P.oy }; P.drag = null; return; }
  const rc = cvs.getBoundingClientRect(), sx = e.clientX - rc.left, sy = e.clientY - rc.top, [x, d] = toP(sx, sy);
  if (e.button === 1 || e.button === 2) { P.drag = { mode: 'pan', sx, sy, ox: P.ox, oy: P.oy }; return; }
  const t = P.tool;
  if (t === 'wall' || t === 'rail') { P.drag = { mode: 'newwall', start: snapPoint(x, d), end: null, rail: t === 'rail' }; return; }
  if (t === 'room') { P.drag = { mode: 'newroom', start: [snapV(x), snapV(d)], end: null }; return; }
  if (t === 'stair') {
    if (P.fi >= S.data.floors.length - 1) { toast('最上層沒有更上面的樓層，請先按「＋」新增樓層'); return; }
    const st = { id: nid('st'), floor: P.fi, x: snapV(x - .9), d: snapV(d - 1.75), w: 1.8, len: 3.5, rot: 0, flip: false };
    S.data.stairs.push(st); P.sel = { k: 'stair', o: st }; P.tool = 'select'; buildToolbar(); commit(); toast('已加入樓梯，可在右側旋轉、調整尺寸'); return;
  }
  if (t === 'door' || t === 'window' || t === 'opening') {
    const nw = nearestWall(x, d); if (!nw) { toast('請點在牆壁上'); return; }
    const L = nw.si.L, def = { door: { type: 'door', w: .8, h: 2.1, sill: 0, style: 'wood', swing: 'b', hinge: 's' }, window: { type: 'window', w: 1.2, h: 1.2, sill: .9 }, opening: { type: 'opening', w: .9, h: 2.1, sill: 0 } }[t];
    const w0 = Math.min(def.w, L - .1); if (w0 < .3) { toast('牆太短了'); return; }
    const o = { id: nid('o'), ...def, w: w0, at: clamp(snapV(nw.si.s), w0 / 2, L - w0 / 2) };
    (nw.w.ops || (nw.w.ops = [])).push(o); P.sel = { k: 'op', o, w: nw.w }; P.tool = 'select'; buildToolbar(); commit(); return;
  }
  const hit = pick(x, d);
  if (hit) {
    P.sel = { k: hit.k, o: hit.o, w: hit.w }; renderProps();
    const start = { x, d, snap: JSON.parse(JSON.stringify(hit.o)) };
    if (hit.k === 'wall') { const w = hit.o; start.joined = joinedEnds(w); }
    P.drag = { mode: 'move', hit, start, moved: false };
  } else { P.sel = null; renderProps(); P.drag = { mode: 'pan', sx, sy, ox: P.ox, oy: P.oy }; }
  draw();
});
function joinedEnds(w) {
  const out = []; for (const o of fl().walls) { if (o === w) continue; for (const e of [1, 2]) { const ox = o['x' + e], od = o['d' + e]; if (Math.hypot(ox - w.x1, od - w.d1) < .03) out.push([o, e, 1]); else if (Math.hypot(ox - w.x2, od - w.d2) < .03) out.push([o, e, 2]); } } return out;
}
cvs.addEventListener('pointermove', e => {
  if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
  if (pinch && pts.size === 2) {
    const [a, b] = [...pts.values()], dd = Math.hypot(a[0] - b[0], a[1] - b[1]), cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2, rc = cvs.getBoundingClientRect();
    const ns = clamp(pinch.s * dd / pinch.d, 8, 300), k = ns / pinch.s;
    P.s = ns; P.ox = (cx - rc.left) - ((pinch.cx - rc.left) - pinch.ox) * k; P.oy = (cy - rc.top) - ((pinch.cy - rc.top) - pinch.oy) * k; draw(); return;
  }
  const dg = P.drag; if (!dg) return;
  const rc = cvs.getBoundingClientRect(), sx = e.clientX - rc.left, sy = e.clientY - rc.top, [x, d] = toP(sx, sy);
  if (dg.mode === 'pan') { P.ox = dg.ox + sx - dg.sx; P.oy = dg.oy + sy - dg.sy; draw(); return; }
  if (dg.mode === 'newwall') { let [ex, ed] = snapPoint(x, d); const [s0, s1] = dg.start; if (Math.abs(ex - s0) < Math.abs(ed - s1) * .15) ex = s0; else if (Math.abs(ed - s1) < Math.abs(ex - s0) * .15) ed = s1; dg.end = [ex, ed]; draw(); return; }
  if (dg.mode === 'newroom') { dg.end = [snapV(x), snapV(d)]; draw(); return; }
  if (dg.mode === 'move') {
    const h = dg.hit, o = h.o, s = dg.start.snap, dx = x - dg.start.x, dd = d - dg.start.d;
    if (!dg.moved && Math.hypot(dx, dd) * P.s < 4) return; dg.moved = true;
    if (h.k === 'room') {
      if (!h.h) { o.x0 = snapV(s.x0 + dx); o.x1 = o.x0 + (s.x1 - s.x0); o.d0 = snapV(s.d0 + dd); o.d1 = o.d0 + (s.d1 - s.d0); }
      else { if (h.h.includes('x0')) o.x0 = Math.min(snapV(x), o.x1 - .3); if (h.h.includes('x1')) o.x1 = Math.max(snapV(x), o.x0 + .3); if (h.h.includes('d0')) o.d0 = Math.min(snapV(d), o.d1 - .3); if (h.h.includes('d1')) o.d1 = Math.max(snapV(d), o.d0 + .3); }
    } else if (h.k === 'wall') {
      if (h.h) { const [px, pd] = snapPoint(x, d, w => w === o); o['x' + h.h] = px; o['d' + h.h] = pd; for (const [w2, e2, mine] of dg.start.joined) if (mine === h.h) { w2['x' + e2] = px; w2['d' + e2] = pd; } }
      else { const mx = snapV(dx), md = snapV(dd); o.x1 = s.x1 + mx; o.d1 = s.d1 + md; o.x2 = s.x2 + mx; o.d2 = s.d2 + md; for (const [w2, e2, mine] of dg.start.joined) { w2['x' + e2] = o['x' + mine]; w2['d' + e2] = o['d' + mine]; } }
    } else if (h.k === 'op') { const si = segInfo(x, d, h.w); o.at = clamp(snapV(si.s), o.w / 2, si.L - o.w / 2); }
    else if (h.k === 'furn' || h.k === 'stair') { o.x = snapV(s.x + dx); o.d = snapV(s.d + dd); }
    draw();
  }
});
function pointerEnd(e) {
  pts.delete(e.pointerId); if (pts.size < 2) pinch = null;
  const dg = P.drag; P.drag = null; if (!dg) return;
  if (dg.mode === 'newwall' && dg.end) {
    const L = Math.hypot(dg.end[0] - dg.start[0], dg.end[1] - dg.start[1]);
    if (L >= .2) { const w = { id: nid('w'), x1: dg.start[0], d1: dg.start[1], x2: dg.end[0], d2: dg.end[1], a: 'cream', b: 'cream', kind: dg.rail ? 'rail' : 'wall', ops: [] }; fl().walls.push(w); P.sel = { k: 'wall', o: w }; commit(); }
    draw(); return;
  }
  if (dg.mode === 'newroom' && dg.end) {
    const x0 = Math.min(dg.start[0], dg.end[0]), x1 = Math.max(dg.start[0], dg.end[0]), d0 = Math.min(dg.start[1], dg.end[1]), d1 = Math.max(dg.start[1], dg.end[1]);
    if (x1 - x0 >= .3 && d1 - d0 >= .3) { const r = { id: nid('r'), name: '新空間', x0, d0, x1, d1, floor: 'wood' }; fl().rooms.push(r); P.sel = { k: 'room', o: r }; P.tool = 'select'; buildToolbar(); commit(); toast('已新增空間，可在右側「加四面牆」'); }
    draw(); return;
  }
  if (dg.mode === 'move' && dg.moved) commit();
}
cvs.addEventListener('pointerup', pointerEnd); cvs.addEventListener('pointercancel', pointerEnd);
cvs.addEventListener('wheel', e => {
  e.preventDefault(); const rc = cvs.getBoundingClientRect(), sx = e.clientX - rc.left, sy = e.clientY - rc.top;
  const k = Math.exp(-e.deltaY * .0015), ns = clamp(P.s * k, 8, 300), kk = ns / P.s; P.ox = sx - (sx - P.ox) * kk; P.oy = sy - (sy - P.oy) * kk; P.s = ns; draw();
}, { passive: false });
cvs.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('keydown', e => {
  if (!$('#plan').classList.contains('show') || /INPUT|SELECT/.test(e.target.tagName)) return;
  if ((e.key === 'Delete' || e.key === 'Backspace') && P.sel) { e.preventDefault(); delSel(); }
  if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  if (e.key === 'r' && P.sel?.k === 'furn') { P.sel.o.rot = ((P.sel.o.rot || 0) + 90) % 360; commit(); }
  if (e.key === 'Escape') { P.sel = null; P.tool = 'select'; buildToolbar(); renderProps(); draw(); }
});

// ---------- selection ops ----------
function delSel() {
  const s = P.sel; if (!s) return; const f = fl();
  if (s.k === 'room') f.rooms = f.rooms.filter(r => r !== s.o);
  if (s.k === 'wall') f.walls = f.walls.filter(w => w !== s.o);
  if (s.k === 'op') s.w.ops = s.w.ops.filter(o => o !== s.o);
  if (s.k === 'furn') f.furniture = f.furniture.filter(o => o !== s.o);
  if (s.k === 'stair') { if (!confirm('刪除樓梯？上下樓會無法通行。')) return; S.data.stairs = S.data.stairs.filter(o => o !== s.o); }
  P.sel = null; commit();
}
function wallsAround(r) {
  const f = fl(), has = (x1, d1, x2, d2) => f.walls.some(w => (Math.hypot(w.x1 - x1, w.d1 - d1) < .05 && Math.hypot(w.x2 - x2, w.d2 - d2) < .05) || (Math.hypot(w.x1 - x2, w.d1 - d2) < .05 && Math.hypot(w.x2 - x1, w.d2 - d1) < .05));
  let n = 0;
  for (const [x1, d1, x2, d2] of [[r.x0, r.d0, r.x1, r.d0], [r.x1, r.d0, r.x1, r.d1], [r.x0, r.d1, r.x1, r.d1], [r.x0, r.d0, r.x0, r.d1]]) if (!has(x1, d1, x2, d2)) { f.walls.push({ id: nid('w'), x1, d1, x2, d2, a: 'cream', b: 'cream', kind: 'wall', ops: [] }); n++; }
  toast(n ? `已加入 ${n} 面牆，再用「加門」開門` : '四周已經有牆了'); commit();
}
function splitWall(w) {
  const mx = snapV((w.x1 + w.x2) / 2), md = snapV((w.d1 + w.d2) / 2), L = Math.hypot(w.x2 - w.x1, w.d2 - w.d1), half = Math.hypot(mx - w.x1, md - w.d1);
  const w2 = { ...w, id: nid('w'), x1: mx, d1: md, ops: (w.ops || []).filter(o => o.at > half).map(o => ({ ...o, at: o.at - half })) };
  w.ops = (w.ops || []).filter(o => o.at <= half); w.x2 = mx; w.d2 = md; fl().walls.push(w2); P.sel = { k: 'wall', o: w }; commit();
}
function showCatalog() {
  const groups = {}; for (const id in CAT) (groups[CAT[id].grp] || (groups[CAT[id].grp] = [])).push(id);
  $('#pprops').innerHTML = `<div class="ph">加家具 <small>點一下放到畫面中央</small></div>` + Object.entries(groups).map(([g, ids]) => `<div class="grp">${g}</div><div class="grid">${ids.map(id => `<button data-add="${id}">${CAT[id].n}</button>`).join('')}</div>`).join('');
  $('#pprops').classList.add('show');
  $('#pprops').querySelectorAll('[data-add]').forEach(b => b.onclick = () => {
    const r = cvs.getBoundingClientRect(), [x, d] = toP(r.width / 2, r.height / 2), type = b.dataset.add;
    const fu = { type, x: snapV(x), d: snapV(d), rot: 0, y: CAT[type].y || 0 }; fl().furniture.push(fu); P.sel = { k: 'furn', o: fu }; P.tool = 'select'; buildToolbar(); commit(); toast(`已加入${CAT[type].n}，拖曳到想要的位置`);
  });
}
function swatchSelect(cur, name) { return `<div class="sws" data-name="${name}">${Object.entries(PRESETS).map(([id, p]) => `<button data-v="${id}" title="${p.n}" class="${id === cur ? 'on' : ''}" style="background:${presetColor(id)}"></button>`).join('')}</div>`; }
function num(label, key, val, step = .05, min = -50, max = 50) { return `<label class="pf"><span>${label}</span><input type="number" data-k="${key}" value="${(+val).toFixed(2)}" step="${step}" min="${min}" max="${max}"></label>`; }
// describe a wall side by the room it faces (side a normal = (ud, -ux) on the plan)
function sideName(w, side) {
  const L = Math.hypot(w.x2 - w.x1, w.d2 - w.d1) || 1, ux = (w.x2 - w.x1) / L, ud = (w.d2 - w.d1) / L, k = side === 'a' ? 1 : -1;
  const px = (w.x1 + w.x2) / 2 + ud * k * .3, pd = (w.d1 + w.d2) / 2 - ux * k * .3;
  const r = fl().rooms.filter(r => px > r.x0 && px < r.x1 && pd > r.d0 && pd < r.d1).sort((a, b) => (a.x1 - a.x0) * (a.d1 - a.d0) - (b.x1 - b.x0) * (b.d1 - b.d0))[0];
  return `${side.toUpperCase()} 面顏色：${r ? r.name + ' 這一側' : '屋外這一側'}`;
}
export function renderProps() {
  const el = $('#pprops'), s = P.sel;
  if (!s) {
    if (P.tool === 'furn') return showCatalog();
    el.innerHTML = `<div class="ph">${fl().name} 平面圖</div><div class="tip">・點選房間、牆、門窗、家具或樓梯來修改<br>・拖曳房間的黃色方塊調整尺寸<br>・拖曳牆的端點改長度，相連的牆會一起動<br>・用左邊工具畫牆、框新空間、加門窗<br>・修改會自動存檔並更新 3D</div>
      <div class="rowb"><button id="pRename">✏️ 樓層名稱</button><button id="pDelF">🗑 刪除此樓層</button></div>`;
    el.classList.toggle('show', innerWidth > 760);
    $('#pRename').onclick = () => { const n = prompt('樓層名稱', fl().name); if (n) { fl().name = n; buildToolbar(); commit(); } };
    $('#pDelF').onclick = delFloor; return;
  }
  el.classList.add('show');
  let h = '';
  if (s.k === 'room') {
    const r = s.o;
    h = `<div class="ph">空間</div><label class="pf"><span>名稱</span><input type="text" data-k="name" value="${r.name}"></label>
      ${num('左邊 X', 'x0', r.x0)}${num('前緣 深度', 'd0', r.d0)}${num('寬 (m)', 'w', r.x1 - r.x0, .05, .3)}${num('深 (m)', 'dd', r.d1 - r.d0, .05, .3)}
      <div class="grp">地板材質</div>${swatchSelect(r.floor, 'floor')}
      <div class="rowb"><button id="pWalls">🧱 加四面牆</button><button id="pDel" class="danger">🗑 刪除空間</button></div>`;
  } else if (s.k === 'wall') {
    const w = s.o, L = Math.hypot(w.x2 - w.x1, w.d2 - w.d1);
    h = `<div class="ph">${w.kind === 'rail' ? '欄杆' : '牆'}</div>${num('長度 (m)', 'len', L, .05, .2)}
      <label class="pf"><span>類型</span><select data-k="kind"><option value="wall" ${w.kind !== 'rail' ? 'selected' : ''}>牆</option><option value="rail" ${w.kind === 'rail' ? 'selected' : ''}>欄杆</option></select></label>
      ${w.kind !== 'rail' ? `<div class="grp">${sideName(w, 'a')}</div>${swatchSelect(w.a, 'a')}<div class="grp">${sideName(w, 'b')}</div>${swatchSelect(w.b, 'b')}` : ''}
      <div class="rowb"><button id="pAddDoor">🚪 加門</button><button id="pAddWin">🪟 加窗</button><button id="pSplit">✂️ 分割</button><button id="pDel" class="danger">🗑 刪除牆</button></div>`;
  } else if (s.k === 'op') {
    const o = s.o;
    h = `<div class="ph">${OPS[o.type]}</div>
      <label class="pf"><span>類型</span><select data-k="type">${Object.entries(OPS).map(([k, n]) => `<option value="${k}" ${k === o.type ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      ${num('寬 (m)', 'w', o.w, .05, .3, 6)}${num('高 (m)', 'h', o.h, .05, .3, 3.1)}${num('離地 (m)', 'sill', o.sill, .05, 0, 2.5)}${num('位置 (m)', 'at', o.at, .05, 0, 50)}
      ${['door', 'door2', 'sliding'].includes(o.type) ? `<label class="pf"><span>門款</span><select data-k="style">${Object.entries(DOOR_STYLE_NAMES).map(([k, n]) => `<option value="${k}" ${k === o.style ? 'selected' : ''}>${n}</option>`).join('')}</select></label>` : ''}
      ${o.type === 'window' ? `<label class="pf"><span>窗簾</span><select data-k="curtain">${[['', '無'], ['#7f9fcc', '藍'], ['#f3ead2', '米白'], ['#e8a6c0', '粉'], ['#8a8fa6', '灰'], ['#5b6fb5', '深藍']].map(([v, n]) => `<option value="${v}" ${v === (o.curtain || '') ? 'selected' : ''}>${n}</option>`).join('')}</select></label>` : ''}
      <div class="rowb">${['door', 'door2'].includes(o.type) ? `<button id="pSwing">↔ 換開門方向</button>` : ''}${o.type === 'door' ? `<button id="pHinge">⇋ 門軸換邊</button>` : ''}<button id="pDel" class="danger">🗑 刪除</button></div>`;
  } else if (s.k === 'furn') {
    const fu = s.o;
    h = `<div class="ph">${CAT[fu.type]?.n || fu.type}</div>${num('X', 'x', fu.x)}${num('深度', 'd', fu.d)}${num('離地高度', 'y', fu.y || 0, .05, 0, 3)}${num('旋轉 (度)', 'rot', fu.rot || 0, 15, -360, 360)}
      <div class="rowb"><button id="pRot">↻ 轉 90°</button><button id="pDup">⧉ 複製</button><button id="pDel" class="danger">🗑 刪除</button></div>`;
  } else if (s.k === 'stair') {
    const st = s.o, fls = S.data.floors;
    h = `<div class="ph">樓梯（${fls[st.floor]?.name} → ${fls[st.floor + 1]?.name || '?'}）</div>
      <label class="pf"><span>連接樓層</span><select data-k="floor">${fls.slice(0, -1).map((f, i) => `<option value="${i}" ${i === st.floor ? 'selected' : ''}>${f.name} → ${fls[i + 1].name}</option>`).join('')}</select></label>
      ${num('X', 'x', st.x)}${num('深度', 'd', st.d)}${num('寬 (m)', 'w', st.w, .05, 1.0, 3)}${num('長 (m)', 'len', st.len, .05, 2.6, 6)}
      <label class="pf"><span>踏板</span><select data-k="mat">${[['', '預設'], ['concrete', '水泥'], ['lightwood', '淺木'], ['wood', '木頭'], ['wmarble', '白大理石'], ['stone', '灰石']].map(([v, n]) => `<option value="${v}" ${v === (st.mat || '') ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <div class="tip">方向：${['朝前 ↑', '朝右 →', '朝後 ↓', '朝左 ←'][((st.rot || 0) % 360) / 90]}${st.flip ? '（鏡像）' : ''}　黃色箭頭是往上走的路線，綠點是上一層的出口。</div>
      <div class="rowb"><button id="pStL">↺ 轉 90°</button><button id="pStR">↻ 轉 90°</button><button id="pStF">⇋ 左右鏡像</button><button id="pDel" class="danger">🗑 刪除樓梯</button></div>`;
  }
  el.innerHTML = h + `<div class="rowb"><button id="pDone">完成</button></div>`;
  el.querySelectorAll('input[data-k],select[data-k]').forEach(inp => inp.onchange = () => {
    const k = inp.dataset.k, v = inp.type === 'number' ? +inp.value : inp.value, o = s.o;
    if (s.k === 'room') { if (k === 'w') o.x1 = o.x0 + Math.max(.3, v); else if (k === 'dd') o.d1 = o.d0 + Math.max(.3, v); else if (k === 'x0') { const w = o.x1 - o.x0; o.x0 = v; o.x1 = v + w; } else if (k === 'd0') { const d = o.d1 - o.d0; o.d0 = v; o.d1 = v + d; } else o[k] = v; }
    else if (s.k === 'wall' && k === 'len') { const L = Math.hypot(o.x2 - o.x1, o.d2 - o.d1); const j = joinedEnds(o).filter(x => x[2] === 2); o.x2 = o.x1 + (o.x2 - o.x1) / L * v; o.d2 = o.d1 + (o.d2 - o.d1) / L * v; for (const [w2, e2] of j) { w2['x' + e2] = o.x2; w2['d' + e2] = o.d2; } }
    else if (s.k === 'stair' && k === 'floor') { o.floor = +v; }
    else if (s.k === 'stair' && (k === 'w' || k === 'len')) { o[k] = clamp(v, k === 'w' ? 1.0 : 2.6, k === 'w' ? 3 : 6); }
    else if (s.k === 'op' && k === 'type') { o.type = v; if (v === 'window') { o.sill = o.sill || .9; o.h = Math.min(o.h, 1.4); } else { o.sill = 0; o.h = Math.max(o.h, 2.05); o.style = o.style || 'wood'; o.swing = o.swing || 'b'; o.hinge = o.hinge || 's'; } if (v === 'door2' || v === 'sliding') o.w = Math.max(o.w, 1.2); }
    else o[k] = v;
    commit();
  });
  el.querySelectorAll('.sws').forEach(sw => sw.querySelectorAll('button').forEach(b => b.onclick = () => { s.o[sw.dataset.name] = b.dataset.v; commit(); }));
  const on = (id, f) => { const b = el.querySelector('#' + id); if (b) b.onclick = f; };
  on('pDel', delSel); on('pDone', () => { P.sel = null; renderProps(); draw(); });
  on('pWalls', () => wallsAround(s.o)); on('pSplit', () => splitWall(s.o));
  on('pAddDoor', () => { P.tool = 'door'; buildToolbar(); hintTool(); toast('點牆上要開門的位置'); });
  on('pAddWin', () => { P.tool = 'window'; buildToolbar(); hintTool(); toast('點牆上要開窗的位置'); });
  on('pSwing', () => { s.o.swing = s.o.swing === 'a' ? 'b' : 'a'; commit(); });
  on('pHinge', () => { s.o.hinge = s.o.hinge === 'e' ? 's' : 'e'; commit(); });
  on('pRot', () => { s.o.rot = ((s.o.rot || 0) + 90) % 360; commit(); });
  const rotSt = dir => { const st = s.o, B = stairBounds(st), cx = (B.x0 + B.x1) / 2, cd = (B.d0 + B.d1) / 2; st.rot = (((st.rot || 0) + dir) % 360 + 360) % 360; const N = stairBounds({ ...st, x: 0, d: 0 }); st.x = snapV(cx - N.x1 / 2); st.d = snapV(cd - N.d1 / 2); commit(); };
  on('pStL', () => rotSt(-90)); on('pStR', () => rotSt(90)); on('pStF', () => { s.o.flip = !s.o.flip; commit(); });
  on('pDup', () => { const c = { ...s.o, x: s.o.x + .3, d: s.o.d + .3 }; fl().furniture.push(c); P.sel = { k: 'furn', o: c }; commit(); });
}
hintTool();
