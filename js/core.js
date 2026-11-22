// core: renderer, scene, shared helpers, textures, materials
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
export { THREE, mergeGeometries };

export const $ = s => document.querySelector(s);
export const DEG = Math.PI / 180;
export const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

export const renderer = new THREE.WebGLRenderer({ antialias: !isTouch, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, isTouch ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.prepend(renderer.domElement);

export const scene = new THREE.Scene();
scene.background = new THREE.Color('#b9d2e6');
export const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 300);
camera.rotation.order = 'YXZ';
scene.add(camera);
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
});

// shared state
export const S = { mode: 'menu', data: null, night: false };

export function rng(seed) { let s = seed % 2147483647 || 1; return () => (s = s * 16807 % 2147483647) / 2147483647; }
export function shade(hex, k) {
  if (hex[0] !== '#') return hex;
  if (hex.length === 4) hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
  const n = parseInt(hex.slice(1), 16); const f = x => Math.max(0, Math.min(255, Math.round(x + k * 255)));
  return '#' + [n >> 16, n >> 8 & 255, n & 255].map(v => f(v).toString(16).padStart(2, '0')).join('');
}
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

let toastT;
export function toast(msg, ms = 2200) {
  const t = $('#toast'); t.textContent = msg; t.style.opacity = 1; clearTimeout(toastT); toastT = setTimeout(() => t.style.opacity = 0, ms);
}

