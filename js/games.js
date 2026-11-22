// three games: 清潔大作戰 (pests), 驅鬼大師 (ghosts), 拆家狂人 (destruction)
import { THREE, S, $, scene, camera, M, bx, cy, sp, toast, clamp, DEG, isTouch, shade } from './core.js';
import { H, hits, groundAt, floorOf, FH, damageAt, lightCfg, setNight, hemi, amb, setLamp, floorY, build, destructionProgress, killBlock, entFi, allFl, zoneOf } from './house.js';
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
  // horror stingers
  jumpscare() { const c = this.ctx; if (!c) return; this.noise(1.2, .9, 4000, 'bandpass', 600); for (let i = 0; i < 5; i++) this.tone(300 + i * 113, 1.2, 'sawtooth', .22, 900 + i * 210); this.tone(55, 1.0, 'square', .5, 30); },
  stinger() { [0, 1, 2].forEach(i => this.tone(1200 + i * 66, 1.6, 'sawtooth', .07, 600 + i * 40, i * .02)); this.tone(70, 1.5, 'sine', .4, 40); },
  whisper() { for (let i = 0; i < 6; i++) setTimeout(() => this.noise(.25 + Math.random() * .3, .07, 2500 + Math.random() * 2500, 'bandpass', 1500), i * 230); },
  giggle(pan = 0, vol = .2) {
    const c = this.ctx; if (!c) return; const pn = c.createStereoPanner ? c.createStereoPanner() : null; const out = pn || this.master; if (pn) { pn.pan.value = Math.max(-1, Math.min(1, pan)); pn.connect(this.master); }
    const n = 4 + Math.floor(Math.random() * 3), b = 900 + Math.random() * 300;
    for (let i = 0; i < n; i++) { const t = c.currentTime + i * .11, o = c.createOscillator(), g = c.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(b * (1 + (i % 2) * .25), t); o.frequency.exponentialRampToValueAtTime(b * .7, t + .09); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + .1); o.connect(g); g.connect(out); o.start(t); o.stop(t + .12); }
  },
  gun() { this.noise(.09, .5, 3000, 'lowpass', 300); this.tone(220, .08, 'square', .15, 80); },
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
  stick: { g: 'adv', n: '木棍', icon: '🪵', kind: 'melee', dmg: 30, range: 2.1, rate: .4, price: 0 },
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
  pistol: { g: 'hide', n: '玩具手槍', icon: '🔫', kind: 'hitscan', dmg: 1, rate: .3, price: 0 },
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
    case 'stick': { const s = cy(g, .025, .03, .8, 0, -.3, 0, M('#7a5230', { r: .9 })); s.rotation.x = -.3; } break;
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
    case 'pistol': bx(g, .05, .09, .26, 0, 0, -.04, M('#e85a9a', { r: .4 })); bx(g, .045, .14, .06, 0, -.1, .06, M('#333')); cy(g, .018, .018, .08, 0, .01, -.2, M('#ffd23a'), 8).rotation.x = Math.PI / 2; break;
  }
  const bx0 = { broom: -.7, mugwort: -.6, hammer: -.3, chainsaw: 0, stick: -.5 }[id] ?? .1;
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
  smiler: { n: '後室笑臉', hp: 150, spd: 2.1, dmg: 14, r: .35, money: 45, build: smiler },
  hound: { n: '黑影獵犬', hp: 90, spd: 3.3, dmg: 9, r: .4, money: 30, build: hound },
  ghostKing: { n: '鬼王', hp: 2600, spd: 1.4, dmg: 26, r: 1.1, fly: .2, ghost: 1, boss: 1, summon: 'wisp', fireball: 1, money: 1200, build: ghostKing },
};
function smiler() {
  const root = new THREE.Group(), g = new THREE.Group(), dark = M('#050505', { r: 1 }); g.scale.setScalar(.62); root.add(g);
  const b = sp(g, .55, 0, 1.25, 0, dark); b.scale.set(.9, 1.3, .8);
  for (const sd of [-1, 1]) sp(g, .07, sd * .17, 1.55, .4, M('#ffffff', { e: '#ffffff', ei: 2 }));
  for (let i = 0; i < 9; i++) { const a = (i / 8 - .5) * 2.2; bx(g, .06, .07, .03, Math.sin(a) * .28, 1.18 - Math.cos(a) * .1, .42, M('#ffffff', { e: '#ffffff', ei: 1.6 })); }
  for (const sd of [-1, 1]) { const a = bx(g, .08, .9, .08, sd * .5, .35, .05, dark); a.rotation.z = sd * .15; }
  return root;
}
function hound() {
  const g = new THREE.Group(), m = M('#111114', { r: .9 });
  const b = sp(g, .3, 0, .55, 0, m); b.scale.set(.8, .7, 1.6); sp(g, .2, 0, .72, .48, m);
  for (const sd of [-1, 1]) sp(g, .04, sd * .08, .78, .64, M('#ff2a1a', { e: '#ff2a1a', ei: 2 }));
  const legs = new THREE.Group(); g.add(legs); for (const [x, z] of [[-.15, .3], [.15, .3], [-.15, -.3], [.15, -.3]]) bx(legs, .07, .45, .07, x, 0, z, m);
  g.userData.legs = legs; return g;
}
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
const DEF_W = { clean: 'broom', ghost: 'mugwort', destroy: 'hammer', adventure: 'stick', hide: 'pistol' };
function loadProf(kind) {
  let p; try { p = JSON.parse(localStorage.getItem(PROF_KEY(kind))); } catch (e) { }
  if (!p) p = { money: kind === 'destroy' ? 200 : 0, owned: { [DEF_W[kind]]: 0 }, cur: DEF_W[kind], level: 1, hpLv: 0, spdLv: 0, defLv: 0, regLv: 0, potions: 2, best: 0 };
  return p;
}
const maxHpOf = p => 100 + (p.hpLv || 0) * 40;
const hpCost = p => 120 + 110 * (p.hpLv || 0);
const potCost = () => 60;
export function usePotion() {
  if (G.kind === 'hide' && G.active) return hideHint();
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
const curDmg = () => W().dmg * lvMult(G.prof.owned[G.prof.cur] || 0) * (G.buffs?.power > 0 ? 2 : 1);

let flashlight = null, worldTargets = [];
export function startGame(kind, data, opts = {}) {
  Snd.init();
  stopGame(true);
  G.kind = kind; G.active = true; G.paused = false; G.prof = loadProf(kind); G.t = 0; G.collapse = 0;
  build(data, { destruct: kind === 'destroy' });
  worldTargets = kind === 'destroy' ? null : [...H.wallMeshes, ...H.slabMeshes];
  const pf = G.prof; pf.defLv ??= 0; pf.regLv ??= 0; pf.potions ??= 2;
  G.maxHp = maxHpOf(pf); G.hp = G.maxHp; clearHearts(); player.speed = 2.4 * (1 + G.prof.spdLv * .08); player.run = 4.4 * (1 + G.prof.spdLv * .08);
  G.buffs = { speed: 0, power: 0, shield: 0 }; G.session = (G.session || 0) + 1; G.evT = 25; G.auto = !!opts.auto;
  vm.visible = true; buildVM(G.prof.cur);
  $('#ghud').classList.add('show'); $('#ghud').dataset.kind = kind; document.body.dataset.kind = kind;
  if (kind === 'ghost') {
    setNight(true); lightCfg.intensity = 3; lightCfg.flicker = .03; H.lamps.forEach(l => setLamp(l, Math.random() < .5));
    scene.fog = new THREE.FogExp2('#000000', .09);
    if (!flashlight) { flashlight = new THREE.SpotLight('#fff6d8', 0, 18, .45, .5, 1.2); camera.add(flashlight); camera.add(flashlight.target); flashlight.position.set(.2, -.1, 0); flashlight.target.position.set(0, 0, -5); }
    flashlight.intensity = 25; $('#vig').classList.add('show'); Snd.droneOn(); lightCfg.lockFog = true;
  } else { setNight(false); lightCfg.intensity = 8; lightCfg.flicker = 0; scene.fog = null; }
  renderWeaponBar();
  if (kind === 'destroy') { banner('🔨 拆家狂人', '盡情破壞！賺錢買更強的武器，把整個家拆光', 2600); updateHUD(); }
  else if (kind === 'adventure') { startAdventure(); }
  else if (kind === 'hide') startHide(G.prof.level || 1);
  else startLevel(G.prof.level);
}
export function stopGame(silent) {
  if (!G.active) return;
  G.active = false; clearHearts(); for (const e of G.enemies) scene.remove(e.mesh); G.enemies = []; for (const p of G.projs) scene.remove(p.mesh); G.projs = [];
  vm.visible = false; beam.visible = false; $('#ghud').classList.remove('show'); $('#shop').classList.remove('show'); $('#banner').classList.remove('show'); $('#vig').classList.remove('show');
  clearAdventure(); clearHide(); lightCfg.lockFog = false; $('#gextra').innerHTML = ''; $('#dialog').classList.remove('show');
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
  const e = { type, d, mesh, hp: d.hp * sc, max: d.hp * sc, spd: d.spd * Math.min(1.6, 1 + .035 * (L - 1)), dmg: d.dmg * (1 + .1 * (L - 1)), r: d.r, cool: 0, dir: Math.random() * 6.28, wt: 0, t: Math.random() * 10, abil: 3 + Math.random() * 3, vis: d.ghost ? 0 : 1, y: pos.y, base: pos.y, sc: 1, home: pos.clone() };
  G.enemies.push(e); if (d.boss) { G.boss = e; $('#bossbar').classList.add('show'); $('#bossname').textContent = d.n; }
  return e;
}
// abnormally big monster: slower, much tougher, hits harder
function makeGiant(e, s = 1.8 + Math.random() * .8) {
  e.sc = s; e.hp = e.max = e.max * s * s * .8; e.dmg *= 1.6; e.spd *= .85; e.r *= Math.min(s, 1.6); e.giant = 1; e.mesh.scale.setScalar(s); return e;
}
// how tense this level is: giants, swarms and events get likelier as the levels go up
const giantChance = L => L < 2 ? 0 : Math.min(.28, .03 * (L - 1));
function startLevel(L) {
  G.level = L; for (const e of G.enemies) scene.remove(e.mesh); G.enemies = []; G.boss = null; $('#bossbar').classList.remove('show');
  G.hp = G.maxHp; G.evT = Math.max(12, 32 - L * 2.5);
  const nF = S.data.floors.length;
  if (G.kind === 'clean') {
    const boss = L % 5 === 0, n = boss ? 4 + L : 6 + L * 3;
    for (let i = 0; i < n; i++) {
      const r = Math.random(); const type = L >= 3 && r < .2 ? 'rat' : L >= 2 && r < .5 ? 'mosquito' : 'roach';
      const e = spawnEnemy(type, randomSpot(Math.floor(Math.random() * nF))); if (Math.random() < giantChance(L)) makeGiant(e);
    }
    if (L >= 4 && Math.random() < .35) { const k = 6 + L * 2; for (let i = 0; i < k; i++) spawnEnemy('roach', randomSpot(floorOf(player.pos.y), 4)); setTimeout(() => G.active && banner('⚠️ 異常', `蟑螂大量出沒！多了 ${k} 隻`, 2200), 2400); }
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
  if (G.kind === 'adventure') return showDialog('💀 你倒下了', '金錢和武器都保留，回到大門口重新出發。', [['🔁 復活', () => { G.paused = false; G.hp = G.maxHp; player.pos.set(2.9, 0, 2.4); player.vy = 0; updateHUD(); }], ['🛒 商店', () => { G.hp = G.maxHp; player.pos.set(2.9, 0, 2.4); openShop(false); }], ['🏠 回主選單', () => on.escape && on.escape('menu')]]);
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
  if (w.kind === 'hitscan') return hideShoot();
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
  if (e.dead || !e.mesh.visible) return; e.hp -= dmg; e.flash = .12; e.aggro = true;
  if (dir && !e.d.boss) e.mesh.position.addScaledVector(dir.clone().setY(0).normalize(), quiet ? .01 : .25);
  if (!quiet) burst(e.mesh.position.clone().add(new THREE.Vector3(0, .3, 0)), e.d.ghost ? '#cfe8ff' : '#7a5a2a', 4, 3, .06, .5);
  if (e.hp <= 0) killEnemy(e);
}
function killEnemy(e) {
  e.dead = true; scene.remove(e.mesh); G.enemies = G.enemies.filter(x => x !== e);
  const pos = e.mesh.position.clone().add(new THREE.Vector3(0, .3, 0));
  if (e.d.ghost) { burst(pos, '#e8f6ff', 18, 4, .1, 1.2, -1.5, { glow: 1 }); Snd.tone(600, .5, 'sine', .2, 1500); }
  else { burst(pos, '#6b8a2a', 10, 3, .08, .8); Snd.squish(); }
  const m = Math.round(e.d.money * (1 + .1 * (G.level - 1)) * (e.giant ? 4 : 1)); earn(m); floatText(`+$${m}`, pos);
  if (e.giant) { dropHeart(pos); fx.shake = Math.max(fx.shake, .8); }
  if (e.temp) return;
  if (e.d.boss) for (let i = 0; i < 3; i++) dropHeart(pos.clone().add(new THREE.Vector3((Math.random() - .5) * 2, 0, (Math.random() - .5) * 2)));
  else if (Math.random() < .14) dropHeart(pos);
  if (e.adv) { const ses = G.session, m0 = e.adv; if (e === G.boss) { G.boss = null; $('#bossbar').classList.remove('show'); } if (m0.respawn > 0) setTimeout(() => { if (G.active && G.session === ses) spawnAdv(m0); }, m0.respawn * 1000); return; }
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
    if (e.adv?.mode === 'scare') { updateScarer(e, dt, distH, sameFloor); continue; }
    let mvx = 0, mvz = 0, advChase = true;
    if (e.adv) { const rg = e.adv.range || 10; advChase = sameFloor && (e.adv.mode === 'active' ? distH < rg : e.aggro && distH < rg * 2.5); if (!advChase && e.aggro && distH > rg * 2.5) e.aggro = false; }
    if (!advChase) {
      e.wt -= dt; if (e.wt <= 0) { e.dir = Math.random() * 6.28; e.wt = 1.5 + Math.random() * 2.5; }
      const hx = e.home.x - m.position.x, hz = e.home.z - m.position.z; if (Math.hypot(hx, hz) > 4) e.dir = Math.atan2(hx, hz);
      mvx = Math.sin(e.dir) * .4; mvz = Math.cos(e.dir) * .4;
      if (d.ghost) { m.position.y = e.base + (d.fly ?? 0) + Math.sin(e.t * 2.5) * .12; const mats = m.userData.mats; if (mats) for (const mt of mats) mt.opacity = .7; }
      if (m.userData.legs) m.userData.legs.rotation.y = Math.sin(e.t * 15) * .2;
    } else if (d.ghost) {
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
    if (e.flash > 0) { e.flash -= dt; m.scale.setScalar(e.sc * (1 + e.flash)); } else m.scale.setScalar(e.sc);
    // attack player
    const reach = e.r + .55, d3 = Math.hypot(distH, (m.position.y - (pp.y + 1)) * (d.fly && !d.ghost ? 1 : .3));
    if (advChase && d3 < reach + (d.boss ? .6 : 0) && e.cool <= 0 && (sameFloor || d.ghost)) { e.cool = d.boss ? 1.2 : 1.3; hurtPlayer(e.dmg); }
    // jump scare when a ghost comes close in view
    if (advChase && d.ghost && !e.scared && distH < 3.2) { e.scared = true; const v = camFwd(), to = new THREE.Vector3(dx, 0, dz).normalize().negate(); if (v.x * to.x + v.z * to.z > .3) scare(0); }
  }
}
// 嚇人: stands still and waits; when you come close it rushes into your face with a scream, then vanishes for a while
const tmpS = new THREE.Vector3();
function updateScarer(e, dt, distH, sameFloor) {
  const m = e.mesh;
  if (e.hgt == null) { const b = new THREE.Box3().setFromObject(m); e.hgt = Math.max(.3, (b.max.y - b.min.y) / (m.scale.y || 1)); }
  if (e.jump > 0) {
    e.jump -= dt; const f = camFwd(), cp = camera.getWorldPosition(tmpS), s = 1.7 / e.hgt, k = 1 - Math.max(0, e.jump - 1.1) / .25;
    m.scale.setScalar(s * (1 + Math.sin(e.t * 40) * .03)); m.visible = true;
    m.position.set(cp.x + f.x * (.95 + (1 - k) * 2), cp.y - 1.22 + Math.sin(e.t * 30) * .02, cp.z + f.z * (.95 + (1 - k) * 2));
    m.rotation.y = Math.atan2(cp.x - m.position.x, cp.z - m.position.z);
    if (e.jump <= 0) { m.visible = false; e.cd = 14 + Math.random() * 10; m.scale.setScalar(e.sc); }
    return;
  }
  if (e.cd > 0) { e.cd -= dt; m.visible = false; if (e.cd <= 0) { m.position.copy(e.home); m.visible = true; } return; }
  m.position.y = e.base; m.rotation.y = Math.atan2(player.pos.x - m.position.x, player.pos.z - m.position.z) + Math.sin(e.t * .7) * .3;
  if (m.userData.legs) m.userData.legs.rotation.y = 0;
  if (sameFloor && distH < (e.adv.range || 4)) {
    e.jump = 1.35; Snd.jumpscare(); scare(1); vibrate([400, 60, 400]);
    const fl = $('#flash'); fl.style.background = 'rgba(0,0,0,.9)'; fl.style.opacity = 1; setTimeout(() => fl.style.opacity = 0, 60);
    if (e.dmg > 0) setTimeout(() => G.active && hurtPlayer(e.dmg * .8), 250);
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
  if (G.buffs?.shield > 0) { Snd.tone(1200, .08, 'triangle', .1); return; }
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
  } else if (G.kind === 'hide') {
    $('#hpbar').style.display = 'none'; const t = Math.max(0, Math.ceil(HD.time));
    $('#glevel').textContent = `👤 捉迷藏 第 ${G.level} 關`;
    $('#gleft').textContent = `找到 ${HD.found}/${HD.figs.length}　⏱ ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    if (!$('#gHint')) { $('#gextra').innerHTML = '<button id="gHint">📡 提示</button>'; $('#gHint').onclick = () => hideHint(); }
    $('#gHint').textContent = `📡 提示 ×${HD.hints}`;
  } else if (G.kind === 'adventure') {
    $('#hpbar').style.display = 'block'; $('#hpfill').style.width = (G.hp / G.maxHp * 100) + '%'; $('#hptext').textContent = `${Math.ceil(G.hp)} / ${G.maxHp}`; $('#potions').textContent = `🧪 ×${G.prof.potions}`;
    const b = G.buffs, fi = floorOf(player.pos.y), near = G.enemies.filter(e => floorOf(e.base) === fi).length;
    $('#glevel').textContent = '🗝 探險 · ' + (allFl()[fi]?.name || '');
    $('#gleft').textContent = `👾 ${near}　🎁 ${chests.filter(c => !c.open && c.fi === fi).length}` + (b.speed > 0 ? `　👟${Math.ceil(b.speed)}s` : '') + (b.power > 0 ? `　💪${Math.ceil(b.power)}s` : '') + (b.shield > 0 ? `　🛡️${Math.ceil(b.shield)}s` : '');
    if (!$('#gShop')) { $('#gextra').innerHTML = '<button id="gShop">🛒 商店</button>'; $('#gShop').onclick = () => openShop(false); }
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
  const p = G.prof, list = Object.entries(WEAPONS).filter(([id, w]) => G.kind === 'adventure' ? (w.g !== 'destroy' || ['katana', 'grenade', 'cannon', 'rocket'].includes(id)) : w.g === G.kind);
  let h = `<h2>🛒 ${G.kind === 'clean' ? '清潔用品店' : G.kind === 'ghost' ? '廟口法器店' : G.kind === 'adventure' ? '冒險者商店' : '五金武器行'}</h2><div class="money">💰 $${p.money}</div><div class="items">`;
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
  if (G.kind !== 'destroy' && G.kind !== 'hide' && G.hp < G.maxHp && !G.enemies.some(e => e.mesh.position.distanceTo(player.pos) < 5)) G.hp = Math.min(G.maxHp, G.hp + dt * (2 + G.prof.regLv * 2.5));
  if (G.kind !== 'destroy' && G.prof.regLv && G.hp < G.maxHp) G.hp = Math.min(G.maxHp, G.hp + dt * G.prof.regLv * .6);
  updateHearts(dt);
  if (G.kind === 'adventure') updateAdventure(dt);
  if (G.kind === 'hide') updateHide(dt);
  if ((G.kind === 'clean' || G.kind === 'ghost') && G.level >= 2) horrorEvents(dt, G.level);
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
      const ne = spawnEnemy(type, pos); if (Math.random() < giantChance(G.level)) { makeGiant(ne); Snd.stinger(); } Snd.ghostAppear();
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
  if (G.kind !== 'destroy' && G.kind !== 'adventure' && G.kind !== 'hide' && G.enemies.length) {
    let best = null, bd = 1e9; for (const e of G.enemies) { const d = e.mesh.position.distanceTo(player.pos) + Math.abs(e.base - player.pos.y) * 3; if (d < bd) { bd = d; best = e; } }
    const dx = best.mesh.position.x - player.pos.x, dz = best.mesh.position.z - player.pos.z, ang = Math.atan2(dx, -dz) + player.yaw;
    const fd = floorOf(best.base) - floorOf(player.pos.y);
    arrow.style.display = 'block'; arrow.querySelector('i').style.transform = `rotate(${ang}rad)`; arrow.querySelector('span').textContent = `${Math.round(Math.hypot(dx, dz))}m${fd > 0 ? ' ⬆樓上' : fd < 0 ? ' ⬇樓下' : ''}`;
  } else arrow.style.display = 'none';
  hudT -= dt; if (hudT <= 0) { hudT = .25; updateHUD(); checkCollapse(); }
}

// ================= horror events: the further you get, the more often something goes wrong =================
function behindPlayer(dist = 4) {
  const f = camFwd(); for (let i = 0; i < 12; i++) { const a = Math.atan2(-f.x, -f.z) + (Math.random() - .5) * 1.6, x = player.pos.x + Math.sin(a) * dist, z = player.pos.z + Math.cos(a) * dist; if (!hits(x, z, player.pos.y, .35, true) && groundAt(x, z, player.pos.y + .3) > player.pos.y - .5) return new THREE.Vector3(x, player.pos.y, z); dist *= .85; }
  return null;
}
function horrorEvents(dt, L, zone) {
  G.evT -= dt; if (G.evT > 0) return;
  G.evT = Math.max(9, 34 - L * 2.5) * (.7 + Math.random() * .6);
  const kinds = ['whisper', 'blackout']; if (L >= 3) kinds.push('giant', 'giant'); if (L >= 4) kinds.push('swarm'); if (L >= 5) kinds.push('face', 'blackout');
  const ev = kinds[Math.floor(Math.random() * kinds.length)];
  const pestType = G.kind === 'clean' ? (L >= 3 ? 'rat' : 'roach') : G.kind === 'ghost' ? (L >= 4 ? 'jiangshi' : 'lady') : 'hound';
  if (ev === 'whisper') { Snd.whisper(); lightCfg.flicker = .35; G.scareT = 1.2; }
  else if (ev === 'blackout') {
    const was = H.lamps.map(l => l.on); H.lamps.forEach(l => setLamp(l, false)); const oi = lightCfg.intensity; lightCfg.intensity = oi * .25; Snd.tone(60, 2.5, 'sawtooth', .12, 35); banner('💡 停電了…', '', 1500);
    const ses = G.session; setTimeout(() => { if (!G.active || G.session !== ses) return; lightCfg.intensity = oi; H.lamps.forEach((l, i) => setLamp(l, was[i])); }, 4000 + Math.random() * 2500);
    if (L >= 4) { const p = behindPlayer(3); if (p) { const e = spawnEnemy(pestType, p); e.temp = !!zone; } }
  } else if (ev === 'giant') {
    const p = behindPlayer(5); if (!p) return; const e = makeGiant(spawnEnemy(pestType, p), 2.2 + Math.random() * .8 + L * .05); e.temp = !!zone; if (e.adv == null && zone) e.home = p.clone();
    Snd.stinger(); fx.shake = .6; banner('⚠️ 異常巨大的東西出現了', '在你後面…', 2000);
  } else if (ev === 'swarm') {
    const n = 5 + L, t = G.kind === 'clean' ? 'roach' : G.kind === 'ghost' ? 'wisp' : 'hound';
    for (let i = 0; i < n; i++) { const p = behindPlayer(3 + Math.random() * 3); if (p) { const e = spawnEnemy(t, p); e.temp = !!zone; } }
    Snd.whisper(); banner('⚠️ 異常大量', `${n} 隻同時出現！`, 1800);
  } else if (ev === 'face') {
    const e = spawnEnemy(zone ? 'smiler' : G.kind === 'ghost' ? 'lady' : 'smiler', player.pos.clone()); e.temp = true; e.adv = { mode: 'scare', range: 99, dmg: 0 }; e.dmg = 0; updateScarer(e, 0, 0, true);
    const ses = G.session; setTimeout(() => { if (G.session === ses && !e.dead) { e.dead = true; scene.remove(e.mesh); G.enemies = G.enemies.filter(x => x !== e); } }, 1500);
  }
}

// ================= pause: continue / save / restart =================
export function openPause() {
  if (!G.active || $('#shop').classList.contains('show') || $('#dialog').classList.contains('show')) return;
  G.paused = true; holding = false; beam.visible = false;
  const name = { clean: '🪳 清潔大作戰', ghost: '👻 驅鬼大師', destroy: '🔨 拆家狂人', adventure: '🗝 探險模式', hide: '👤 捉迷藏' }[G.kind];
  const info = G.kind === 'destroy' ? `💰 $${G.prof.money}` : G.kind === 'adventure' ? `💰 $${G.prof.money}` : `第 ${G.level} 關 · 💰 $${G.prof.money}`;
  showDialog('⏸ 暫停 · ' + name, info + '<br><small>進度會自動存檔，也可以手動存檔。</small>', [
    ['▶ 繼續', () => { G.paused = false; }],
    ['💾 存檔', () => { saveProf(); toast('💾 已存檔'); G.paused = false; }],
    ['🔁 重新開始', () => showDialog('確定重新開始？', '這個遊戲的金錢、武器和關卡都會清空，從第 1 關開始。', [['🔁 確定重新開始', () => restartGame()], ['取消', () => { G.paused = false; }]])],
    ['🏠 回主選單', () => on.escape && on.escape('menu')]]);
}
export function restartGame(kind = G.kind) {
  const auto = G.auto; stopGame(true); try { localStorage.removeItem(PROF_KEY(kind)); } catch (e) { }
  startGame(kind, S.data, { auto }); toast('🔁 重新開始');
}
export { showDialog };

// ================= 捉迷藏: camouflaged little white people hidden all over the house =================
const HD = { figs: [], t: 0, time: 0, hints: 3, intro: 0, moveT: 20, found: 0, over: false };
const figGeo = { body: new THREE.CapsuleGeometry(.17, .38, 4, 10), head: new THREE.SphereGeometry(.15, 14, 10), limb: new THREE.CapsuleGeometry(.055, .3, 3, 6) };
const texAvg = {};
function avgColor(tex) {
  if (!tex?.image) return null; const k = tex.uuid; if (texAvg[k]) return texAvg[k];
  try { const c = document.createElement('canvas'); c.width = c.height = 8; const x = c.getContext('2d'); x.drawImage(tex.image, 0, 0, 8, 8); const d = x.getImageData(0, 0, 8, 8).data; let r = 0, g = 0, b = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; } return texAvg[k] = new THREE.Color(r / 16320, g / 16320, b / 16320).convertSRGBToLinear(); } catch (e) { return null; }
}
function makeFig(h) {
  const g = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .8 });
  const body = new THREE.Mesh(figGeo.body, mat); body.position.y = .55; g.add(body);
  const head = new THREE.Mesh(figGeo.head, mat); head.position.y = 1.0; g.add(head);
  for (const sx of [-1, 1]) { const a = new THREE.Mesh(figGeo.limb, mat); a.position.set(sx * .24, .62, 0); a.rotation.z = sx * .25; g.add(a); const l = new THREE.Mesh(figGeo.limb, mat); l.position.set(sx * .09, .2, 0); g.add(l); }
  g.scale.setScalar(h / 1.15); g.userData.mat = mat; g.traverse(o => { if (o.isMesh) o.userData.fig = g; }); return g;
}
function camoTargets() { return [...H.wallMeshes, ...H.furn.filter(e => !e.dead).map(e => e.obj), ...H.slabMeshes]; }
const hray = new THREE.Raycaster();
// find a hiding place: right against a wall or a piece of furniture, coloured (and textured) like that surface
function hidingSpot(L) {
  const nF = S.data.floors.length, objs = camoTargets();
  for (let k = 0; k < 40; k++) {
    const fi = Math.floor(Math.random() * nF), p = randomSpot(fi, 6), a = Math.random() * 6.28;
    hray.set(new THREE.Vector3(p.x, p.y + .5, p.z), new THREE.Vector3(Math.sin(a), 0, Math.cos(a))); hray.far = 3;
    const hit = hray.intersectObjects(objs, true)[0]; if (!hit || !hit.face) continue;
    const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld); if (Math.abs(n.y) > .4) continue; n.y = 0; n.normalize();
    const mats = Array.isArray(hit.object.material) ? hit.object.material : [hit.object.material], mat = mats[hit.face.materialIndex] || mats[0];
    if (!mat || !mat.color) continue;
    const pos = hit.point.clone().addScaledVector(n, .2); pos.y = groundAt(pos.x, pos.z, p.y + .5); if (pos.y < p.y - .3 || hits(pos.x, pos.z, pos.y, .12, true)) continue;
    if (HD.figs.some(f => f.g.position.distanceTo(pos) < 1.5)) continue;
    return { pos, n, mat };
  }
  return null;
}
function camoFig(f, L, keepWhite) {
  const sp_ = f.spot, mt = f.g.userData.mat, jitter = Math.max(.012, .1 - L * .012) * (Math.random() < .5 ? -1 : 1);
  f.camo = sp_.mat.color.clone(); if (!sp_.mat.map) { const hsl = {}; f.camo.getHSL(hsl); f.camo.setHSL(hsl.h, hsl.s, clamp(hsl.l + jitter, 0, 1)); }
  else f.camo.multiplyScalar(1 + jitter * 2);
  f.map = sp_.mat.map || null; f.rough = sp_.mat.roughness ?? .8;
  if (!keepWhite) { mt.map = f.map; mt.color.copy(f.camo); mt.roughness = f.rough; mt.needsUpdate = true; }
}
function placeFig(f, L) {
  const sp_ = hidingSpot(L); if (!sp_) return false; f.spot = sp_;
  const g = f.g; g.position.copy(sp_.pos); g.rotation.set(0, Math.atan2(sp_.n.x, sp_.n.z), 0);
  const pose = Math.random(); f.pose = pose < .45 ? 'stand' : pose < .8 ? 'crouch' : 'lie';
  g.children.forEach(c => c.rotation.x = 0);
  if (f.pose === 'crouch') { g.scale.set(f.s, f.s * .62, f.s); }
  else if (f.pose === 'lie') { g.scale.setScalar(f.s); g.rotation.x = -Math.PI / 2; g.position.y += .18 * f.s; g.position.addScaledVector(sp_.n, .2); }
  else g.scale.setScalar(f.s);
  return true;
}
function clearHide() { for (const f of HD.figs) scene.remove(f.g); HD.figs = []; HD.over = false; }
function startHide(L) {
  clearHide(); G.level = L; HD.over = false; G.enemies = [];
  const n = Math.min(26, 5 + L * 2); HD.hints = 3; HD.found = 0; HD.intro = 3.2; HD.moveT = 22; HD.t = 0;
  HD.time = Math.round(80 + n * 11 - Math.min(40, L * 4));
  for (let i = 0; i < n; i++) { const s0 = (.55 + Math.random() * .45) * (L >= 4 && Math.random() < .2 ? .6 : 1); const f = { g: makeFig(1.15), s: s0 / 1.15 * 1.15, found: false }; if (!placeFig(f, L)) continue; camoFig(f, L, true); scene.add(f.g); HD.figs.push(f); }
  setNight(false); lightCfg.intensity = L >= 5 ? 5.5 : 8; lightCfg.flicker = 0;
  $('#hpbar').style.display = 'none';
  banner(`👤 捉迷藏 第 ${L} 關`, `${HD.figs.length} 個白色小人正在躲起來…看仔細，用槍射中他們！`, 3000);
  Snd.giggle(0, .25); setTimeout(() => G.active && Snd.giggle(-.6, .18), 500); setTimeout(() => G.active && Snd.giggle(.7, .18), 900);
  updateHUD();
}
function figHitTest() {
  const origin = camera.getWorldPosition(new THREE.Vector3()), dir = camFwd().clone(); hray.set(origin, dir); hray.far = 60;
  const figMeshes = HD.figs.filter(f => !f.found).flatMap(f => f.g.children);
  return hray.intersectObjects([...figMeshes, ...camoTargets()], true)[0];
}
function hideShoot() {
  if (HD.intro > 0 || HD.over) return;
  Snd.gun(); fx.kick = .06; swingT = .4;
  const hit = figHitTest(); if (!hit) return;
  const fg = hit.object.userData.fig, f = fg && HD.figs.find(x => x.g === fg);
  if (f) {
    f.found = true; HD.found++; const mt = f.g.userData.mat; mt.map = null; mt.color.set('#ffffff'); mt.emissive = new THREE.Color('#ffffff'); mt.emissiveIntensity = .6; mt.needsUpdate = true; f.pop = 0;
    burst(hit.point, '#ffffff', 22, 3, .07, 1, 2, { glow: 1 }); Snd.giggle(0, .3); Snd.coin(); HD.time += 6; floatText('找到了！+6秒', hit.point);
    G.prof.money = (G.prof.money || 0) + 10 * G.level; vibrate(40);
    if (HD.found >= HD.figs.length) hideWin();
  } else {
    burst(hit.point, '#ffe680', 5, 2, .04, .4); HD.time = Math.max(0, HD.time - 3); floatText('-3秒', hit.point); Snd.tone(160, .08, 'square', .06);
  }
  updateHUD();
}
function hideHint() {
  if (HD.over || HD.intro > 0) return; if (HD.hints <= 0) return toast('提示用完了');
  const left = HD.figs.filter(f => !f.found).sort((a, b) => a.g.position.distanceTo(player.pos) - b.g.position.distanceTo(player.pos)); if (!left.length) return;
  HD.hints--; const f = left[0]; f.glow = 1.2; giggleAt(f, .35); toast('📡 聽聽看…最近的小人在笑', 1600); updateHUD();
}
function giggleAt(f, vol = .2) {
  const dx = f.g.position.x - player.pos.x, dz = f.g.position.z - player.pos.z, ang = Math.atan2(dx, -dz) + player.yaw, dist = Math.hypot(dx, dz) + Math.abs(f.g.position.y - player.pos.y) * 3;
  Snd.giggle(Math.sin(ang), clamp(vol * 4 / (2 + dist), .02, vol));
}
function hideWin() {
  HD.over = true; const bonus = 80 * G.level + Math.round(HD.time) * 2; G.prof.money += bonus; G.prof.level = G.level + 1; G.prof.best = Math.max(G.prof.best || 0, G.level); saveProf();
  Snd.level(); banner(`🎉 第 ${G.level} 關全部找到！`, `剩 ${Math.round(HD.time)} 秒 · 獎金 $${bonus}`, 2200);
  setTimeout(() => { if (!G.active) return; G.paused = true; showDialog(`🎉 第 ${G.level} 關完成`, `下一關小人更多、偽裝更像，還會偷偷換位置…`, [['▶ 下一關', () => { G.paused = false; startHide(G.level + 1); }], ['🏠 回主選單', () => on.escape && on.escape('menu')]]); }, 2000);
}
function hideLose() {
  HD.over = true; Snd.stinger();
  for (const f of HD.figs) if (!f.found) { const mt = f.g.userData.mat; mt.map = null; mt.color.set('#ff3355'); mt.emissive = new THREE.Color('#ff2244'); mt.emissiveIntensity = .8; mt.needsUpdate = true; }
  const left = HD.figs.filter(f => !f.found).length;
  banner('⏰ 時間到！', `還有 ${left} 個沒找到（紅色的就是）`, 2500);
  setTimeout(() => { if (!G.active) return; G.paused = true; showDialog('⏰ 時間到', `找到 ${HD.found} / ${HD.figs.length} 個。紅色發光的是沒找到的小人。`, [['🔁 再挑戰這關', () => { G.paused = false; startHide(G.level); }], ['👀 看看他們躲哪', () => { G.paused = false; }], ['🏠 回主選單', () => on.escape && on.escape('menu')]]); }, 2600);
}
function updateHide(dt) {
  HD.t += dt;
  if (HD.intro > 0) {
    HD.intro -= dt; const k = clamp(1 - HD.intro / 1.4, 0, 1); // last 1.4 s: white → camouflage
    for (const f of HD.figs) { const mt = f.g.userData.mat; if (k > 0 && !mt.map && f.map) { mt.map = f.map; mt.needsUpdate = true; } mt.color.setRGB(1, 1, 1).lerp(f.camo, k); mt.roughness = f.rough; }
    if (HD.intro <= 0) { banner('🔫 開始找！', '在牆邊、家具旁仔細看，有輪廓的就開槍', 1800); Snd.tone(880, .2, 'square', .1); }
    return;
  }
  for (const f of HD.figs) {
    if (f.found) { f.pop += dt; f.g.position.y += Math.max(0, (.4 - f.pop)) * dt * 3; f.g.rotation.y += dt * 6; if (f.pop > 1.2 && f.g.visible) { f.g.visible = false; burst(f.g.position.clone().add(new THREE.Vector3(0, .5, 0)), '#fff', 10, 2, .05, .6, 1, { glow: 1 }); } continue; }
    if (f.glow > 0) { f.glow -= dt; const mt = f.g.userData.mat; mt.emissive = mt.emissive || new THREE.Color(); mt.emissive.set('#ffffff'); mt.emissiveIntensity = Math.max(0, Math.sin(f.glow * 12)) * .5; if (f.glow <= 0) mt.emissiveIntensity = 0; }
    // the creepy part: stare at one from close up and it giggles
    if (!HD.over && G.level >= 2) { const d = f.g.position.distanceTo(player.pos); if (d < 2.2 && !f.giggled) { const to = f.g.position.clone().sub(camera.position).normalize(); if (to.dot(camFwd()) > .9) { f.giggled = true; giggleAt(f, .25); } } }
  }
  if (HD.over) return;
  // later levels: a figure you're not looking at sneaks to a new place
  if (G.level >= 3) {
    HD.moveT -= dt;
    if (HD.moveT <= 0) {
      HD.moveT = Math.max(8, 24 - G.level * 2) * (.7 + Math.random() * .6);
      const cand = HD.figs.filter(f => !f.found && f.g.position.clone().sub(camera.position).normalize().dot(camFwd()) < .2);
      const f = cand[Math.floor(Math.random() * cand.length)]; if (f && placeFig(f, G.level)) { camoFig(f, G.level); giggleAt(f, .3); toast('…有東西換位置了', 1400); }
    }
  }
  if (G.level >= 4 && Math.random() < dt / 25) Snd.whisper();
  HD.time -= dt; if (HD.time <= 0) { HD.time = 0; hideLose(); }
  if (HD.time < 20 && Math.floor(HD.time * 2) !== Math.floor((HD.time + dt) * 2)) Snd.heart();
}

// ================= adventure: admin-placed monsters, treasure chests, timed buffs =================
const chests = [];
function spawnAdv(m) {
  const fi = entFi(m); if (fi < 0 || !allFl()[fi] || !ENEMY[m.type]) return;
  const pos = new THREE.Vector3(m.x, floorY(fi), -m.d), e = spawnEnemy(m.type, pos, 1);
  e.adv = m; e.hp = e.max = e.d.hp * (m.hp || 1); e.spd = e.d.spd * (m.speed || 1); e.dmg = e.d.dmg * (m.dmg ?? 1); e.home = pos.clone();
  if ((m.scale || 1) !== 1) { e.sc = m.scale; e.r *= Math.min(m.scale, 1.6); e.hp = e.max *= m.scale; mesh_scale(e); }
  if (e.d.boss && m.mode !== 'active') { G.boss = null; $('#bossbar').classList.remove('show'); }
}
function mesh_scale(e) { e.mesh.scale.setScalar(e.sc); }
// backroom levels the admin left empty still get monsters; deeper levels: more, faster, bigger
function fillBackrooms() {
  const zs = (S.data.zones || []).filter(z => z.kind === 'backroom');
  zs.forEach((z, k) => {
    const fi = allFl().indexOf(z), have = (S.data.monsters || []).filter(m => m.zid === z.id).length, want = 3 + k * 2;
    for (let i = have; i < want; i++) {
      const r = z.rooms[0]; if (!r) break;
      const type = ['smiler', 'hound', 'lady', 'smiler', 'jiangshi'][(i + k) % 5], mode = i % 4 === 3 ? 'scare' : 'active';
      const m = { id: 'auto' + z.id + i, type, mode, speed: 1 + k * .12, hp: 1 + k * .3, dmg: 1 + k * .2, range: mode === 'scare' ? 4 : 9 + k * 2, respawn: 45, zid: z.id, scale: Math.random() < .12 + k * .08 ? 1.8 + Math.random() * .6 : 1 };
      for (let t = 0; t < 30; t++) { m.x = r.x0 + 1.25 + Math.floor(Math.random() * ((r.x1 - r.x0) / 2.5)) * 2.5; m.d = r.d0 + 1.25 + Math.floor(Math.random() * ((r.d1 - r.d0) / 2.5)) * 2.5; if (Math.hypot(m.x - 1.25, m.d - 1.25) > 6) break; }
      spawnAdv(m);
    }
  });
}
function chestMesh() {
  const g = new THREE.Group(), w = M('#8a5524', { r: .7 }), gold = M('#e0b030', { m: .8, r: .3, e: '#6a4a00', ei: .4 });
  bx(g, .8, .42, .5, 0, 0, 0, w); for (const x of [-.36, .36]) bx(g, .06, .44, .52, x, 0, 0, gold);
  const lid = new THREE.Group(); lid.position.set(0, .42, -.25); g.add(lid);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(.25, .25, .8, 12, 1, false, 0, Math.PI), w); top.rotation.z = Math.PI / 2; top.position.set(0, 0, .25); lid.add(top);
  bx(lid, .1, .12, .04, 0, -.06, .52, gold);
  const glow = sp(g, .12, 0, .5, 0, M('#ffe680', { e: '#ffd040', ei: 2, op: .0 })); glow.visible = false;
  g.userData.lid = lid; g.userData.glow = glow; return g;
}
function startAdventure() {
  setNight(false); lightCfg.intensity = 8; lightCfg.flicker = 0;
  for (const m of S.data.monsters || []) spawnAdv(m);
  fillBackrooms();
  for (const c of S.data.chests || []) {
    const fi = entFi(c); if (fi < 0 || !allFl()[fi]) continue;
    const mesh = chestMesh(); mesh.position.set(c.x, floorY(fi), -c.d); mesh.rotation.y = (c.rot || 0) * DEG; scene.add(mesh);
    chests.push({ c, fi, mesh, open: false, t: 0, re: 0 });
  }
  if (G.auto) { banner('⚠️ 你進入了後室', '這裡的東西會攻擊你！點擊/⚔️ 攻擊，離開後室就恢復參觀', 3200); Snd.stinger(); }
  else banner('🗝 探險模式', '探索地下室、下水道…找寶箱、打怪物。靠近寶箱按 E / ✋', 3000);
  updateHUD();
}
function clearAdventure() { for (const c of chests) scene.remove(c.mesh); chests.length = 0; }
function nearChest() {
  if (!G.active || G.kind !== 'adventure') return null;
  let best = null, bd = 1.6;
  for (const c of chests) { if (c.open) continue; const p = c.mesh.position; if (Math.abs(p.y - player.pos.y) > 1.2) continue; const d = Math.hypot(p.x - player.pos.x, p.z - player.pos.z); if (d < bd) { bd = d; best = c; } }
  return best;
}
export function advHint() { return nearChest() ? '打開寶箱' : ''; }
export function advInteract() {
  const c = nearChest(); if (!c || G.paused) return false;
  c.open = true; c.t = 0; c.re = c.c.respawn || 0; Snd.init(); Snd.level();
  giveLoot(c.c.loot || 'random', c.mesh.position.clone().add(new THREE.Vector3(0, .8, 0)));
  burst(c.mesh.position.clone().add(new THREE.Vector3(0, .6, 0)), '#ffd84a', 24, 3, .06, 1.2, -1, { glow: 1 });
  return true;
}
const BUFF_TXT = { speed: ['👟 加速！', 30], power: ['💪 攻擊力 ×2！', 30], shield: ['🛡️ 無敵護盾！', 15] };
function giveLoot(loot, pos) {
  if (loot === 'random') {
    const pool = ['speed', 'power', 'shield', 'heal', 'potion', 'money', 'money'], ws = Object.keys(WEAPONS).filter(id => WEAPONS[id].g !== 'destroy' && id !== 'stick' && !(id in G.prof.owned));
    if (ws.length) pool.push('weapon:' + ws[Math.floor(Math.random() * ws.length)], 'weapon:' + ws[Math.floor(Math.random() * ws.length)]);
    loot = pool[Math.floor(Math.random() * pool.length)];
  }
  const p = G.prof;
  if (loot.startsWith('weapon:')) {
    const id = loot.slice(7), w = WEAPONS[id]; if (!w) return;
    if (id in p.owned) { p.owned[id] = Math.min(5, p.owned[id] + 1); banner(`${w.icon} ${w.n} 升級！`, `Lv${p.owned[id] + 1}`, 1800); }
    else { p.owned[id] = 0; equip(id); banner(`${w.icon} 得到 ${w.n}！`, '按 Q 或數字鍵切換武器', 2000); }
    renderWeaponBar();
  } else if (BUFF_TXT[loot]) { G.buffs[loot] = BUFF_TXT[loot][1]; banner(BUFF_TXT[loot][0], `${BUFF_TXT[loot][1]} 秒`, 1600); }
  else if (loot === 'heal') { G.hp = G.maxHp; banner('❤️ 生命補滿！', '', 1400); }
  else if (loot === 'potion') { p.potions = Math.min(9, (p.potions || 0) + 2); banner('🧪 補血藥水 ×2', '按 H 或 🧪 使用', 1600); }
  else if (loot === 'money') { const m = 200 + Math.floor(Math.random() * 200); earn(m); floatText(`+$${m}`, pos); banner(`💰 $${m}`, '', 1400); }
  saveProf(); updateHUD();
}
function updateAdventure(dt) {
  const z = zoneOf(floorOf(player.pos.y));
  if (z?.kind === 'backroom') { const k = (S.data.zones || []).filter(q => q.kind === 'backroom').indexOf(z); horrorEvents(dt, 3 + k * 2, z); }
  const b = G.buffs; for (const k in b) if (b[k] > 0) { b[k] -= dt; if (b[k] <= 0) toast({ speed: '加速結束', power: '攻擊力恢復', shield: '護盾消失' }[k], 1200); }
  const k = (1 + G.prof.spdLv * .08) * (b.speed > 0 ? 1.6 : 1); player.speed = 2.4 * k; player.run = 4.4 * k;
  for (const c of chests) {
    const lid = c.mesh.userData.lid;
    if (c.open) { c.t += dt; lid.rotation.x = -Math.min(1.9, c.t * 4); if (c.re > 0 && c.t > c.re) { c.open = false; c.t = 0; } }
    else { lid.rotation.x += (0 - lid.rotation.x) * Math.min(1, dt * 6); c.mesh.position.y = floorY(c.fi) + (Math.sin(G.t * 2 + c.fi) > .98 ? .02 : 0); }
  }
  // arrow to the nearest closed chest on this floor
  const arrow = $('#garrow'), fi = floorOf(player.pos.y); let best = null, bd = 1e9;
  for (const c of chests) if (!c.open && c.fi === fi) { const d = c.mesh.position.distanceTo(player.pos); if (d < bd) { bd = d; best = c; } }
  if (best && bd > 2) { const dx = best.mesh.position.x - player.pos.x, dz = best.mesh.position.z - player.pos.z, ang = Math.atan2(dx, -dz) + player.yaw; arrow.style.display = 'block'; arrow.querySelector('i').style.transform = `rotate(${ang}rad)`; arrow.querySelector('span').textContent = `🎁 ${Math.round(bd)}m`; }
  else arrow.style.display = 'none';
}
