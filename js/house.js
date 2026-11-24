// house: build 3D from data, collisions, doors, lights, destruction blocks
import { THREE, mergeGeometries, S, scene, camera, M, P, presetColor, BG, bx, cy, sp, pl, boxUV, DEG, clamp, canvasPlane } from './core.js';
import { CAT, buildFurniture } from './catalog.js';

export const FH = 3.2, CH = 3.0, T = 0.12;
let dataRef = null;
// unified floor list: normal floors first, then zones (basement, sewer, backrooms) which sit at their own height
export const allFl = (d = S.data || dataRef) => d ? [...d.floors, ...(d.zones || [])] : [];
export const zoneIdx = (d, zid) => { const k = (d.zones || []).findIndex(z => z.id === zid); return k < 0 ? -1 : d.floors.length + k; };
export const entFi = (e, d = S.data || dataRef) => e.zid ? zoneIdx(d, e.zid) : (e.fi || 0);
export const zoneOf = (fi, d = S.data || dataRef) => d && fi >= d.floors.length ? d.zones[fi - d.floors.length] : null;
export const floorY = i => { const d = S.data || dataRef, n = d ? d.floors.length : 99; return i < n ? i * FH : (d.zones?.[i - n]?.y ?? 0); };
export const H = {
  root: new THREE.Group(), floors: [], segs: [], steps: [], solids: [], cells: [], doors: [], lamps: [], surf: {},
  furn: [], breakables: [], wallMeshes: [], blockMeshes: [], slabMeshes: [], destruct: false, totalBlocks: 0, brokenBlocks: 0,
  onBreak: null,
};
scene.add(H.root);
const edgeMat = M('#e9e5dc'), ceilMat = M('#ece7dd', { r: .95 });

// ---------- lights ----------
export const hemi = new THREE.HemisphereLight('#ffffff', '#6b6a60', 1.0); scene.add(hemi);
export const amb = new THREE.AmbientLight('#ffffff', 0.35); scene.add(amb);
export const sun = new THREE.DirectionalLight('#fff4e0', 1.6); sun.position.set(-6, 20, 14); scene.add(sun);
const POOL = matchMedia('(pointer: coarse)').matches ? 4 : 6;
const pool = []; for (let i = 0; i < POOL; i++) { const L = new THREE.PointLight('#fff1dc', 0, 0, 1.6); scene.add(L); pool.push(L); }
export const lightCfg = { intensity: 8, flicker: 0, mult: 1, lockFog: false, steady: false };
export function setNight(v) { S.night = v; applyEnv(true); }

// ---------- environment (season / brightness / colour), set by the admin ----------
export const DEF_ENV = { season: 'none', bright: 1, tint: '#ffffff', lamp: '#fff1dc', fog: 0, sky: '' };
export const SEASONS = { none: '一般', spring: '春天 🌸', summer: '夏天 ☀️', autumn: '秋天 🍁', winter: '冬天 ❄️' };
const SEASON = {
  none: { sky: '#b9d2e6', sun: '#fff4e0', ground: '#6f7a62' }, spring: { sky: '#cfe6f3', sun: '#fff0f2', ground: '#86ad6a', p: '#ffc4dc', ps: .07 },
  summer: { sky: '#86c3f2', sun: '#fff1c4', ground: '#5d8f42', sunI: 1.35 }, autumn: { sky: '#dccbaa', sun: '#ffc68a', ground: '#9c7b45', p: '#d9792a', ps: .1 },
  winter: { sky: '#d6dee7', sun: '#e8f0ff', ground: '#e9eef2', p: '#ffffff', ps: .06, sunI: .8 },
};
let envKey = '', curSeason = SEASON.none, underground = false;
const extMat = { ground: new THREE.MeshStandardMaterial({ color: '#6f7a62', roughness: 1 }) };
export function envFor(fi) { const d = S.data || dataRef, z = zoneOf(fi, d); return { ...DEF_ENV, ...(d?.env || {}), ...(z?.env || {}), zone: z }; }
export function applyEnv(force) {
  const d = dataRef; if (!d) return;
  const fi = floorOf(camera.position.y - 1.5), e = envFor(fi), z = e.zone;
  const k = JSON.stringify(e) + S.night + lightCfg.lockFog + lightCfg.steady; if (!force && k === envKey) return; envKey = k;
  const se = SEASON[e.season] || SEASON.none, b = +e.bright || 1; curSeason = se; underground = !!z;
  scene.background.set(z ? (e.sky || '#050505') : S.night ? '#0b1020' : (e.sky || se.sky));
  hemi.color.set(e.tint); hemi.intensity = (S.night ? .1 : z ? .5 : 1.0) * b; amb.color.set(e.tint); amb.intensity = (S.night ? .04 : .35) * b;
  sun.intensity = (S.night || z ? 0 : 1.6 * (se.sunI || 1)) * b; sun.color.set(se.sun);
  // steady mode (prop hunt): no lights following the camera, just even, bright light everywhere that never changes
  if (lightCfg.steady) { hemi.intensity = (z ? 1.4 : 1.65) * b; amb.intensity = (z ? 1 : 1) * b; }
  for (const L of pool) L.color.set(e.lamp); lightCfg.mult = b;
  extMat.ground.color.set(se.ground);
  if (!lightCfg.lockFog) scene.fog = +e.fog > 0 ? new THREE.FogExp2(scene.background.clone(), +e.fog) : null;
}
// falling petals / leaves / snow around the camera (never inside the house footprint)
const PN = 700, pPos = new Float32Array(PN * 3), pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
const pMat = new THREE.PointsMaterial({ size: .07, color: '#fff', transparent: true, opacity: .9, depthWrite: false });
const flakes = new THREE.Points(pGeo, pMat); flakes.frustumCulled = false; flakes.visible = false; scene.add(flakes);
for (let i = 0; i < PN; i++) { pPos[i * 3] = (Math.random() - .5) * 30; pPos[i * 3 + 1] = Math.random() * 12; pPos[i * 3 + 2] = (Math.random() - .5) * 30; }
let houseRect = { x0: 0, x1: 5, d0: -3.2, d1: 16.5 };
const fy = new Float32Array(PN); for (let i = 0; i < PN; i++) fy[i] = Math.random() * 12;
function updateFlakes(dt, t) {
  const se = curSeason, on = !!se.p && !underground && camera.position.y > -1; flakes.visible = on; if (!on) return;
  pMat.color.set(se.p); pMat.size = se.ps; const cp = camera.position, fall = se === SEASON.winter ? .9 : se === SEASON.spring ? .6 : 1.1, R = houseRect;
  for (let i = 0; i < PN; i++) {
    let x = pPos[i * 3], y = fy[i], z = pPos[i * 3 + 2];
    y -= fall * dt * (.6 + (i % 7) / 10); x += Math.sin(t * .8 + i) * dt * .4;
    if (y < 0 || Math.abs(x - cp.x) > 15 || Math.abs(z - cp.z) > 15) { x = cp.x + (Math.random() - .5) * 30; z = cp.z + (Math.random() - .5) * 30; y = 4 + Math.random() * 8; }
    const inside = x > R.x0 - .1 && x < R.x1 + .1 && -z > R.d0 - .1 && -z < R.d1 + .1;
    fy[i] = y; pPos[i * 3] = x; pPos[i * 3 + 1] = inside ? -1000 : y; pPos[i * 3 + 2] = z;
  }
  pGeo.attributes.position.needsUpdate = true;
}

// ---------- stairs ----------
// A U-shaped stair is defined in a local frame (width w along lx, length len along ld, flight 1 starts at
// ld = len and climbs towards ld = 0, landing at ld = 0, flight 2 climbs back). rot (0/90/180/270, clockwise
// on the plan) and flip (mirror left/right) place it in the house; x,d is the top-left corner of its bounds.
export function stairBounds(st) {
  const r = (((st.rot || 0) % 360) + 360) % 360, side = r === 90 || r === 270;
  return { x0: st.x, d0: st.d, x1: st.x + (side ? st.len : st.w), d1: st.d + (side ? st.w : st.len) };
}
function stairXf(st) {
  const r = (((st.rot || 0) % 360) + 360) % 360, w = st.w, L = st.len, f = !!st.flip;
  const pt = (lx, ld) => { if (f) lx = w - lx; let x = lx, d = ld; if (r === 90) { x = L - ld; d = lx; } else if (r === 180) { x = w - lx; d = L - ld; } else if (r === 270) { x = ld; d = w - lx; } return [st.x + x, st.d + d]; };
  const vec = (dx, dd) => { if (f) dx = -dx; if (r === 90) return [-dd, dx]; if (r === 180) return [-dx, -dd]; if (r === 270) return [dd, -dx]; return [dx, dd]; };
  const rect = a => { const p = pt(a.x0, a.d0), q = pt(a.x1, a.d1); return { ...a, x0: Math.min(p[0], q[0]), x1: Math.max(p[0], q[0]), d0: Math.min(p[1], q[1]), d1: Math.max(p[1], q[1]) }; };
  return { pt, vec, rect };
}
export function stairGeom(st) {
  const w = st.w, len = st.len, half = w / 2, n1 = 7, n2 = 9, r = FH / 16;
  const f1s = len - 0.9, f1e = 0.7, run1 = (f1s - f1e) / n1, f2e = len - 0.37, run2 = (f2e - f1e) / n2;
  const X = stairXf(st), L = [];
  for (let i = 0; i < n1; i++) L.push({ x0: .03, x1: half - .02, d0: f1s - (i + 1) * run1, d1: f1s - i * run1, top: (i + 1) * r, down: 1 });
  L.push({ x0: .03, x1: w - .03, d0: .03, d1: f1e, top: n1 * r, landing: 1 });
  for (let i = 0; i < n2; i++) L.push({ x0: half + .02, x1: w - .03, d0: f1e + i * run2, d1: f1e + (i + 1) * run2, top: (n1 + i + 1) * r, down: -1 });
  const steps = L.map(s => { const o = X.rect(s); if (s.down) o.dv = X.vec(0, s.down); return o; });
  const holes = [X.rect({ x0: 0, d0: 0, x1: w, d1: f1s }), X.rect({ x0: half, d0: f1s, x1: w, d1: f2e })];
  return {
    steps, holes,
    wall: [X.pt(half, f1e), X.pt(half, f1s)],
    rails: [[X.pt(.08, f1s), r, X.pt(.08, f1e), 7 * r], [X.pt(w - .08, f1e), 7 * r, X.pt(w - .08, f2e), 16 * r]],
    guards: [[X.pt(0, f1s), X.pt(half, f1s)], [X.pt(half, f1s), X.pt(half, f2e - run2 - .02)]],
    path: [X.pt(w * .25, len - .15), X.pt(w * .25, .35), X.pt(w * .75, .35), X.pt(w * .75, f2e)],
    start: X.pt(w * .25, len - .25), arrive: X.pt(w * .75, Math.min(len - .1, f2e + .15)), bounds: stairBounds(st),
  };
}

