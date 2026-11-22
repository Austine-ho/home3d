// main: modes, menus, 3D edit, save/load, render loop
import { THREE, S, $, scene, camera, renderer, isTouch, toast, PRESETS, presetColor, tex, DEG, clamp } from './core.js';
import { CAT } from './catalog.js';
import { defaultHouse, migrate } from './data.js';
import { stairGeom, H, build, updateHouse, setNight, toggleDoor, setLamp, spawnFurniture, removeFurnitureEntry, refreshFurnBox, refreshSolids, paintSurface, floorOf, floorY, FH, allFl, entFi, nearPortal } from './house.js';
import { player, input, on, fx, updatePlayer, requestLock, releaseLock, locked } from './controls.js';
import { openPlan, closePlan, Plan } from './plan.js';
import { startGame, stopGame, updateGame, Game, Snd, openShop, usePotion, advInteract, advHint } from './games.js';

// ---------- save / load ----------
const KEY = 'home3d_design_v2';
S.save = () => { try { localStorage.setItem(KEY, JSON.stringify(S.data)); } catch (e) { } };
function load() { try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && d.version === 2 && d.floors?.length) { const before = d.defaultRev || 0, m = migrate(d); if (before !== m.defaultRev) setTimeout(() => toast(before < 2 ? '已套用你的新 1F 設計' : '已加入地下室、下水道與馬路物件'), 1500); return m; } } catch (e) { } return defaultHouse(); }
S.data = load(); S.save();
let dirty = false;
function rebuild() { build(S.data); dirty = false; }
rebuild();

// ---------- modes ----------
const MODE_TAG = { visit: '🚶 參觀', edit: '🛋 改裝潢', game: '' };
function setMode(m, opt) {
  const prev = S.mode;
  if (prev === 'plan' && m !== 'plan') { closePlan(); S.admin = false; if (dirty) { rebuild(); renderFloorBtns(); } }
  if (prev === 'game' && m !== 'game') { stopGame(); rebuild(); }
  S.mode = m;
  document.body.dataset.mode = m;
  $('#menu').classList.toggle('show', m === 'menu');
  $('#panel').classList.toggle('show', m === 'edit');
  $('#tag').textContent = MODE_TAG[m] || '';
  $('#tag').style.display = (m === 'visit' || m === 'edit') ? 'block' : 'none';
  if (m !== 'edit') selectFurn(null);
  input.look = m !== 'plan' && m !== 'menu';
  if (m === 'visit' || m === 'game') requestLock(); else releaseLock();
  if (m === 'plan') { S.admin = opt === 'admin'; Plan.fi = floorOf(player.pos.y); openPlan(); }
  if (m === 'game') { startGame(opt, S.data); if (isTouch && innerHeight > innerWidth) setTimeout(() => toast('📱 建議把手機橫放來玩'), 2600); }
  if (m === 'menu') updateMenu();
}
Plan.onChange = () => { dirty = true; };
on.escape = (to) => { if (to === 'menu' || S.mode === 'visit' || S.mode === 'game') setMode('menu'); };
document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { Snd.init(); const [m, o] = b.dataset.go.split(':'); setMode(m, o); });
$('#btnAdmin').onclick = () => {
  let ok = false; try { ok = sessionStorage.getItem('home3d_admin') === '1'; } catch (e) { }
  if (!ok) { const pw = prompt('🔐 管理員密碼'); if (pw === null) return; if (pw.trim() !== '3') return toast('密碼錯誤'); try { sessionStorage.setItem('home3d_admin', '1'); } catch (e) { } }
  setMode('plan', 'admin'); toast('🔐 已進入管理員遊戲編輯');
};
$('#pauseBtn').onclick = () => setMode('menu');
$('#pDone2').onclick = () => setMode('visit');
function updateMenu() {
  const g = k => { try { return JSON.parse(localStorage.getItem('home_game_' + k)) || {}; } catch (e) { return {}; } };
  const c = g('clean'), gh = g('ghost'), d = g('destroy');
  $('#prog-clean').textContent = c.level ? `第 ${c.level} 關 · $${c.money}` : '新遊戲';
  $('#prog-ghost').textContent = gh.level ? `第 ${gh.level} 關 · $${gh.money}` : '新遊戲';
  $('#prog-destroy').textContent = d.money != null ? `$${d.money}` : '新遊戲';
  const a = g('adventure'); $('#prog-adventure').textContent = a.money != null ? `$${a.money}` : '新遊戲';
}
on.key = e => {
  if (e.code === 'Escape' && (S.mode === 'edit' || S.mode === 'plan')) { if (S.mode === 'edit' && sel) { selectFurn(null); return; } if (S.mode === 'plan') return; setMode('menu'); }
  if (e.code === 'Escape' && (S.mode === 'visit' || S.mode === 'game') && !locked()) setMode('menu');
  if (e.code === 'Tab') { if (S.mode === 'visit') setMode('edit'); else if (S.mode === 'edit') setMode('visit'); }
  if (e.code === 'KeyL' && S.mode === 'visit') setNight(!S.night);
  if (e.code === 'KeyG' && (S.mode === 'visit' || S.mode === 'game' || S.mode === 'edit')) goHome();
  if (e.code === 'KeyE' && (S.mode === 'visit' || S.mode === 'game')) interact();
  if (e.code === 'KeyQ' && S.mode === 'game') on.switchW && on.switchW();
  if (e.code === 'KeyH' && S.mode === 'game') usePotion();
  if (e.code === 'KeyB' && S.mode === 'game' && Game.kind === 'destroy') openShop(false);
  if (/^Digit[1-9]$/.test(e.code) && S.mode === 'game') { const ids = Object.keys(Game.prof.owned), id = ids[+e.code.slice(5) - 1]; if (id) document.querySelector(`#wbar [data-w="${id}"]`)?.click(); }
  if (S.mode === 'edit') editKey(e);
};

