// house: build 3D from data, collisions, doors, lights, destruction blocks
import { THREE, mergeGeometries, S, scene, camera, M, P, presetColor, BG, bx, cy, sp, pl, boxUV, DEG, clamp, canvasPlane } from './core.js';
import { CAT, buildFurniture } from './catalog.js';

export const FH = 3.2, CH = 3.0, T = 0.12;
export const floorY = i => i * FH;
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
export const lightCfg = { intensity: 8, flicker: 0 };
export function setNight(v) {
  S.night = v; scene.background.set(v ? '#0b1020' : '#b9d2e6');
  hemi.intensity = v ? .1 : 1.0; amb.intensity = v ? .04 : .35; sun.intensity = v ? 0 : 1.6;
}

// ---------- stairs ----------
export function stairGeom(st) {
  const { x, d, w, len } = st, half = w / 2, n1 = 7, n2 = 9, r = FH / 16;
  const f1s = d + len - 0.9, f1e = d + 0.7, run1 = (f1s - f1e) / n1, f2e = d + len - 0.37, run2 = (f2e - f1e) / n2;
  const steps = [];
  for (let i = 0; i < n1; i++) steps.push({ x0: x + .03, x1: x + half - .02, d0: f1s - (i + 1) * run1, d1: f1s - i * run1, top: (i + 1) * r });
  steps.push({ x0: x + .03, x1: x + w - .03, d0: d + .03, d1: f1e, top: n1 * r, landing: 1 });
  for (let i = 0; i < n2; i++) steps.push({ x0: x + half + .02, x1: x + w - .03, d0: f1e + i * run2, d1: f1e + (i + 1) * run2, top: (n1 + i + 1) * r });
  const holes = [{ x0: x, d0: d, x1: x + w, d1: f1s }, { x0: x + half, d0: f1s, x1: x + w, d1: f2e }];
  return { steps, holes };
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
let dataRef = null;
export function build(data, opts = {}) {
  dataRef = data;
  for (const c of H.root.children.slice()) { H.root.remove(c); c.traverse(o => { if (o.geometry && o.userData.own) o.geometry.dispose(); }); }
  Object.assign(H, { floors: [], segs: [], steps: [], solids: [], cells: [], doors: [], lamps: [], surf: {}, furn: [], breakables: [], wallMeshes: [], blockMeshes: [], slabMeshes: [], totalBlocks: 0, brokenBlocks: 0 });
  H.destruct = !!opts.destruct;
  const nF = data.floors.length, holes = data.floors.map(() => []);
  for (const st of data.stairs) if (holes[st.floor + 1]) holes[st.floor + 1].push(...stairGeom(st).holes);
  data.floors.forEach((fl, fi) => {
    const g = new THREE.Group(); g.userData.fi = fi; H.root.add(g); H.floors.push(g);
    const Y = floorY(fi);
    for (const r of fl.rooms) buildSlab(g, fi, r, holes[fi], Y);
    if (fi === nF - 1) for (const r of fl.rooms) buildRoof(g, r, Y + CH);
    for (const w of fl.walls) buildWall(g, fi, w, Y);
    for (const f of fl.furniture) spawnFurniture(f, fi);
    for (const r of fl.rooms) { const area = (r.x1 - r.x0) * (r.d1 - r.d0); if (area >= 1.2) addLamp(g, (r.x0 + r.x1) / 2, Y + CH - .03, -(r.d0 + r.d1) / 2, r.name); }
  });
  for (const st of data.stairs) if (H.floors[st.floor]) buildStairs(H.floors[st.floor], st);
  // ground everywhere outside
  H.cells.push({ x0: -60, x1: 60, z0: -60, z1: 60, y: 0 });
  addBoundarySegs();
  H._furnTotal = H.furn.length;
  refreshSolids();
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
function buildRoof(g, r, y) {
  const w = r.x1 - r.x0, dd = r.d1 - r.d0;
  const m = new THREE.Mesh(BG(w + .02, .2, dd + .02), [ceilMat, ceilMat, P('concrete'), ceilMat, ceilMat, ceilMat]);
  m.position.set((r.x0 + r.x1) / 2, y + .1, -(r.d0 + r.d1) / 2); g.add(m); m.userData.roof = 1;
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
function buildWall(g, fi, w, Y) {
  const dx = w.x2 - w.x1, dd = w.d2 - w.d1, L = Math.hypot(dx, dd); if (L < .05) return;
  const ux = dx / L, ud = dd / L, th = Math.atan2(ud, ux);
  const at = s => [w.x1 + ux * s, w.d1 + ud * s];
  const kA = `w:${fi}:${w.id}:a`, kB = `w:${fi}:${w.id}:b`;
  if (w.kind === 'rail') return buildRail(g, w, Y, L, ux, ud, th, kA, kB);
  const hgt = FH;
  const { pieces, list } = wallPieces(L, w.ops || [], hgt);
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
    const leaf = leafMesh(o.style, lf.w - .02, o.h - .02); leaf.position.x = .01; pivot.add(leaf);
    const d = { kind: 'hinge', fi, pivot, leaf, base, delta: 88 * DEG * sgn, t: 0, open: false, w: lf.w, y0: Y + o.sill, h: o.h, name: o.type === 'door2' ? '大門' : '門', hp: 40, max: 40 };
    pivot.rotation.y = base;
    leaf.traverse(m => m.userData.door = d);
    H.doors.push(d); made.push(d);
    H.breakables.push({ kind: 'door', obj: pivot, door: d, hp: 40, max: 40, box: new THREE.Box3(), fi, color: DOOR_STYLE[o.style]?.c || '#6b4a35', value: 30 });
  }
  if (made.length === 2) { made[0].pair = made[1]; made[1].pair = made[0]; }
}
function buildStairs(g, st) {
  const Y = floorY(st.floor), { steps } = stairGeom(st), m = P('concrete'), nose = M('#6d6b66');
  for (const s of steps) {
    const w = s.x1 - s.x0, dd = s.d1 - s.d0;
    const mesh = new THREE.Mesh(BG(w, s.top, dd), m); mesh.position.set((s.x0 + s.x1) / 2, Y + s.top / 2, -(s.d0 + s.d1) / 2); g.add(mesh);
    const b = new THREE.Box3(new THREE.Vector3(s.x0, Y, -s.d1), new THREE.Vector3(s.x1, Y + s.top, -s.d0)); b.step = 1; H.steps.push(b);
  }
  // handrail along the outer wall side of flight 2 (visual only)
  bx(g, .04, .04, st.len - 1.1, st.x + st.w - .06, Y + 2.4, -(st.d + st.len / 2 + .2), M('#888', { m: .6 }));
}
function addLamp(g, x, y, z, name) {
  const lm = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff6e0', emissiveIntensity: 1.2 });
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 0.06, 20), lm); m.userData.own = 1; m.position.set(x, y, z); g.add(m);
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
  e.spin = obj.getObjectByName('spin');
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
  H.solids = [...H.steps, ...H.furn.filter(e => !e.nc && !e.dead).map(e => e.box)];
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
export function hits(x, z, feet, r = 0.24, ignoreDoors = false) {
  const lo = feet + 0.36, hi = feet + 1.7;
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
export function groundAt(x, z, feet) {
  let g = -100; const lim = feet + 0.38;
  for (const c of H.cells) if (c.y <= lim && c.y > g && x >= c.x0 && x <= c.x1 && z >= c.z0 && z <= c.z1) g = c.y;
  for (const c of H.solids) if (c.max.y <= lim && c.max.y > g && x > c.min.x - .1 && x < c.max.x + .1 && z > c.min.z - .1 && z < c.max.z + .1) g = c.max.y;
  return g;
}
export const floorOf = y => clamp(Math.floor((y + .6) / FH), 0, Math.max(0, H.floors.length - 1));

// ---------- surfaces (paint) ----------
export function paintSurface(key, preset) {
  const p = key.split(':'), fl = dataRef.floors[+p[1]];
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
  for (const e of H.furn) if (e.spin) e.spin.rotation.z += dt * 12;
  poolT -= dt;
  if (poolT <= 0) {
    poolT = .25;
    const cp = camera.position;
    const lit = H.lamps.filter(l => l.on).map(l => [l, (l.x - cp.x) ** 2 + (l.z - cp.z) ** 2 + ((l.y - cp.y) * 2.5) ** 2]).sort((a, b) => a[1] - b[1]);
    pool.forEach((L, i) => { const e = lit[i]; if (e) { L.position.set(e[0].x, e[0].y - .25, e[0].z); L.intensity = lightCfg.intensity; } else L.intensity = 0; });
  }
  if (lightCfg.flicker > 0) pool.forEach(L => { if (L.intensity > 0) L.intensity = lightCfg.intensity * (Math.random() < lightCfg.flicker ? .05 : 1); });
}
export function toggleDoor(d) { d.open = !d.open; if (d.pair) d.pair.open = d.open; }

// ---------- exterior (built once) ----------
export const exterior = new THREE.Group(); scene.add(exterior);
{
  const fm = P('facade');
  bx(exterior, 0.45, 3.0, 0.45, 0.22, 0, 3.0, fm); bx(exterior, 0.45, 3.0, 0.45, 4.78, 0, 3.0, fm);
  bx(exterior, 5, 0.3, 0.3, 2.5, 2.7, 0.2, M('#b8bcc0', { m: .5, r: .4 }));
  const road = new THREE.Mesh(new THREE.PlaneGeometry(80, 16), M('#4a4c50', { r: .95 })); road.rotation.x = -Math.PI / 2; road.position.set(2.5, -0.02, 11.2); exterior.add(road);
  const walk = new THREE.Mesh(new THREE.PlaneGeometry(80, 0.2), M('#ffffff')); walk.rotation.x = -Math.PI / 2; walk.position.set(2.5, -0.01, 8); exterior.add(walk);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(80, 60), M('#6f7a62', { r: 1 })); back.rotation.x = -Math.PI / 2; back.position.set(2.5, -0.03, -30); exterior.add(back);
  const nb = [['#c9b8a0', -3.1, 10.2], ['#a9b6c2', 8.1, 11.5], ['#d6c7b5', -9.3, 9.6], ['#b6a79e', 14.3, 12.8]];
  for (const [c, x, h] of nb) {
    bx(exterior, 6.2, h, 20, x, 0, -6.6, M(c, { r: .9 }));
    for (const y of [3.8, 7.0]) bx(exterior, 3, 1.3, 0.06, x, y, 3.42, M('#5d7a90', { r: .2, m: .3 }));
    bx(exterior, 4, 2.4, 0.06, x, 0, 3.42, M('#8e9499', { m: .5, r: .4 }));
  }
  const bnd = [[2.5, 1.5, 6.2, 20, 3, .1], [-0.06, 1.5, 4.7, .1, 3, 3], [5.06, 1.5, 4.7, .1, 3, 3]];
  for (const [x, y, z, w, h, d] of bnd) H._bounds = (H._bounds || []).concat([[x, z, w, d]]);
}
export function addBoundarySegs() {
  addSeg(-7, -6.2, 12, -6.2, 0, 50, .05); addSeg(-0.06, -3.2, -0.06, -6.2, 0, 50, .05); addSeg(5.06, -3.2, 5.06, -6.2, 0, 50, .05);
}