// ---------- helpers ----------
function rectCells(r, holes) {
  const xs = [r.x0, r.x1], ds = [r.d0, r.d1];
  for (const h of holes) { if (h.x1 <= r.x0 || h.x0 >= r.x1 || h.d1 <= r.d0 || h.d0 >= r.d1) continue; xs.push(clamp(h.x0, r.x0, r.x1), clamp(h.x1, r.x0, r.x1)); ds.push(clamp(h.d0, r.d0, r.d1), clamp(h.d1, r.d0, r.d1)); }
  const ux = [...new Set(xs)].sort((a, b) => a - b), ud = [...new Set(ds)].sort((a, b) => a - b), out = [];
  for (let i = 0; i < ux.length - 1; i++) for (let j = 0; j < ud.length - 1; j++) {
    const cx = (ux[i] + ux[i + 1]) / 2, cd = (ud[j] + ud[j + 1]) / 2;
    if (ux[i + 1] - ux[i] < .01 || ud[j + 1] - ud[j] < .01) continue;
    if (!holes.some(h => cx > h.x0 && cx < h.x1 && cd > h.d0 && cd < h.d1)) out.push({ x0: ux[i], x1: ux[i + 1], d0: ud[j], d1: ud[j + 1] });
  }
  return out;
}
function regSurf(key, mesh, idx) { (H.surf[key] || (H.surf[key] = [])).push({ mesh, idx }); }
function addSeg(ax, ad, bx_, bd, y0, y1, half, extra = {}) {
  const s = { ax, az: -ad, bx: bx_, bz: -bd, y0, y1, half, ...extra }; H.segs.push(s); return s;
}

// ---------- build ----------
export function build(data, opts = {}) {
  dataRef = data;
  for (const c of H.root.children.slice()) { H.root.remove(c); c.traverse(o => { if (o.geometry && o.userData.own) o.geometry.dispose(); }); }
  Object.assign(H, { floors: [], segs: [], steps: [], solids: [], cells: [], doors: [], lamps: [], surf: {}, furn: [], breakables: [], wallMeshes: [], blockMeshes: [], slabMeshes: [], portals: [], totalBlocks: 0, brokenBlocks: 0 });
  H.destruct = !!opts.destruct;
  const nF = data.floors.length, all = allFl(data), holes = all.map(() => []);
  for (const st of data.stairs) if (st.floor + 1 < nF) holes[st.floor + 1].push(...stairGeom(st).holes);
  all.forEach((fl, fi) => {
    const g = new THREE.Group(); g.userData.fi = fi; H.root.add(g); H.floors.push(g);
    const Y = floorY(fi), zone = fi >= nF;
    // overlapping rooms would draw two floors in the same plane (flicker): the smaller room wins the overlap
    const area = r => (r.x1 - r.x0) * (r.d1 - r.d0), rooms = healRooms(fl.rooms);
    const over = (r, i) => rooms.filter((o, j) => o !== r && (area(o) < area(r) || (area(o) === area(r) && j > i)) && o.x0 < r.x1 && o.x1 > r.x0 && o.d0 < r.d1 && o.d1 > r.d0);
    rooms.forEach((r, i) => buildSlab(g, fi, r, [...holes[fi], ...over(r, i)], Y));
    if (zone) rooms.forEach((r, i) => buildCeiling(g, r, over(r, i), Y + CH));
    else if (fi === nF - 1) rooms.forEach((r, i) => buildRoof(g, r, over(r, i), Y + CH));
    for (const w of fl.walls) buildWall(g, fi, w, Y, w.kind === 'rail' ? [0, 0] : wallExt(fl.walls, w));
    for (const f of fl.furniture) spawnFurniture(f, fi);
    for (const r of fl.rooms) {
      const area = (r.x1 - r.x0) * (r.d1 - r.d0);
      if (zone && area > 20) { // big zone rooms (backrooms, sewer): a grid of ceiling lights
        const nx = Math.max(1, Math.round((r.x1 - r.x0) / 5)), nd = Math.max(1, Math.round((r.d1 - r.d0) / 5));
        for (let i = 0; i < nx; i++) for (let j = 0; j < nd; j++) addLamp(g, r.x0 + (i + .5) * (r.x1 - r.x0) / nx, Y + CH - .03, -(r.d0 + (j + .5) * (r.d1 - r.d0) / nd), r.name, fl.kind === 'backroom');
      } else if (area >= 1.2) addLamp(g, (r.x0 + r.x1) / 2, Y + CH - .03, -(r.d0 + r.d1) / 2, r.name);
    }
  });
  for (const st of data.stairs) if (H.floors[st.floor]) buildStairs(H.floors[st.floor], st);
  for (const p of data.portals || []) buildPortal(p);
  // ground everywhere outside
  H.cells.push({ x0: -60, x1: 60, z0: -60, z1: 60, y: 0 });
  buildExterior(data);
  H._furnTotal = H.furn.length;
  refreshSolids();
  applyEnv(true);
}
// hand-edited plans leave walls a few cm short of each other and rooms not quite touching, which shows as thin
// see-through lines. Heal them at build time only (the saved design is never changed).
function healRooms(rooms) {
  const G = .16;
  return rooms.map(r => {
    const h = { ...r };
    for (const o of rooms) {
      if (o === r) continue;
      if (Math.min(r.d1, o.d1) - Math.max(r.d0, o.d0) > .05) { const g = o.x0 - r.x1; if (g > .001 && g < G) h.x1 = Math.max(h.x1, o.x0); }
      if (Math.min(r.x1, o.x1) - Math.max(r.x0, o.x0) > .05) { const g = o.d0 - r.d1; if (g > .001 && g < G) h.d1 = Math.max(h.d1, o.d0); }
    }
    return h;
  });
}
// how far each end of a wall must be stretched to reach just inside the wall it runs into (fills corner notches and short gaps)
function wallExt(walls, w) {
  const L = Math.hypot(w.x2 - w.x1, w.d2 - w.d1); if (L < .05) return [0, 0];
  const ux = (w.x2 - w.x1) / L, ud = (w.d2 - w.d1) / L, out = [0, 0];
  [[w.x1, w.d1, -1], [w.x2, w.d2, 1]].forEach(([px, pd, sg], k) => {
    let best = null;
    for (const o of walls) {
      if (o === w || o.kind === 'rail') continue;
      const oL = Math.hypot(o.x2 - o.x1, o.d2 - o.d1); if (oL < .05) continue;
      const vx = (o.x2 - o.x1) / oL, vd = (o.d2 - o.d1) / oL, cr = ux * vd - ud * vx;
      if (Math.abs(cr) < .34) continue;                                   // (nearly) parallel: never overlap those
      const t = ((o.x1 - px) * vd - (o.d1 - pd) * vx) / cr, sAt = ((o.x1 - px) * ud - (o.d1 - pd) * ux) / cr;
      if (sAt < -.15 || sAt > oL + .15) continue;
      const e = t * sg; if (e < -.2 || e > .2) continue;                  // distance from this end to o's centre line
      if ((o.ops || []).some(op => op.sill < .05 && Math.abs(sAt - op.at) < op.w / 2 + .02)) continue; // don't poke into a doorway
      const need = e + T / 2 / Math.abs(cr) - .003;
      if (need > 0 && (!best || Math.abs(e) < Math.abs(best.e))) best = { e, need };
    }
    if (best) out[k] = Math.min(best.need, .3);
  });
  // two walls drawn on top of each other (same line, overlapping) flicker: the later one gives up the shared part
  const me = walls.indexOf(w);
  for (const o of walls.slice(0, me)) {
    if (o.kind === 'rail') continue;
    const oL = Math.hypot(o.x2 - o.x1, o.d2 - o.d1); if (oL < .05) continue;
    if (Math.abs(ux * (o.d2 - o.d1) / oL - ud * (o.x2 - o.x1) / oL) > .05) continue;
    const off = (x, d) => Math.abs((x - w.x1) * ud - (d - w.d1) * ux); if (Math.min(off(o.x1, o.d1), off(o.x2, o.d2)) > .03) continue;
    const pr = (x, d) => (x - w.x1) * ux + (d - w.d1) * ud, a = Math.min(pr(o.x1, o.d1), pr(o.x2, o.d2)), b = Math.max(pr(o.x1, o.d1), pr(o.x2, o.d2));
    if (b - a < .05 || b <= .01 || a >= L - .01) continue;
    if (a <= .01 && b >= L - .01) return [-L, 0];                       // completely covered: draw nothing
    if (a <= .01) out[0] = Math.min(out[0], -b); else if (b >= L - .01) out[1] = Math.min(out[1], -(L - a));
  }
  return out;
}
function buildSlab(g, fi, r, holes, Y) {
  for (const c of rectCells(r, holes)) {
    const w = c.x1 - c.x0, dd = c.d1 - c.d0;
    const geo = new THREE.BoxGeometry(w, .2, dd); boxUV(geo, w, .2, dd, 0, 0, c.x0, -c.d1);
    const m = new THREE.Mesh(geo, [ceilMat, ceilMat, P(r.floor), ceilMat, ceilMat, ceilMat]); m.userData.own = 1;
    m.position.set((c.x0 + c.x1) / 2, Y - .1, -(c.d0 + c.d1) / 2); g.add(m);
    const key = `r:${fi}:${r.id}`; regSurf(key, m, 2); m.userData.surf = { 2: key };
    H.slabMeshes.push(m); H.cells.push({ x0: c.x0, x1: c.x1, z0: -c.d1, z1: -c.d0, y: Y, fi });
  }
}
function buildRoof(g, r, holes, y) {
  for (const c of rectCells(r, holes)) {
    const w = c.x1 - c.x0, dd = c.d1 - c.d0;
    const m = new THREE.Mesh(BG(w, .2, dd), [ceilMat, ceilMat, P('concrete'), ceilMat, ceilMat, ceilMat]);
    m.position.set((c.x0 + c.x1) / 2, y + .1, -(c.d0 + c.d1) / 2); g.add(m); m.userData.roof = 1;
  }
}
// underground zones: only a downward-facing ceiling, so nothing pokes up through the ground or the 1F floor
function buildCeiling(g, r, holes, y) {
  for (const c of rectCells(r, holes)) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(c.x1 - c.x0, c.d1 - c.d0), ceilMat); m.userData.own = 1;
    m.rotation.x = Math.PI / 2; m.position.set((c.x0 + c.x1) / 2, y, -(c.d0 + c.d1) / 2); g.add(m);
  }
}

