// furniture catalog: procedural builders (front faces local +z, origin at bottom centre)
import { THREE, mergeGeometries, M, PM, bx, cy, sp, pl, rng, shade, canvasPlane } from './core.js';

export const CAT = {};
const wood = c => M(c, { r: .6 });
function def(id, n, grp, c, f, extra = {}) { CAT[id] = { n, grp, c, f, ...extra }; }

def('altar', '神明桌', '客廳', '#2b1612', c => {
  const g = new THREE.Group(), w = wood(c), gold = M('#c9a23a', { m: .7, r: .3 });
  bx(g, 1.5, 0.1, 0.62, 0, 0, 0, w); bx(g, 1.42, 0.88, 0.56, 0, 0.1, -0.02, w); bx(g, 1.56, 0.07, 0.66, 0, 0.98, 0, w);
  pl(g, 1.3, 0.24, 0, 0.84, 0.265, PM('altar_carving'));
  bx(g, 1.5, 1.4, 0.05, 0, 1.05, -0.27, w);
  for (const x of [-0.7, 0.7]) bx(g, 0.1, 1.4, 0.42, x, 1.05, -0.09, w);
  bx(g, 1.62, 0.22, 0.5, 0, 2.45, -0.07, w); bx(g, 1.7, 0.06, 0.55, 0, 2.67, -0.07, w);
  pl(g, 1.05, 1.0, 0, 1.75, -0.24, PM('altar_panel'));
  for (const x of [-0.58, 0.58]) bx(g, 0.1, 1.0, 0.01, x, 1.25, -0.23, M('#b3171b', { r: .6 }));
  const red = M('#ff3a2a', { e: '#ff2a1a', ei: 1.5 });
  for (const x of [-0.5, -0.25, 0.25, 0.5]) { cy(g, .012, .02, 0.14, x, 1.05, 0.05, gold); sp(g, .04, x, 1.24, 0.05, red, 1.3); }
  cy(g, .08, .07, 0.12, 0, 1.05, 0.02, gold);
  bx(g, 1.15, 0.05, 0.42, 0, 0.8, 0.36, w);
  for (const [x, z] of [[-.53, .18], [.53, .18], [-.53, .54], [.53, .54]]) bx(g, 0.05, 0.8, 0.05, x, 0, z, w);
  return g;
});
def('desk_drawers', '抽屜書桌', '客廳', '#8a4a22', c => {
  const g = new THREE.Group(), w = wood(c), dk = M('#4a250f');
  bx(g, 1.3, 0.76, 0.6, 0, 0, 0, w); bx(g, 1.34, 0.04, 0.64, 0, 0.76, 0, w);
  for (let i = 0; i < 3; i++) for (const x of [-.42, .42]) { bx(g, 0.4, 0.2, 0.01, x, 0.08 + i * 0.23, 0.3, M(c, { r: .5 })); bx(g, 0.1, 0.02, 0.02, x, 0.18 + i * 0.23, 0.31, dk); }
  const r = rng(5), cs = ['#f2f2f2', '#4aa3df', '#e8c040', '#d0503a', '#7ac070'];
  for (let i = 0; i < 7; i++) bx(g, .08 + r() * .2, .05 + r() * .3, .08 + r() * .15, -.5 + r(), .8, -.15 + r() * .3, M(cs[i % 5]));
  return g;
});
def('dining_table', '長桌', '客廳', '#d8c6a3', c => {
  const g = new THREE.Group(); bx(g, 1.8, 0.05, 0.85, 0, 0.71, 0, wood(c));
  for (const [x, z] of [[-.85, -.37], [.85, -.37], [-.85, .37], [.85, .37]]) bx(g, 0.05, 0.71, 0.05, x, 0, z, M('#555', { m: .5 }));
  return g;
});
def('chair', '椅子', '客廳', '#2d2f33', c => {
  const g = new THREE.Group(), m = M(c, { r: .6 }), mt = M('#aaa', { m: .7, r: .3 });
  bx(g, 0.46, 0.06, 0.44, 0, 0.44, 0, m); bx(g, 0.44, 0.48, 0.05, 0, 0.5, -0.2, m);
  for (const [x, z] of [[-.2, -.18], [.2, -.18], [-.2, .18], [.2, .18]]) cy(g, .012, .012, .44, x, 0, z, mt, 6);
  return g;
});
def('stool_red', '紅色板凳', '客廳', '#d42a22', c => {
  const g = new THREE.Group(), m = M(c, { r: .45 }); bx(g, 0.3, 0.04, 0.3, 0, 0.3, 0, m);
  for (const [x, z] of [[-.12, -.12], [.12, -.12], [-.12, .12], [.12, .12]]) bx(g, 0.04, 0.3, 0.04, x, 0, z, m);
  return g;
});
function sofa(c, w) {
  const g = new THREE.Group(), m = M(c, { r: .95 }), dk = M(shade(c, -.08), { r: .95 });
  bx(g, w, 0.27, 0.88, 0, 0.05, 0, dk);
  const n = Math.max(1, Math.round((w - .3) / .62)), cw = (w - .32) / n;
  for (let i = 0; i < n; i++) { bx(g, cw - .02, 0.15, 0.62, -w / 2 + .16 + cw * (i + .5), 0.32, 0.1, m); bx(g, cw - .02, 0.42, 0.2, -w / 2 + .16 + cw * (i + .5), 0.32, -0.3, m); }
  for (const x of [-w / 2 + .08, w / 2 - .08]) bx(g, 0.16, 0.6, 0.88, x, 0.05, 0, m);
  return g;
}
def('sofa3', '三人沙發', '客廳', '#a3a29e', c => { const g = sofa(c, 2.0); const p = bx(g, .45, .38, .14, -.55, .45, -.16, M('#e8743a', { r: 1 })); p.rotation.z = .15; return g; });
def('sofa1', '單人沙發', '客廳', '#a3a29e', c => sofa(c, 0.95));
def('coffee_table', '茶几', '客廳', '#c5a882', c => {
  const g = new THREE.Group(), w = wood(c); bx(g, 1.1, 0.05, 0.6, 0, 0.38, 0, w); bx(g, 1.0, 0.03, 0.5, 0, 0.1, 0, w);
  for (const [x, z] of [[-.5, -.25], [.5, -.25], [-.5, .25], [.5, .25]]) bx(g, 0.05, 0.38, 0.05, x, 0, z, M(shade(c, -.2)));
  return g;
});
def('tv_cabinet', '電視櫃', '客廳', '#7a4a28', c => {
  const g = new THREE.Group(), w = wood(c); bx(g, 1.6, 0.5, 0.45, 0, 0, 0, w);
  bx(g, 0.25, 0.04, 0.18, 0, 0.5, 0, M('#222')); bx(g, 1.05, 0.62, 0.05, 0, 0.6, 0, M('#111', { r: .3 }));
  pl(g, 1.0, 0.57, 0, 0.91, 0.026, M('#0d1b2a', { r: .2, e: '#1a3550', ei: .6 }));
  return g;
});
def('water_dispenser', '飲水機', '客廳', '#f0f0ee', c => {
  const g = new THREE.Group(); bx(g, 0.32, 1.05, 0.35, 0, 0, 0, M(c, { r: .4 })); bx(g, 0.22, 0.25, 0.02, 0, 0.55, 0.18, M('#333'));
  return g;
});
def('helmet_rack', '安全帽鐵架', '收納', '#c8ccd0', c => {
  const g = new THREE.Group(), mt = M(c, { m: .8, r: .3 }), sh = M(c, { m: .6, r: .45 });
  for (const [x, z] of [[-.58, -.2], [.58, -.2], [-.58, .2], [.58, .2]]) cy(g, .012, .012, 1.85, x, 0, z, mt, 6);
  for (const y of [0.15, 0.7, 1.2, 1.7]) bx(g, 1.2, 0.02, 0.44, 0, y, 0, sh);
  const cs = ['#2b3440', '#1d1d1d', '#6a3c22', '#111', '#8fd6dc', '#f1e9d8', '#f37fb0', '#7fc3ef', '#b9a6e0'];
  for (let i = 0; i < 4; i++) sp(g, .14, -.42 + i * .28, 1.37, 0, M(cs[i], { r: .25 }), .95);
  for (let i = 0; i < 5; i++) sp(g, .13, -.46 + i * .23, .86, 0, M(cs[4 + i], { r: .25 }), .95);
  for (let i = 0; i < 6; i++) bx(g, .17, .45, .15, -.48 + i * .19, .17, 0, M(['#ddd', '#333', '#cbb8e0', '#556', '#eee', '#9ab'][i]));
  return g;
});
def('glass_cabinet', '玻璃展示櫃', '收納', '#c79a5e', c => {
  const g = new THREE.Group(), w = wood(c), gl = M('#cfe3ea', { r: .05, op: .35 });
  bx(g, 0.8, 0.08, 0.4, 0, 0, 0, w); bx(g, 0.8, 0.05, 0.4, 0, 1.75, 0, w);
  for (const x of [-.38, .38]) bx(g, 0.04, 1.8, 0.4, x, 0, 0, w); bx(g, .8, 1.8, .02, 0, 0, -.19, w);
  for (const y of [.5, .95, 1.35]) bx(g, .72, .02, .36, 0, y, 0, w);
  const r = rng(9); for (let i = 0; i < 10; i++) cy(g, .03, .03, .08 + r() * .14, -.3 + r() * .6, [.1, .52, .97][i % 3], -.1 + r() * .2, M(['#eee', '#cde', '#f9c', '#ddd'][i % 4]), 6);
  bx(g, .74, 1.66, .01, 0, .08, .2, gl);
  return g;
});
def('fan', '電風扇', '客廳', '#f2f2ef', c => {
  const g = new THREE.Group(), m = M(c, { r: .4 });
  cy(g, .17, .19, .04, 0, 0, 0, m); cy(g, .02, .02, .95, 0, 0, 0, m); sp(g, .07, 0, 1.0, 0, m);
  const blades = new THREE.Group(); blades.position.set(0, 1.0, .08); g.add(blades); blades.userData.keep = 1; g.userData.spinName = 'spin'; blades.name = 'spin';
  for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.CircleGeometry(.09, 10), M('#f6c7c7', { ds: 1 })); b.position.set(Math.cos(i * 2.09) * .09, Math.sin(i * 2.09) * .09, 0); blades.add(b); }
  return g;
});
def('shoe_cabinet', '鞋櫃', '收納', '#9ea3a6', c => {
  const g = new THREE.Group(), m = M(c, { r: .5 }); bx(g, 0.95, 1.5, 0.35, 0, 0, 0, m);
  const r = rng(10);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 6; j++) {
    bx(g, 0.29, 0.22, 0.01, -0.31 + i * 0.31, 0.04 + j * 0.245, 0.176, M('#e9ecee', { r: .3 }));
    bx(g, 0.18, 0.07, 0.01, -0.31 + i * 0.31, 0.08 + j * 0.245, 0.182, M(['#eee', '#333', '#79c', '#f9a', '#cb9'][Math.floor(r() * 5)]));
  }
  return g;
});
def('armchair_red', '紅色按摩椅', '客廳', '#8e1c1c', c => {
  const g = new THREE.Group(), m = M(c, { r: .35 });
  bx(g, 0.85, 0.42, 0.85, 0, 0, 0, m); bx(g, 0.6, 0.15, 0.6, 0, 0.42, 0.08, m);
  bx(g, 0.85, 0.7, 0.22, 0, 0.42, -0.32, m); for (const x of [-.36, .36]) bx(g, 0.15, 0.3, 0.8, x, 0.42, 0, m);
  return g;
});
def('coat_rack', '吊衣架', '收納', '#2a2e3a', c => {
  const g = new THREE.Group(); cy(g, .02, .02, 1.8, 0, 0, 0, M('#888', { m: .7 })); cy(g, .22, .24, .03, 0, 0, 0, M('#666', { m: .6 }));
  const r = rng(11); for (let i = 0; i < 5; i++) { const a = i * 1.25; const b = bx(g, .38, .9 + r() * .2, .12, Math.cos(a) * .14, .75, Math.sin(a) * .14, M(i % 2 ? c : shade(c, .1 + r() * .1), { r: .9 })); b.rotation.y = -a; }
  return g;
});
def('fridge', '冰箱', '廚房', '#161616', c => {
  const g = new THREE.Group(), m = M(c, { r: .25, m: .3 }); bx(g, 0.7, 1.75, 0.68, 0, 0, 0, m);
  bx(g, 0.7, 0.01, 0.01, 0, 1.15, 0.345, M('#000')); bx(g, 0.03, 0.4, 0.03, -0.3, 1.25, 0.36, M('#888', { m: .8 })); bx(g, 0.03, 0.4, 0.03, -0.3, 0.6, 0.36, M('#888', { m: .8 }));
  const r = rng(12), cs = ['#fff', '#f6c', '#fc3', '#6cf', '#f63', '#9e6'];
  for (let i = 0; i < 12; i++) bx(g, .05 + r() * .06, .04 + r() * .06, .01, -.25 + r() * .5, 1.2 + r() * .5, .345, M(cs[i % 6]));
  return g;
});
def('kitchen_counter', '流理台(水槽)', '廚房', '#efe3a6', c => {
  const g = new THREE.Group(), cab = M(c, { r: .5 }), top = M('#c9ccd0', { m: .6, r: .3 });
  bx(g, 1.8, 0.82, 0.6, 0, 0, 0, cab); bx(g, 1.82, 0.04, 0.62, 0, 0.82, 0, top);
  for (let i = 0; i < 3; i++) bx(g, 0.58, 0.7, 0.01, -0.6 + i * 0.6, 0.06, 0.3, M(shade(c, -.03), { r: .5 }));
  bx(g, 0.6, 0.02, 0.4, -0.3, 0.845, 0.02, M('#7d8186', { m: .7, r: .25 }));
  cy(g, .015, .015, .3, -.3, .86, -.22, top); bx(g, .02, .02, .18, -.3, 1.14, -.14, top);
  return g;
});
def('stove', '瓦斯爐台', '廚房', '#efe3a6', c => {
  const g = new THREE.Group(), cab = M(c, { r: .5 }), top = M('#c9ccd0', { m: .6, r: .3 });
  bx(g, 0.75, 0.82, 0.6, 0, 0, 0, cab); bx(g, 0.77, 0.04, 0.62, 0, 0.82, 0, top);
  bx(g, 0.7, 0.08, 0.45, 0, 0.86, 0, M('#222', { r: .4 }));
  bx(g, 0.75, 0.22, 0.5, 0, 1.6, -0.05, M('#d6d9dc', { m: .7, r: .3 })); cy(g, .07, .07, 1.2, .15, 1.82, -.15, M('#c0c4c8', { m: .7, r: .3 }), 10);
  return g;
});
def('shelf_rack', '雜物層架', '收納', '#d7b98a', c => {
  const g = new THREE.Group(), w = wood(c);
  for (const [x, z] of [[-.4, -.18], [.4, -.18], [-.4, .18], [.4, .18]]) bx(g, 0.04, 1.3, 0.04, x, 0, z, w);
  const r = rng(14), cs = ['#e44', '#4a4', '#fa0', '#48c', '#c6c', '#fff', '#eb5'];
  for (const y of [0.1, 0.5, 0.9, 1.28]) { bx(g, 0.84, 0.03, 0.4, 0, y, 0, w); if (y < 1.2) for (let i = 0; i < 4; i++) cy(g, .05, .05, .1 + r() * .22, -.3 + i * .2, y + .03, (r() - .5) * .2, M(cs[Math.floor(r() * 7)], { r: .4 }), 8); }
  return g;
});
def('toilet', '馬桶', '衛浴', '#fafafa', c => {
  const g = new THREE.Group(), m = M(c, { r: .15 });
  cy(g, .16, .13, .38, 0, 0, .05, m); cy(g, .2, .18, .06, 0, .38, .08, m); bx(g, .42, .38, .18, 0, .4, -.17, m);
  return g;
});
def('basin', '洗手台', '衛浴', '#fafafa', c => {
  const g = new THREE.Group(), m = M(c, { r: .15 });
  cy(g, .07, .1, .68, 0, 0, -.05, m); bx(g, .5, .14, .4, 0, .68, 0, m); bx(g, .4, .03, .3, 0, .8, .02, M('#ccd'));
  bx(g, .45, .55, .02, 0, 1.15, -.2, M('#cfe0ea', { r: .05, m: .9 }));
  return g;
});
def('washer', '洗衣機', '衛浴', '#f4f4f4', c => {
  const g = new THREE.Group(); bx(g, 0.58, 0.92, 0.58, 0, 0, 0, M(c, { r: .35 }));
  cy(g, .2, .2, .01, 0, .92, .03, M('#666', { r: .3 })); bx(g, .58, .12, .06, 0, .92, -.26, M('#ddd'));
  return g;
});
def('plant', '盆栽', '裝飾', '#3f8f3a', c => {
  const g = new THREE.Group(); cy(g, .17, .13, .3, 0, 0, 0, M('#8a5a3a'));
  const r = rng(15); for (let i = 0; i < 7; i++) { const l = new THREE.Mesh(new THREE.ConeGeometry(.06, .6 + r() * .3, 5), M(shade(c, (r() - .5) * .15))); l.position.set((r() - .5) * .15, .55, (r() - .5) * .15); l.rotation.set((r() - .5) * .7, 0, (r() - .5) * .7); g.add(l); }
  return g;
});
def('scooter', '機車', '其他', '#6b6880', c => {
  const g = new THREE.Group(), m = M(c, { r: .3, m: .3 }), tire = M('#151515', { r: .9 });
  for (const z of [-.6, .6]) { const t = cy(g, .2, .2, .1, 0, 0, z, tire, 16); t.rotation.z = Math.PI / 2; t.position.y = .2; }
  bx(g, 0.32, 0.3, 1.1, 0, 0.25, -0.05, m); bx(g, 0.3, 0.12, 0.6, 0, 0.6, -0.25, M('#222', { r: .6 }));
  bx(g, 0.28, 0.6, 0.15, 0, 0.35, 0.5, m); bx(g, 0.6, 0.03, 0.03, 0, 1.0, 0.55, M('#333'));
  return g;
});
def('boxes', '紙箱堆', '收納', '#c49a64', c => {
  const g = new THREE.Group();
  bx(g, .6, .45, .45, 0, 0, 0, M(c, { r: 1 })); bx(g, .5, .35, .4, .03, .45, 0, M(shade(c, .05), { r: 1 })); bx(g, .35, .25, .3, -.05, .8, .02, M(shade(c, -.05), { r: 1 }));
  return g;
});
def('clutter', '雜物袋', '收納', '#2d7a5a', c => {
  const g = new THREE.Group(), r = rng(17), cs = [c, '#7a4ad0', '#f2e6d0', '#5aa0e0', '#e8d23a', '#fff'];
  for (let i = 0; i < 7; i++) { const b = bx(g, .25 + r() * .2, .3 + r() * .3, .1 + r() * .15, (r() - .5) * .5, r() * .2, (r() - .5) * .4, M(cs[i % 6], { r: 1 })); b.rotation.y = r() * 2; b.rotation.z = (r() - .5) * .3; }
  return g;
});
def('rug', '地毯', '裝飾', '#b85c4a', c => {
  const g = new THREE.Group(); bx(g, 1.8, 0.012, 1.2, 0, 0, 0, M(c, { r: 1 })); bx(g, 1.5, 0.014, 0.9, 0, 0, 0, M(shade(c, .15), { r: 1 }));
  return g;
}, { nc: 1 });
def('bookshelf', '書櫃', '臥室', '#7b5232', c => {
  const g = new THREE.Group(), w = wood(c); bx(g, .9, 1.8, .03, 0, 0, -.14, w);
  for (const x of [-.44, .44]) bx(g, .03, 1.8, .3, x, 0, 0, w);
  const r = rng(18); for (let s = 0; s < 5; s++) { bx(g, .88, .03, .3, 0, s * .44, 0, w); if (s < 4) { let x = -.4; while (x < .36) { const bw = .04 + r() * .05, bh = .22 + r() * .14; bx(g, bw, bh, .2, x + bw / 2, s * .44 + .03, .02, M(`hsl(${Math.floor(r() * 360)},45%,${35 + Math.floor(r() * 25)}%)`)); x += bw + .005; } } }
  return g;
});
def('floor_lamp', '立燈', '裝飾', '#f3e6c8', c => {
  const g = new THREE.Group(); cy(g, .15, .15, .03, 0, 0, 0, M('#333', { m: .6 })); cy(g, .015, .015, 1.5, 0, 0, 0, M('#333', { m: .6 }));
  cy(g, .14, .22, .3, 0, 1.45, 0, M(c, { e: '#ffdca0', ei: .8 }));
  return g;
});
def('bed', '單人床', '臥室', '#7aa6c9', c => {
  const g = new THREE.Group(); bx(g, 1.05, 0.3, 2.05, 0, 0, 0, wood('#d9c7a8')); bx(g, 1.0, 0.18, 1.95, 0, 0.3, 0, M('#f5f3ee', { r: 1 }));
  bx(g, 1.02, 0.08, 1.3, 0, 0.45, 0.32, M(c, { r: 1 })); bx(g, 0.6, 0.12, 0.35, 0, 0.48, -0.75, M('#fff', { r: 1 })); bx(g, 1.05, 0.9, 0.06, 0, 0, -1.0, wood('#d9c7a8'));
  return g;
});
def('double_bed', '雙人床', '臥室', '#e8b4c8', c => {
  const g = new THREE.Group(); bx(g, 1.55, 0.32, 2.05, 0, 0, 0, wood('#5a3a2a')); bx(g, 1.5, 0.2, 1.95, 0, 0.32, 0, M('#f5f3ee', { r: 1 }));
  bx(g, 1.52, 0.08, 1.35, 0, 0.5, 0.3, M(c, { r: 1 }));
  for (const x of [-.38, .38]) bx(g, 0.6, 0.12, 0.35, x, 0.52, -0.75, M('#fff', { r: 1 }));
  bx(g, 1.6, 1.0, 0.08, 0, 0, -1.02, wood('#5a3a2a'));
  return g;
});
def('wardrobe', '衣櫃', '臥室', '#c9913f', c => {
  const g = new THREE.Group(), w = M(c, { r: .35 }); bx(g, 1.2, 2.2, 0.6, 0, 0, 0, w);
  for (const x of [-.3, .3]) { bx(g, 0.58, 2.1, 0.01, x, 0.05, 0.3, M(shade(c, .05), { r: .3 })); bx(g, 0.02, 0.25, 0.03, x + (x < 0 ? .25 : -.25), 1.0, 0.31, M('#ddd', { m: .8 })); }
  for (let i = 1; i < 4; i++) bx(g, 1.18, 0.01, 0.01, 0, i * 0.55, 0.31, M(shade(c, -.15)));
  return g;
});
def('dark_wardrobe', '深色衣櫃', '臥室', '#5a2e1e', c => {
  const g = new THREE.Group(), w = M(c, { r: .4 }); bx(g, 1.3, 2.1, 0.6, 0, 0, 0, w); bx(g, 1.36, 0.08, 0.64, 0, 2.1, 0, w);
  for (const x of [-.43, 0, .43]) { const d = bx(g, 0.4, 1.9, 0.02, x, 0.1, 0.3, M(shade(c, .04), { r: .35 })); }
  bx(g, .5, .3, .4, -.2, 2.18, 0, M('#c49a64', { r: 1 }));
  return g;
});
def('vanity', '梳妝台', '臥室', '#efe4cf', c => {
  const g = new THREE.Group(), m = M(c, { r: .5 });
  bx(g, 1.0, 0.75, 0.45, 0, 0, 0, m); bx(g, 0.5, 0.05, 0.4, 0, 0.42, 0.42, m);
  for (let i = 0; i < 3; i++) bx(g, 0.3, 0.2, 0.01, 0.32, 0.08 + i * 0.22, 0.226, M(shade(c, -.04)));
  bx(g, 0.75, 0.85, 0.05, 0, 0.75, -0.18, m); bx(g, 0.62, 0.72, 0.02, 0, 0.82, -0.15, M('#d6e6ee', { r: .05, m: .9 }));
  const r = rng(40); for (let i = 0; i < 8; i++) cy(g, .025, .025, .06 + r() * .12, -.4 + r() * .8, .75, -.05 + r() * .15, M(['#f6c', '#fff', '#6cf', '#c9f', '#fc6'][i % 5]), 6);
  return g;
});
def('dresser', '斗櫃', '臥室', '#efe4cf', c => {
  const g = new THREE.Group(), m = M(c, { r: .5 }); bx(g, 0.8, 1.0, 0.45, 0, 0, 0, m);
  for (let i = 0; i < 4; i++) { bx(g, 0.72, 0.21, 0.01, 0, 0.06 + i * 0.235, 0.226, M(shade(c, -.04))); bx(g, 0.12, 0.02, 0.02, 0, 0.16 + i * 0.235, 0.235, M('#b9a07a')); }
  return g;
});
def('tv_small', '小電視', '臥室', '#111111', c => {
  const g = new THREE.Group(); bx(g, .2, .03, .15, 0, 0, 0, M('#222')); bx(g, .04, .1, .04, 0, 0, 0, M('#222'));
  bx(g, 0.6, 0.38, 0.04, 0, 0.1, 0, M(c, { r: .3 })); pl(g, .56, .34, 0, .29, .021, M('#0d1b2a', { r: .2, e: '#1a3550', ei: .5 }));
  return g;
}, { nc: 1 });
def('kid_desk', '兒童書桌', '臥室', '#f2f0ea', c => {
  const g = new THREE.Group(), m = M(c, { r: .5 }), leg = M('#ddd', { m: .4 });
  bx(g, 1.2, 0.04, 0.65, 0, 0.72, 0, m); for (const x of [-.55, .55]) bx(g, 0.06, 0.72, 0.6, x, 0, 0, leg);
  bx(g, 1.2, 0.3, 0.04, 0, 0.76, -0.3, m);
  const r = rng(41); for (let i = 0; i < 6; i++) bx(g, .1 + r() * .2, .02 + r() * .1, .1 + r() * .2, -.45 + r() * .9, .76, -.2 + r() * .4, M(['#fff', '#f9c', '#9cf', '#fc6', '#222'][i % 5]));
  // chair
  bx(g, 0.42, 0.06, 0.42, 0, 0.45, 0.55, M('#d65a6a', { r: .5 })); bx(g, 0.42, 0.4, 0.05, 0, 0.55, 0.76, M('#d65a6a', { r: .5 })); cy(g, .03, .03, .45, 0, 0, .55, leg, 6);
  return g;
});
def('laundry_rack', '曬衣架', '收納', '#c8ccd0', c => {
  const g = new THREE.Group(), mt = M(c, { m: .7, r: .3 });
  for (const x of [-.7, .7]) { cy(g, .015, .015, 1.6, x, 0, 0, mt, 6); bx(g, .05, .03, .6, x, 0, 0, mt); }
  bx(g, 1.45, .025, .025, 0, 1.55, 0, mt);
  const r = rng(42), cs = ['#f6c7d6', '#fff', '#5bb', '#336', '#ddd', '#c9a', '#88a'];
  for (let i = 0; i < 7; i++) bx(g, .16, .5 + r() * .3, .03, -.6 + i * .2, 1.0 - r() * .2, 0, M(cs[i], { r: 1 }));
  return g;
});
def('ac_outdoor', '冷氣室外機', '其他', '#eeeeea', c => {
  const g = new THREE.Group(); bx(g, 0.8, 0.6, 0.3, 0, 0, 0, M(c, { r: .5 }));
  const f = cy(g, .22, .22, .02, .1, .3, .15, M('#555'), 16); f.rotation.x = Math.PI / 2; f.position.y = .3;
  return g;
});
def('storage_tower', '收納抽屜塔', '收納', '#f4f4f0', c => {
  const g = new THREE.Group(); for (let i = 0; i < 6; i++) { bx(g, 0.45, 0.3, 0.45, 0, i * 0.31, 0, M(c, { r: .4 })); bx(g, 0.3, 0.06, 0.01, 0, i * 0.31 + .12, 0.226, M(['#f6a', '#fa6', '#6af'][i % 3])); }
  return g;
});
def('air_purifier', '空氣清淨機', '臥室', '#f6f6f4', c => {
  const g = new THREE.Group(); cy(g, .14, .15, .55, 0, 0, 0, M(c, { r: .4 }), 18); cy(g, .1, .1, .01, 0, .55, 0, M('#888'), 18);
  return g;
});
def('round_table', '圓桌', '客廳', '#b8885a', c => {
  const g = new THREE.Group(); cy(g, .5, .5, .04, 0, .72, 0, wood(c), 24); cy(g, .04, .05, .72, 0, 0, 0, M('#333')); cy(g, .25, .28, .03, 0, 0, 0, M('#333'));
  return g;
});
def('aquarium', '魚缸', '裝飾', '#2e86c1', c => {
  const g = new THREE.Group(); bx(g, 1.0, 0.75, 0.42, 0, 0, 0, wood('#333'));
  bx(g, 0.96, 0.5, 0.38, 0, 0.75, 0, M(c, { r: .1, op: .5, e: c, ei: .4 })); bx(g, 1.0, 0.06, 0.42, 0, 1.25, 0, M('#222'));
  const r = rng(19); for (let i = 0; i < 6; i++) sp(g, .025, -.35 + r() * .7, .9 + r() * .25, -.1 + r() * .2, M(['#f80', '#ff3', '#f36'][i % 3]), .6);
  return g;
});
def('piano', '鋼琴', '客廳', '#151515', c => {
  const g = new THREE.Group(), m = M(c, { r: .15, m: .2 }); bx(g, 1.5, 1.25, 0.6, 0, 0, -0.1, m); bx(g, 1.5, 0.06, 0.35, 0, 0.72, 0.3, m);
  bx(g, 1.4, 0.02, 0.15, 0, 0.78, 0.3, M('#f8f8f4')); for (let i = 0; i < 20; i++) bx(g, .02, .015, .09, -.66 + i * .07, .8, .27, M('#111'));
  return g;
});
function wallArt(name, w, h) {
  return c => { const g = new THREE.Group(); bx(g, w + .08, h + .08, 0.03, 0, -h / 2 - .04, 0, M(c, { r: .5 })); pl(g, w, h, 0, 0, 0.017, PM(name)); return g; };
}
def('calligraphy', '書法掛畫', '裝飾', '#3a2418', wallArt('calligraphy', 1.4, 0.8), { nc: 1, y: 1.65 });
def('painting', '觀音畫', '裝飾', '#c8b48a', wallArt('painting', 0.55, 0.85), { nc: 1, y: 1.5 });
let mapMat;
def('world_map', '世界地圖', '裝飾', '#c79a5e', c => {
  const g = new THREE.Group(); bx(g, 1.28, 0.88, 0.02, 0, -0.44, 0, M(c));
  mapMat = mapMat || canvasPlane(1.2, .8, 240, 160, (x, w, h) => { x.fillStyle = '#3d8fd1'; x.fillRect(0, 0, w, h); const r = rng(50); const cs = ['#e9c46a', '#8ac926', '#f4a261', '#e76f51', '#90be6d']; for (let i = 0; i < 9; i++) { x.fillStyle = cs[i % 5]; x.beginPath(); x.ellipse(20 + r() * 200, 20 + r() * 120, 15 + r() * 25, 10 + r() * 20, r() * 3, 0, 7); x.fill(); } });
  pl(g, 1.2, 0.8, 0, 0, 0.012, mapMat); return g;
}, { nc: 1, y: 1.5 });
def('clock', '時鐘', '裝飾', '#ffffff', c => { const g = new THREE.Group(); const f = cy(g, .16, .16, .03, 0, -.015, 0, M(c), 20); f.rotation.x = Math.PI / 2; f.position.y = 0; bx(g, .01, .11, .01, 0, 0, .02, M('#111')); return g; }, { nc: 1, y: 2.2 });
def('ac_unit', '冷氣', '裝飾', '#f4f4f2', c => { const g = new THREE.Group(); bx(g, 0.85, 0.28, 0.22, 0, 0, 0, M(c, { r: .5 })); bx(g, 0.8, 0.02, 0.05, 0, 0.02, 0.1, M('#cfd4d8')); return g; }, { nc: 1, y: 2.4 });