// ---------- interaction ----------
const ray = new THREE.Raycaster(), center = new THREE.Vector2();
function aim() {
  ray.setFromCamera(center, camera); ray.far = 2.6;
  const objs = [...H.doors.filter(d => !d.dead).flatMap(d => d.kind === 'hinge' ? [d.leaf] : [d.p1, d.p2]), ...H.lamps.map(l => l.mesh)];
  const hit = ray.intersectObjects(objs, true)[0]; ray.far = Infinity;
  if (!hit) return null; const u = hit.object.userData; return u.door ? { door: u.door, dist: hit.distance } : u.lamp ? { lamp: u.lamp } : null;
}
// closest closed-or-open door roughly in front of the player (fallback when the aim ray slips through a gap)
function doorAhead(maxD = 1.6) {
  const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw); let best = null, bd = maxD;
  for (const d of H.doors) {
    if (d.dead || Math.abs(d.fi === undefined ? 0 : (floorY(d.fi) - player.pos.y)) > 1.2) continue;
    let cx, cz;
    if (d.kind === 'hinge') { cx = d.pivot.position.x + Math.cos(d.base) * d.w / 2; cz = d.pivot.position.z - Math.sin(d.base) * d.w / 2; }
    else { const p = d.fr.position; cx = p.x; cz = p.z; }
    const dx = cx - player.pos.x, dz = cz - player.pos.z, dist = Math.hypot(dx, dz);
    if (dist < bd && (dx * fx + dz * fz) / (dist || 1) > .35) { bd = dist; best = d; }
  }
  return best ? { door: best, dist: bd } : null;
}
function interact() { if (S.mode === 'game' && advInteract()) return; const pt = nearPortal(player.pos); if (pt && !autoPortal(pt.p)) return usePortal(pt.p); const a = aim() || doorAhead(); if (a?.door) { toggleDoor(a.door); Snd.init(); Snd.tone(220, .08, 'triangle', .08); } else if (a?.lamp) setLamp(a.lamp, !a.lamp.on); }
on.interact = interact; on.heal = usePotion; $('#potions').onclick = () => usePotion();
$('#btnNight').onclick = () => setNight(!S.night);
// 🏠 back home: just inside the front door on 1F (also the fix for being locked out)
function goHome() {
  let x = 2.9, d = 1.2;
  const f0 = S.data.floors[0];
  for (const w of f0.walls) for (const o of w.ops || []) if (o.type === 'door2') {
    const L = Math.hypot(w.x2 - w.x1, w.d2 - w.d1), ux = (w.x2 - w.x1) / L, ud = (w.d2 - w.d1) / L, cx = w.x1 + ux * o.at, cd = w.d1 + ud * o.at;
    let nx = ud, nd = -ux; if (nd < 0) { nx = -nx; nd = -nd; } x = cx + nx * 1.3; d = cd + nd * 1.3;
  }
  player.pos.set(x, .05, -d); player.vy = 0; player.yaw = 0; player.pitch = -.05; player.lastG = 0;
  if (S.mode === 'edit') selectFurn(null);
  toast('🏠 回到家了');
}
$('#btnHome').onclick = e => { e.stopPropagation(); goHome(); };
// ---------- portals ----------
const autoPortal = p => p.style === 'portal' || p.style === 'door';
let portalCD = 0, portalArmed = true;
function usePortal(p) {
  if (!p.to) return toast('這個傳送門還沒有設定目的地');
  const fi = entFi(p.to); if (fi < 0 || !allFl()[fi]) return toast('目的地不存在了');
  const f = $('#flash'); f.style.background = autoPortal(p) ? 'rgba(160,110,255,.7)' : 'rgba(0,0,0,.85)'; f.style.opacity = 1; setTimeout(() => f.style.opacity = 0, 250);
  Snd.init(); if (autoPortal(p)) { Snd.tone(300, .5, 'sine', .2, 1200); Snd.tone(450, .5, 'triangle', .1, 1500, .1); } else Snd.tone(160, .15, 'square', .08);
  player.pos.set(p.to.x, floorY(fi) + .05, -p.to.d); player.vy = 0; portalCD = 1.2; portalArmed = false;
  toast('📍 ' + allFl()[fi].name);
}
function updatePortals(dt) {
  portalCD -= dt; const pt = nearPortal(player.pos, .75);
  if (!pt) { portalArmed = true; return; }
  if (portalArmed && portalCD <= 0 && autoPortal(pt.p)) usePortal(pt.p);
}
function renderFloorBtns() {
  const fls = allFl();
  $('#floorbtns').innerHTML = fls.map((f, i) => f.admin ? '' : `<button data-fl="${i}">${f.name.split(' ')[0]}</button>`).join('');
  $('#floorbtns').querySelectorAll('[data-fl]').forEach(b => b.onclick = () => teleport(+b.dataset.fl));
}
function teleport(fi) {
  if (fi >= S.data.floors.length) {
    const z = allFl()[fi], pt = (S.data.portals || []).find(p => p.to && entFi(p.to) === fi && !p.admin), r = z.rooms[0];
    const [x, d] = pt ? [pt.to.x, pt.to.d] : [(r.x0 + r.x1) / 2, (r.d0 + r.d1) / 2]; player.pos.set(x, floorY(fi) + .05, -d); player.vy = 0; portalArmed = false; toast('📍 ' + z.name); return;
  }
  const st = S.data.stairs.find(s => s.floor === fi - 1) || S.data.stairs.find(s => s.floor === fi);
  if (fi === 0) { player.pos.set(2.9, 0, 2.4); player.yaw = 0; }
  else if (st) { const g = stairGeom(st), [ax, ad] = st.floor === fi - 1 ? g.arrive : g.start; player.pos.set(ax, floorY(fi) + .05, -ad); }
  else { const r = allFl()[fi].rooms[0]; player.pos.set((r.x0 + r.x1) / 2, floorY(fi), -(r.d0 + r.d1) / 2); }
  player.vy = 0; toast('📍 ' + allFl()[fi].name);
}