function wallPieces(L, ops, hgt) {
  const list = ops.map(o => ({ ...o, a: clamp(o.at - o.w / 2, 0, L), b: clamp(o.at + o.w / 2, 0, L) })).filter(o => o.b - o.a > .05).sort((p, q) => p.a - q.a);
  const pieces = []; let cur = 0;
  for (const o of list) {
    if (o.a > cur) pieces.push([cur, o.a, 0, hgt]);
    const s0 = Math.max(o.a, cur);
    if (o.b > s0) { if (o.sill > 0) pieces.push([s0, o.b, 0, o.sill]); const top = o.sill + o.h; if (top < hgt) pieces.push([s0, o.b, top, hgt]); }
    cur = Math.max(cur, o.b);
  }
  if (cur < L) pieces.push([cur, L, 0, hgt]);
  return { pieces, list };
}
function buildWall(g, fi, w, Y, ext = [0, 0]) {
  const dx = w.x2 - w.x1, dd = w.d2 - w.d1, L0 = Math.hypot(dx, dd); if (L0 < .05) return;
  const ux = dx / L0, ud = dd / L0, th = Math.atan2(ud, ux), [e1, e2] = ext, L = L0 + e1 + e2; if (L < .02) return;
  const at = s => [w.x1 + ux * (s - e1), w.d1 + ud * (s - e1)];
  const kA = `w:${fi}:${w.id}:a`, kB = `w:${fi}:${w.id}:b`;
  if (w.kind === 'rail') return buildRail(g, w, Y, L, ux, ud, th, kA, kB);
  const hgt = FH;
  const { pieces, list } = wallPieces(L, (w.ops || []).map(o => ({ ...o, at: o.at + e1 })), hgt);
  for (const [a, b, y0, y1] of pieces) {
    const len = b - a, h = y1 - y0; if (len < .01 || h < .01) continue;
    const [cx, cd] = at((a + b) / 2), [pax, pad] = at(a), [pbx, pbd] = at(b);
    const mats = [edgeMat, edgeMat, edgeMat, edgeMat, P(w.a), P(w.b)];
    const seg = addSeg(pax, pad, pbx, pbd, Y + y0, Y + y1, T / 2, { wall: w, fi });
    if (H.destruct) {
      const nu = Math.max(1, Math.round(len / .5)), nv = Math.max(1, Math.round(h / .45)), bu = len / nu, bv = h / nv, n = nu * nv;
      const geo = new THREE.BoxGeometry(bu * .985, bv * .985, T); boxUV(geo, bu, bv, T);
      const im = new THREE.InstancedMesh(geo, mats, n); im.userData.own = 1;
      const m4 = new THREE.Matrix4();
      for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) im.setMatrixAt(j * nu + i, m4.makeTranslation(-len / 2 + bu * (i + .5), -h / 2 + bv * (j + .5), 0));
      im.position.set(cx, Y + (y0 + y1) / 2, -cd); im.rotation.y = th; g.add(im);
      const grid = { nu, nv, bu, bv, len, h, alive: new Uint8Array(n).fill(1), hp: new Float32Array(n).fill(40), mesh: im, colors: [presetColor(w.a), presetColor(w.b)], seg };
      seg.grid = grid; im.userData.grid = grid; im.userData.surf = { 4: kA, 5: kB };
      H.blockMeshes.push(im); H.totalBlocks += n;
      regSurf(kA, im, 4); regSurf(kB, im, 5);
    } else {
      const geo = new THREE.BoxGeometry(len, h, T); boxUV(geo, len, h, T, a, y0);
      const m = new THREE.Mesh(geo, mats); m.userData.own = 1;
      m.position.set(cx, Y + (y0 + y1) / 2, -cd); m.rotation.y = th; g.add(m);
      m.userData.surf = { 4: kA, 5: kB }; m.userData.wall = { fi, w };
      regSurf(kA, m, 4); regSurf(kB, m, 5); H.wallMeshes.push(m);
    }
  }
  for (const o of list) buildOpening(g, fi, w, o, Y, at, ux, ud, th);
}
let railGeoCache = {};
function railGeo(bu) {
  const k = bu.toFixed(3); if (railGeoCache[k]) return railGeoCache[k];
  const parts = []; const n = Math.max(1, Math.round(bu / .13));
  for (let i = 0; i < n; i++) { const p = new THREE.BoxGeometry(.025, .95, .025); p.translate(-bu / 2 + bu * (i + .5) / n, 0, 0); parts.push(p); }
  const top = new THREE.BoxGeometry(bu, .05, .06); top.translate(0, .48, 0); parts.push(top);
  const bot = new THREE.BoxGeometry(bu, .03, .03); bot.translate(0, -.45, 0); parts.push(bot);
  return railGeoCache[k] = mergeGeometries(parts);
}
function buildRail(g, w, Y, L, ux, ud, th, kA, kB) {
  const nu = Math.max(1, Math.round(L / .5)), bu = L / nu;
  const im = new THREE.InstancedMesh(railGeo(bu), M('#2a2a2a', { m: .6, r: .4 }), nu);
  const m4 = new THREE.Matrix4(); for (let i = 0; i < nu; i++) im.setMatrixAt(i, m4.makeTranslation(-L / 2 + bu * (i + .5), 0, 0));
  im.position.set(w.x1 + ux * L / 2, Y + .5, -(w.d1 + ud * L / 2)); im.rotation.y = th; g.add(im);
  const seg = addSeg(w.x1, w.d1, w.x2, w.d2, Y, Y + 1.0, .04, { wall: w, rail: 1 });
  const grid = { nu, nv: 1, bu, bv: 1, len: L, h: 1, alive: new Uint8Array(nu).fill(1), hp: new Float32Array(nu).fill(25), mesh: im, colors: ['#2a2a2a', '#2a2a2a'], seg };
  seg.grid = grid; im.userData.grid = grid;
  if (H.destruct) { H.blockMeshes.push(im); H.totalBlocks += nu; }
}