// ----- more furniture: home -----
const legs4 = (g, w, d, h, m, t = .04) => { for (const [x, z] of [[-w / 2 + t, -d / 2 + t], [w / 2 - t, -d / 2 + t], [-w / 2 + t, d / 2 - t], [w / 2 - t, d / 2 - t]]) bx(g, t, h, t, x, 0, z, m); };
def('bunk_bed', '上下舖', '臥室', '#7a5232', c => {
  const g = new THREE.Group(), w = wood(c), mat = M('#e8e4da', { r: .95 });
  for (const [x, z] of [[-.47, -1], [.47, -1], [-.47, 1], [.47, 1]]) bx(g, .07, 1.75, .07, x, 0, z, w);
  for (const y of [.25, 1.15]) { bx(g, 1.0, .08, 2.05, 0, y, 0, w); bx(g, .9, .14, 1.95, 0, y + .08, 0, mat); }
  bx(g, 1.0, .06, .05, 0, 1.6, 1.0, w); bx(g, 1.0, .06, .05, 0, 1.6, -1.0, w); bx(g, .05, .3, 1.9, .5, 1.3, 0, w);
  for (let i = 0; i < 4; i++) bx(g, .3, .03, .03, -.3, .45 + i * .3, 1.05, w);
  return g;
});
def('desk_pc', '電腦桌', '臥室', '#efefef', c => {
  const g = new THREE.Group(), m = M(c, { r: .5 }), dk = M('#1a1a1a', { r: .4 });
  bx(g, 1.3, .04, .65, 0, .74, 0, m); legs4(g, 1.3, .65, .74, M('#333', { m: .6 }));
  bx(g, .6, .36, .03, 0, .9, -.2, dk); pl(g, .56, .32, 0, 1.08, -.184, M('#0e2236', { e: '#2a6aa0', ei: .7 })); bx(g, .06, .14, .06, 0, .76, -.2, dk);
  bx(g, .45, .02, .15, 0, .78, .08, dk); bx(g, .2, .42, .44, .48, .0, -.05, M('#222', { e: '#3050ff', ei: .2 }));
  return g;
});
def('gaming_chair', '電競椅', '臥室', '#d42a22', c => {
  const g = new THREE.Group(), m = M(c, { r: .5 }), dk = M('#151515', { r: .5 });
  cy(g, .03, .03, .4, 0, .05, 0, M('#888', { m: .8 })); bx(g, .55, .04, .55, 0, .04, 0, dk);
  bx(g, .52, .12, .5, 0, .45, 0, dk); bx(g, .5, .78, .1, 0, .55, -.24, dk); bx(g, .36, .7, .11, 0, .6, -.235, m); bx(g, .3, .14, .12, 0, 1.2, -.23, m);
  for (const x of [-.29, .29]) bx(g, .06, .05, .3, x, .68, 0, dk);
  return g;
});
def('treadmill', '跑步機', '客廳', '#2a2a2a', c => {
  const g = new THREE.Group(), m = M(c, { r: .5 }); bx(g, .75, .18, 1.7, 0, 0, 0, m); bx(g, .6, .02, 1.5, 0, .18, 0, M('#111', { r: .9 }));
  for (const x of [-.34, .34]) bx(g, .05, 1.2, .05, x, .18, -.75, M('#999', { m: .7 })); bx(g, .7, .15, .25, 0, 1.3, -.75, M('#333')); pl(g, .3, .1, 0, 1.38, -.62, M('#082030', { e: '#20c0ff', ei: .6 }), 0);
  return g;
});
def('bar_stool', '吧台椅', '廚房', '#2d2f33', c => { const g = new THREE.Group(); cy(g, .2, .2, .05, 0, .72, 0, M(c, { r: .5 }), 18); cy(g, .025, .025, .72, 0, 0, 0, M('#aaa', { m: .8 })); cy(g, .2, .22, .03, 0, 0, 0, M('#888', { m: .8 }), 18); return g; });
def('microwave', '微波爐', '廚房', '#e8e8e8', c => { const g = new THREE.Group(); bx(g, .5, .3, .38, 0, 0, 0, M(c, { r: .4 })); pl(g, .32, .2, -.06, .15, .191, M('#222', { r: .1 })); bx(g, .1, .22, .01, .18, .04, .19, M('#555')); return g; }, { y: .92 });
def('rice_cooker', '大同電鍋', '廚房', '#d84a3a', c => { const g = new THREE.Group(), m = M(c, { r: .3, m: .2 }); cy(g, .16, .16, .24, 0, 0, 0, m, 20); cy(g, .17, .15, .06, 0, .24, 0, m, 20); sp(g, .03, 0, .32, 0, M('#222')); for (const s of [-1, 1]) bx(g, .06, .03, .03, s * .18, .22, 0, M('#222')); return g; }, { y: .92 });
def('bathtub', '浴缸', '衛浴', '#f4f4f2', c => { const g = new THREE.Group(), m = M(c, { r: .2 }); bx(g, 1.6, .55, .75, 0, 0, 0, m); bx(g, 1.45, .02, .6, 0, .45, 0, M('#bfe2ee', { r: .05, op: .8 })); cy(g, .02, .02, .2, -.7, .55, 0, M('#ccc', { m: .9 })); return g; });
def('shower', '淋浴間', '衛浴', '#cfe6f0', c => { const g = new THREE.Group(), gl = M(c, { op: .35, r: .05 }); bx(g, .9, .08, .9, 0, 0, 0, M('#eee')); bx(g, .9, 1.95, .02, 0, .08, .44, gl); bx(g, .02, 1.95, .9, .44, .08, 0, gl); cy(g, .015, .015, 1.9, -.4, .08, -.4, M('#ccc', { m: .9 })); cy(g, .08, .08, .02, -.3, 1.95, -.38, M('#ccc', { m: .9 })); return g; });
def('mirror', '鏡子', '衛浴', '#d9e6ee', c => { const g = new THREE.Group(); bx(g, .62, .82, .03, 0, -.41, 0, M('#bbb', { m: .7 })); pl(g, .56, .76, 0, 0, .016, M(c, { m: 1, r: .05 })); return g; }, { nc: 1, y: 1.6 });
def('cat_tree', '貓跳台', '裝飾', '#c9b28a', c => { const g = new THREE.Group(), m = M(c, { r: 1 }), p = M('#e8dcc0', { r: 1 }); bx(g, .6, .06, .6, 0, 0, 0, m); cy(g, .05, .05, 1.4, 0, 0, 0, p); bx(g, .45, .05, .45, 0, .6, 0, m); bx(g, .5, .05, .5, 0, 1.4, 0, m); bx(g, .36, .3, .36, .1, .06, .1, m); sp(g, .06, .2, .5, .2, M('#f04070')); return g; });
def('xmas_tree', '聖誕樹', '裝飾', '#2f7d3a', c => { const g = new THREE.Group(), m = M(c, { r: .8 }); cy(g, .06, .06, .3, 0, 0, 0, M('#6b4a2a')); for (let i = 0; i < 4; i++) { const k = new THREE.Mesh(new THREE.ConeGeometry(.6 - i * .12, .6, 12), m); k.position.y = .55 + i * .38; g.add(k); } const r = rng(9); for (let i = 0; i < 16; i++) { const a = r() * 6.28, h = .4 + r() * 1.3; sp(g, .04, Math.cos(a) * (.55 - h * .3), h, Math.sin(a) * (.55 - h * .3), M(['#f33', '#fd3', '#39f', '#fff'][i % 4], { e: ['#f33', '#fd3', '#39f', '#fff'][i % 4], ei: .8 })); } sp(g, .08, 0, 2.15, 0, M('#ffd23a', { e: '#ffb000', ei: 1 })); return g; });
def('crib', '嬰兒床', '臥室', '#f2f0ea', c => { const g = new THREE.Group(), m = M(c, { r: .6 }); bx(g, .7, .05, 1.25, 0, .35, 0, m); bx(g, .62, .1, 1.18, 0, .4, 0, M('#bfe0f0', { r: 1 })); for (let i = 0; i < 9; i++) for (const s of [-1, 1]) bx(g, .025, .6, .025, s * .34, .35, -.6 + i * .15, m); for (const s of [-1, 1]) bx(g, .7, .9, .04, 0, 0, s * .62, m); return g; });
def('bean_bag', '懶骨頭', '客廳', '#e8743a', c => { const g = new THREE.Group(); sp(g, .42, 0, .3, 0, M(c, { r: 1 }), .7); sp(g, .3, 0, .45, -.18, M(c, { r: 1 }), .9); return g; });
def('tea_table', '泡茶桌', '客廳', '#6b3a1e', c => { const g = new THREE.Group(), w = wood(c); bx(g, 1.3, .12, .75, 0, .5, 0, w); bx(g, 1.2, .5, .65, 0, 0, 0, M(shade(c, -.1))); bx(g, .5, .02, .35, 0, .62, 0, M('#3a2414')); for (const x of [-.12, 0, .12]) cy(g, .03, .025, .04, x, .64, .05, M('#f2efe6')); sp(g, .06, -.1, .7, -.05, M('#5a2a1a', { r: .3 })); return g; });
def('mahjong_table', '麻將桌', '客廳', '#2f7d4a', c => { const g = new THREE.Group(); bx(g, .9, .06, .9, 0, .72, 0, M(c, { r: 1 })); bx(g, .96, .05, .96, 0, .7, 0, M('#6b4a2a')); legs4(g, .9, .9, .7, M('#6b4a2a'), .06); const r = rng(4); for (let i = 0; i < 4; i++) for (let k = 0; k < 8; k++) { const a = i * Math.PI / 2, t = -.28 + k * .08; const b = bx(g, .06, .04, .045, 0, .78, 0, M('#f4f0e2')); b.position.set(Math.cos(a) * .33 - Math.sin(a) * t, .8, Math.sin(a) * .33 + Math.cos(a) * t); b.rotation.y = -a; } for (const [x, z] of [[0, .62], [0, -.62], [.62, 0], [-.62, 0]]) bx(g, .4, .45, .4, x, 0, z, M('#8a5a3a')); return g; });
def('wall_tv', '壁掛電視', '客廳', '#111111', c => { const g = new THREE.Group(); bx(g, 1.45, .84, .05, 0, -.42, 0, M(c, { r: .3 })); pl(g, 1.38, .77, 0, 0, .026, M('#0b1a2a', { e: '#1d4a70', ei: .7 })); return g; }, { nc: 1, y: 1.5 });
def('umbrella_stand', '傘架', '收納', '#4a4a4a', c => { const g = new THREE.Group(); cy(g, .13, .12, .5, 0, 0, 0, M(c, { m: .5 })); for (const [x, z, col] of [[.04, 0, '#2d5fa8'], [-.04, .03, '#d42a22'], [0, -.04, '#2a2a2a']]) { cy(g, .012, .012, .9, x, .05, z, M(col)); } return g; });
def('ceiling_fan', '吊扇', '裝飾', '#d9cdb5', c => { const g = new THREE.Group(), m = M(c, { r: .5 }); cy(g, .015, .015, .3, 0, -.3, 0, M('#888', { m: .8 })); cy(g, .12, .1, .12, 0, -.42, 0, M('#ddd', { m: .4 })); const s = new THREE.Group(); s.name = 'spinY'; s.position.y = -.38; g.add(s); for (let i = 0; i < 4; i++) { const b = bx(s, .62, .015, .13, 0, 0, 0, m); b.position.set(Math.cos(i * Math.PI / 2) * .38, 0, Math.sin(i * Math.PI / 2) * .38); b.rotation.y = -i * Math.PI / 2; } s.userData.keep = 1; return g; }, { nc: 1, y: 2.98 });
def('kids_slide', '兒童溜滑梯', '裝飾', '#3aa0e8', c => { const g = new THREE.Group(), m = M(c, { r: .4 }); bx(g, .6, .9, .6, 0, 0, -.5, M('#f2c230', { r: .4 })); const s = bx(g, .5, .04, 1.3, 0, .38, .25, m); s.rotation.x = .62; for (const x of [-.27, .27]) { const r = bx(g, .03, .12, 1.3, x, .44, .25, m); r.rotation.x = .62; } return g; });
// ----- street -----
def('street_lamp', '路燈', '馬路', '#5a5f64', c => { const g = new THREE.Group(), m = M(c, { m: .6, r: .4 }); cy(g, .07, .09, 5.2, 0, 0, 0, m, 10); bx(g, .08, .08, 1.2, 0, 5.1, .55, m); bx(g, .3, .1, .5, 0, 5.02, 1.05, m); bx(g, .26, .02, .44, 0, 5.0, 1.05, M('#fff6d0', { e: '#ffe9a0', ei: 1.6 })); return g; });
def('car', '汽車', '馬路', '#d8d8d8', c => {
  const g = new THREE.Group(), m = M(c, { m: .5, r: .3 }), gl = M('#2a3a48', { r: .1, m: .4 }), tire = M('#151515', { r: .9 });
  bx(g, 1.75, .6, 4.3, 0, .3, 0, m); bx(g, 1.55, .55, 2.2, 0, .9, -.2, m); bx(g, 1.5, .45, 2.0, 0, .95, -.2, gl); bx(g, 1.6, .05, 2.25, 0, 1.45, -.2, m);
  for (const [x, z] of [[-.82, 1.35], [.82, 1.35], [-.82, -1.35], [.82, -1.35]]) { const t = cy(g, .33, .33, .22, x, 0, z, tire, 16); t.rotation.z = Math.PI / 2; t.position.y = .33; }
  for (const x of [-.6, .6]) { bx(g, .3, .12, .04, x, .62, 2.14, M('#fff8d8', { e: '#fff2c0', ei: .8 })); bx(g, .3, .12, .04, x, .62, -2.14, M('#c0141a', { e: '#a00', ei: .6 })); }
  bx(g, .5, .14, .02, 0, .42, 2.16, M('#f2f2f2'));
  return g;
});
def('bicycle', '腳踏車', '馬路', '#2e8a4a', c => { const g = new THREE.Group(), m = M(c, { m: .5, r: .3 }), tire = M('#151515'); for (const z of [-.5, .5]) { const t = new THREE.Mesh(new THREE.TorusGeometry(.32, .025, 6, 20), tire); t.rotation.y = Math.PI / 2; t.position.set(0, .34, z); g.add(t); } const f = bx(g, .04, .04, 1.0, 0, .55, 0, m); f.rotation.x = .1; bx(g, .04, .45, .04, 0, .34, -.2, m); bx(g, .2, .05, .26, 0, .82, -.22, M('#222')); bx(g, .55, .03, .03, 0, .95, .45, M('#333')); return g; });
def('traffic_cone', '三角錐', '馬路', '#f26a1b', c => { const g = new THREE.Group(); bx(g, .4, .04, .4, 0, 0, 0, M(c)); const k = new THREE.Mesh(new THREE.ConeGeometry(.15, .62, 14), M(c, { r: .5 })); k.position.y = .35; g.add(k); cy(g, .1, .12, .08, 0, .26, 0, M('#ffffff'), 14); return g; });
def('fire_hydrant', '消防栓', '馬路', '#c8241c', c => { const g = new THREE.Group(), m = M(c, { r: .4, m: .3 }); cy(g, .13, .15, .6, 0, 0, 0, m, 14); sp(g, .14, 0, .62, 0, m); for (const s of [-1, 1]) { const n = cy(g, .05, .05, .14, s * .17, .38, 0, m, 10); n.rotation.z = Math.PI / 2; n.position.y = .42; } return g; });
def('trash_can', '垃圾桶', '馬路', '#3a7d44', c => { const g = new THREE.Group(); cy(g, .25, .22, .85, 0, 0, 0, M(c, { r: .5 }), 16); cy(g, .27, .27, .05, 0, .85, 0, M(shade(c, -.15)), 16); return g; });
def('mailbox', '郵筒', '馬路', '#2a8a4a', c => { const g = new THREE.Group(); for (const [x, col] of [[-.25, c], [.25, '#d42a22']]) { bx(g, .4, 1.0, .4, x, 0, 0, M(col, { r: .4 })); const t = cy(g, .2, .2, .4, x, 1.0, 0, M(col, { r: .4 }), 16); t.rotation.z = Math.PI / 2; t.position.y = 1.0; bx(g, .25, .04, .02, x, .78, .2, M('#111')); } return g; });
def('bench', '長椅', '馬路', '#8a5a2a', c => { const g = new THREE.Group(), w = wood(c), mt = M('#333', { m: .6 }); for (let i = 0; i < 3; i++) bx(g, 1.6, .04, .12, 0, .44, -.15 + i * .15, w); for (let i = 0; i < 2; i++) bx(g, 1.6, .1, .03, 0, .6 + i * .15, -.24, w); for (const x of [-.7, .7]) { bx(g, .05, .44, .45, x, 0, 0, mt); bx(g, .05, .45, .04, x, .45, -.24, mt); } return g; });
def('street_tree', '路樹', '馬路', '#3f8a3a', c => { const g = new THREE.Group(); cy(g, .12, .16, 2.2, 0, 0, 0, M('#6b4a2a', { r: 1 })); for (const [x, y, z, r] of [[0, 2.8, 0, .9], [.5, 2.4, .2, .6], [-.4, 2.5, -.3, .65], [.1, 3.4, .1, .6]]) sp(g, r, x, y, z, M(c, { r: 1 })); bx(g, 1, .1, 1, 0, 0, 0, M('#6b5a4a')); return g; });
def('bus_stop', '公車站牌', '馬路', '#1d5fa8', c => { const g = new THREE.Group(); cy(g, .04, .04, 2.6, 0, 0, 0, M('#aaa', { m: .7 })); bx(g, .55, .7, .05, 0, 1.9, 0, M(c)); pl(g, .45, .2, 0, 2.38, .027, M('#ffffff'), 0); bx(g, .4, .3, .03, 0, 1.4, 0, M('#f2f2f2')); return g; });
def('vending_machine', '自動販賣機', '馬路', '#d42a22', c => { const g = new THREE.Group(); bx(g, .95, 1.85, .75, 0, 0, 0, M(c, { r: .4 })); pl(g, .6, 1.0, -.1, 1.15, .376, M('#dfefff', { e: '#bfe0ff', ei: .7 })); const r = rng(3); for (let i = 0; i < 4; i++) for (let k = 0; k < 6; k++) cy(g, .035, .035, .14, -.33 + k * .092, .72 + i * .25, .33, M(['#3a8', '#e33', '#fc3', '#39f', '#fff'][Math.floor(r() * 5)])); bx(g, .2, .5, .02, .32, .9, .38, M('#333')); bx(g, .55, .15, .02, -.1, .2, .38, M('#222')); return g; });
def('traffic_light', '紅綠燈', '馬路', '#3a3d40', c => { const g = new THREE.Group(), m = M(c, { m: .6 }); cy(g, .07, .08, 4.6, 0, 0, 0, m); bx(g, .1, .1, 2.0, 0, 4.4, .95, m); bx(g, .35, .95, .3, 0, 3.75, 1.8, M('#222')); for (const [y, col] of [[4.45, '#ff2a1a'], [4.2, '#ffb000'], [3.95, '#2ad04a']]) { const l = cy(g, .1, .1, .05, 0, y, 1.96, M(col, { e: col, ei: y > 4.4 ? 1.5 : .2 }), 14); l.rotation.x = Math.PI / 2; l.position.y = y; } return g; });
def('barrier', '施工圍欄', '馬路', '#f2c230', c => { const g = new THREE.Group(); for (const y of [.5, .8]) for (let i = 0; i < 4; i++) bx(g, .3, .12, .04, -.45 + i * .3, y, 0, M(i % 2 ? '#d42a22' : '#f4f4f4')); for (const x of [-.6, .6]) { bx(g, .05, 1.0, .05, x, 0, 0, M('#666', { m: .6 })); bx(g, .35, .05, .35, x, 0, 0, M('#333')); } return g; });
def('manhole_deco', '人孔蓋(裝飾)', '馬路', '#3a3d40', c => { const g = new THREE.Group(); cy(g, .4, .4, .02, 0, 0, 0, M(c, { m: .7, r: .4 }), 24); return g; }, { nc: 1 });
def('bollard', '路障柱', '馬路', '#f2c230', c => { const g = new THREE.Group(); cy(g, .06, .06, .8, 0, 0, 0, M(c, { r: .4 })); for (const y of [.5, .65]) cy(g, .065, .065, .05, 0, y, 0, M('#222')); return g; });
// ----- basement / sewer / backrooms -----
def('water_heater', '熱水器', '地下室', '#e8e8e4', c => { const g = new THREE.Group(); cy(g, .25, .25, 1.4, 0, 0, 0, M(c, { r: .4 }), 18); cy(g, .03, .03, 1.0, .12, 1.4, 0, M('#b87333', { m: .8 })); cy(g, .03, .03, 1.0, -.12, 1.4, 0, M('#b87333', { m: .8 })); return g; });
def('pipes', '管線', '地下室', '#8a8f94', c => { const g = new THREE.Group(), m = M(c, { m: .7, r: .4 }); for (const [y, r] of [[0, .08], [.25, .05], [.42, .06]]) { const p = cy(g, r, r, 2.4, 0, 0, 0, m, 10); p.rotation.z = Math.PI / 2; p.position.y = y; } for (const x of [-1, 0, 1]) bx(g, .06, .55, .06, x, -.05, -.05, M('#555')); return g; }, { nc: 1, y: 2.0 });
def('barrel', '鐵桶', '地下室', '#2d5fa8', c => { const g = new THREE.Group(), m = M(c, { m: .4, r: .5 }); cy(g, .29, .29, .88, 0, 0, 0, m, 16); for (const y of [.2, .66]) cy(g, .3, .3, .03, 0, y, 0, M(shade(c, -.2), { m: .5 }), 16); return g; });
def('crate', '木箱', '地下室', '#b88a4a', c => { const g = new THREE.Group(), w = M(c, { r: .9 }), dk = M(shade(c, -.25)); bx(g, .7, .7, .7, 0, 0, 0, w); for (const s of [-1, 1]) { bx(g, .72, .08, .02, 0, .1, s * .35, dk); bx(g, .72, .08, .02, 0, .52, s * .35, dk); const d = bx(g, .08, .9, .02, 0, -.1, s * .355, dk); d.rotation.z = .78; d.position.y = .35; } return g; });
def('generator', '發電機', '地下室', '#e8a020', c => { const g = new THREE.Group(); bx(g, 1.0, .6, .6, 0, .1, 0, M(c, { r: .4 })); bx(g, 1.1, .1, .7, 0, 0, 0, M('#333', { m: .5 })); bx(g, .3, .2, .01, -.25, .4, .305, M('#222')); cy(g, .05, .05, .3, .35, .7, 0, M('#555', { m: .7 })); return g; });
def('workbench', '工作台', '地下室', '#8a6a42', c => { const g = new THREE.Group(), w = wood(c); bx(g, 1.6, .06, .7, 0, .86, 0, w); legs4(g, 1.6, .7, .86, M('#555', { m: .6 }), .06); bx(g, 1.5, .03, .6, 0, .25, 0, w); bx(g, 1.6, .8, .03, 0, .92, -.34, M('#c8b48a')); for (let i = 0; i < 6; i++) bx(g, .04, .22, .02, -.6 + i * .24, 1.3, -.32, M(['#c33', '#333', '#3a6', '#fc3', '#39f', '#888'][i], { m: .4 })); return g; });
def('pillar', '柱子', '地下室', '#b5b2ab', c => { const g = new THREE.Group(); bx(g, .45, 3.0, .45, 0, 0, 0, M(c, { r: .95 })); return g; });
def('bike', '舊腳踏車', '地下室', '#8a3a2a', c => CAT.bicycle.f(c));
def('sewer_water', '下水道水溝', '地下室', '#2f4a2a', c => { const g = new THREE.Group(); const w = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.2), M(c, { r: .05, m: .3, e: '#1a3a14', ei: .4, op: .9 })); w.rotation.x = -Math.PI / 2; w.position.y = .02; g.add(w); for (const s of [-1, 1]) bx(g, 9, .05, .08, 0, 0, s * .64, M('#3a4238')); return g; }, { nc: 1 });
def('backroom_chair', '後室舊椅', '後室', '#6a6a5a', c => { const g = new THREE.Group(), m = M(c, { r: .8 }); bx(g, .45, .05, .45, 0, .45, 0, m); bx(g, .45, .45, .05, 0, .5, -.2, m); legs4(g, .45, .45, .45, M('#555', { m: .6 }), .03); return g; });
def('wet_floor', '小心地滑牌', '後室', '#f2c230', c => { const g = new THREE.Group(), m = M(c, { r: .4 }); const a = bx(g, .3, .6, .02, 0, 0, .1, m); a.rotation.x = -.25; const b = bx(g, .3, .6, .02, 0, 0, -.1, m); b.rotation.x = .25; return g; });

