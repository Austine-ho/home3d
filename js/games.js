// three games: 清潔大作戰 (pests), 驅鬼大師 (ghosts), 拆家狂人 (destruction)
import { THREE, S, $, scene, camera, M, bx, cy, sp, toast, clamp, DEG, isTouch, shade } from './core.js';
import { H, hits, groundAt, floorOf, FH, damageAt, lightCfg, setNight, hemi, amb, setLamp, floorY, build, destructionProgress, killBlock } from './house.js';
import { player, input, fx, on } from './controls.js';

// ================= audio (synthesised) =================
export const Snd = {
  ctx: null, master: null, drone: null,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); this.master = this.ctx.createGain(); this.master.gain.value = .5; this.master.connect(this.ctx.destination); } catch (e) { }
  },
  tone(f, dur, type = 'sine', vol = .3, f2 = null, delay = 0) {
    const c = this.ctx; if (!c) return; const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + .05);
  },
  noise(dur, vol = .3, freq = 1000, type = 'lowpass', f2 = null) {
    const c = this.ctx; if (!c) return; const t = c.currentTime, n = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource(); s.buffer = b; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(freq, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(this.master); s.start(t);
  },
  whoosh() { this.noise(.18, .25, 2500, 'bandpass', 500); },
  hit() { this.tone(140, .12, 'square', .2, 60); this.noise(.08, .25, 1800); },
  squish() { this.noise(.12, .3, 900, 'lowpass', 200); this.tone(300, .1, 'sawtooth', .1, 80); },
  splash() { this.noise(.08, .08, 3000, 'highpass'); },
  boom(big = 1) { this.noise(.6 * big, .6, 800, 'lowpass', 60); this.tone(80, .5 * big, 'sine', .5, 30); },
  crash() { this.noise(.35, .35, 2500, 'bandpass', 300); this.tone(90, .2, 'triangle', .2, 40); },
  glass() { for (let i = 0; i < 5; i++) this.tone(2000 + Math.random() * 3000, .15, 'triangle', .06, null, i * .03); },
  coin() { this.tone(988, .08, 'square', .12); this.tone(1319, .18, 'square', .12, null, .07); },
  buy() { this.tone(660, .1, 'triangle', .2); this.tone(880, .1, 'triangle', .2, null, .1); this.tone(1320, .2, 'triangle', .2, null, .2); },
  hurt() { this.tone(200, .25, 'sawtooth', .25, 70); },
  level() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, .25, 'triangle', .2, null, i * .12)); },
  scream() { const c = this.ctx; if (!c) return; for (let i = 0; i < 3; i++) this.tone(700 + i * 37, 1.1, 'sawtooth', .18, 1600 + i * 80); this.noise(1.0, .3, 3000, 'bandpass', 900); },
  ghostAppear() { this.tone(180, 1.4, 'sine', .25, 90); this.tone(185, 1.4, 'sine', .2, 95); },
  heart() { this.tone(60, .12, 'sine', .5, 40); this.tone(55, .12, 'sine', .4, 35, .2); },
  bell() { [880, 1320, 1760].forEach((f, i) => this.tone(f, 1.2, 'sine', .15, null, i * .02)); },
  droneOn() { const c = this.ctx; if (!c || this.drone) return; const o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(); o.type = 'sawtooth'; o.frequency.value = 55; o2.type = 'sine'; o2.frequency.value = 58; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 180; g.gain.value = .12; o.connect(f); o2.connect(f); f.connect(g); g.connect(this.master); o.start(); o2.start(); this.drone = [o, o2, g]; },
  droneOff() { if (this.drone) { this.drone[0].stop(); this.drone[1].stop(); this.drone = null; } },
};
const vibrate = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { } };

// ================= particles =================
const pGeo = new THREE.BoxGeometry(1, 1, 1), parts = [];
const pRoot = new THREE.Group(); scene.add(pRoot);
function part(pos, vel, color, size, life, grav = 9.8, opts = {}) {
  let p = parts.find(q => !q.alive);
  if (!p) { if (parts.length > 500) return; p = { mesh: new THREE.Mesh(pGeo, M(color)), vel: new THREE.Vector3() }; pRoot.add(p.mesh); parts.push(p); }
  p.alive = true; p.mesh.visible = true; p.mesh.material = opts.mat || M(color, { r: .8, e: opts.glow ? color : '', ei: opts.glow ? .8 : 1 });
  p.mesh.position.copy(pos); p.vel.copy(vel); p.size = size; p.mesh.scale.setScalar(size); p.life = p.max = life; p.grav = grav; p.spin = opts.spin ?? 6; p.mesh.rotation.set(Math.random() * 3, Math.random() * 3, 0);
}
function burst(pos, color, n, speed, size, life = 1, grav = 9.8, opts) {
  for (let i = 0; i < n; i++) part(pos, new THREE.Vector3((Math.random() - .5) * speed, Math.random() * speed * .8, (Math.random() - .5) * speed), color, size * (.5 + Math.random()), life * (.6 + Math.random() * .6), grav, opts);
}
function updateParts(dt) {
  for (const p of parts) {
    if (!p.alive) continue;
    p.life -= dt; if (p.life <= 0) { p.alive = false; p.mesh.visible = false; continue; }
    p.vel.y -= p.grav * dt; p.mesh.position.addScaledVector(p.vel, dt);
    const g = groundAt(p.mesh.position.x, p.mesh.position.z, p.mesh.position.y + .1);
    if (p.mesh.position.y < g + p.size / 2) { p.mesh.position.y = g + p.size / 2; p.vel.y *= -.3; p.vel.x *= .6; p.vel.z *= .6; }
    p.mesh.rotation.x += dt * p.spin; p.mesh.rotation.y += dt * p.spin;
    const k = Math.min(1, p.life / Math.min(.4, p.max)); p.mesh.scale.setScalar(p.size * k);
  }
}
H.onBreak = (pos, color, size, kind, s) => {
  if (kind === 'block') { burst(pos, color, 3, 4, size * .5, 1.6); if (Math.random() < .3) burst(pos, '#bbb', 2, 1.5, .25, .8, -0.3); }
  else if (kind === 'window') { burst(pos, '#cfe6f5', 14, 5, .07, 1.2); Snd.glass(); }
  else { burst(pos, color, 14, 5, size * .8, 2); burst(pos, '#cfc6b8', 6, 2, .3, 1, -.4); Snd.crash(); }
};

// ================= weapons =================
export const WEAPONS = {
  broom: { g: 'clean', n: '掃把', icon: '🧹', kind: 'melee', dmg: 34, range: 2.1, rate: .42, price: 0 },
  slipper: { g: 'clean', n: '藍白拖', icon: '🩴', kind: 'proj', dmg: 48, speed: 16, grav: 5, rate: .5, price: 120, model: 'slipper' },
  watergun: { g: 'clean', n: '水槍', icon: '🔫', kind: 'stream', dmg: 8, speed: 15, rate: .06, price: 260, color: '#5ab4ff' },
  spray: { g: 'clean', n: '殺蟲劑', icon: '🧴', kind: 'cone', dmg: 9, range: 3.4, rate: .08, price: 520, color: '#d8f0d0' },
  vacuum: { g: 'clean', n: '吸塵器', icon: '🌀', kind: 'beam', dmg: 14, range: 5.5, rate: .08, price: 1100, color: '#9ad' },
  mugwort: { g: 'ghost', n: '艾草棒', icon: '🌿', kind: 'melee', dmg: 40, range: 2.2, rate: .42, price: 0, color: '#6fbf4a' },
  holywater: { g: 'ghost', n: '聖水槍', icon: '💧', kind: 'stream', dmg: 10, speed: 15, rate: .07, price: 300, color: '#9fe8ff' },
  talisman: { g: 'ghost', n: '符咒', icon: '📜', kind: 'proj', dmg: 75, speed: 11, grav: 0, homing: 1, rate: .55, price: 650, model: 'talisman' },
  bagua: { g: 'ghost', n: '八卦鏡', icon: '☯️', kind: 'beam', dmg: 20, range: 9, rate: .08, price: 1300, color: '#ffe680' },
  bell: { g: 'ghost', n: '法鈴', icon: '🔔', kind: 'nova', dmg: 140, radius: 5.5, rate: 2.2, price: 2200 },
  hammer: { g: 'destroy', n: '大鐵鎚', icon: '🔨', kind: 'melee', dmg: 70, range: 2.4, radius: .6, rate: .55, price: 0 },
  katana: { g: 'destroy', n: '武士刀', icon: '🗡️', kind: 'melee', dmg: 45, range: 2.5, radius: .45, rate: .2, price: 200 },
  chainsaw: { g: 'destroy', n: '電鋸', icon: '🪚', kind: 'melee', dmg: 22, range: 2.0, radius: .5, rate: .07, price: 450 },
  grenade: { g: 'destroy', n: '手榴彈', icon: '💣', kind: 'proj', dmg: 160, speed: 11, grav: 9.8, fuse: 1.6, radius: 2.4, rate: .8, price: 600, model: 'grenade', bounce: 1 },
  cannon: { g: 'destroy', n: '大砲', icon: '💥', kind: 'proj', dmg: 220, speed: 24, grav: 3, radius: 2.0, rate: .9, price: 1000, model: 'ball' },
  rocket: { g: 'destroy', n: '火箭筒', icon: '🚀', kind: 'proj', dmg: 280, speed: 26, grav: 0, radius: 2.8, rate: 1.0, price: 1800, model: 'rocket' },
  mega: { g: 'destroy', n: '超級炸彈', icon: '☢️', kind: 'proj', dmg: 3000, speed: 10, grav: 9.8, fuse: 3, radius: 9, rate: 4, price: 6000, model: 'mega', bounce: 1 },
};
const lvMult = lv => 1 + .45 * lv;
const upCost = (w, lv) => Math.round(Math.max(90, w.price) * .7 * (lv + 1));