// ---------- textures ----------
const texLoader = new THREE.TextureLoader();
const photoCache = {};
export function photo(name) {
  if (!photoCache[name]) { const t = texLoader.load(window.HOME_TEX[name]); t.colorSpace = THREE.SRGBColorSpace; photoCache[name] = t; }
  return photoCache[name];
}
function canvasTex(size, meters, draw) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  t.repeat.set(1 / meters, 1 / meters); t.anisotropy = 4;
  t.userData.css = c.toDataURL();
  return t;
}
function noise(g, s, n, alpha, r) { for (let i = 0; i < n; i++) { const v = Math.floor(r() * 255); g.fillStyle = `rgba(${v},${v},${v},${alpha})`; g.fillRect(r() * s, r() * s, 2, 2); } }
function grid(g, s, n, fill, grout, gw, jitter = 0, r = Math.random) {
  g.fillStyle = grout; g.fillRect(0, 0, s, s); const c = s / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.fillStyle = shade(fill, jitter ? (r() - .5) * jitter : 0); g.fillRect(i * c + gw / 2, j * c + gw / 2, c - gw, c - gw); }
}
const texMakers = {
  tile: () => canvasTex(256, 0.8, (g, s) => grid(g, s, 4, '#f3f3f0', '#8d9394', 3, .02, rng(3))),
  greentile: () => canvasTex(256, 0.8, (g, s) => { grid(g, s, 4, '#f3f3f0', '#9aa39a', 3, .02, rng(3)); g.fillStyle = '#9fcf9f'; g.fillRect(0, s * .5 - 6, s, 12); }),
  smalltile: () => canvasTex(256, 0.5, (g, s) => grid(g, s, 5, '#dfe6ea', '#a9b2b8', 3, .03, rng(4))),
  beigetile: () => canvasTex(256, 0.6, (g, s) => { grid(g, s, 2, '#d9c7a4', '#9c8f7a', 4, .04, rng(5)); noise(g, s, 2000, .06, rng(6)); }),
  stone: () => canvasTex(256, 1.2, (g, s) => { grid(g, s, 2, '#8d8d88', '#5d5d5a', 4, .05, rng(7)); noise(g, s, 4000, .08, rng(8)); }),
  facade: () => canvasTex(256, 0.6, (g, s) => grid(g, s, 8, '#d9cfbd', '#b5ab98', 2, .05, rng(9))),
  concrete: () => canvasTex(256, 2, (g, s) => { g.fillStyle = '#9a9894'; g.fillRect(0, 0, s, s); noise(g, s, 12000, .07, rng(10)); }),
  graycarpet: () => canvasTex(256, 1, (g, s) => { g.fillStyle = '#8c9096'; g.fillRect(0, 0, s, s); noise(g, s, 16000, .1, rng(30)); }),
  brick: () => canvasTex(256, 1.0, (g, s) => {
    g.fillStyle = '#d8d0c4'; g.fillRect(0, 0, s, s); const r = rng(11); const bh = s / 16, bw = s / 4;
    for (let y = 0; y < 16; y++) for (let x = -1; x < 4; x++) { g.fillStyle = shade('#a8513a', (r() - .5) * .12); g.fillRect(x * bw + (y % 2) * bw / 2 + 2, y * bh + 2, bw - 4, bh - 4); }
  }),
  wood: () => canvasTex(256, 1.2, (g, s) => {
    const r = rng(12), n = 8, w = s / n;
    for (let i = 0; i < n; i++) {
      g.fillStyle = shade('#b07b4a', (r() - .5) * .14); g.fillRect(i * w, 0, w, s);
      for (let k = 0; k < 10; k++) { g.strokeStyle = 'rgba(70,40,15,.18)'; g.beginPath(); const x = i * w + r() * w; g.moveTo(x, 0); g.bezierCurveTo(x + 3, s * .3, x - 3, s * .6, x, s); g.stroke(); }
      g.fillStyle = 'rgba(40,20,5,.5)'; g.fillRect(i * w, 0, 1.5, s); g.fillRect(i * w, r() * s, w, 1.5);
    }
  }),
  lightwood: () => canvasTex(256, 1.2, (g, s) => {
    const r = rng(14), n = 6, w = s / n;
    for (let i = 0; i < n; i++) { g.fillStyle = shade('#c7a274', (r() - .5) * .12); g.fillRect(i * w, 0, w, s); for (let k = 0; k < 8; k++) { g.fillStyle = 'rgba(90,60,30,.12)'; g.fillRect(i * w + r() * w, 0, 1, s); } g.fillStyle = 'rgba(40,20,5,.4)'; g.fillRect(i * w, 0, 1.5, s); g.fillRect(i * w, r() * s, w, 1.5); }
  }),
  wmarble: () => canvasTex(256, 1.2, (g, s) => {
    g.fillStyle = '#ecebe7'; g.fillRect(0, 0, s, s); const r = rng(13);
    for (let k = 0; k < 10; k++) { g.strokeStyle = `rgba(120,120,125,${.1 + r() * .25})`; g.lineWidth = 1 + r() * 2; g.beginPath(); let x = r() * s, y = 0; g.moveTo(x, y); while (y < s) { x += (r() - .5) * 20; y += 10 + r() * 15; g.lineTo(x, y); } g.stroke(); }
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 0, s, 1); g.fillRect(0, 0, 1, s);
  }),
  marble: () => canvasTex(256, 1.6, (g, s) => {
    const r = rng(21), N = 34, pts = [];
    for (let i = 0; i < N; i++) { const c = shade('#244a3d', (r() - .5) * .14); pts.push([r() * s, r() * s, [1, 3, 5].map(k => parseInt(c.substr(k, 2), 16)), r()]); }
    const img = g.createImageData(s, s);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      let d1 = 1e9, d2 = 1e9, bi = 0;
      for (let i = 0; i < N; i++) {
        let dx = Math.abs(x - pts[i][0]); dx = Math.min(dx, s - dx); let dy = Math.abs(y - pts[i][1]); dy = Math.min(dy, s - dy);
        const d = dx * dx + dy * dy; if (d < d1) { d2 = d1; d1 = d; bi = i; } else if (d < d2) d2 = d;
      }
      const o = (y * s + x) * 4; let c = pts[bi][2];
      const vein = Math.sin((x * .07 + y * .05) * (2 + pts[bi][3] * 3) + pts[bi][3] * 9) > .93 ? 40 : 0;
      if (Math.sqrt(d2) - Math.sqrt(d1) < 1.6) c = [190, 200, 192];
      img.data[o] = c[0] + vein; img.data[o + 1] = c[1] + vein; img.data[o + 2] = c[2] + vein; img.data[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }),
  wallpaper: () => canvasTex(256, 0.7, (g, s) => {
    g.fillStyle = '#efe6d2'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const x = i * s / 4 + (j % 2) * s / 8, y = j * s / 4;
      g.fillStyle = '#2f2f2f'; g.beginPath(); g.ellipse(x + s / 8, y + s / 8, s / 12, s / 9, 0, 0, 7); g.fill();
      g.fillStyle = '#efe6d2'; g.beginPath(); g.ellipse(x + s / 8, y + s / 8, s / 20, s / 14, 0, 0, 7); g.fill();
    }
  }),
};
texMakers.backroom = () => canvasTex(256, 0.9, (g, s) => {
  g.fillStyle = '#d9c77a'; g.fillRect(0, 0, s, s); const r = rng(77);
  for (let x = 0; x < s; x += 16) { g.fillStyle = 'rgba(150,120,40,.18)'; g.fillRect(x, 0, 3, s); }
  for (let i = 0; i < 40; i++) { g.strokeStyle = 'rgba(140,110,30,.25)'; g.beginPath(); const x = r() * s, y = r() * s; g.moveTo(x, y); g.lineTo(x + 6, y + 8); g.lineTo(x, y + 16); g.stroke(); }
  noise(g, s, 5000, .05, r);
});
texMakers.moistcarpet = () => canvasTex(256, 1.2, (g, s) => { g.fillStyle = '#a89660'; g.fillRect(0, 0, s, s); const r = rng(78); noise(g, s, 18000, .12, r); for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(80,70,30,.18)'; g.beginPath(); g.ellipse(r() * s, r() * s, 20 + r() * 40, 12 + r() * 30, r() * 3, 0, 7); g.fill(); } });
texMakers.sewer = () => canvasTex(256, 1.0, (g, s) => { grid(g, s, 4, '#4f5a4c', '#252b23', 5, .12, rng(79)); noise(g, s, 6000, .12, rng(80)); g.fillStyle = 'rgba(60,90,50,.25)'; g.fillRect(0, s * .7, s, s * .3); });
texMakers.asphalt = () => canvasTex(256, 2, (g, s) => { g.fillStyle = '#4a4c50'; g.fillRect(0, 0, s, s); noise(g, s, 14000, .1, rng(81)); });
const TEX = {};
export function tex(name) { return TEX[name] || (TEX[name] = texMakers[name]()); }

// ---------- materials ----------
const matCache = {};
export function M(color, o = {}) {
  const k = color + '|' + (o.r ?? .75) + '|' + (o.m ?? 0) + '|' + (o.e || '') + '|' + (o.ei ?? 1) + '|' + (o.op ?? 1) + '|' + (o.ds ? 1 : 0);
  if (!matCache[k]) matCache[k] = new THREE.MeshStandardMaterial({
    color, roughness: o.r ?? .75, metalness: o.m ?? 0,
    emissive: o.e ? new THREE.Color(o.e) : new THREE.Color(0), emissiveIntensity: o.ei ?? 1,
    transparent: (o.op ?? 1) < 1, opacity: o.op ?? 1, depthWrite: (o.op ?? 1) >= 1, side: o.ds ? THREE.DoubleSide : THREE.FrontSide,
  });
  return matCache[k];
}
export function PM(name, o = {}) {
  const k = 'photo|' + name;
  return matCache[k] || (matCache[k] = new THREE.MeshStandardMaterial({ map: photo(name), roughness: o.r ?? .8 }));
}
export const PRESETS = {
  pink: { n: '粉紅', c: '#ecc7d3' }, pinkwall: { n: '蜜桃粉', c: '#f2c4bc' }, blue: { n: '水藍', c: '#9fd2d6' }, skyblue: { n: '天空藍', c: '#a9dbe6' },
  mint: { n: '淺綠', c: '#dfeab4' }, lime: { n: '蘋果綠', c: '#a8d65c' }, white: { n: '米白', c: '#f1eee6' }, cream: { n: '奶油黃', c: '#efe2c8' },
  lav: { n: '淡紫', c: '#ddd7e8' }, beige: { n: '奶茶', c: '#dccbb0' }, yellow: { n: '鵝黃', c: '#f3dc8a' }, sage: { n: '鼠尾草', c: '#a7b89c' },
  terra: { n: '陶土', c: '#c97b5c' }, navy: { n: '深藍', c: '#3e4c6b' }, gray: { n: '淺灰', c: '#bdbdb9' }, charcoal: { n: '炭灰', c: '#4a4a4a' },
  marble: { n: '綠石地', tex: 'marble' }, wood: { n: '木地板', tex: 'wood' }, lightwood: { n: '淺木地板', tex: 'lightwood' }, wmarble: { n: '白大理石', tex: 'wmarble' },
  tile: { n: '白磁磚', tex: 'tile' }, greentile: { n: '綠腰磚', tex: 'greentile' }, smalltile: { n: '小方磚', tex: 'smalltile' }, beigetile: { n: '米色磚', tex: 'beigetile' },
  stone: { n: '灰石磚', tex: 'stone' }, concrete: { n: '水泥', tex: 'concrete' }, graycarpet: { n: '灰地墊', tex: 'graycarpet' },
  brick: { n: '紅磚', tex: 'brick' }, wallpaper: { n: '圖騰壁紙', tex: 'wallpaper' }, facade: { n: '外牆磚', tex: 'facade' },
  backroom: { n: '後室壁紙', tex: 'backroom' }, moistcarpet: { n: '潮濕地毯', tex: 'moistcarpet' }, sewer: { n: '下水道石', tex: 'sewer' }, asphalt: { n: '柏油', tex: 'asphalt' },
};
export function presetColor(id) { const p = PRESETS[id]; if (!p) return '#ddd'; if (p.c) return p.c; return { marble: '#2a4a3e', wood: '#a8754a', lightwood: '#c7a274', wmarble: '#e8e8e4', tile: '#eeeeea', greentile: '#e0eadf', smalltile: '#dbe2e6', beigetile: '#d6c4a0', stone: '#8a8a85', concrete: '#9a9894', graycarpet: '#8c9096', brick: '#a8513a', wallpaper: '#d9d0bd', facade: '#d6ccba', backroom: '#d9c77a', moistcarpet: '#a89660', sewer: '#4f5a4c', asphalt: '#4a4c50' }[p.tex] || '#ccc'; }
const presetMat = {};
export function P(id) {
  if (presetMat[id]) return presetMat[id];
  const p = PRESETS[id] || PRESETS.white;
  return presetMat[id] = p.tex ? new THREE.MeshStandardMaterial({ map: tex(p.tex), roughness: /marble|tile/.test(p.tex) ? .35 : .85 })
    : new THREE.MeshStandardMaterial({ color: p.c, roughness: .9 });
}

// ---------- geometry helpers ----------
const geoCache = {};
export const BG = (w, h, d) => geoCache[`b${w},${h},${d}`] || (geoCache[`b${w},${h},${d}`] = new THREE.BoxGeometry(w, h, d));
export function bx(p, w, h, d, x, y, z, mat) { const m = new THREE.Mesh(BG(w, h, d), mat); m.position.set(x, y + h / 2, z); p.add(m); return m; }
export function cy(p, rt, rb, h, x, y, z, mat, seg = 14) {
  const k = `c${rt},${rb},${h},${seg}`; const g = geoCache[k] || (geoCache[k] = new THREE.CylinderGeometry(rt, rb, h, seg));
  const m = new THREE.Mesh(g, mat); m.position.set(x, y + h / 2, z); p.add(m); return m;
}
export function sp(p, r, x, y, z, mat, sy = 1) {
  const k = `s${r}`; const g = geoCache[k] || (geoCache[k] = new THREE.SphereGeometry(r, 14, 10));
  const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); m.scale.y = sy; p.add(m); return m;
}
export function pl(p, w, h, x, y, z, mat, ry = 0) {
  const k = `p${w},${h}`; const g = geoCache[k] || (geoCache[k] = new THREE.PlaneGeometry(w, h));
  const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); m.rotation.y = ry; p.add(m); return m;
}
export function boxUV(geo, w, h, d, ou = 0, ov = 0, tu = 0, tv = 0) {
  const uv = geo.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
    const k = f * 4 + i; const top = f === 2 || f === 3;
    uv.setXY(k, uv.getX(k) * dims[f][0] + (top ? tu : ou), uv.getY(k) * dims[f][1] + (top ? tv : ov));
  }
  uv.needsUpdate = true;
}
export function canvasPlane(w, h, pxW, pxH, draw) {
  const c = document.createElement('canvas'); c.width = pxW; c.height = pxH; draw(c.getContext('2d'), pxW, pxH);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: t, roughness: .8 });
}