const DOOR_STYLE = {
  wood: { c: '#6b4a35' }, darkwood: { c: '#4a2a1e', panels: 1 }, steel: { c: '#c4c8cc', m: .75, stripes: 1 }, glassblue: { c: '#a8d4dc', glass: 1 },
  alum: { c: '#c9ccd0', m: .6, glass: 1 }, paleblue: { c: '#a9d6d8' }, white: { c: '#f0eee8' },
};
export const DOOR_STYLE_NAMES = { wood: '木門', darkwood: '深色木門', steel: '不鏽鋼門', glassblue: '藍色玻璃門', alum: '鋁門', paleblue: '淺藍門', white: '白門' };
function leafMesh(style, w, h) {
  const s = DOOR_STYLE[style] || DOOR_STYLE.wood, g = new THREE.Group(), m = M(s.c, { r: .5, m: s.m || 0 });
  bx(g, w, h, 0.04, w / 2, 0, 0, m);
  if (s.glass) bx(g, w * .62, h * .45, 0.05, w / 2, h * .45, 0, M('#d5e6ee', { r: .05, op: .6 }));
  if (s.stripes) for (let i = 0; i < 4; i++) bx(g, w * .8, 0.02, 0.06, w / 2, 0.4 + i * 0.45, 0, M('#9ea3a8', { m: .7 }));
  if (s.panels) for (const y of [.25, 1.2]) bx(g, w * .7, h * .38, 0.05, w / 2, y, 0, M('#5a3324', { r: .45 }));
  sp(g, .03, w - .08, 1.0, .04, M('#bbb', { m: .8, r: .2 })); sp(g, .03, w - .08, 1.0, -.04, M('#bbb', { m: .8, r: .2 }));
  return g;
}
function buildOpening(g, fi, w, o, Y, at, ux, ud, th) {
  const [cx, cd] = at((o.a + o.b) / 2), ow = o.b - o.a;
  const frameC = o.type === 'window' ? '#9aa0a6' : (DOOR_STYLE[o.style]?.c || '#8a6a4a');
  // frame
  const fr = new THREE.Group(); fr.position.set(cx, Y, -cd); fr.rotation.y = th; g.add(fr);
  const fm = M(frameC, { r: .5, m: o.type === 'window' ? .6 : 0 });
  if (o.type !== 'opening') {
    bx(fr, .05, o.h, T + .04, -ow / 2, o.sill, 0, fm); bx(fr, .05, o.h, T + .04, ow / 2, o.sill, 0, fm); bx(fr, ow + .1, .05, T + .04, 0, o.sill + o.h, 0, fm);
    if (o.sill > 0) bx(fr, ow + .1, .04, T + .1, 0, o.sill - .04, 0, fm);
  }
  if (o.type === 'window') {
    const glass = M('#cfe6f5', { r: .05, m: .1, op: .35, e: '#9fc7e0', ei: .5 });
    pl(fr, ow, o.h, 0, o.sill + o.h / 2, 0, glass); bx(fr, .03, o.h, .05, 0, o.sill, 0, fm);
    if (o.grille) for (let i = 0; i <= Math.floor(ow / .15); i++) bx(fr, .02, o.h, .02, -ow / 2 + i * .15, o.sill, T / 2 + .06, M('#c8ccd0', { m: .7 }));
    if (o.curtain) { const cm = M(o.curtain, { r: 1 }); const n = Math.max(4, Math.round(ow / .2)); for (let i = 0; i < n; i++) bx(fr, ow / (n - 1), o.h + .3, .04, -ow / 2 + i * ow / (n - 1), o.sill - .25, -(T / 2 + .08 + (i % 2) * .04), cm); }
    const seg = addSeg(...at(o.a), ...at(o.b), Y, Y + FH, T / 2, { window: fr });
    H.breakables.push({ kind: 'window', obj: fr, seg, hp: 10, max: 10, box: new THREE.Box3().setFromObject(fr), fi, color: '#cfe6f5', value: 15 });
    return;
  }
  if (o.type === 'opening') return;
  if (o.type === 'sliding') {
    const pw = ow / 2 + .05, mk = () => { const p = new THREE.Group(); bx(p, pw, o.h, .04, 0, 0, 0, M(frameC, { r: .5 })); bx(p, pw * .75, o.h * .8, .05, 0, o.h * .1, 0, M('#e2ecf0', { r: .1, op: .55 })); return p; };
    const p1 = mk(), p2 = mk(); fr.add(p1, p2);
    p1.position.set(ow / 4, o.sill, -.025); p2.position.set(-ow / 4, o.sill, .025);
    const d = { kind: 'slide', fi, p1, p2, ow, t: 0, open: false, fr, y0: Y, name: '拉門', o, at, th, a: o.a, b: o.b };
    d.update = () => { p2.position.x = -ow / 4 + d.t * (ow / 2 - .05); };
    d.segs = () => { const s0 = o.a + d.t * (ow / 2 - .05); return [[...at(s0), ...at(s0 + ow / 2)], [...at(o.a + ow / 2), ...at(o.b)]]; };
    p1.traverse(m => m.userData.door = d); p2.traverse(m => m.userData.door = d);
    H.doors.push(d); return;
  }
  // hinged doors (single or double)
  const leaves = o.type === 'door2' ? [{ s: o.a, end: false, w: ow / 2 }, { s: o.b, end: true, w: ow / 2 }] : [{ s: o.hinge === 'e' ? o.b : o.a, end: o.hinge === 'e', w: ow }];
  const made = [];
  for (const lf of leaves) {
    const [hx, hd] = at(lf.s);
    const pivot = new THREE.Group(); pivot.position.set(hx, Y + o.sill, -hd); g.add(pivot);
    const base = th + (lf.end ? Math.PI : 0);
    const sgn = (o.swing === 'a' ? -1 : 1) * (lf.end ? -1 : 1);
    const leaf = leafMesh(o.style, lf.w - (leaves.length > 1 ? .004 : .02), o.h - .02); leaf.position.x = leaves.length > 1 ? .002 : .01; pivot.add(leaf);
    const d = { kind: 'hinge', fi, pivot, leaf, base, delta: 88 * DEG * sgn, t: 0, open: false, w: lf.w, y0: Y + o.sill, h: o.h, name: o.type === 'door2' ? '大門' : '門', hp: 40, max: 40 };
    pivot.rotation.y = base;
    leaf.traverse(m => m.userData.door = d);
    H.doors.push(d); made.push(d);
    H.breakables.push({ kind: 'door', obj: pivot, door: d, hp: 40, max: 40, box: new THREE.Box3(), fi, color: DOOR_STYLE[o.style]?.c || '#6b4a35', value: 30 });
  }
  if (made.length === 2) { made[0].pair = made[1]; made[1].pair = made[0]; }
}
function buildStairs(g, st) {
  const Y = floorY(st.floor), G = stairGeom(st);
  const top = P(st.mat || (st.floor ? 'lightwood' : 'concrete')), under = M('#ddd8ce', { r: .95 }), nose = M('#5a4a3a', { r: .6 }), wallM = M('#ebe5d8', { r: .9 });
  // steps are slabs (not solid columns) so the flight above never fills the space of the flight below
  for (const s of G.steps) {
    const w = s.x1 - s.x0, dd = s.d1 - s.d0, th = s.landing ? .22 : Math.min(s.top, .4);
    const mesh = new THREE.Mesh(BG(w, th, dd), [under, under, top, under, under, under]);
    mesh.position.set((s.x0 + s.x1) / 2, Y + s.top - th / 2, -(s.d0 + s.d1) / 2); g.add(mesh);
    if (s.dv) { // nosing on the downhill edge
      const [vx, vd] = s.dv;
      if (vd) bx(g, w, .03, .03, (s.x0 + s.x1) / 2, Y + s.top - .03, -(vd > 0 ? s.d1 - .015 : s.d0 + .015), nose);
      else bx(g, .03, .03, dd, vx > 0 ? s.x1 - .015 : s.x0 + .015, Y + s.top - .03, -(s.d0 + s.d1) / 2, nose);
    }
    const b = new THREE.Box3(new THREE.Vector3(s.x0, Y + s.top - th, -s.d1), new THREE.Vector3(s.x1, Y + s.top, -s.d0)); b.step = 1; H.steps.push(b);
  }
  // centre wall between the two flights (full storey high)
  const [[ax, ad], [bx_, bd]] = G.wall, alongX = Math.abs(bx_ - ax) > Math.abs(bd - ad), wl = Math.hypot(bx_ - ax, bd - ad);
  const cw = new THREE.Mesh(alongX ? BG(wl, FH, .1) : BG(.1, FH, wl), wallM); cw.position.set((ax + bx_) / 2, Y + FH / 2, -(ad + bd) / 2); g.add(cw);
  addSeg(ax, ad, bx_, bd, Y, Y + FH, .05);
  // sloped handrails along the outer side of each flight
  const rail = M('#6b4a35', { r: .5 });
  for (const [[x0, d0], y0, [x1, d1], y1] of G.rails) {
    const a = new THREE.Vector3(x0, Y + y0 + .9, -d0), b = new THREE.Vector3(x1, Y + y1 + .9, -d1), len = a.distanceTo(b);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, len, 8), rail); m.userData.own = 1;
    m.position.copy(a).add(b).multiplyScalar(.5); m.lookAt(b); m.rotateX(Math.PI / 2); g.add(m);
    for (const p of [a, b]) { const post = new THREE.Mesh(BG(.03, .9, .03), rail); post.position.set(p.x, p.y - .45, p.z); g.add(post); }
  }
  // guard rails around the opening on the floor above when no further stair starts there
  const nextFloor = st.floor + 1, hasNext = dataRef.stairs.some(o => o.floor === nextFloor);
  if (dataRef.floors[nextFloor] && !hasNext) {
    const Y2 = floorY(nextFloor), g2 = H.floors[nextFloor] || g;
    for (const [[x1, d1], [x2, d2]] of G.guards) { const L = Math.hypot(x2 - x1, d2 - d1); if (L > .1) buildRail(g2, { x1, d1, x2, d2 }, Y2, L, (x2 - x1) / L, (d2 - d1) / L, Math.atan2(d2 - d1, x2 - x1)); }
  }
}
function addLamp(g, x, y, z, name, panel) {
  const lm = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: panel ? '#fff8d0' : '#fff6e0', emissiveIntensity: 1.2 });
  const m = new THREE.Mesh(panel ? new THREE.BoxGeometry(1.2, .04, .6) : new THREE.CylinderGeometry(0.22, 0.25, 0.06, 20), lm); m.userData.own = 1; m.position.set(x, y, z); g.add(m);
  const l = { x, y, z, mesh: m, mat: lm, on: true, name: name + '燈' }; m.userData.lamp = l; H.lamps.push(l);
}
export function setLamp(l, on) { l.on = on; l.mat.emissiveIntensity = on ? 1.2 : 0; }