// view model
const vm = new THREE.Group(); camera.add(vm); vm.position.set(.32, -.34, -.55); vm.visible = false;
const beam = new THREE.Mesh(new THREE.CylinderGeometry(.04, .09, 1, 8, 1, true), M('#ffe680', { op: .45, e: '#ffe680', ei: 1, ds: 1 })); beam.rotation.x = Math.PI / 2; beam.visible = false; scene.add(beam);
function buildVM(id) {
  vm.clear(); const g = new THREE.Group(); vm.add(g);
  const wood = M('#8a5a2a'), metal = M('#9aa0a6', { m: .8, r: .3 }), dark = M('#2a2a2a', { m: .5, r: .4 });
  switch (id) {
    case 'broom': cy(g, .015, .015, .9, 0, -.2, 0, wood).rotation.x = -.3; { const b = cy(g, .02, .12, .25, 0, -.45, .12, M('#d9b66a')); b.rotation.x = -.3; } break;
    case 'slipper': bx(g, .1, .03, .26, 0, 0, 0, M('#3d6fd6')); bx(g, .1, .02, .04, 0, .03, -.02, M('#fff')); break;
    case 'watergun': case 'holywater': bx(g, .08, .12, .3, 0, 0, 0, M(id === 'watergun' ? '#ff7a1a' : '#e9f6ff', { r: .3 })); cy(g, .05, .05, .12, 0, .12, .05, M(id === 'watergun' ? '#3aa0ff' : '#9fe8ff', { op: .7 })); bx(g, .05, .14, .06, 0, -.12, .08, dark); break;
    case 'spray': cy(g, .05, .05, .25, 0, -.1, 0, M('#2e9e4f')); cy(g, .02, .02, .05, 0, .15, 0, M('#ddd')); break;
    case 'vacuum': bx(g, .12, .12, .3, 0, -.05, .05, M('#c03a3a')); cy(g, .03, .03, .5, 0, -.05, -.3, metal).rotation.x = Math.PI / 2; break;
    case 'mugwort': { const s = cy(g, .02, .025, .7, 0, -.25, 0, M('#7a9a4a')); s.rotation.x = -.3; for (let i = 0; i < 6; i++) { const l = sp(g, .05, (Math.random() - .5) * .08, .35 + i * .04, -.12 - i * .015, M('#5fae3a', { e: '#2a5', ei: .3 })); } } break;
    case 'talisman': bx(g, .1, .2, .005, 0, 0, 0, M('#f3d23a', { e: '#a80', ei: .3 })); bx(g, .02, .14, .006, 0, .03, 0, M('#c00')); break;
    case 'bagua': { const m = cy(g, .12, .12, .03, 0, 0, 0, M('#d4a83a', { m: .7, r: .3 }), 8); m.rotation.x = Math.PI / 2; const mm = cy(g, .07, .07, .035, 0, 0, 0, M('#e8f6ff', { m: 1, r: .05, e: '#fff7c0', ei: .4 }), 16); mm.rotation.x = Math.PI / 2; } break;
    case 'bell': cy(g, .02, .06, .12, 0, 0, 0, M('#d4a83a', { m: .8, r: .3 })); cy(g, .012, .012, .15, 0, .12, 0, wood); break;
    case 'hammer': cy(g, .02, .02, .7, 0, -.35, 0, wood); bx(g, .28, .14, .14, 0, .3, 0, metal); break;
    case 'katana': bx(g, .02, .02, .25, 0, -.12, .05, M('#222')); bx(g, .1, .015, .02, 0, 0, 0, M('#c9a23a', { m: .8 })); bx(g, .012, .85, .035, 0, .02, 0, M('#e6eef2', { m: .9, r: .15 })); break;
    case 'chainsaw': bx(g, .12, .14, .3, 0, -.05, .05, M('#f0b020')); bx(g, .03, .08, .5, 0, 0, -.35, metal); break;
    case 'grenade': case 'mega': sp(g, id === 'mega' ? .12 : .07, 0, 0, 0, M(id === 'mega' ? '#e8d020' : '#4a5a2a', { r: .5 })); if (id === 'mega') bx(g, .02, .02, .02, 0, .12, 0, M('#f00', { e: '#f00' })); break;
    case 'cannon': cy(g, .09, .11, .55, 0, -.1, -.1, dark, 12).rotation.x = Math.PI / 2; break;
    case 'rocket': cy(g, .07, .07, .7, 0, 0, -.1, M('#4a5a3a'), 12).rotation.x = Math.PI / 2; bx(g, .04, .1, .06, 0, -.12, .05, dark); break;
  }
  const bx0 = { broom: -.7, mugwort: -.6, hammer: -.3, chainsaw: 0 }[id] ?? .1;
  g.rotation.set(bx0, -.15, 0); g.userData.bx = bx0;
  vm.userData.g = g;
}
function projModel(w) {
  const g = new THREE.Group();
  switch (w.model) {
    case 'slipper': bx(g, .1, .03, .26, 0, 0, 0, M('#3d6fd6')); break;
    case 'talisman': bx(g, .12, .22, .01, 0, 0, 0, M('#f3d23a', { e: '#fc3', ei: .8 })); break;
    case 'grenade': sp(g, .07, 0, 0, 0, M('#4a5a2a')); break;
    case 'mega': sp(g, .14, 0, 0, 0, M('#e8d020', { e: '#f80', ei: .4 })); break;
    case 'ball': sp(g, .12, 0, 0, 0, M('#111', { m: .6, r: .3 })); break;
    case 'rocket': cy(g, .05, .05, .4, 0, -.2, 0, M('#ddd')).rotation.x = Math.PI / 2; break;
    default: sp(g, .04, 0, 0, 0, M(w.color || '#5ab4ff', { op: .85, e: w.color || '#5ab4ff', ei: .3 }));
  }
  scene.add(g); return g;
}

