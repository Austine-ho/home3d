// player movement + keyboard / mouse / touch input
import { THREE, S, camera, renderer, isTouch, $, clamp, toast } from './core.js';
import { hits, groundAt, pushOut } from './house.js';

export const player = { pos: new THREE.Vector3(2.9, 0, 2.4), vy: 0, yaw: 0, pitch: -.05, ground: true, speed: 4.4, run: 6.2, eye: 1.58, bob: 0 };
export const input = { keys: {}, jx: 0, jy: 0, look: true, attack: false };
export const on = { home: null, heal: null, interact: null, attackDown: null, attackUp: null, switchW: null, key: null, escape: null };
export const fx = { shake: 0, kick: 0 };

const cvs = renderer.domElement;
export const locked = () => document.pointerLockElement === cvs;
let wantLock = false, wasLocked = false;
export function requestLock() {
  if (isTouch) return; wantLock = true;
  try { const p = cvs.requestPointerLock(); if (p && p.catch) p.catch(() => { }); } catch (e) { }
}
export function releaseLock() { wantLock = false; if (locked()) document.exitPointerLock(); }
let lockTip = false;
document.addEventListener('pointerlockchange', () => {
  if (locked()) { wasLocked = true; if (!lockTip) { lockTip = true; toast('🖱 按 Alt（Mac 是 Option）放開滑鼠去點按鈕', 3500); } }
  else if (wasLocked && wantLock) { wantLock = false; on.escape && on.escape(); }
  if (!locked()) wasLocked = false;
});

// keyboard
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
  input.keys[e.code] = true;
  if (e.code === 'Tab') e.preventDefault();
  // Alt (Option on Mac): let go of the mouse so the on-screen buttons can be clicked; click the scene to look around again
  if ((e.code === 'AltLeft' || e.code === 'AltRight') && !e.repeat && (S.mode === 'visit' || S.mode === 'game')) {
    e.preventDefault(); if (locked()) { releaseLock(); toast('🖱 滑鼠已放開，可以點按鈕；點一下畫面回到視角', 2200); } else requestLock();
  }
  on.key && on.key(e);
});
addEventListener('keyup', e => { input.keys[e.code] = false; });
addEventListener('blur', () => { for (const k in input.keys) input.keys[k] = false; input.attack = false; });

// mouse
let drag = null;
cvs.addEventListener('mousedown', e => {
  if (!input.look || isTouch) return;
  if (S.mode === 'visit' || S.mode === 'game') {
    if (!locked()) { requestLock(); drag = { x: e.clientX, y: e.clientY }; }
    if (e.button === 0 && S.mode === 'game') { input.attack = true; on.attackDown && on.attackDown(); }
  }
});
addEventListener('mouseup', e => { drag = null; if (e.button === 0 && input.attack) { input.attack = false; on.attackUp && on.attackUp(); } });
document.addEventListener('mousemove', e => {
  if (!input.look) return;
  if (locked()) look(e.movementX * 2.2, e.movementY * 2.2);
  else if (drag) { look((e.clientX - drag.x) * 5, (e.clientY - drag.y) * 5); drag = { x: e.clientX, y: e.clientY }; }
});
const SENS = 0.00125; // +25% (was 0.001)
export function look(dx, dy) { player.yaw -= dx * SENS; player.pitch = clamp(player.pitch - dy * SENS, -1.45, 1.45); }

// touch: left half = joystick, right half = look
const joy = $('#joy'), knob = $('#joyKnob');
let jt = null, lt = null;
cvs.addEventListener('touchstart', e => {
  for (const t of e.changedTouches) {
    if (t.clientX < innerWidth * 0.42 && jt === null && input.look && (S.mode === 'visit' || S.mode === 'game' || S.mode === 'edit')) {
      jt = { id: t.identifier, x: t.clientX, y: t.clientY }; joy.style.left = (t.clientX - 60) + 'px'; joy.style.top = (t.clientY - 60) + 'px'; joy.style.display = 'block'; knob.style.transform = 'translate(0,0)';
    } else if (lt === null && input.look) lt = { id: t.identifier, x: t.clientX, y: t.clientY };
  }
}, { passive: true });
cvs.addEventListener('touchmove', e => {
  for (const t of e.changedTouches) {
    if (jt && t.identifier === jt.id) {
      let dx = t.clientX - jt.x, dy = t.clientY - jt.y; const l = Math.hypot(dx, dy), mx = 50;
      if (l > mx) { dx *= mx / l; dy *= mx / l; }
      input.jx = dx / mx; input.jy = -dy / mx; knob.style.transform = `translate(${dx}px,${dy}px)`;
    } else if (lt && t.identifier === lt.id) { { const mx = t.clientX - lt.x, my = t.clientY - lt.y, acc = 1 + Math.min(1.2, Math.hypot(mx, my) / 25); look(mx * 8.5 * acc, my * 8.5 * acc); } lt.x = t.clientX; lt.y = t.clientY; }
  }
}, { passive: true });
function endTouch(e) {
  for (const t of e.changedTouches) {
    if (jt && t.identifier === jt.id) { jt = null; input.jx = input.jy = 0; joy.style.display = 'none'; }
    if (lt && t.identifier === lt.id) lt = null;
  }
}
cvs.addEventListener('touchend', endTouch); cvs.addEventListener('touchcancel', endTouch);