// ---------- furniture ----------
export function spawnFurniture(f, fi) {
  const d = CAT[f.type]; if (!d) return null;
  const obj = buildFurniture(f.type, f.color);
  obj.position.set(f.x, floorY(fi) + (f.y || 0), -f.d); obj.rotation.y = (f.rot || 0) * DEG;
  H.floors[fi].add(obj);
  const e = { kind: 'furn', f, fi, obj, nc: !!d.nc, box: new THREE.Box3(), hp: 0, max: 0, color: f.color || d.c, value: 0 };
  obj.traverse(o => o.userData.furn = e);
  e.spin = obj.getObjectByName('spin'); e.spinY = obj.getObjectByName('spinY');
  refreshFurnBox(e);
  const v = (e.box.max.x - e.box.min.x) * (e.box.max.y - e.box.min.y) * (e.box.max.z - e.box.min.z);
  e.hp = e.max = Math.round(30 + v * 120); e.value = Math.round(15 + v * 60);
  H.furn.push(e); H.breakables.push(e);
  return e;
}
export function refreshFurnBox(e) { e.obj.updateMatrixWorld(true); e.box.setFromObject(e.obj); e.box.expandByScalar(-0.02); }
export function removeFurnitureEntry(e) {
  e.obj.parent && e.obj.parent.remove(e.obj); e.dead = true;
  H.furn = H.furn.filter(x => x !== e); H.breakables = H.breakables.filter(x => x !== e); refreshSolids();
}
export function refreshSolids() {
  // small items (plants, stools, cones…) never block the way: you just brush past them
  const small = b => (b.max.x - b.min.x) * (b.max.z - b.min.z) < .3;
  H.solids = [...H.steps, ...H.furn.filter(e => !e.nc && !e.dead && !small(e.box)).map(e => e.box)];
}

// ---------- collision ----------
const tmp = new THREE.Vector3();
function segDist2(px, pz, s) {
  const vx = s.bx - s.ax, vz = s.bz - s.az, L2 = vx * vx + vz * vz || 1e-6;
  let t = ((px - s.ax) * vx + (pz - s.az) * vz) / L2; t = clamp(t, 0, 1);
  const cx = s.ax + vx * t, cz = s.az + vz * t; return [(px - cx) ** 2 + (pz - cz) ** 2, t, Math.sqrt(L2)];
}
function gridBlocks(s, t, L, r, y0, y1) {
  const g = s.grid, sAlong = t * L;
  const i0 = clamp(Math.floor((sAlong - r) / g.bu), 0, g.nu - 1), i1 = clamp(Math.floor((sAlong + r) / g.bu), 0, g.nu - 1);
  const j0 = clamp(Math.floor((y0 - s.y0) / g.bv), 0, g.nv - 1), j1 = clamp(Math.floor((y1 - s.y0) / g.bv), 0, g.nv - 1);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (g.alive[j * g.nu + i]) return true;
  return false;
}
const doorSegCache = [];
function doorSegs() {
  doorSegCache.length = 0;
  for (const d of H.doors) {
    if (d.dead) continue;
    if (d.kind === 'hinge') {
      const a = d.pivot.rotation.y, px = d.pivot.position.x, pz = d.pivot.position.z;
      doorSegCache.push({ ax: px, az: pz, bx: px + Math.cos(a) * d.w, bz: pz - Math.sin(a) * d.w, y0: d.y0, y1: d.y0 + d.h, half: .03 });
    } else for (const [ax, ad, bx_, bd] of d.segs()) doorSegCache.push({ ax, az: -ad, bx: bx_, bz: -bd, y0: d.y0, y1: d.y0 + 2.1, half: .04 });
  }
  return doorSegCache;
}
// the player's body (shrunk in 道具躲貓貓 so you can crawl under tables)
export const BODY = { lo: .36, hi: 1.7 };
export function hits(x, z, feet, r = 0.24, ignoreDoors = false) {
  const lo = feet + BODY.lo, hi = feet + BODY.hi;
  for (const s of H.segs) {
    if (s.dead || s.y1 <= lo || s.y0 >= hi) continue;
    const [d2, t, L] = segDist2(x, z, s), rr = r + s.half;
    if (d2 >= rr * rr) continue;
    if (s.grid) { if (gridBlocks(s, t, L, r, Math.max(lo, s.y0), Math.min(hi, s.y1 - .01))) return true; }
    else return true;
  }
  if (!ignoreDoors) for (const s of doorSegs()) {
    if (s.y1 <= lo || s.y0 >= hi) continue;
    const [d2] = segDist2(x, z, s), rr = r + s.half; if (d2 < rr * rr) return true;
  }
  for (const c of H.solids) {
    if (c.max.y <= lo || c.min.y >= hi) continue;
    const cx = clamp(x, c.min.x, c.max.x), cz = clamp(z, c.min.z, c.max.z);
    if ((x - cx) ** 2 + (z - cz) ** 2 < r * r) return true;
  }
  return false;
}
// slide instead of stopping: push a circle at (x,z) out of every wall, door and solid it overlaps
export function pushOut(x, z, feet, r = 0.24) {
  const lo = feet + BODY.lo, hi = feet + BODY.hi, segs = [...H.segs, ...doorSegs()];
  for (let it = 0; it < 4; it++) {
    let moved = false;
    for (const s of segs) {
      if (s.dead || s.y1 <= lo || s.y0 >= hi) continue;
      const [d2, t, L] = segDist2(x, z, s), rr = r + s.half;
      if (d2 >= rr * rr) continue;
      if (s.grid && !gridBlocks(s, t, L, r, Math.max(lo, s.y0), Math.min(hi, s.y1 - .01))) continue;
      const cx = s.ax + (s.bx - s.ax) * t, cz = s.az + (s.bz - s.az) * t, d = Math.sqrt(d2);
      let nx, nz; if (d > 1e-4) { nx = (x - cx) / d; nz = (z - cz) / d; } else { nx = -(s.bz - s.az) / (L || 1); nz = (s.bx - s.ax) / (L || 1); }
      x = cx + nx * (rr + .001); z = cz + nz * (rr + .001); moved = true;
    }
    for (const c of H.solids) {
      if (c.max.y <= lo || c.min.y >= hi) continue;
      const cx = clamp(x, c.min.x, c.max.x), cz = clamp(z, c.min.z, c.max.z), d2 = (x - cx) ** 2 + (z - cz) ** 2;
      if (d2 >= r * r) continue;
      if (d2 > 1e-8) { const d = Math.sqrt(d2); x = cx + (x - cx) / d * (r + .001); z = cz + (z - cz) / d * (r + .001); }
      else { const opts = [[c.min.x - r - .001 - x, 0], [c.max.x + r + .001 - x, 0], [0, c.min.z - r - .001 - z], [0, c.max.z + r + .001 - z]].sort((a, b) => Math.abs(a[0] + a[1]) - Math.abs(b[0] + b[1]))[0]; x += opts[0]; z += opts[1]; }
      moved = true;
    }
    if (!moved) break;
  }
  return [x, z];
}
export function groundAt(x, z, feet) {
  let g = -100; const lim = feet + 0.38;
  for (const c of H.cells) if (c.y <= lim && c.y > g && x >= c.x0 && x <= c.x1 && z >= c.z0 && z <= c.z1) g = c.y;
  for (const c of H.solids) if (c.max.y <= lim && c.max.y > g && x > c.min.x - .1 && x < c.max.x + .1 && z > c.min.z - .1 && z < c.max.z + .1) g = c.max.y;
  return g;
}
export const floorOf = y => {
  const d = S.data || dataRef;
  if (d && y < -1 && d.zones?.length) { let best = -1, by = -1e9; d.zones.forEach((z, k) => { if (z.y <= y + .6 && z.y > by) { by = z.y; best = k; } }); if (best >= 0) return d.floors.length + best; }
  return clamp(Math.floor((y + .6) / FH), 0, Math.max(0, (d ? d.floors.length : H.floors.length) - 1));
};

// ---------- surfaces (paint) ----------
export function paintSurface(key, preset) {
  const p = key.split(':'), fl = allFl(dataRef)[+p[1]];
  if (p[0] === 'w') { const w = fl.walls.find(w => w.id === p[2]); if (w) w[p[3]] = preset; }
  else if (p[0] === 'r') { const r = fl.rooms.find(r => r.id === p[2]); if (r) r.floor = preset; }
  for (const { mesh, idx } of H.surf[key] || []) mesh.material[idx] = P(preset);
}