// ----- bake: merge static meshes per material (fewer draw calls) -----
export function bake(g) {
  g.updateMatrixWorld(true);
  const byMat = new Map(), keep = [];
  g.children.slice().forEach(function walk(o) {
    if (o.userData.keep) { keep.push(o); return; }
    if (o.isMesh) {
      const geo = o.geometry.index ? o.geometry.clone() : o.geometry.clone();
      geo.applyMatrix4(o.matrixWorld);
      for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
      if (!byMat.has(o.material)) byMat.set(o.material, []); byMat.get(o.material).push(geo);
    }
    o.children.slice().forEach(walk);
  });
  const out = new THREE.Group();
  for (const [mat, geos] of byMat) { const merged = mergeGeometries(geos, false); if (merged) out.add(new THREE.Mesh(merged, mat)); }
  for (const k of keep) out.add(k);
  return out;
}
const built = {};
export function buildFurniture(type, color) {
  const d = CAT[type]; if (!d) return null;
  const g = bake(d.f(color || d.c));
  return g;
}
const fpCache = {};
export function footprint(type) {
  if (fpCache[type]) return fpCache[type];
  const g = CAT[type].f(CAT[type].c); const b = new THREE.Box3().setFromObject(g);
  return fpCache[type] = { w: Math.max(.1, b.max.x - b.min.x), d: Math.max(.05, b.max.z - b.min.z), cx: (b.max.x + b.min.x) / 2, cz: (b.max.z + b.min.z) / 2, h: b.max.y };
}