// ================= enemies =================
const ENEMY = {
  roach: { n: '蟑螂', hp: 30, spd: 2.4, dmg: 3, r: .3, money: 10, build: () => bug('#5a2e12', .5) },
  mosquito: { n: '蚊子', hp: 16, spd: 2.0, dmg: 2, r: .25, fly: 1.4, money: 12, build: mosq },
  rat: { n: '老鼠', hp: 70, spd: 3.0, dmg: 6, r: .35, money: 22, build: rat },
  roachKing: { n: '蟑螂王', hp: 1300, spd: 1.7, dmg: 18, r: 1.0, money: 600, boss: 1, summon: 'roach', build: () => { const g = bug('#3a1a08', 2.0); const cr = cy(g, .25, .3, .25, 0, .55, .45, M('#f5c542', { m: .8, r: .3 }), 6); return g; } },
  wisp: { n: '小鬼', hp: 40, spd: 1.9, dmg: 5, r: .35, fly: 1.3, ghost: 1, money: 15, build: wisp },
  lady: { n: '紅衣女鬼', hp: 120, spd: 1.5, dmg: 11, r: .4, fly: .05, ghost: 1, teleport: 1, money: 35, build: lady },
  jiangshi: { n: '殭屍', hp: 170, spd: 1.5, dmg: 13, r: .4, hop: 1, money: 40, build: jiangshi },
  ghostKing: { n: '鬼王', hp: 2600, spd: 1.4, dmg: 26, r: 1.1, fly: .2, ghost: 1, boss: 1, summon: 'wisp', fireball: 1, money: 1200, build: ghostKing },
};
function bug(c, s) {
  const g = new THREE.Group(), m = M(c, { r: .3, m: .2 });
  const b = sp(g, .2 * s, 0, .1 * s, 0, m); b.scale.set(.7, .35, 1.2);
  sp(g, .08 * s, 0, .1 * s, .26 * s, M(shade(c, -.1)));
  const legs = new THREE.Group(); g.add(legs);
  for (let i = 0; i < 3; i++) for (const sd of [-1, 1]) { const l = bx(legs, .22 * s, .015 * s, .02 * s, sd * .14 * s, .02 * s, (-.1 + i * .1) * s, M('#2a1408')); l.rotation.y = sd * (i - 1) * .4; }
  for (const sd of [-1, 1]) { const a = bx(g, .01 * s, .01 * s, .3 * s, sd * .05 * s, .14 * s, .45 * s, M('#2a1408')); a.rotation.y = sd * .3; }
  g.userData.legs = legs; return g;
}
function mosq() {
  const g = new THREE.Group(); const b = sp(g, .06, 0, 0, 0, M('#222')); b.scale.set(.6, .6, 1.8);
  bx(g, .005, .005, .15, 0, 0, .14, M('#111'));
  const wm = M('#ddeeff', { op: .5, ds: 1 }); const w1 = new THREE.Mesh(new THREE.PlaneGeometry(.18, .07), wm), w2 = w1.clone(); w1.position.set(.09, .04, 0); w2.position.set(-.09, .04, 0); w1.rotation.x = w2.rotation.x = -Math.PI / 2; g.add(w1, w2); g.userData.wings = [w1, w2];
  for (let i = 0; i < 3; i++) for (const sd of [-1, 1]) { const l = bx(g, .005, .14, .005, sd * .04, -.14, (i - 1) * .04, M('#111')); l.rotation.z = sd * .4; }
  g.scale.setScalar(1.6); return g;
}
function rat() {
  const g = new THREE.Group(), m = M('#6d6a66', { r: .9 }); const b = sp(g, .18, 0, .15, 0, m); b.scale.set(.8, .7, 1.4);
  sp(g, .1, 0, .17, .26, m); for (const sd of [-1, 1]) sp(g, .05, sd * .07, .27, .22, M('#e8a0a0'));
  sp(g, .015, .04, .2, .35, M('#000')); sp(g, .015, -.04, .2, .35, M('#000'));
  const t = cy(g, .012, .006, .45, 0, .08, -.45, M('#d9a0a0')); t.rotation.x = Math.PI / 2.4; return g;
}
function ghostMat(c, op = .8) { return new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: .5, transparent: true, opacity: op, depthWrite: false, roughness: 1 }); }
function wisp() {
  const g = new THREE.Group(), m = ghostMat('#e8f2ff');
  const head = new THREE.Mesh(new THREE.SphereGeometry(.28, 16, 12), m); head.position.y = .2; g.add(head);
  const body = new THREE.Mesh(new THREE.ConeGeometry(.3, .6, 16, 1, true), m); body.rotation.x = Math.PI; body.position.y = -.2; g.add(body);
  for (const sd of [-1, 1]) sp(g, .05, sd * .1, .25, .24, M('#000')); const mo = sp(g, .06, 0, .1, .25, M('#000')); mo.scale.set(1, 1.6, .5);
  g.userData.mats = [m]; return g;
}
function lady() {
  const g = new THREE.Group(), dress = ghostMat('#b0121a', .9), skin = ghostMat('#f2efe8', .95), hair = ghostMat('#050505', .95);
  const body = new THREE.Mesh(new THREE.ConeGeometry(.35, 1.4, 16, 1, true), dress); body.position.y = .7; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.14, 14, 10), skin); head.position.y = 1.55; g.add(head);
  const h = new THREE.Mesh(new THREE.CylinderGeometry(.16, .22, .8, 12, 1, true), hair); h.position.set(0, 1.25, -.02); g.add(h);
  const hf = new THREE.Mesh(BG3(.24, .55, .02), hair); hf.position.set(0, 1.35, .15); g.add(hf);
  for (const sd of [-1, 1]) { const a = new THREE.Mesh(BG3(.06, .55, .06), skin); a.position.set(sd * .3, 1.0, .1); a.rotation.z = sd * .3; g.add(a); }
  g.userData.mats = [dress, skin, hair]; return g;
}
const BG3 = (a, b, c) => new THREE.BoxGeometry(a, b, c);
function jiangshi() {
  const g = new THREE.Group(), robe = M('#1d2b5a', { r: .8 }), skin = M('#9bb59a', { r: .9 });
  bx(g, .5, 1.1, .32, 0, .2, 0, robe); bx(g, .52, .08, .34, 0, .8, 0, M('#c9a23a')); bx(g, .3, .3, .28, 0, 1.3, 0, skin);
  bx(g, .38, .12, .36, 0, 1.6, 0, M('#111')); bx(g, .22, .1, .2, 0, 1.72, 0, M('#111')); sp(g, .03, 0, 1.82, 0, M('#c00'));
  bx(g, .14, .26, .01, 0, 1.24, .15, M('#f3d23a', { e: '#a80', ei: .3 })); bx(g, .03, .18, .012, 0, 1.24, .155, M('#c00'));
  for (const sd of [-1, 1]) { bx(g, .12, .12, .6, sd * .2, 1.05, .35, robe); bx(g, .1, .1, .12, sd * .2, 1.05, .7, skin); }
  bx(g, .5, .2, .3, 0, 0, 0, M('#111')); return g;
}
function ghostKing() {
  const g = new THREE.Group(), body = ghostMat('#5a0010', .9), dark = ghostMat('#140006', .95);
  const b = new THREE.Mesh(new THREE.ConeGeometry(1.0, 2.6, 18, 1, true), dark); b.position.y = 1.3; g.add(b);
  const torso = new THREE.Mesh(new THREE.SphereGeometry(.7, 16, 12), body); torso.position.y = 2.3; torso.scale.set(1.2, 1, .9); g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.45, 16, 12), body); head.position.y = 3.1; g.add(head);
  for (const sd of [-1, 1]) { const h = new THREE.Mesh(new THREE.ConeGeometry(.1, .5, 8), M('#e8e0c0')); h.position.set(sd * .3, 3.55, 0); h.rotation.z = -sd * .4; g.add(h); sp(g, .08, sd * .17, 3.15, .38, M('#ff2a00', { e: '#ff2a00', ei: 2 })); }
  for (const sd of [-1, 1]) { const a = new THREE.Mesh(BG3(.25, 1.2, .25), body); a.position.set(sd * 1.0, 2.2, .3); a.rotation.z = sd * .6; g.add(a); }
  const glow = new THREE.PointLight('#ff2200', 3, 6, 2); glow.position.y = 2.5; g.add(glow);
  g.userData.mats = [body, dark]; return g;
}

// ================= game state =================
const G = { kind: null, active: false, paused: false, level: 1, enemies: [], projs: [], cool: 0, hp: 100, maxHp: 100, queue: 0, spawnT: 0, prof: null, t: 0, boss: null, collapse: 0, scareT: 0 };
export const Game = G;
const PROF_KEY = k => 'home_game_' + k;
const DEF_W = { clean: 'broom', ghost: 'mugwort', destroy: 'hammer' };
function loadProf(kind) {
  let p; try { p = JSON.parse(localStorage.getItem(PROF_KEY(kind))); } catch (e) { }
  if (!p) p = { money: kind === 'destroy' ? 200 : 0, owned: { [DEF_W[kind]]: 0 }, cur: DEF_W[kind], level: 1, hpLv: 0, spdLv: 0, defLv: 0, regLv: 0, potions: 2, best: 0 };
  return p;
}
const maxHpOf = p => 100 + (p.hpLv || 0) * 40;
const hpCost = p => 120 + 110 * (p.hpLv || 0);
const potCost = () => 60;
export function usePotion() {
  if (!G.active || G.kind === 'destroy' || G.paused) return;
  if (!G.prof.potions) return toast('沒有藥水了，到商店買');
  if (G.hp >= G.maxHp) return toast('生命已經是滿的');
  G.prof.potions--; G.hp = Math.min(G.maxHp, G.hp + G.maxHp * .6); saveProf(); updateHUD();
  Snd.tone(523, .15, 'triangle', .2); Snd.tone(784, .25, 'triangle', .2, null, .12);
  const f = $('#flash'); f.style.background = 'rgba(60,255,120,.3)'; f.style.opacity = 1; setTimeout(() => f.style.opacity = 0, 200);
  burst(player.pos.clone().add(new THREE.Vector3(0, 1, 0)), '#66ff66', 14, 2, .06, .8, -1, { glow: 1 });
}
// heart pickups dropped by enemies
const hearts = [];
function dropHeart(pos) {
  const g = new THREE.Group(), m = M('#ff3355', { e: '#ff2244', ei: .9, r: .3 });
  sp(g, .09, -.06, 0, 0, m); sp(g, .09, .06, 0, 0, m); const c = new THREE.Mesh(new THREE.ConeGeometry(.13, .18, 12), m); c.rotation.z = Math.PI; c.position.y = -.1; g.add(c);
  g.position.copy(pos); g.position.y = groundAt(pos.x, pos.z, pos.y + .5) + .45; g.userData.base = g.position.y; g.userData.t = 0;
  scene.add(g); hearts.push(g);
}
function clearHearts() { for (const h of hearts) scene.remove(h); hearts.length = 0; }
function updateHearts(dt) {
  for (const h of hearts.slice()) {
    h.userData.t += dt; h.rotation.y += dt * 3; h.position.y = h.userData.base + Math.sin(h.userData.t * 3) * .06;
    if (h.userData.t > 25) { scene.remove(h); hearts.splice(hearts.indexOf(h), 1); continue; }
    if (Math.hypot(h.position.x - player.pos.x, h.position.z - player.pos.z) < .8 && Math.abs(h.position.y - player.pos.y - .45) < 1.2) {
      scene.remove(h); hearts.splice(hearts.indexOf(h), 1);
      const heal = Math.round(G.maxHp * .25); G.hp = Math.min(G.maxHp, G.hp + heal); floatText(`+${heal}❤️`, h.position); Snd.tone(880, .12, 'sine', .2); Snd.tone(1175, .2, 'sine', .2, null, .1); updateHUD();
    }
  }
}
const saveProf = () => { try { localStorage.setItem(PROF_KEY(G.kind), JSON.stringify(G.prof)); } catch (e) { } };
const W = () => WEAPONS[G.prof.cur];
const curDmg = () => W().dmg * lvMult(G.prof.owned[G.prof.cur] || 0);