// ---------- destruction ----------
const m4 = new THREE.Matrix4(), zero = new THREE.Matrix4().makeScale(0, 0, 0), v3 = new THREE.Vector3();
export function killBlock(grid, id) {
  if (!grid.alive[id]) return false;
  grid.alive[id] = 0; grid.mesh.getMatrixAt(id, m4); v3.setFromMatrixPosition(m4).applyMatrix4(grid.mesh.matrixWorld);
  grid.mesh.setMatrixAt(id, zero); grid.mesh.instanceMatrix.needsUpdate = true; H.brokenBlocks++;
  H.onBreak && H.onBreak(v3.clone(), grid.colors[Math.random() < .5 ? 0 : 1], Math.min(grid.bu, .5), 'block');
  return true;
}
export function damageAt(p, radius, dmg) {
  let blocks = 0, money = 0; const objs = [];
  for (const im of H.blockMeshes) {
    const g = im.userData.grid; if (!g) continue;
    if (im.position.distanceTo(p) > g.len / 2 + g.h / 2 + radius + .3) continue;
    im.updateMatrixWorld();
    for (let id = 0; id < g.alive.length; id++) {
      if (!g.alive[id]) continue;
      im.getMatrixAt(id, m4); v3.setFromMatrixPosition(m4).applyMatrix4(im.matrixWorld);
      const dist = v3.distanceTo(p) - Math.max(g.bu, g.bv) * .5;
      if (dist > radius) continue;
      g.hp[id] -= dmg * (1 - Math.max(0, dist) / radius * .6);
      if (g.hp[id] <= 0 && killBlock(g, id)) { blocks++; money += 2; }
    }
  }
  for (const e of H.breakables.slice()) {
    if (e.dead) continue;
    if (e.kind === 'door') { e.door.leaf.updateMatrixWorld(true); e.box.setFromObject(e.door.leaf); }
    if (e.box.distanceToPoint(p) > radius) continue;
    e.hp -= dmg;
    if (e.hp <= 0) { breakObj(e); money += e.value; objs.push(e); }
    else if (e.kind === 'furn') { e.obj.position.x += (Math.random() - .5) * .04; }
  }
  if (blocks || objs.length) refreshSolids();
  return { blocks, objs, money };
}
export function breakObj(e) {
  if (e.dead) return; e.dead = true;
  const b = e.kind === 'door' ? new THREE.Box3().setFromObject(e.door.leaf) : e.box;
  const c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3());
  H.onBreak && H.onBreak(c, e.color, Math.min(.35, Math.max(s.x, s.y, s.z) / 4), e.kind, s);
  if (e.kind === 'furn') { e.obj.parent && e.obj.parent.remove(e.obj); H.furn = H.furn.filter(x => x !== e); }
  if (e.kind === 'door') { e.door.dead = true; e.door.pivot.parent.remove(e.door.pivot); }
  if (e.kind === 'window') { e.seg.dead = true; e.obj.parent.remove(e.obj); }
  H.breakables = H.breakables.filter(x => x !== e);
}
export function destructionProgress() {
  const total = H.totalBlocks + (H._furnTotal || 1);
  return (H.brokenBlocks + ((H._furnTotal || 0) - H.furn.length)) / total;
}

// ---------- per-frame ----------
let poolT = 0;
export function updateHouse(dt, t) {
  for (const d of H.doors) {
    if (d.dead) continue;
    d.t += ((d.open ? 1 : 0) - d.t) * Math.min(1, dt * 5);
    if (d.kind === 'hinge') d.pivot.rotation.y = d.base + d.delta * d.t; else d.update();
  }
  for (const e of H.furn) { if (e.spin) e.spin.rotation.z += dt * 12; if (e.spinY) e.spinY.rotation.y += dt * 6; }
  const full = lightCfg.intensity * lightCfg.mult;
  poolT -= dt;
  if (poolT <= 0) {
    poolT = .25;
    const cp = camera.position;
    // the few real lights go to the lamps nearest the camera. A lamp that already has a light keeps it
    // unless another lamp is clearly closer (stops lights hopping around while you run), and lights fade in/out
    const held = new Set(pool.map(L => L.userData.lamp).filter(Boolean));
    const want = H.lamps.filter(l => l.on).map(l => [l, ((l.x - cp.x) ** 2 + (l.z - cp.z) ** 2 + ((l.y - cp.y) * 2.5) ** 2) * (held.has(l) ? .55 : 1)]).sort((a, b) => a[1] - b[1]).slice(0, pool.length).map(e => e[0]);
    const wantSet = new Set(want);
    for (const L of pool) if (L.userData.lamp && !wantSet.has(L.userData.lamp)) L.userData.lamp = null;
    const free = want.filter(l => !pool.some(L => L.userData.lamp === l));
    for (const L of pool) if (!L.userData.lamp && (L.userData.base ?? 0) < full * .04 && free.length) { const l = free.shift(); L.userData.lamp = l; L.position.set(l.x, l.y - .25, l.z); }
    applyEnv();
  }
  // fade every light toward its target (instant drops only for the scary flicker effect)
  const fk = Math.min(1, dt * 6);
  for (const L of pool) {
    if (L.userData.lamp && !L.userData.lamp.on) L.userData.lamp = null;
    const tgt = L.userData.lamp && !lightCfg.steady ? full : 0, b0 = L.userData.base ?? 0;
    L.userData.base = lightCfg.steady ? 0 : b0 + (tgt - b0) * (tgt < b0 ? Math.min(1, dt * 10) : fk);
    L.intensity = L.userData.base * (lightCfg.flicker > 0 && Math.random() < lightCfg.flicker ? .05 : 1);
  }
  for (const p of H.portals) if (p.spin) { p.spin.rotation.z += dt * 2.5; p.spin.material.emissiveIntensity = 1.2 + Math.sin(t * 4) * .4; }
  updateFlakes(dt, t);
}
export function toggleDoor(d) { d.open = !d.open; if (d.pair) d.pair.open = d.open; }

// ---------- portals (teleport points: manhole, hatch, ladder, magic portal) ----------
export const PORTAL_STYLES = { portal: '🌀 傳送門', manhole: '⚫ 人孔蓋', hatch: '🟫 地板活門', ladder: '🪜 梯子', door: '🚪 神秘門' };
function buildPortal(p) {
  const fi = entFi(p, dataRef), g = H.floors[fi]; if (!g || fi < 0) return;
  const Y = floorY(fi), o = new THREE.Group(); o.position.set(p.x, Y, -p.d); o.rotation.y = (p.rot || 0) * DEG; g.add(o);
  let spin = null; const metal = M('#3a3d40', { m: .7, r: .4 });
  if (p.style === 'manhole') { cy(o, .42, .42, .03, 0, 0, 0, metal, 24); cy(o, .34, .34, .035, 0, 0, 0, M('#2a2c2e', { m: .6, r: .5 }), 24); for (let i = -2; i <= 2; i++) bx(o, .5, .04, .03, 0, .01, i * .12, M('#4a4d50', { m: .6 })); }
  else if (p.style === 'hatch') { bx(o, 1.0, .04, 1.0, 0, 0, 0, M('#5a3a22', { r: .6 })); bx(o, .9, .045, .06, 0, 0, -.3, M('#3a2414')); bx(o, .9, .045, .06, 0, 0, .3, M('#3a2414')); cy(o, .05, .05, .05, .3, .03, 0, M('#c9a23a', { m: .8 })); }
  else if (p.style === 'ladder') { const st = M('#8a8f94', { m: .7, r: .35 }); for (const x of [-.22, .22]) bx(o, .05, 2.9, .05, x, 0, 0, st); for (let i = 1; i < 10; i++) bx(o, .44, .03, .03, 0, i * .29, 0, st); }
  else if (p.style === 'door') { bx(o, 1.0, 2.2, .12, 0, 0, 0, M('#1a1a22')); const pm = new THREE.Mesh(new THREE.PlaneGeometry(.86, 2.05), M('#6a3cff', { e: '#7a4cff', ei: 1.2, op: .85 })); pm.position.set(0, 1.05, .07); o.add(pm); }
  else { // magic portal: glowing ring with a swirling disc
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.75, .07, 10, 40), M('#b48cff', { e: '#9a6cff', ei: 1.5 })); ring.position.y = 1.05; o.add(ring);
    spin = new THREE.Mesh(new THREE.CircleGeometry(.7, 32), new THREE.MeshStandardMaterial({ map: swirlTex(), emissive: '#7a4cff', emissiveIntensity: 1.2, emissiveMap: swirlTex(), transparent: true, opacity: .85, side: THREE.DoubleSide, depthWrite: false }));
    spin.position.y = 1.05; o.add(spin);
  }
  H.portals.push({ p, fi, obj: o, spin, x: p.x, z: -p.d, y: Y });
}
let swirl = null;
function swirlTex() {
  if (swirl) return swirl; const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, '#ffffff'); gr.addColorStop(.4, '#b48cff'); gr.addColorStop(1, '#2a0a5a'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 3; for (let k = 0; k < 4; k++) { g.beginPath(); for (let a = 0; a < 12; a += .1) { const r = a * 5; g.lineTo(64 + Math.cos(a + k * 1.57) * r, 64 + Math.sin(a + k * 1.57) * r); } g.stroke(); }
  return swirl = new THREE.CanvasTexture(c);
}
export function nearPortal(pos, r = 1.2) {
  let best = null, bd = r;
  for (const p of H.portals) { if (Math.abs(p.y - pos.y) > 1.2) continue; const d = Math.hypot(p.x - pos.x, p.z - pos.z); if (d < bd) { bd = d; best = p; } }
  return best;
}