// ---------- 3D edit (furniture & paint) ----------
let sel = null, dragging = null, paint = null;
const selBox = new THREE.Box3Helper(new THREE.Box3(), 0xffb020); selBox.visible = false; scene.add(selBox);
const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), ndc = new THREE.Vector2();
function selectFurn(e) {
  sel = e; selBox.visible = !!e; if (e) { selBox.box.copy(e.box); if (e.nc) selBox.box.setFromObject(e.obj); }
  const box = $('#selbox');
  if (!e) { box.innerHTML = '<div class="mut">點選家具來移動、旋轉或刪除</div>'; return; }
  const colors = ['#a3a29e', '#e8e2d6', '#3a3a3a', '#7a4a28', '#c79a5e', '#2b1612', '#b85c4a', '#3e4c6b', '#7aa6c9', '#3f8f3a', '#e8743a', '#d42a22', '#efe3a6', '#f2a7c3'];
  box.innerHTML = `<b>${CAT[e.f.type].n}</b><div class="rowb"><button data-a="rl">↺</button><button data-a="rr">↻</button><button data-a="up">⬆</button><button data-a="dn">⬇</button><button data-a="dup">複製</button><button data-a="del" class="danger">🗑</button></div>
    <div class="colors">${colors.map(c => `<button style="background:${c}" data-c="${c}"></button>`).join('')}<button data-c="">↺</button></div>`;
  box.querySelectorAll('[data-a]').forEach(b => b.onclick = () => editAction(b.dataset.a));
  box.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { e.f.color = b.dataset.c || undefined; respawn(e); });
}
function respawn(e) { const fi = e.fi, f = e.f; removeFurnitureEntry(e); const n = spawnFurniture(f, fi); refreshSolids(); selectFurn(n); S.save(); }
function editAction(a) {
  const e = sel; if (!e) return; const f = e.f;
  if (a === 'rl' || a === 'rr') { f.rot = ((f.rot || 0) + (a === 'rl' ? 15 : -15)) % 360; e.obj.rotation.y = f.rot * DEG; }
  if (a === 'r90') { f.rot = ((f.rot || 0) + 90) % 360; e.obj.rotation.y = f.rot * DEG; }
  if (a === 'up' || a === 'dn') { f.y = clamp((f.y || 0) + (a === 'up' ? .05 : -.05), 0, 2.8); e.obj.position.y = floorY(e.fi) + f.y; }
  if (a === 'del') { const fl = allFl()[e.fi]; fl.furniture = fl.furniture.filter(x => x !== f); removeFurnitureEntry(e); selectFurn(null); S.save(); toast('已刪除'); return; }
  if (a === 'dup') { const c = { ...f, x: f.x + .4, d: f.d + .4 }; allFl()[e.fi].furniture.push(c); const n = spawnFurniture(c, e.fi); refreshSolids(); selectFurn(n); S.save(); return; }
  refreshFurnBox(e); refreshSolids(); selectFurn(e); S.save();
}
function editKey(e) {
  if (!sel) return;
  if (e.code === 'KeyR') editAction(e.shiftKey ? 'rr' : 'rl');
  if (e.code === 'KeyT') editAction('r90');
  if (e.code === 'BracketRight') editAction('up'); if (e.code === 'BracketLeft') editAction('dn');
  if (e.code === 'Delete' || e.code === 'Backspace') { e.preventDefault(); editAction('del'); }
  if (e.code === 'KeyD' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); editAction('dup'); }
}
const cvs = renderer.domElement;
let downAt = null;
cvs.addEventListener('pointerdown', e => {
  if (S.mode !== 'edit') return;
  ndc.set(e.clientX / innerWidth * 2 - 1, -e.clientY / innerHeight * 2 + 1); ray.setFromCamera(ndc, camera); ray.far = 40;
  if (e.button === 2) { downAt = { x: e.clientX, y: e.clientY, look: true }; return; }
  if (paint) {
    const hit = ray.intersectObjects([...H.wallMeshes, ...H.slabMeshes], false)[0];
    if (hit) { const key = hit.object.userData.surf?.[hit.face.materialIndex]; if (key) { paintSurface(key, paint); S.save(); toast('已套用 ' + PRESETS[paint].n, 900); } }
    return;
  }
  const hit = ray.intersectObjects([...H.furn.map(x => x.obj), ...H.wallMeshes, ...H.slabMeshes], true)[0];
  const f = hit?.object.userData.furn;
  if (f) { selectFurn(f); plane.constant = -(floorY(f.fi) + (f.f.y || 0)); const p = new THREE.Vector3(); if (ray.ray.intersectPlane(plane, p)) dragging = { e: f, ox: f.obj.position.x - p.x, oz: f.obj.position.z - p.z, moved: false }; input.look = false; }
  else { selectFurn(null); downAt = { x: e.clientX, y: e.clientY, look: true }; }
});
cvs.addEventListener('pointermove', e => {
  if (S.mode !== 'edit') return;
  if (downAt?.look && !isTouch) { player.yaw -= (e.clientX - downAt.x) * .004; player.pitch = clamp(player.pitch - (e.clientY - downAt.y) * .004, -1.45, 1.45); downAt.x = e.clientX; downAt.y = e.clientY; return; }
  if (!dragging) return;
  ndc.set(e.clientX / innerWidth * 2 - 1, -e.clientY / innerHeight * 2 + 1); ray.setFromCamera(ndc, camera);
  const p = new THREE.Vector3();
  if (ray.ray.intersectPlane(plane, p)) {
    let x = p.x + dragging.ox, z = p.z + dragging.oz; if (!e.altKey) { x = Math.round(x * 20) / 20; z = Math.round(z * 20) / 20; }
    const f = dragging.e.f; f.x = x; f.d = -z; dragging.e.obj.position.x = x; dragging.e.obj.position.z = z; dragging.moved = true;
    refreshFurnBox(dragging.e); selBox.box.copy(dragging.e.box);
  }
});
addEventListener('pointerup', () => { if (dragging?.moved) { refreshSolids(); S.save(); } dragging = null; downAt = null; if (S.mode === 'edit') input.look = true; });
cvs.addEventListener('contextmenu', e => e.preventDefault());
// catalog + paint UI
{
  const groups = {}; for (const id in CAT) (groups[CAT[id].grp] || (groups[CAT[id].grp] = [])).push(id);
  $('#catalog').innerHTML = Object.entries(groups).map(([g, ids]) => `<div class="grp">${g}</div><div class="grid">${ids.map(id => `<button data-add="${id}">${CAT[id].n}</button>`).join('')}</div>`).join('');
  $('#catalog').querySelectorAll('[data-add]').forEach(b => b.onclick = () => {
    const type = b.dataset.add, fi = floorOf(player.pos.y);
    const f = { type, x: Math.round((player.pos.x - Math.sin(player.yaw) * 1.5) * 20) / 20, d: -Math.round((player.pos.z - Math.cos(player.yaw) * 1.5) * 20) / 20, rot: Math.round(player.yaw / DEG / 90) * 90, y: CAT[type].y || 0 };
    allFl()[fi].furniture.push(f); const e = spawnFurniture(f, fi); refreshSolids(); selectFurn(e); S.save(); toast(`新增：${CAT[type].n}（拖曳移動）`, 1200);
  });
  const mk = (id, p) => `<button data-p="${id}" style="${p.tex ? `background-image:url(${tex(p.tex).userData.css});background-size:60px` : `background:${p.c}`}"><span>${p.n}</span></button>`;
  $('#swPaint').innerHTML = Object.entries(PRESETS).filter(([, p]) => !p.tex).map(([id, p]) => mk(id, p)).join('');
  $('#swTex').innerHTML = Object.entries(PRESETS).filter(([, p]) => p.tex).map(([id, p]) => mk(id, p)).join('');
  const refresh = () => document.querySelectorAll('#panel .sw button').forEach(b => b.classList.toggle('on', b.dataset.p === paint));
  document.querySelectorAll('#panel .sw button').forEach(b => b.onclick = () => { paint = paint === b.dataset.p ? null : b.dataset.p; selectFurn(null); refresh(); if (paint) toast('點擊牆面或地板套用', 1200); });
  document.querySelectorAll('#panel .tabs button[data-tab]').forEach(b => b.onclick = () => {
    document.querySelectorAll('#panel .tabs button[data-tab]').forEach(x => x.classList.toggle('on', x === b));
    document.querySelectorAll('#panel .tab').forEach(t => t.classList.toggle('show', t.id === 'tab-' + b.dataset.tab));
    if (b.dataset.tab !== 'paint') { paint = null; refresh(); }
  });
  $('#collapse').onclick = () => $('#panel').classList.toggle('mini');
}
// file ops
$('#btnExport').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(S.data)], { type: 'application/json' })); a.download = '我家設計.json'; a.click(); };
$('#btnImport').onclick = () => $('#fileIn').click();
$('#fileIn').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { const d = JSON.parse(await f.text()); if (d.version !== 2) throw 0; d.defaultRev = Math.max(d.defaultRev || 0, 2); S.data = migrate(d); S.save(); rebuild(); renderFloorBtns(); toast('已匯入設計'); } catch (err) { toast('檔案格式不正確'); } e.target.value = ''; };
$('#btnReset').onclick = () => { if (confirm('還原成依影片建立的原始格局？目前的設計會被覆蓋（建議先匯出備份）。')) { S.data = defaultHouse(); S.save(); rebuild(); renderFloorBtns(); Plan.hist = []; toast('已還原'); } };
$('#btnShot').onclick = () => { renderer.render(scene, camera); const a = document.createElement('a'); a.href = cvs.toDataURL('image/png'); a.download = '我家截圖.png'; a.click(); };
$('#btnFull').onclick = () => { const d = document.documentElement; if (!document.fullscreenElement) (d.requestFullscreen || d.webkitRequestFullscreen)?.call(d); else document.exitFullscreen?.(); };