let flashlight = null, worldTargets = [];
export function startGame(kind, data) {
  Snd.init();
  stopGame(true);
  G.kind = kind; G.active = true; G.paused = false; G.prof = loadProf(kind); G.t = 0; G.collapse = 0;
  build(data, { destruct: kind === 'destroy' });
  worldTargets = kind === 'destroy' ? null : [...H.wallMeshes, ...H.slabMeshes];
  const pf = G.prof; pf.defLv ??= 0; pf.regLv ??= 0; pf.potions ??= 2;
  G.maxHp = maxHpOf(pf); G.hp = G.maxHp; clearHearts(); player.speed = 2.4 * (1 + G.prof.spdLv * .08); player.run = 4.4 * (1 + G.prof.spdLv * .08);
  vm.visible = true; buildVM(G.prof.cur);
  $('#ghud').classList.add('show'); $('#ghud').dataset.kind = kind; document.body.dataset.kind = kind;
  if (kind === 'ghost') {
    setNight(true); lightCfg.intensity = 3; lightCfg.flicker = .03; H.lamps.forEach(l => setLamp(l, Math.random() < .5));
    scene.fog = new THREE.FogExp2('#000000', .09);
    if (!flashlight) { flashlight = new THREE.SpotLight('#fff6d8', 0, 18, .45, .5, 1.2); camera.add(flashlight); camera.add(flashlight.target); flashlight.position.set(.2, -.1, 0); flashlight.target.position.set(0, 0, -5); }
    flashlight.intensity = 25; $('#vig').classList.add('show'); Snd.droneOn();
  } else { setNight(false); lightCfg.intensity = 8; lightCfg.flicker = 0; scene.fog = null; }
  renderWeaponBar();
  if (kind === 'destroy') { banner('🔨 拆家狂人', '盡情破壞！賺錢買更強的武器，把整個家拆光', 2600); updateHUD(); }
  else startLevel(G.prof.level);
}
export function stopGame(silent) {
  if (!G.active) return;
  G.active = false; clearHearts(); for (const e of G.enemies) scene.remove(e.mesh); G.enemies = []; for (const p of G.projs) scene.remove(p.mesh); G.projs = [];
  vm.visible = false; beam.visible = false; $('#ghud').classList.remove('show'); $('#shop').classList.remove('show'); $('#banner').classList.remove('show'); $('#vig').classList.remove('show');
  if (flashlight) flashlight.intensity = 0; scene.fog = null; lightCfg.flicker = 0; lightCfg.intensity = 8; Snd.droneOff(); setNight(false);
  H.lamps.forEach(l => setLamp(l, true));
  if (G.kind) saveProf();
}

function roomsOn(fi) { return S.data.floors[fi]?.rooms || []; }
function randomSpot(fi, avoidPlayer = 3) {
  const rooms = roomsOn(fi).filter(r => (r.x1 - r.x0) * (r.d1 - r.d0) > 1.5);
  for (let k = 0; k < 60; k++) {
    const r = rooms[Math.floor(Math.random() * rooms.length)]; if (!r) break;
    const x = r.x0 + .4 + Math.random() * (r.x1 - r.x0 - .8), d = r.d0 + .4 + Math.random() * (r.d1 - r.d0 - .8), z = -d, y = floorY(fi);
    if (groundAt(x, z, y + .2) < y - .1) continue;
    if (hits(x, z, y, .3, true)) continue;
    if (Math.hypot(x - player.pos.x, z - player.pos.z) < avoidPlayer && Math.abs(y - player.pos.y) < 1) continue;
    return new THREE.Vector3(x, y, z);
  }
  return new THREE.Vector3(2.5, floorY(fi), -4);
}
function spawnEnemy(type, pos, L = G.level) {
  const d = ENEMY[type], mesh = d.build(); mesh.position.copy(pos); scene.add(mesh);
  const sc = 1 + .18 * (L - 1);
  const e = { type, d, mesh, hp: d.hp * sc, max: d.hp * sc, spd: d.spd * Math.min(1.6, 1 + .035 * (L - 1)), dmg: d.dmg * (1 + .1 * (L - 1)), r: d.r, cool: 0, dir: Math.random() * 6.28, wt: 0, t: Math.random() * 10, abil: 3 + Math.random() * 3, vis: d.ghost ? 0 : 1, y: pos.y, base: pos.y };
  G.enemies.push(e); if (d.boss) { G.boss = e; $('#bossbar').classList.add('show'); $('#bossname').textContent = d.n; }
  return e;
}
function startLevel(L) {
  G.level = L; for (const e of G.enemies) scene.remove(e.mesh); G.enemies = []; G.boss = null; $('#bossbar').classList.remove('show');
  G.hp = G.maxHp;
  const nF = S.data.floors.length;
  if (G.kind === 'clean') {
    const boss = L % 5 === 0, n = boss ? 4 + L : 6 + L * 3;
    for (let i = 0; i < n; i++) {
      const r = Math.random(); const type = L >= 3 && r < .2 ? 'rat' : L >= 2 && r < .5 ? 'mosquito' : 'roach';
      spawnEnemy(type, randomSpot(Math.floor(Math.random() * nF)));
    }
    if (boss) spawnEnemy('roachKing', randomSpot(0, 5));
    banner(boss ? `👑 第 ${L} 關 BOSS` : `🧹 第 ${L} 關`, boss ? '蟑螂王出現了！' : `清除 ${n} 隻害蟲`, 2200);
  } else {
    const boss = L % 3 === 0;
    G.queue = boss ? 5 + L : 6 + L * 2; G.spawnT = 2.5;
    if (boss) setTimeout(() => { if (G.active && G.level === L) { const p = player.pos.clone(); p.x = clamp(p.x + (Math.random() - .5) * 4, .8, 4.2); p.z -= 3; const e = spawnEnemy('ghostKing', p); G.queue--; scare(1); } }, 4000);
    banner(boss ? `👹 第 ${L} 關 BOSS` : `👻 第 ${L} 關`, boss ? '鬼王即將降臨…' : `驅除 ${G.queue} 隻鬼`, 2400);
  }
  updateHUD();
}
function levelClear() {
  const bonus = 60 * G.level; G.prof.money += bonus; G.prof.level = G.level + 1; G.prof.best = Math.max(G.prof.best, G.level); saveProf();
  Snd.level(); banner(`✨ 第 ${G.level} 關完成！`, `獎金 $${bonus}`, 1800);
  setTimeout(() => openShop(true), 1600);
}
function playerDie() {
  G.paused = true; Snd.hurt(); vibrate([200, 100, 300]);
  $('#shop').classList.remove('show');
  showDialog('💀 你倒下了', `撐到第 ${G.level} 關。金錢和武器都保留。`, [['🔁 重新挑戰', () => { G.paused = false; startLevel(G.level); }], ['🛒 先去商店', () => openShop(false, true)], ['🏠 回主選單', () => on.escape && on.escape('menu')]]);
}