// ---------- exterior: street, neighbours and boundary, fitted to the house footprint ----------
export const exterior = new THREE.Group(); scene.add(exterior);
function footprintOf(data) {
  let x0 = 1e9, x1 = -1e9, d0 = 1e9, d1 = -1e9;
  for (const f of data.floors) { for (const r of f.rooms) { x0 = Math.min(x0, r.x0); x1 = Math.max(x1, r.x1); d0 = Math.min(d0, r.d0); d1 = Math.max(d1, r.d1); } for (const w of f.walls) { x0 = Math.min(x0, w.x1, w.x2); x1 = Math.max(x1, w.x1, w.x2); d0 = Math.min(d0, w.d1, w.d2); d1 = Math.max(d1, w.d1, w.d2); } }
  if (x0 > x1) return { x0: 0, x1: 5, d0: -3.2, d1: 16.5 };
  return { x0, x1, d0, d1 };
}
export const STREET = { front: -15.5 };
function buildExterior(data) {
  for (const c of exterior.children.slice()) exterior.remove(c);
  const B = footprintOf(data), cx = (B.x0 + B.x1) / 2, front = B.d0, far = STREET.front; houseRect = B;
  const road = new THREE.Mesh(new THREE.PlaneGeometry(90, 40), P('asphalt')); road.rotation.x = -Math.PI / 2; road.position.set(cx, -0.02, -(front - 20)); exterior.add(road);
  for (let x = -40; x < 40; x += 3) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6, .14), M('#f2f2f2')); m.rotation.x = -Math.PI / 2; m.position.set(cx + x, -0.01, -((front + far) / 2)); exterior.add(m); }
  for (const dd of [front - .9, far + .9]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(90, .12), M('#ffffff')); m.rotation.x = -Math.PI / 2; m.position.set(cx, -0.01, -dd); exterior.add(m); }
  const back = new THREE.Mesh(new THREE.PlaneGeometry(90, 80), extMat.ground); back.rotation.x = -Math.PI / 2; back.position.set(cx, -0.03, -(B.d1 + 40)); exterior.add(back);
  bx(exterior, 90, .05, 2.2, cx, -0.04, -(far - 1.1), P('stone'));
  // neighbouring houses hug the footprint on both sides (never overlapping it)
  const depth = B.d1 - front + .2, zc = -(front + depth / 2 - .1), cols = ['#c9b8a0', '#a9b6c2', '#d6c7b5', '#b6a79e', '#c2b9a8', '#aab0a0'];
  [[B.x0 - .08, -1], [B.x1 + .08, 1]].forEach(([edge, dir], si) => {
    let e = edge;
    for (let k = 0; k < 3; k++) {
      const w = 5.6 + ((k + si) % 2) * .8, h = 9.6 + ((k * 3 + si) % 4) * 1.2, x = e + dir * w / 2, c = cols[(k * 2 + si) % cols.length];
      bx(exterior, w, h, depth, x, 0, zc, M(c, { r: .9 }));
      for (const y of [3.8, 7.0]) bx(exterior, w * .5, 1.3, 0.06, x, y, -(front - .14), M('#5d7a90', { r: .2, m: .3 }));
      bx(exterior, w * .7, 2.4, 0.06, x, 0, -(front - .14), M('#8e9499', { m: .5, r: .4 }));
      e += dir * w;
    }
  });
  neighbourhood(B, cx, front, far, cols);
  const fm = P('facade');
  bx(exterior, 0.4, 3.0, 0.4, B.x0 + .2, 0, -(front + .2), fm); bx(exterior, 0.4, 3.0, 0.4, B.x1 - .2, 0, -(front + .2), fm);
  // invisible boundary: neighbour fronts, the street ends and the far sidewalk
  const L = cx - 30, Rr = cx + 30;
  addSeg(L, front, B.x0 - .06, front, 0, 50, .05); addSeg(B.x1 + .06, front, Rr, front, 0, 50, .05);
  addSeg(B.x0 - .1, front, B.x0 - .1, B.d1 + .1, 0, 50, .03); addSeg(B.x1 + .1, front, B.x1 + .1, B.d1 + .1, 0, 50, .03); // neighbours' side walls
  // the street ends and the far side (open into the little park)
  const sw = far - 2.2, pk = PARK(cx, far);
  addSeg(L, front, L, sw, 0, 50, .05); addSeg(Rr, front, Rr, sw, 0, 50, .05);
  addSeg(L, sw, pk.x0, sw, 0, 50, .05); addSeg(pk.x0, sw, pk.x0, pk.d1, 0, 50, .05); addSeg(pk.x0, pk.d1, pk.x1, pk.d1, 0, 50, .05); addSeg(pk.x1, pk.d1, pk.x1, sw, 0, 50, .05); addSeg(pk.x1, sw, Rr, sw, 0, 50, .05);
}
// ---------- the neighbourhood across the street: houses with shops, a corner store, a little park and a shrine ----------
const PARK = (cx, far) => ({ x0: cx - 14.3, x1: cx - 3.1, d0: far - 2.2, d1: far - 12 });
function ext(type, x, d, rot = 0, solid = false, y = 0) {
  const o = buildFurniture(type); if (!o) return null; o.position.set(x, y, -d); o.rotation.y = rot * DEG; exterior.add(o);
  if (solid) { const b = new THREE.Box3().setFromObject(o); solidBox(b.min.x, -b.max.z, b.max.x, -b.min.z); }
  return o;
}
function solidBox(x0, d0, x1, d1) { addSeg(x0, d0, x1, d0, 0, 50, .03); addSeg(x1, d0, x1, d1, 0, 50, .03); addSeg(x1, d1, x0, d1, 0, 50, .03); addSeg(x0, d1, x0, d0, 0, 50, .03); }
function signTex(text, bg, fg, w = 256, h = 64, vertical = false) {
  return canvasPlane(1, 1, w, h, (x, W, Hh) => {
    x.fillStyle = bg; x.fillRect(0, 0, W, Hh); x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
    if (vertical) { const n = text.length, fs = Math.min(W * .8, Hh / n * .85); x.font = `bold ${fs}px sans-serif`; [...text].forEach((ch, i) => x.fillText(ch, W / 2, (i + .5) * Hh / n)); }
    else { x.font = `bold ${Math.floor(Hh * .62)}px sans-serif`; x.fillText(text, W / 2, Hh / 2 + 2); }
  });
}
function sign(text, bg, fg, w, h, x, y, z, ry = 0, vertical = false) {
  const m = signTex(text, bg, fg, vertical ? 64 : 256, vertical ? 256 : 64, vertical); m.emissive = new THREE.Color('#ffffff'); m.emissiveMap = m.map; m.emissiveIntensity = .35; m.side = THREE.DoubleSide;
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); p.position.set(x, y, z); p.rotation.y = ry; exterior.add(p); return p;
}
const SHOPS = [['早餐店', '#f2a020'], ['水果行', '#3a9a4a'], ['五金行', '#2a5aa8'], ['理髮院', '#c83a5a'], ['藥局', '#1a8a7a'], ['麵店', '#c8502a']];
function neighbourhood(B, cx, front, far, cols) {
  const sw = far - 2.2, glassM = M('#5d7a90', { r: .2, m: .3 }), shutter = M('#8e9499', { m: .5, r: .4 });
  const zf = -sw - .04, PI = Math.PI; // the street-facing fronts across the road (the street is towards -z)
  // a row of houses; slots -2,-1 are the park, 1 the corner store, 3 the shrine
  for (let k = -5; k <= 5; k++) {
    const w = 5.8, xc = cx + k * w, h = 8 + ((k + 8) % 3) * 1.6, c = cols[(k + 8) % cols.length];
    if (k === -2 || k === -1) continue;
    if (k === 1) { store(xc, sw, w); continue; }
    if (k === 3) { shrine(xc, sw, w, c); continue; }
    bx(exterior, w - .1, h, 10, xc, 0, -(sw - 5), M(c, { r: .9 }));
    for (const y of [3.6, 6.6]) bx(exterior, w * .5, 1.2, .06, xc, y, zf, glassM);
    const shop = SHOPS[(k + 6) % SHOPS.length];
    if (k % 2 === 0) { // a little shop on the ground floor: awning, sign, goods
      bx(exterior, w * .8, 2.4, .06, xc, 0, zf, M('#2a2e33', { r: .4 }));
      const aw = bx(exterior, w * .86, .06, 1.1, xc, 2.55, zf - .5, M(shop[1], { r: .6 })); aw.rotation.x = -.25;
      sign(shop[0], shop[1], '#ffffff', 2.4, .6, xc, 3.1, zf - .05, PI);
      sign(shop[0], '#fffbe8', shop[1], .5, 2, xc + w / 2 - .5, 4.6, zf - .5, PI / 2, true);
      ext(['crate', 'boxes', 'clutter', 'bucket'][(k + 8) % 4], xc - 1.2, sw + .5, 0);
    } else bx(exterior, w * .6, 2.4, .06, xc, 0, zf, shutter);
  }
  // ---- the corner store ----
  function store(xc, sw, w) {
    bx(exterior, w - .1, 9, 10, xc, 0, -(sw - 5), M('#e8e4dc', { r: .9 }));
    const shelves = canvasPlane(1, 1, 256, 128, (x, W, Hh) => { x.fillStyle = '#f6f8f4'; x.fillRect(0, 0, W, Hh); const cs = ['#e33', '#3a6', '#fc3', '#39f', '#f80', '#a3e', '#fff']; for (let r = 0; r < 4; r++) { x.fillStyle = '#c8ccd0'; x.fillRect(0, 18 + r * 28, W, 3); for (let i = 0; i < 40; i++) { x.fillStyle = cs[(i * 7 + r * 3) % 7]; x.fillRect(i * 6.4 + 1, 4 + r * 28, 5, 14); } } });
    shelves.emissive = new THREE.Color('#ffffff'); shelves.emissiveMap = shelves.map; shelves.emissiveIntensity = .55;
    const g = new THREE.Mesh(new THREE.PlaneGeometry(w * .86, 2.5), shelves); g.position.set(xc, 1.3, -sw - .05); g.rotation.y = PI; exterior.add(g);
    bx(exterior, w * .9, .08, .1, xc, 0, -sw - .06, M('#bbb', { m: .6 })); for (const dx of [-w * .45, 0, w * .45]) bx(exterior, .08, 2.6, .1, xc + dx, 0, -sw - .06, M('#bbb', { m: .6 }));
    for (const [y, col] of [[2.65, '#f2c230'], [2.8, '#2a6ab0'], [2.95, '#2a6ab0']]) bx(exterior, w - .1, .15, .14, xc, y, -sw - .1, M(col, { r: .5 }));
    sign('便利商店 24H', '#ffffff', '#2a6ab0', 3, .5, xc, 3.45, -sw - .2, PI);
    ext('vending_machine', xc + w / 2 - .7, sw + .45, 180, true);
    ext('trash_can', xc - w / 2 + .5, sw + .4, 0); ext('mailbox', xc - w / 2 + 1.4, sw + .4, 180, true);
  }
  // ---- a small shrine (土地公廟) with a courtyard ----
  function shrine(xc, sw, w, c) {
    bx(exterior, w - .1, 7.5, 6, xc, 0, -(sw - 7), M(c, { r: .9 }));
    bx(exterior, w - .1, .06, 4, xc, -.03, -(sw - 2), M('#b8b0a0', { r: .9 }));
    const red = M('#b8241c', { r: .6 }), gold = M('#e0b040', { m: .5, r: .4 }), tile = M('#c8642a', { r: .7 });
    bx(exterior, 3.2, 2.6, 2.4, xc, 0, -(sw - 2.9), red); bx(exterior, 1.2, 1.7, .05, xc, .2, -(sw - 1.68), M('#2a1410'));
    for (const s of [-1, 1]) { const r = bx(exterior, 2.0, .12, 2.9, xc + s * .8, 2.75, -(sw - 2.9), tile); r.rotation.z = s * -.42; }
    bx(exterior, 3.4, .14, .14, xc, 3.15, -(sw - 2.9), gold);
    for (const s of [-1, 1]) { sp(exterior, .12, xc + s * 1.75, 3.25, -(sw - 2.9), gold); cy(exterior, .07, .07, 2.6, xc + s * 1.45, 0, -(sw - 1.62), red, 10); }
    sign('福德祠', '#b8241c', '#ffd23a', 1.2, .32, xc, 2.25, -(sw - 1.64), PI);
    cy(exterior, .3, .22, .55, xc, 0, -(sw - 1.0), M('#3a2a1a', { m: .4, r: .5 }), 16); for (let i = 0; i < 3; i++) cy(exterior, .006, .006, .25, xc - .05 + i * .05, .55, -(sw - 1.0), M('#c8301a'), 4);
    for (const s of [-1, 1]) ext('red_lantern', xc + s * 1.2, sw - 1.64, 0, false, 2.6);
    solidBox(xc - 1.6, sw - 1.7, xc + 1.6, sw - 4.1);
  }
  // ---- the little park ----
  const pk = PARK(cx, far), pw = pk.x1 - pk.x0, pd = pk.d0 - pk.d1, pcx = (pk.x0 + pk.x1) / 2, pcd = (pk.d0 + pk.d1) / 2;
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(pw, pd), M('#6a9a4a', { r: 1 })); grass.rotation.x = -Math.PI / 2; grass.position.set(pcx, -0.005, -pcd); exterior.add(grass);
  const path = new THREE.Mesh(new THREE.PlaneGeometry(1.6, pd), M('#c8b898', { r: 1 })); path.rotation.x = -Math.PI / 2; path.position.set(pcx, 0, -pcd); exterior.add(path);
  const hedge = M('#3f7a34', { r: 1 });
  bx(exterior, pw, .9, .5, pcx, 0, -(pk.d1 + .25), hedge); for (const x of [pk.x0 + .25, pk.x1 - .25]) bx(exterior, .5, .9, pd, x, 0, -pcd, hedge);
  for (const x of [pk.x0 + .25, pk.x1 - .25]) bx(exterior, .5, .9, .1, x, 0, -(pk.d0 - .05), hedge);
  sign('社區公園', '#3a6a2a', '#ffffff', 1.6, .4, pk.x0 + 1.3, 1.6, -(pk.d0 - .1), PI); cy(exterior, .05, .05, 1.4, pk.x0 + 1.3, 0, -(pk.d0 - .12), M('#555'));
  for (const [x, d] of [[pk.x0 + 1.4, pk.d1 + 1.6], [pk.x1 - 1.4, pk.d1 + 1.6], [pk.x0 + 1.2, pcd + .5], [pk.x1 - 1.2, pcd - .8]]) ext('street_tree', x, d, 0);
  ext('bench', pcx - 2.2, pk.d1 + 1.2, 0); ext('bench', pcx + 2.2, pk.d1 + 1.2, 0);
  ext('kids_slide', pcx + 3, pcd, 90, true); ext('street_lamp', pcx - 1.2, pk.d0 - 1.2, 90);
  ext('trash_can', pcx + 1.1, pk.d0 - .9, 0); ext('mushroom_stool', pcx - 3.4, pcd - 1.6, 0); ext('mushroom_stool', pcx - 2.8, pcd - 2.1, 0);
  // swings
  { const g = new THREE.Group(), mt = M('#d84a3a', { m: .4, r: .4 }), x0 = pcx - 3.2, d0 = pcd + 1.2;
    for (const s of [-1, 1]) for (const t of [-1, 1]) { const l = bx(g, .08, 2.3, .08, s * 1.3, 0, t * .5, mt); l.rotation.x = -t * .2; }
    const top = cy(g, .05, .05, 2.7, 0, 2.15, 0, mt, 8); top.rotation.z = Math.PI / 2; top.position.y = 2.15;
    for (const sx of [-.55, .55]) { for (const r of [-.18, .18]) cy(g, .008, .008, 1.6, sx + r, .55, 0, M('#888', { m: .8 }), 4); bx(g, .45, .04, .2, sx, .53, 0, M('#2a6ab0')); }
    g.position.set(x0, 0, -d0); exterior.add(g); solidBox(x0 - 1.4, d0 - .6, x0 + 1.4, d0 + .6); }
  // sandbox
  bx(exterior, 2.2, .2, 1.6, pcx + 2.8, 0, -(pk.d1 + 3.0), M('#b8884a')); bx(exterior, 2.0, .02, 1.4, pcx + 2.8, .19, -(pk.d1 + 3.0), M('#e8d8a8', { r: 1 })); ext('bucket_mop', pcx + 2.4, pk.d1 + 3.1, 0, false, .2); ext('ball', pcx + 3.3, pk.d1 + 2.8, 0, false, .2);
  // a pavilion
  { const x0 = pcx - 3.3, d0 = pk.d1 + 3.6, wd = M('#7a4a2a', { r: .7 });
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { cy(exterior, .08, .08, 2.4, x0 + a * 1.1, 0, -(d0 + b * 1.1), wd, 8); solidBox(x0 + a * 1.1 - .1, d0 + b * 1.1 - .1, x0 + a * 1.1 + .1, d0 + b * 1.1 + .1); }
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.0, 1.0, 4), M('#2f5a3a', { r: .6 })); roof.rotation.y = Math.PI / 4; roof.position.set(x0, 2.9, -d0); exterior.add(roof);
    bx(exterior, 1.2, .05, .7, x0, .7, -d0, wd); for (const s of [-1, 1]) bx(exterior, 1.0, .05, .3, x0, .42, -(d0 + s * .6), wd); }
  // ---- street furniture ----
  for (let x = cx - 26; x <= cx + 26; x += 13) if (x < pk.x0 - .5 || x > pk.x1 + .5) ext('street_lamp', x, sw + .35, 180);
  ext('bus_stop', cx + 9, sw + .4, 180); ext('bench', cx + 10.4, sw + .55, 180);
  ext('fire_hydrant', cx + 13.5, sw + .4, 0); ext('trash_can', cx - 17, sw + .4, 0);
  ext('car', cx + 15.5, far + 1.3, 90, true); ext('car', cx - 20.5, far + 1.3, -90, true);
  // utility poles with sagging wires along our side of the street
  const poleXs = [cx - 24, cx - 12, B.x1 + 3.5, cx + 18];
  for (const x of poleXs) {
    cy(exterior, .13, .17, 8.5, x, 0, -(front - .5), M('#9a9a92', { r: .9 }), 10); bx(exterior, 1.6, .1, .1, x, 7.6, -(front - .5), M('#555'));
    cy(exterior, .22, .22, .7, x + .35, 6.4, -(front - .3), M('#7a8088', { m: .4 }), 12); solidBox(x - .18, front - .68, x + .18, front - .32);
  }
  for (let i = 0; i < poleXs.length - 1; i++) for (const dz of [-.7, 0, .7]) {
    const a = poleXs[i], b = poleXs[i + 1], L = b - a, wire = cy(exterior, .012, .012, L, (a + b) / 2, 0, -(front - .5) + dz * .1, M('#1a1a1a'), 4);
    wire.rotation.z = Math.PI / 2; wire.position.y = 7.55 - (dz === 0 ? .35 : .15);
  }
  // scooters parked in front of the neighbours (never in front of our gate)
  let n = 0; for (const [x0, dir] of [[B.x0 - 1.2, -1], [B.x1 + 1.2, 1]]) for (let i = 0; i < 4; i++) ext('scooter', x0 + dir * i * .75, front - 1.0, 180 + ((n++ % 3) - 1) * 6);
  // a zebra crossing and a few cones
  for (let i = 0; i < 7; i++) { const z = new THREE.Mesh(new THREE.PlaneGeometry(.45, Math.max(2, front - far - 2.2)), M('#f2f2f2')); z.rotation.x = -Math.PI / 2; z.position.set(B.x1 + 6 + i * .8, -0.008, -((front + far) / 2)); exterior.add(z); }
  for (const x of [L0(cx), R0(cx)]) for (let i = 0; i < 4; i++) ext('barrier', x, front - 1.5 - i * 2.6, 90);
}
const L0 = cx => cx - 29.4, R0 = cx => cx + 29.4;
export function addBoundarySegs() { }