// ---------- loop ----------
const clock = new THREE.Clock();
let hintT = 0;
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), .05), t = clock.elapsedTime;
  if (S.mode === 'plan') return;
  const canMove = S.mode === 'visit' || S.mode === 'edit' || (S.mode === 'game' && !Game.paused);
  updatePlayer(dt, t, canMove && !dragging);
  updateHouse(dt, t);
  if (S.mode === 'visit' || S.mode === 'game') updatePortals(dt);
  updateGame(dt);
  if (selBox.visible && sel) selBox.box.copy(sel.box);
  hintT -= dt;
  if (hintT <= 0 && (S.mode === 'visit' || S.mode === 'game')) {
    hintT = .15; const a = aim() || doorAhead(), h = $('#hint');
    // doors open by themselves when you walk into them
    const k = input.keys, moving = k.KeyW || k.ArrowUp || Math.abs(input.jy) > .3;
    if (moving && a?.door && !a.door.open && a.dist < 1.3) { toggleDoor(a.door); Snd.init(); Snd.tone(220, .08, 'triangle', .06); }
    const pt = nearPortal(player.pos), ah = S.mode === 'game' && advHint();
    if (ah) { h.textContent = `${isTouch ? '按 ✋' : 'E'} ${ah}`; h.style.display = 'block'; }
    else if (pt && !autoPortal(pt.p)) { h.textContent = `${isTouch ? '按 ✋' : 'E'} ${pt.p.name || '進入'}`; h.style.display = 'block'; }
    else if (a?.door) { h.textContent = `${isTouch ? '按 ✋' : 'E'} ${a.door.open ? '關' : '開'}${a.door.name}`; h.style.display = 'block'; }
    else if (a?.lamp && S.mode === 'visit') { h.textContent = `${isTouch ? '按 ✋' : 'E'} ${a.lamp.on ? '關' : '開'}${a.lamp.name}`; h.style.display = 'block'; }
    else h.style.display = 'none';
    $('#flname').textContent = allFl()[floorOf(player.pos.y)]?.name || '';
  }
  renderer.render(scene, camera);
}
renderFloorBtns();
document.body.classList.toggle('touch', isTouch);
setMode('menu');
loop();
window.__app = { S, H, player, setMode, Game, rebuild, teleport };