// ================= scare effects =================
function scare(big) {
  Snd.scream(); vibrate(big ? [300, 80, 300] : 200); fx.shake = big ? 1.4 : .9;
  const f = $('#flash'); f.style.background = big ? 'rgba(140,0,0,.75)' : 'rgba(255,255,255,.55)'; f.style.opacity = 1; setTimeout(() => f.style.opacity = 0, 120);
  lightCfg.flicker = .5; G.scareT = 1.4; camera.fov = 58; camera.updateProjectionMatrix();
}

// ================= attacks =================
const ray = new THREE.Raycaster(), fwd = new THREE.Vector3(), tmpV = new THREE.Vector3();
let swingT = 0, holding = false;
on.attackDown = () => { if (!G.active || G.paused) return; Snd.init(); holding = true; tryFire(); };
on.attackUp = () => { holding = false; beam.visible = false; };
on.switchW = () => { if (!G.active) return; const ids = Object.keys(G.prof.owned); const i = ids.indexOf(G.prof.cur); equip(ids[(i + 1) % ids.length]); };
function equip(id) { G.prof.cur = id; buildVM(id); renderWeaponBar(); saveProf(); toast(WEAPONS[id].icon + ' ' + WEAPONS[id].n, 900); }
function camFwd() { camera.getWorldDirection(fwd); return fwd; }
function tryFire() {
  if (G.cool > 0) return; const w = W(); G.cool = w.rate;
  const dmg = curDmg(), dir = camFwd().clone(), origin = camera.getWorldPosition(new THREE.Vector3());
  if (w.kind === 'melee') {
    swingT = 1; Snd.whoosh(); fx.kick = .04;
    if (G.kind === 'destroy') {
      ray.set(origin, dir); ray.far = w.range;
      const hit = ray.intersectObjects(destroyTargets(), true)[0];
      if (hit) { const r = damageAt(hit.point, w.radius, dmg); burst(hit.point, '#ddd', 5, 3, .06, .5); Snd.hit(); fx.shake = Math.max(fx.shake, .35); vibrate(30); earn(r.money); }
    } else {
      let any = false;
      for (const e of G.enemies) {
        tmpV.copy(e.mesh.position); tmpV.y += e.d.fly ? 0 : .3 + e.r * .5; const to = tmpV.sub(origin); const dist = to.length();
        if (dist > w.range + e.r) continue; to.normalize(); if (to.dot(dir) < .55 && dist > e.r + .5) continue;
        hurtEnemy(e, dmg, dir); any = true;
      }
      if (any) { Snd.hit(); vibrate(25); }
    }
  } else if (w.kind === 'proj') {
    const m = projModel(w); m.position.copy(origin).addScaledVector(dir, .5); m.position.y -= .1;
    G.projs.push({ mesh: m, vel: dir.clone().multiplyScalar(w.speed).add(new THREE.Vector3(0, w.grav ? w.speed * .18 : 0, 0)), w, dmg, life: w.fuse || 4, fuse: w.fuse });
    Snd.whoosh(); fx.kick = w.radius ? .1 : .03; if (w.model === 'ball' || w.model === 'rocket') { Snd.boom(.4); fx.shake = .4; }
  } else if (w.kind === 'stream') {
    for (let i = 0; i < 2; i++) {
      const m = projModel(w); m.position.copy(origin).addScaledVector(dir, .45); m.position.y -= .12;
      const v = dir.clone().multiplyScalar(w.speed); v.x += (Math.random() - .5) * .8; v.y += 1 + (Math.random() - .5) * .6; v.z += (Math.random() - .5) * .8;
      G.projs.push({ mesh: m, vel: v, w: { ...w, grav: 5 }, dmg, life: .9, stream: 1 });
    }
    if (Math.random() < .3) Snd.splash();
  } else if (w.kind === 'cone') {
    for (let i = 0; i < 4; i++) part(origin.clone().addScaledVector(dir, .6), dir.clone().multiplyScalar(4 + Math.random() * 2).add(new THREE.Vector3((Math.random() - .5) * 1.5, (Math.random() - .5) * 1.2, (Math.random() - .5) * 1.5)), w.color, .12, .6, -.2, { spin: 1 });
    for (const e of G.enemies) { const to = tmpV.copy(e.mesh.position).sub(origin), dist = to.length(); if (dist < w.range && to.normalize().dot(dir) > .8) hurtEnemy(e, dmg, dir, true); }
    if (Math.random() < .4) Snd.noise(.1, .08, 4000, 'highpass');
  } else if (w.kind === 'beam') {
    beam.visible = true; beam.material.color.set(w.color); beam.material.emissive.set(w.color);
    const end = origin.clone().addScaledVector(dir, w.range); beam.position.copy(origin).add(end).multiplyScalar(.5); beam.position.y -= .15; beam.scale.set(1, w.range, 1); beam.lookAt(end); beam.rotateX(Math.PI / 2);
    for (const e of G.enemies) {
      const to = tmpV.copy(e.mesh.position).sub(origin), t = to.dot(dir); if (t < 0 || t > w.range) continue;
      const perp = to.addScaledVector(dir, -t).length(); if (perp < e.r + .5) { hurtEnemy(e, dmg, dir, true); if (G.prof.cur === 'vacuum') e.mesh.position.addScaledVector(dir, -.05); }
    }
    if (Math.random() < .2) Snd.tone(180 + Math.random() * 40, .1, 'sawtooth', .04);
  } else if (w.kind === 'nova') {
    Snd.bell(); fx.shake = .4;
    for (let i = 0; i < 40; i++) { const a = i / 40 * 6.28; part(player.pos.clone().add(new THREE.Vector3(0, 1, 0)), new THREE.Vector3(Math.cos(a) * 7, 0, Math.sin(a) * 7), '#ffe680', .12, .8, 0, { glow: 1 }); }
    for (const e of G.enemies) if (e.mesh.position.distanceTo(player.pos) < w.radius) hurtEnemy(e, dmg, null);
  }
}
function destroyTargets() { return [...H.blockMeshes, ...H.furn.map(e => e.obj), ...H.doors.filter(d => !d.dead && d.leaf).map(d => d.leaf), ...H.breakables.filter(b => b.kind === 'window').map(b => b.obj), ...H.slabMeshes]; }
function earn(m) { if (!m) return; G.prof.money += m; if (Math.random() < .3) Snd.coin(); updateHUD(); }
function hurtEnemy(e, dmg, dir, quiet) {
  if (e.dead) return; e.hp -= dmg; e.flash = .12;
  if (dir && !e.d.boss) e.mesh.position.addScaledVector(dir.clone().setY(0).normalize(), quiet ? .01 : .25);
  if (!quiet) burst(e.mesh.position.clone().add(new THREE.Vector3(0, .3, 0)), e.d.ghost ? '#cfe8ff' : '#7a5a2a', 4, 3, .06, .5);
  if (e.hp <= 0) killEnemy(e);
}
function killEnemy(e) {
  e.dead = true; scene.remove(e.mesh); G.enemies = G.enemies.filter(x => x !== e);
  const pos = e.mesh.position.clone().add(new THREE.Vector3(0, .3, 0));
  if (e.d.ghost) { burst(pos, '#e8f6ff', 18, 4, .1, 1.2, -1.5, { glow: 1 }); Snd.tone(600, .5, 'sine', .2, 1500); }
  else { burst(pos, '#6b8a2a', 10, 3, .08, .8); Snd.squish(); }
  const m = Math.round(e.d.money * (1 + .1 * (G.level - 1))); earn(m); floatText(`+$${m}`, pos);
  if (e.d.boss) for (let i = 0; i < 3; i++) dropHeart(pos.clone().add(new THREE.Vector3((Math.random() - .5) * 2, 0, (Math.random() - .5) * 2)));
  else if (Math.random() < .14) dropHeart(pos);
  if (e === G.boss) { G.boss = null; $('#bossbar').classList.remove('show'); fx.shake = 1.2; Snd.boom(1.5); for (const x of G.enemies.slice()) killEnemy(x); G.queue = 0; }
  if (!G.enemies.length && (G.kind === 'clean' || G.queue <= 0)) setTimeout(() => { if (G.active && !G.enemies.length && (G.kind === 'clean' || G.queue <= 0)) levelClear(); }, 600);
}
function explode(pos, w, dmg) {
  const big = w.radius > 5;
  Snd.boom(big ? 2.5 : 1); fx.shake = big ? 2.2 : 1.0; vibrate(big ? [400, 100, 400] : 120);
  burst(pos, '#ff9a2a', big ? 60 : 24, big ? 16 : 7, big ? .35 : .18, 1, -2, { glow: 1 });
  burst(pos, '#555', big ? 40 : 14, big ? 10 : 4, big ? .5 : .3, 1.6, -.5);
  const flashL = new THREE.PointLight('#ffaa44', big ? 80 : 30, big ? 30 : 10, 2); flashL.position.copy(pos); scene.add(flashL); setTimeout(() => scene.remove(flashL), 120);
  if (G.kind === 'destroy') { const r = damageAt(pos, w.radius, dmg); earn(r.money); }
  for (const e of G.enemies.slice()) if (e.mesh.position.distanceTo(pos) < w.radius + e.r) hurtEnemy(e, dmg, null);
}
function updateProjs(dt) {
  for (const p of G.projs.slice()) {
    p.life -= dt;
    const prev = p.mesh.position.clone();
    if (p.w.homing) { let best = null, bd = 1e9; for (const e of G.enemies) { const d = e.mesh.position.distanceTo(p.mesh.position); if (d < bd) { bd = d; best = e; } } if (best) { const to = best.mesh.position.clone().add(new THREE.Vector3(0, .4, 0)).sub(p.mesh.position).normalize().multiplyScalar(p.w.speed); p.vel.lerp(to, Math.min(1, dt * 3)); } p.mesh.rotation.z += dt * 10; }
    p.vel.y -= (p.w.grav || 0) * dt; p.mesh.position.addScaledVector(p.vel, dt);
    if (p.w.model === 'rocket') { p.mesh.lookAt(p.mesh.position.clone().add(p.vel)); part(p.mesh.position, new THREE.Vector3(0, .5, 0), '#ffb040', .1, .3, 0, { glow: 1 }); }
    if (p.w.model === 'slipper') p.mesh.rotation.x += dt * 15;
    let done = false;
    // enemies
    if (!p.fuse) for (const e of G.enemies) { const c = e.mesh.position.clone(); c.y += e.d.fly ? 0 : .25 + e.r * .4; if (c.distanceTo(p.mesh.position) < e.r + .25) { if (p.w.radius) explode(p.mesh.position, p.w, p.dmg); else hurtEnemy(e, p.dmg, p.vel.clone().normalize(), p.stream); done = true; break; } }
    // world
    if (!done) {
      const seg = p.mesh.position.clone().sub(prev), len = seg.length();
      if (len > 0) {
        ray.set(prev, seg.normalize()); ray.far = len + .05;
        const hit = ray.intersectObjects(G.kind === 'destroy' ? destroyTargets() : worldTargets, true)[0];
        if (hit) {
          if (p.w.bounce && p.fuse) { const n = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : new THREE.Vector3(0, 1, 0); p.vel.reflect(n).multiplyScalar(.45); p.mesh.position.copy(hit.point).addScaledVector(n, .08); Snd.tone(300, .05, 'square', .05); }
          else if (p.w.radius) { explode(hit.point, p.w, p.dmg); done = true; }
          else { if (p.stream) { if (Math.random() < .4) burst(hit.point, p.w.color, 2, 1.5, .04, .3); } else { burst(hit.point, '#ddd', 4, 2, .05, .4); Snd.hit(); } done = true; }
        }
      }
    }
    if (!done && p.life <= 0) { if (p.w.radius) explode(p.mesh.position, p.w, p.dmg); done = true; }
    if (done) { scene.remove(p.mesh); G.projs = G.projs.filter(x => x !== p); }
  }
}