// on-screen buttons
document.querySelectorAll('#tbtns [data-act]').forEach(b => {
  const act = b.dataset.act;
  b.addEventListener('touchstart', e => {
    e.preventDefault(); e.stopPropagation(); b.classList.add('on');
    if (act === 'attack') { input.attack = true; on.attackDown && on.attackDown(); }
    if (act === 'jump') input.keys.Space = true;
    if (act === 'run') input.keys.ShiftLeft = !input.keys.ShiftLeft;
    if (act === 'use') on.interact && on.interact();
    if (act === 'switch') on.switchW && on.switchW();
    if (act === 'heal') on.heal && on.heal();
  }, { passive: false });
  b.addEventListener('touchend', e => {
    e.preventDefault(); b.classList.remove('on');
    if (act === 'attack') { input.attack = false; on.attackUp && on.attackUp(); }
    if (act === 'jump') input.keys.Space = false;
    if (act === 'run' && !input.keys.ShiftLeft) b.classList.remove('on'); else if (act === 'run') b.classList.add('on');
  }, { passive: false });
});

// ---------- movement ----------
export function updatePlayer(dt, t, canMove) {
  const k = input.keys;
  let fx_ = 0, fz = 0;
  if (canMove) {
    if (k.KeyW || k.ArrowUp) fz += 1; if (k.KeyS || k.ArrowDown) fz -= 1;
    if (k.KeyD || k.ArrowRight) fx_ += 1; if (k.KeyA || k.ArrowLeft) fx_ -= 1;
    fx_ += input.jx; fz += input.jy;
  }
  const len = Math.hypot(fx_, fz);
  if (len > .05) {
    const n = len > 1 ? len : 1, run = k.ShiftLeft || k.ShiftRight;
    const spd = (run ? player.run : player.speed) * dt / n;
    const sy = Math.sin(player.yaw), cyw = Math.cos(player.yaw);
    const dx = (-sy * fz + cyw * fx_) * spd, dz = (-cyw * fz - sy * fx_) * spd;
    const p = player.pos;
    if (hits(p.x, p.z, p.y)) { p.x += dx; p.z += dz; }        // already inside something: let the player walk out
    else {
      // small steps, each pushed out of whatever it touches, so the player glides along walls and furniture
      const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .08));
      for (let i = 0; i < n; i++) {
        const [nx, nz] = pushOut(p.x + dx / n, p.z + dz / n, p.y);
        if (!hits(nx, nz, p.y, .235)) { p.x = nx; p.z = nz; }
        else { if (!hits(p.x + dx / n, p.z, p.y)) p.x += dx / n; if (!hits(p.x, p.z + dz / n, p.y)) p.z += dz / n; }
      }
    }
    player.bob += dt * (run ? 14 : 10);
  }
  if (canMove && k.Space && player.ground) { player.vy = 4.2; player.ground = false; }
  const g = groundAt(player.pos.x, player.pos.z, player.pos.y);
  player.vy -= 12 * dt; player.pos.y += player.vy * dt;
  if (player.pos.y <= g) { player.pos.y = g; player.vy = 0; player.ground = true; player.lastG = g; } else if (player.pos.y - g > .05) player.ground = false;
  if (g < -99 && player.pos.y < (player.lastG ?? 0) - 12) { player.pos.set(2.9, 0, 2.4); player.vy = 0; player.lastG = 0; toast('掉出去了，回到大門口'); }
  fx.shake = Math.max(0, fx.shake - dt * 2.5);
  const sh = fx.shake * fx.shake * .15;
  const bob = len > .05 && player.ground ? Math.sin(player.bob) * .025 : 0;
  camera.position.set(player.pos.x + (Math.random() - .5) * sh, player.pos.y + player.eye + bob + (Math.random() - .5) * sh, player.pos.z + (Math.random() - .5) * sh);
  camera.rotation.set(player.pitch + fx.kick, player.yaw, (Math.random() - .5) * sh * .3);
  fx.kick *= Math.pow(.001, dt);
}