// ================= enemy AI =================
function updateEnemies(dt) {
  const pp = player.pos;
  for (const e of G.enemies.slice()) {
    e.t += dt; e.cool -= dt; e.abil -= dt;
    const m = e.mesh, d = e.d;
    const dx = pp.x - m.position.x, dz = pp.z - m.position.z, distH = Math.hypot(dx, dz), dy = pp.y - e.base;
    const sameFloor = Math.abs(dy) < 1.4;
    let mvx = 0, mvz = 0;
    if (d.ghost) {
      e.vis = Math.min(1, e.vis + dt * 1.5);
      const ty = pp.y + (d.fly ?? 1.2) + Math.sin(e.t * 2) * .15;
      e.base += clamp(pp.y - e.base, -dt * 1.5, dt * 1.5); m.position.y = e.base + (d.fly ?? 0) + Math.sin(e.t * 2.5) * .12;
      if (distH > .5) { mvx = dx / distH; mvz = dz / distH; }
      const mats = m.userData.mats; if (mats) for (const mt of mats) mt.opacity = (d.boss ? .9 : .75) * e.vis * (.75 + .25 * Math.sin(e.t * 6));
      if (d.teleport && e.abil <= 0 && distH > 3) { e.abil = 6 + Math.random() * 4; const a = player.yaw + Math.PI + (Math.random() - .5); m.position.x = pp.x - Math.sin(a) * 2.2; m.position.z = pp.z - Math.cos(a) * 2.2; e.base = pp.y; e.vis = .2; scare(0); }
      if (d.boss) {
        if (e.abil <= 0) { e.abil = 3.2; for (let i = 0; i < 3; i++) setTimeout(() => G.active && fireball(e), i * 250); }
        if (Math.floor(e.t) % 9 === 0 && !e.sumT) { e.sumT = 1; for (let i = 0; i < 2; i++) { const s = m.position.clone(); s.x += (Math.random() - .5) * 2; spawnEnemy('wisp', s); } setTimeout(() => e.sumT = 0, 1500); }
      }
    } else {
      // walkers / flyers (pests, jiangshi)
      const chase = sameFloor && distH < 14;
      e.wt -= dt; if (!chase && e.wt <= 0) { e.dir = Math.random() * 6.28; e.wt = 1.5 + Math.random() * 2.5; }
      if (chase && distH > .3) { mvx = dx / distH; mvz = dz / distH; } else { mvx = Math.sin(e.dir); mvz = Math.cos(e.dir); }
      if (d.hop) { const ph = (e.t * 2.2) % 1; if (ph > .5) { mvx = mvz = 0; } m.position.y = e.base + Math.sin(Math.min(ph, .5) * 2 * Math.PI) * .3 * (ph < .5 ? 1 : 0); }
      if (d.boss && e.abil <= 0) { e.abil = 7; for (let i = 0; i < 3; i++) spawnEnemy(d.summon, m.position.clone().add(new THREE.Vector3((Math.random() - .5) * 2, 0, (Math.random() - .5) * 2))); Snd.squish(); }
      if (m.userData.legs) m.userData.legs.rotation.y = Math.sin(e.t * 30) * .2;
      if (m.userData.wings) { const s = Math.sin(e.t * 60) * .6; m.userData.wings[0].rotation.z = s; m.userData.wings[1].rotation.z = -s; }
    }
    // move
    const step = e.spd * dt;
    if (mvx || mvz) {
      const nx = m.position.x + mvx * step, nz = m.position.z + mvz * step;
      if (d.ghost) { m.position.x = nx; m.position.z = nz; }
      else {
        const feet = e.base; let moved = false;
        if (!hits(nx, m.position.z, feet, Math.min(e.r, .3))) { m.position.x = nx; moved = true; }
        if (!hits(m.position.x, nz, feet, Math.min(e.r, .3))) { m.position.z = nz; moved = true; }
        if (!moved) { e.dir = Math.random() * 6.28; e.wt = 1; }
        const g = groundAt(m.position.x, m.position.z, feet + .1); if (g > -50) e.base += clamp(g - e.base, -dt * 6, dt * 6);
        if (d.fly) m.position.y = e.base + d.fly + Math.sin(e.t * 4) * .15; else if (!d.hop) m.position.y = e.base;
      }
      m.rotation.y = Math.atan2(mvx, mvz);
    }
    if (e.flash > 0) { e.flash -= dt; m.scale.setScalar(1 + e.flash); } else m.scale.setScalar(1);
    // attack player
    const reach = e.r + .55, d3 = Math.hypot(distH, (m.position.y - (pp.y + 1)) * (d.fly && !d.ghost ? 1 : .3));
    if (d3 < reach + (d.boss ? .6 : 0) && e.cool <= 0 && (sameFloor || d.ghost)) { e.cool = d.boss ? 1.2 : 1.3; hurtPlayer(e.dmg); }
    // jump scare when a ghost comes close in view
    if (d.ghost && !e.scared && distH < 3.2) { e.scared = true; const v = camFwd(), to = new THREE.Vector3(dx, 0, dz).normalize().negate(); if (v.x * to.x + v.z * to.z > .3) scare(0); }
  }
}
function fireball(e) {
  const m = new THREE.Group(); sp(m, .18, 0, 0, 0, M('#ff4a1a', { e: '#ff3300', ei: 2 })); scene.add(m);
  m.position.copy(e.mesh.position).add(new THREE.Vector3(0, 2.5, 0));
  const v = player.pos.clone().add(new THREE.Vector3(0, 1.2, 0)).sub(m.position).normalize().multiplyScalar(7);
  G.projs.push({ mesh: m, vel: v, w: { grav: 0, enemy: 1 }, dmg: 0, life: 4, enemyShot: e.dmg * .6 });
  Snd.tone(150, .4, 'sawtooth', .15, 60);
}
function updateEnemyShots() {
  for (const p of G.projs.slice()) {
    if (!p.enemyShot) continue;
    part(p.mesh.position, new THREE.Vector3(0, .3, 0), '#ff6a2a', .08, .3, 0, { glow: 1 });
    if (p.mesh.position.distanceTo(player.pos.clone().add(new THREE.Vector3(0, 1.1, 0))) < .5) { hurtPlayer(p.enemyShot); scene.remove(p.mesh); G.projs = G.projs.filter(x => x !== p); }
  }
}
function hurtPlayer(n) {
  if (G.paused) return;
  G.hp -= n * (1 - .08 * (G.prof.defLv || 0)); Snd.hurt(); fx.shake = Math.max(fx.shake, .5); vibrate(60);
  const f = $('#flash'); f.style.background = 'rgba(200,0,0,.45)'; f.style.opacity = 1; setTimeout(() => f.style.opacity = 0, 150);
  if (G.hp <= 0) { G.hp = 0; playerDie(); }
  updateHUD();
}

// ================= destruction collapse =================
function checkCollapse() {
  if (G.kind !== 'destroy' || G.collapse) return;
  const p = destructionProgress();
  if (p >= .8) {
    G.collapse = 1; banner('🏚 整棟房子要倒了！', '', 2000); Snd.boom(3); fx.shake = 2.5;
    const blocks = []; for (const im of H.blockMeshes) { const g = im.userData.grid; for (let i = 0; i < g.alive.length; i++) if (g.alive[i]) blocks.push([g, i]); }
    blocks.sort(() => Math.random() - .5);
    let k = 0; const iv = setInterval(() => { for (let n = 0; n < 40 && k < blocks.length; n++, k++) killBlock(...blocks[k]); fx.shake = 1.5; if (k % 120 === 0) Snd.boom(1); if (k >= blocks.length) { clearInterval(iv); collapseSlabs(); } }, 50);
    for (const e of H.breakables.slice()) setTimeout(() => damageAt(e.box.getCenter(new THREE.Vector3()), .5, 99999), Math.random() * 2500);
  }
}
function collapseSlabs() {
  const fallers = H.slabMeshes.filter(m => m.position.y > .5).concat(H.root.children.flatMap(g => g.children.filter(c => c.userData.roof)));
  for (const m of fallers) m.userData.vy = 0;
  G.fallers = fallers;
  setTimeout(() => {
    G.prof.money += 2000; saveProf(); updateHUD(); Snd.level();
    showDialog('🏚 整個家被你拆光了！', '獲得全毀獎金 $2000。要復原房子再拆一次嗎？', [['♻️ 復原房子', () => restoreHouse()], ['🛒 商店', () => openShop(false)], ['🏠 回主選單', () => on.escape && on.escape('menu')]]);
  }, 3500);
}
function updateFallers(dt) {
  if (!G.fallers) return;
  for (const m of G.fallers) { if (m.position.y <= .1) continue; m.userData.vy -= 9.8 * dt; m.position.y = Math.max(.1, m.position.y + m.userData.vy * dt); if (m.position.y <= .1) { burst(m.position, '#999', 10, 6, .3, 1.5); Snd.boom(.6); fx.shake = 1; } m.rotation.z += dt * .2; }
  H.cells = H.cells.filter(c => c.y < .5 || c.x0 < -50);
}
export function restoreHouse() {
  $('#dialog').classList.remove('show'); G.paused = false; G.collapse = 0; G.fallers = null;
  build(S.data, { destruct: true }); player.pos.set(2.9, 0, 2.4); player.vy = 0;
  banner('♻️ 房子復原了', '再拆一次吧！', 1600); updateHUD();
}

// ================= HUD / shop / dialogs =================
function updateHUD() {
  if (!G.active) return;
  $('#gmoney').textContent = '$' + G.prof.money;
  if (G.kind === 'destroy') {
    const p = destructionProgress(); $('#glevel').textContent = `破壞度 ${Math.floor(p * 100)}%`; $('#gleft').textContent = '';
    $('#hpbar').style.display = 'none'; $('#gextra').innerHTML = '<button id="gRestore">♻️ 復原</button><button id="gShop">🛒 商店</button>';
    $('#gRestore').onclick = () => restoreHouse(); $('#gShop').onclick = () => openShop(false);
  } else {
    $('#hpbar').style.display = 'block'; $('#hpfill').style.width = (G.hp / G.maxHp * 100) + '%'; $('#hptext').textContent = `${Math.ceil(G.hp)} / ${G.maxHp}`; $('#potions').textContent = `🧪 ×${G.prof.potions}`;
    $('#glevel').textContent = `第 ${G.level} 關`;
    const per = {}; for (const e of G.enemies) { const f = floorOf(e.base); per[f] = (per[f] || 0) + 1; }
    const fn = i => S.data.floors[i]?.name || i;
    $('#gleft').textContent = (G.kind === 'clean' ? '🪳 ' : '👻 ') + (G.enemies.length + (G.queue > 0 ? G.queue : 0)) + ' 隻' + (G.kind === 'clean' ? '　' + Object.entries(per).map(([f, n]) => `${fn(f)}:${n}`).join(' ') : '');
    $('#gextra').innerHTML = '';
  }
}
function renderWeaponBar() {
  const ids = Object.keys(G.prof.owned);
  $('#wbar').innerHTML = ids.map(id => `<button data-w="${id}" class="${id === G.prof.cur ? 'on' : ''}">${WEAPONS[id].icon}<small>${WEAPONS[id].n}${G.prof.owned[id] ? ' +' + G.prof.owned[id] : ''}</small></button>`).join('');
  $('#wbar').querySelectorAll('[data-w]').forEach(b => b.onclick = e => { e.stopPropagation(); equip(b.dataset.w); });
  $('#tbtns [data-act=attack]').textContent = W().icon;
}
export function openShop(betweenLevels, fromDeath) {
  G.paused = true; holding = false; beam.visible = false;
  const p = G.prof, list = Object.entries(WEAPONS).filter(([, w]) => w.g === G.kind);
  let h = `<h2>🛒 ${G.kind === 'clean' ? '清潔用品店' : G.kind === 'ghost' ? '廟口法器店' : '五金武器行'}</h2><div class="money">💰 $${p.money}</div><div class="items">`;
  for (const [id, w] of list) {
    const own = id in p.owned, lv = p.owned[id] || 0;
    h += `<div class="item ${p.cur === id ? 'cur' : ''}"><div class="ic">${w.icon}</div><div class="info"><b>${w.n}</b>${own ? ` <span class="lv">Lv${lv + 1}</span>` : ''}<small>傷害 ${Math.round(w.dmg * lvMult(lv))}${w.radius ? ' · 爆炸範圍 ' + w.radius + 'm' : ''} · ${{ melee: '近戰', proj: '投擲/發射', stream: '連射', cone: '噴灑', beam: '光束', nova: '範圍' }[w.kind]}</small></div>
      ${own ? `${lv < 5 ? `<button data-up="${id}">升級 $${upCost(w, lv)}</button>` : '<button disabled>滿級</button>'}${p.cur !== id ? `<button data-eq="${id}">裝備</button>` : ''}` : `<button data-buy="${id}">購買 $${w.price}</button>`}</div>`;
  }
  h += '</div>';
  if (G.kind !== 'destroy') {
    const hc = hpCost(p), sc = 200 * (p.spdLv + 1), dc = 180 * (p.defLv + 1), rc = 160 * (p.regLv + 1);
    h += `<h3 style="margin:12px 0 6px">💪 主角強化</h3><div class="items">
      <div class="item"><div class="ic">❤️</div><div class="info"><b>最大生命 +40</b><small>目前 ${maxHpOf(p)}（無上限，每關開始會補滿）</small></div><button data-hp>$${hc}</button></div>
      <div class="item"><div class="ic">🧪</div><div class="info"><b>補血藥水</b><small>回復 60% 生命，持有 ${p.potions}/9（按 H 或 🧪 使用）</small></div>${p.potions < 9 ? `<button data-pot>$${potCost()}</button>` : '<button disabled>已滿</button>'}</div>
      <div class="item"><div class="ic">🛡️</div><div class="info"><b>防禦 Lv${p.defLv}</b><small>受到傷害 -${p.defLv * 8}%（每級 -8%，最多 -48%）</small></div>${p.defLv < 6 ? `<button data-def>$${dc}</button>` : '<button disabled>滿級</button>'}</div>
      <div class="item"><div class="ic">💚</div><div class="info"><b>回血 Lv${p.regLv}</b><small>戰鬥中也會慢慢回血，脫離戰鬥回更快</small></div>${p.regLv < 6 ? `<button data-reg>$${rc}</button>` : '<button disabled>滿級</button>'}</div>
      <div class="item"><div class="ic">👟</div><div class="info"><b>移動速度 +8%</b><small>Lv${p.spdLv}</small></div>${p.spdLv < 6 ? `<button data-spd>$${sc}</button>` : '<button disabled>滿級</button>'}</div></div>`;
  }
  h += `<div class="rowb">${betweenLevels ? `<button class="go" data-next>▶ 第 ${G.prof.level} 關</button>` : fromDeath ? `<button class="go" data-retry>🔁 重新挑戰</button>` : `<button class="go" data-close>▶ 繼續</button>`}</div>`;
  const el = $('#shop'); el.innerHTML = `<div class="card">${h}</div>`; el.classList.add('show');
  const reopen = () => openShop(betweenLevels, fromDeath);
  el.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => { const id = b.dataset.buy, w = WEAPONS[id]; if (p.money < w.price) return toast('錢不夠喔'); p.money -= w.price; p.owned[id] = 0; p.cur = id; Snd.buy(); buildVM(id); renderWeaponBar(); saveProf(); reopen(); });
  el.querySelectorAll('[data-up]').forEach(b => b.onclick = () => { const id = b.dataset.up, c = upCost(WEAPONS[id], p.owned[id]); if (p.money < c) return toast('錢不夠喔'); p.money -= c; p.owned[id]++; Snd.buy(); renderWeaponBar(); saveProf(); reopen(); });
  el.querySelectorAll('[data-eq]').forEach(b => b.onclick = () => { equip(b.dataset.eq); reopen(); });
  const buyUp = (sel, cost, fn) => { const b = el.querySelector(sel); if (b) b.onclick = () => { const c = cost(); if (p.money < c) return toast('錢不夠喔'); p.money -= c; fn(); Snd.buy(); saveProf(); updateHUD(); reopen(); }; };
  buyUp('[data-hp]', () => hpCost(p), () => { p.hpLv++; G.maxHp = maxHpOf(p); G.hp = G.maxHp; });
  buyUp('[data-pot]', potCost, () => { p.potions++; });
  buyUp('[data-def]', () => 180 * (p.defLv + 1), () => { p.defLv++; });
  buyUp('[data-reg]', () => 160 * (p.regLv + 1), () => { p.regLv++; });
  const sd = el.querySelector('[data-spd]'); if (sd) sd.onclick = () => { const c = 200 * (p.spdLv + 1); if (p.money < c) return toast('錢不夠喔'); p.money -= c; p.spdLv++; player.speed = 2.4 * (1 + p.spdLv * .08); player.run = 4.4 * (1 + p.spdLv * .08); Snd.buy(); saveProf(); reopen(); };
  const close = () => { el.classList.remove('show'); G.paused = false; updateHUD(); };
  const nx = el.querySelector('[data-next]'); if (nx) nx.onclick = () => { close(); startLevel(G.prof.level); };
  const rt = el.querySelector('[data-retry]'); if (rt) rt.onclick = () => { close(); startLevel(G.level); };
  const cl = el.querySelector('[data-close]'); if (cl) cl.onclick = close;
}
function showDialog(title, text, btns) {
  const el = $('#dialog'); el.innerHTML = `<div class="card"><h2>${title}</h2><p>${text}</p><div class="rowb">${btns.map((b, i) => `<button data-i="${i}" class="${i === 0 ? 'go' : ''}">${b[0]}</button>`).join('')}</div></div>`;
  el.classList.add('show'); el.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { el.classList.remove('show'); btns[+b.dataset.i][1](); });
}
let bannerT;
function banner(t, s, ms) { const b = $('#banner'); b.innerHTML = `<b>${t}</b><span>${s}</span>`; b.classList.add('show'); clearTimeout(bannerT); bannerT = setTimeout(() => b.classList.remove('show'), ms); }
function floatText(t, pos) {
  const v = pos.clone().project(camera); if (v.z > 1) return;
  const el = document.createElement('div'); el.className = 'ftext'; el.textContent = t; el.style.left = ((v.x + 1) / 2 * innerWidth) + 'px'; el.style.top = ((1 - v.y) / 2 * innerHeight) + 'px';
  document.body.appendChild(el); setTimeout(() => el.remove(), 900);
}

// ================= main update =================
let hudT = 0, heartT = 0, ambT = 5;
export function updateGame(dt) {
  updateParts(dt);
  if (!G.active) return;
  if (G.paused) { updateFallers(dt); return; }
  G.t += dt; G.cool -= dt;
  if (holding && G.cool <= 0) { const w = W(); if (w.kind !== 'melee' || w.rate < .3) tryFire(); else if (w.kind === 'melee') tryFire(); }
  // view model swing
  const g = vm.userData.g; if (g) { swingT = Math.max(0, swingT - dt * 4); const k = Math.sin(swingT * Math.PI); g.rotation.x = (g.userData.bx ?? .1) - k * 1.4; g.rotation.z = -k * .6; g.position.y = Math.sin(G.t * 8) * .005; }
  updateProjs(dt); updateEnemyShots(); updateEnemies(dt); updateFallers(dt);
  if (G.kind !== 'destroy' && G.hp < G.maxHp && !G.enemies.some(e => e.mesh.position.distanceTo(player.pos) < 5)) G.hp = Math.min(G.maxHp, G.hp + dt * (2 + G.prof.regLv * 2.5));
  if (G.kind !== 'destroy' && G.prof.regLv && G.hp < G.maxHp) G.hp = Math.min(G.maxHp, G.hp + dt * G.prof.regLv * .6);
  updateHearts(dt);
  // ghost spawner
  if (G.kind === 'ghost') {
    G.spawnT -= dt;
    const maxAlive = 3 + Math.floor(G.level / 2);
    if (G.queue > 0 && G.spawnT <= 0 && G.enemies.filter(e => !e.d.boss).length < maxAlive) {
      G.spawnT = Math.max(1.2, 4 - G.level * .2) * (.6 + Math.random() * .8); G.queue--;
      const r = Math.random(), type = G.level >= 4 && r < .25 ? 'jiangshi' : G.level >= 2 && r < .55 ? 'lady' : 'wisp';
      const a = Math.random() * 6.28, dist = 3 + Math.random() * 3;
      let pos = new THREE.Vector3(player.pos.x + Math.sin(a) * dist, player.pos.y, player.pos.z + Math.cos(a) * dist);
      if (type === 'jiangshi') pos = randomSpot(floorOf(player.pos.y), 4);
      spawnEnemy(type, pos); Snd.ghostAppear();
      if (Math.random() < .5) { lightCfg.flicker = .4; G.scareT = .8; }
    }
    ambT -= dt; if (ambT <= 0) { ambT = 4 + Math.random() * 7; const r = Math.random(); if (r < .4) Snd.noise(1.5, .06, 400, 'bandpass', 200); else if (r < .7) Snd.tone(90 + Math.random() * 60, 1.2, 'sine', .08, 60); else { H.lamps.forEach(l => Math.random() < .3 && setLamp(l, !l.on)); } }
    const near = G.enemies.some(e => e.mesh.position.distanceTo(player.pos) < 5);
    heartT -= dt; if (near && heartT <= 0) { heartT = .9; Snd.heart(); }
    $('#vig').style.opacity = near ? 1 : .7;
  }
  if (G.scareT > 0) { G.scareT -= dt; if (G.scareT <= 0) { lightCfg.flicker = G.kind === 'ghost' ? .03 : 0; camera.fov = 72; camera.updateProjectionMatrix(); } else { camera.fov += (72 - camera.fov) * dt * 3; camera.updateProjectionMatrix(); } }
  // boss bar
  if (G.boss) $('#bossfill').style.width = (G.boss.hp / G.boss.max * 100) + '%';
  // nearest enemy arrow
  const arrow = $('#garrow');
  if (G.kind !== 'destroy' && G.enemies.length) {
    let best = null, bd = 1e9; for (const e of G.enemies) { const d = e.mesh.position.distanceTo(player.pos) + Math.abs(e.base - player.pos.y) * 3; if (d < bd) { bd = d; best = e; } }
    const dx = best.mesh.position.x - player.pos.x, dz = best.mesh.position.z - player.pos.z, ang = Math.atan2(dx, -dz) + player.yaw;
    const fd = floorOf(best.base) - floorOf(player.pos.y);
    arrow.style.display = 'block'; arrow.querySelector('i').style.transform = `rotate(${ang}rad)`; arrow.querySelector('span').textContent = `${Math.round(Math.hypot(dx, dz))}m${fd > 0 ? ' ⬆樓上' : fd < 0 ? ' ⬇樓下' : ''}`;
  } else arrow.style.display = 'none';
  hudT -= dt; if (hudT <= 0) { hudT = .25; updateHUD(); checkCollapse(); }
}
