// 🎭 道具躲貓貓 (prop hunt) — multiplayer for everyone at home.
// Phones/computers connect directly to each other (WebRTC through PeerJS; its public broker only introduces the
// devices, game traffic goes device-to-device). The device that creates the room runs the round and relays states.
import { THREE, S, $, scene, camera, renderer, isTouch, toast, clamp } from './core.js';
import { CAT, buildFurniture, footprint } from './catalog.js';
import { H, BODY, build, pushOut, lightCfg, setLamp } from './house.js';
import { player, input, on, fx, releaseLock, locked } from './controls.js';
import { Snd, showDialog } from './games.js';

const PEER_SRC = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
const ID_PRE = 'home3d-prophunt-';
const COLORS = ['#4aa3ff', '#ffb020', '#5ad16a', '#ff6ad5', '#9a7bff', '#2fd6d0', '#ff8a4a', '#f0f0f0'];
const SMALL = { eye: .5, r: .11, lo: .2, hi: .62, speed: 2.4, run: 3.5, jump: 3.96 }; // jump ×1.2
const NORMAL = { eye: 1.58, r: .24, lo: .36, hi: 1.7, speed: 4.4, run: 6.2, jump: 4.2 };
const WEAP = { gun: { n: '槍', ic: '🔫', dmg: 14, cd: .38 / 1.3, range: 30 }, knife: { n: '刀', ic: '🔪', dmg: 34, cd: .6 / 1.3, range: 1.5 } }; // attack rate ×1.3
const CAUGHT_HP = 15, TAUNT_EVERY = 30, BOOST_T = 3, BOOST_X = 1.8, SPRAY_R = 5, SPRAY_T = 2;
let DASHES = 3;
const HELP = `<b>玩法</b><br>開始時隨機一個人當 <b>👹 鬼</b>，其他人是 <b>🧍 躲藏者</b>。所有人都縮小了，家變得超大。<br><br>
<b>🧍 躲藏者</b>：鬼出發前先躲好。隨時可以用下方圖示變身成家具、地板或牆壁（R 旋轉）。🎯 會變成你正在看的那件家具。下方可以切換家具種類。💨 加速可以跑快 ${BOOST_T} 秒（次數由房主設定），🌫 噴霧每局只能用 1 次：噴在鬼附近（${SPRAY_R} 公尺內），鬼會 ${SPRAY_T} 秒看不清楚。被鬼打到血快沒了（剩 ${CAUGHT_HP}）就算被抓。每 ${TAUNT_EVERY} 秒所有躲藏者會發出一聲笑聲。<br><br>
<b>👹 鬼</b>：躲藏時間內眼睛被矇住。之後用 🔫 槍或 🔪 刀找人（Q 切換），按住就能一直攻擊、不會扣血。打中躲藏者會噴出一點血。<br><br>
<b>🔒 鎖定模式</b>（躲藏者）：家具固定不動，鏡頭可以繞著自己轉、滾輪或兩指縮放，看清楚四周。畫面只剩鎖定、😄 笑聲（挑釁鬼）和血條。再按一次鎖定回到正常。<br><br><b>勝負</b>：時間內抓到所有人鬼贏，撐到時間結束躲藏者贏。<br><br>
<small>🎮 WASD 移動、滑鼠看、左鍵攻擊、F 💨 加速 ${BOOST_T} 秒、V 🌫 噴霧、空白鍵跳、1–9 變身、R 旋轉、L 🔒 鎖定、T 😄 笑聲、E 開門、Alt 放開滑鼠、Esc 選單<br>📱 左半邊搖桿、右半邊轉視角、右下按鈕</small>`;

const P = {
  peer: null, host: false, conns: {}, hostConn: null, myId: null, code: '', name: '',
  players: [], settings: { hide: 30, seek: 240, dashes: 3 }, view: 'home',
  phase: 'off', left: 0, role: 'hider', seeker: null, caught: new Set(), states: {},
  hp: 100, dash: 3, spray: 1, blindT: 0, boostT: 0, base: null, cat: '常用', slot: 'me', form: { k: 'me' }, frot: 0, anchor: null,
  weapon: 'gun', cd: 0, holding: false, remotes: {}, self: null, ownData: null, hooks: {}, stT: 0, relayT: 0, doorT: 0, tauntT: TAUNT_EVERY, doors: [], quick: [],
  lock: false, lockYaw: 0, lockMesh: null, zoom: 2.6, laughCD: 0,
};
export const Prop = P;
const send = m => { if (P.host) hostRecv(P.myId, m); else if (P.hostConn?.open) P.hostConn.send(m); };
function bcast(m, except) {
  for (const id in P.conns) if (id !== except && P.conns[id].open) P.conns[id].send(m);
  if (except !== P.myId) clientRecv(m);
}
function sendTo(id, m) { if (id === P.myId) clientRecv(m); else if (P.conns[id]?.open) P.conns[id].send(m); }
const nameOf = id => P.players.find(p => p.id === id)?.name || '？';
const colorOf = id => P.players.find(p => p.id === id)?.color || '#ccc';

// ---------------- connection ----------------
let peerLib = null;
function loadPeer() {
  if (window.Peer) return Promise.resolve(window.Peer);
  return peerLib || (peerLib = new Promise((ok, no) => { const s = document.createElement('script'); s.src = PEER_SRC; s.onload = () => ok(window.Peer); s.onerror = () => { peerLib = null; no(new Error('load')); }; document.head.appendChild(s); }));
}
async function createRoom(tries = 0) {
  setBusy('建立房間中…');
  try { await loadPeer(); } catch (e) { return fail('無法載入連線元件，請確認有網路'); }
  const code = String(1000 + Math.floor(Math.random() * 9000));
  const peer = new Peer(ID_PRE + code, { debug: 0 });
  peer.on('open', id => {
    Object.assign(P, { peer, host: true, myId: id, code, conns: {}, view: 'room', phase: 'lobby' });
    P.players = [{ id, name: P.name, color: COLORS[0] }]; renderLobby();
  });
  peer.on('connection', conn => {
    conn.on('data', m => hostRecv(conn.peer, m, conn));
    conn.on('close', () => dropPlayer(conn.peer));
    conn.on('error', () => dropPlayer(conn.peer));
  });
  peer.on('error', err => {
    if (err.type === 'unavailable-id' && tries < 5) { peer.destroy(); return createRoom(tries + 1); }
    if (P.peer === peer && P.phase !== 'off') { if (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error') toast('連線伺服器中斷，正在重試…'); return; }
    fail('建立房間失敗：' + err.type);
  });
  peer.on('disconnected', () => { if (P.peer === peer && !peer.destroyed) setTimeout(() => !peer.destroyed && peer.reconnect(), 1500); });
}
async function joinRoom(code) {
  code = (code || '').trim(); if (!/^\d{4}$/.test(code)) return toast('請輸入 4 位數房間號碼');
  setBusy('連線到房間 ' + code + '…');
  try { await loadPeer(); } catch (e) { return fail('無法載入連線元件，請確認有網路'); }
  const peer = new Peer({ debug: 0 });
  let opened = false;
  peer.on('open', id => {
    const conn = peer.connect(ID_PRE + code, { reliable: true });
    Object.assign(P, { peer, host: false, myId: id, code, hostConn: conn });
    conn.on('open', () => { opened = true; conn.send({ t: 'hello', name: P.name }); });
    conn.on('data', clientRecv);
    conn.on('close', () => { if (P.peer === peer) hostGone(); });
    setTimeout(() => { if (!opened && P.peer === peer) fail('連不上房間 ' + code + '，請確認號碼，並且在同一個 Wi-Fi'); }, 12000);
  });
  peer.on('error', err => { if (P.peer && P.peer !== peer) return; fail(err.type === 'peer-unavailable' ? `找不到房間 ${code}` : '連線失敗：' + err.type); });
}
function hostGone() { const was = P.phase; leave(true); if (was !== 'off') showDialog('📴 房主離開了', '房間已經關閉。', [['好', () => { }]]); }
function dropPlayer(id) {
  if (!P.host || !P.conns[id] && !P.players.some(p => p.id === id)) return;
  delete P.conns[id]; const p = P.players.find(x => x.id === id); P.players = P.players.filter(x => x.id !== id); delete P.states[id];
  if (!p) return;
  bcast({ t: 'left', id, name: p.name, players: P.players });
  if (P.phase === 'hide' || P.phase === 'seek') {
    if (id === P.seeker) endRound('hiders', `鬼（${p.name}）離開了`);
    else checkAllCaught();
  } else if (P.phase === 'lobby') bcastLobby();
}
function leave(silent) {
  const wasHost = P.host;
  if (wasHost) for (const id in P.conns) try { P.conns[id].send({ t: 'closed' }); } catch (e) { }
  const peer = P.peer; P.peer = null; setTimeout(() => { try { peer && peer.destroy(); } catch (e) { } }, 300);
  const inRound = S.mode === 'prop';
  stopRound();
  Object.assign(P, { host: false, conns: {}, hostConn: null, players: [], phase: 'off', view: 'home', states: {} });
  closeLobby();
  if (inRound) P.hooks.setMode('menu');
  if (!silent) toast('已離開房間');
}

// ---------------- host: rules & relay ----------------
function bcastLobby() { bcast({ t: 'lobby', players: P.players, settings: P.settings }); }
function hostRecv(from, m, conn) {
  if (m.t === 'hello') {
    if (P.phase !== 'lobby') { conn?.send({ t: 'busy' }); setTimeout(() => conn?.close(), 500); return; }
    if (conn) P.conns[from] = conn;
    if (!P.players.some(p => p.id === from)) { const used = new Set(P.players.map(p => p.color)); P.players.push({ id: from, name: (m.name || '玩家').slice(0, 10), color: COLORS.find(c => !used.has(c)) || '#ccc' }); }
    toast(`👋 ${m.name} 加入了`); bcastLobby(); return;
  }
  if (m.t === 'st') { P.states[from] = m.s; return; }
  if (m.t === 'hit') { if (P.phase === 'seek' && from === P.seeker && !P.caught.has(m.to)) sendTo(m.to, { t: 'hurt', dmg: m.dmg, by: from }); return; }
  if (m.t === 'caught') { if (P.caught.has(from) || from === P.seeker) return; P.caught.add(from); bcast({ t: 'caught', id: from }); checkAllCaught(); return; }
  if (m.t === 'door' || m.t === 'fx') { bcast(m, from); return; }
  if (m.t === 'laugh') { if (P.phase === 'seek' || P.phase === 'hide') bcast({ t: 'laugh', by: from }); return; }
  if (m.t === 'spray') { if (P.phase === 'seek' || P.phase === 'hide') bcast({ ...m, by: from }); return; }
}
function checkAllCaught() {
  if (P.phase !== 'seek' && P.phase !== 'hide') return;
  const hiders = P.players.filter(p => p.id !== P.seeker);
  if (hiders.length && hiders.every(p => P.caught.has(p.id))) endRound('seeker', '所有人都被抓到了');
}
function startRoundHost() {
  if (P.players.length < 2) return toast('至少要 2 個人才能開始');
  const seeker = P.players[Math.floor(Math.random() * P.players.length)].id;
  P.caught = new Set(); P.states = {};
  bcast({ t: 'start', data: S.data, seeker, players: P.players, hide: P.settings.hide, seek: P.settings.seek, dashes: P.settings.dashes || 3 });
}
function endRound(win, why) { if (P.phase === 'end') return; bcast({ t: 'end', win, why, seeker: P.seeker, caught: [...P.caught] }); }
function setLeft(s) { P.endAt = performance.now() + s * 1000; }
Object.defineProperty(P, 'left', { get() { return P.endAt ? (P.endAt - performance.now()) / 1000 : 0; }, set(v) { setLeft(v); } });
// the host keeps the round going on a timer, even when its own screen renders slowly
let lastTick = performance.now();
setInterval(() => { const n = performance.now(), dt = Math.min(.5, (n - lastTick) / 1000); lastTick = n; if (P.host && P.peer && P.phase !== 'off') hostTick(dt); if (S.mode === 'prop' && P.peer) sendMine(dt); }, 50);
function sendMine(dt) {
  P.stT -= dt;
  if (P.stT <= 0) {
    P.stT = 1 / 12; const s = { x: +player.pos.x.toFixed(3), y: +player.pos.y.toFixed(3), z: +player.pos.z.toFixed(3), yaw: +(P.lock ? P.lockYaw : player.yaw).toFixed(3), f: formKey(P.form), fr: +P.frot.toFixed(2), hp: Math.round(P.hp) };
    if (P.form.k === 'wall') s.w = P.wallAt.map(v => +v.toFixed(3));
    send({ t: 'st', s });
  }
  // doors opened on this device → everyone
  P.doorT -= dt; if (P.doorT <= 0) { P.doorT = .25; H.doors.forEach((d, i) => { if (d.open !== P.doors[i]) { P.doors[i] = d.open; send({ t: 'door', i, o: d.open }); } }); }
}
function hostTick(dt) {
  P.relayT -= dt; if (P.relayT <= 0) { P.relayT = 1 / 12; const m = { t: 'sts', s: P.states }; for (const id in P.conns) if (P.conns[id].open) P.conns[id].send(m); }
  if (P.phase === 'hide' && P.left <= 0) bcast({ t: 'phase', phase: 'seek', left: P.settings.seek });
  else if (P.phase === 'seek') {
    if (P.left <= 0) endRound('hiders', '時間到，還有人沒被抓到');
    P.tauntT -= dt; if (P.tauntT <= 0) { P.tauntT = TAUNT_EVERY; bcast({ t: 'taunt' }); }
  }
}

// ---------------- every device ----------------
function clientRecv(m) {
  switch (m.t) {
    case 'lobby': P.players = m.players; P.settings = m.settings; if (P.phase === 'off' || P.phase === 'lobby') { P.phase = 'lobby'; P.view = 'room'; renderLobby(); } break;
    case 'busy': fail('這個房間的遊戲已經開始了，等這局結束再加入'); break;
    case 'closed': hostGone(); break;
    case 'left': P.players = m.players; toast(`👋 ${m.name} 離開了`); { const r = P.remotes[m.id]; if (r) { scene.remove(r.g); delete P.remotes[m.id]; } } if (P.view === 'room') renderLobby(); break;
    case 'start': startRound(m); break;
    case 'sts': for (const id in m.s) if (id !== P.myId) P.states[id] = m.s[id]; break;
    case 'phase': P.phase = m.phase; setLeft(m.left); P.tauntT = TAUNT_EVERY;
      if (m.phase === 'seek') { Snd.stinger(); bigText(P.role === 'seeker' ? '👹 出發！' : '👹 鬼出發了！', P.role === 'seeker' ? '把躲起來的人全部找出來' : '不要動…', 2400); }
      updateHud(); break;
    case 'hurt': hurt(m.dmg); break;
    case 'caught': P.caught.add(m.id);
      if (m.id === P.myId) { setLock(false); P.role = 'spec'; setForm({ k: 'me' }); bigText('😵 你被抓到了', '可以四處看看大家躲在哪', 2600); }
      else { toast(`🎯 ${nameOf(m.id)} 被抓到了！`); if (P.role === 'seeker') { Snd.coin(); } }
      updateHud(); break;
    case 'end': showEnd(m); break;
    case 'again': $('#dialog').classList.remove('show'); stopRound(); P.hooks.setMode('menu'); P.phase = 'lobby'; P.view = 'room'; openLobby(); break;
    case 'door': { const d = H.doors[m.i]; if (d) { d.open = m.o; if (d.pair) d.pair.open = m.o; P.doors[m.i] = m.o; } break; }
    case 'fx': playFx(m); break;
    case 'taunt': taunt(); break;
    case 'spray': sprayFx(m); break;
    case 'laugh': laughFx(m.by); break;
  }
}

// ---------------- round ----------------
function applySize(z) {
  player.eye = z.eye; player.r = z.r; player.speed = z.speed; player.run = z.run; player.jump = z.jump; BODY.lo = z.lo; BODY.hi = z.hi;
}
function startRound(m) {
  closeLobby(); $('#dialog').classList.remove('show');
  if (!P.ownData) P.ownData = S.data;
  S.data = JSON.parse(JSON.stringify(m.data)); build(S.data);
  lightCfg.flicker = 0; lightCfg.intensity = 8; H.lamps.forEach(l => setLamp(l, true)); // prop hunt: every light stays on
  P.players = m.players; P.seeker = m.seeker; P.caught = new Set(); P.states = {};
  P.role = m.seeker === P.myId ? 'seeker' : 'hider';
  DASHES = m.dashes || 3; P.hp = 100; P.dash = DASHES; P.spray = 1; P.blindT = 0; P.boostT = 0; P.cat = '常用'; P.slot = 'me'; P.form = { k: 'me' }; P.frot = 0; P.weapon = 'gun'; P.cd = 0; P.tauntT = TAUNT_EVERY;
  P.phase = 'hide'; setLeft(m.hide); P.doors = H.doors.map(d => d.open);
  for (const id in P.remotes) scene.remove(P.remotes[id].g); P.remotes = {};
  P.hooks.setMode('prop');
  applySize(SMALL); camera.fov = 80; camera.updateProjectionMatrix();
  P.base = { speed: player.speed, run: player.run };
  P.hooks.goHome();
  const i = P.players.findIndex(p => p.id === P.myId); player.pos.x += ((i % 4) - 1.5) * .35; player.pos.z += Math.floor(i / 4) * .35;
  P.quick = pickQuick(); buildHud(); setForm({ k: 'me' }); updateHud();
  if (P.role === 'seeker') bigText('👹 你是鬼', `${m.hide} 秒後出發去抓人`, 3000);
  else bigText('🧍 快躲起來！', `鬼 ${m.hide} 秒後出發 · 用下方圖示變身`, 3000);
  Snd.init(); Snd.bell();
}
export function stopRound() {
  setLock(false);
  P.holding = false;
  for (const id in P.remotes) scene.remove(P.remotes[id].g); P.remotes = {};
  if (P.self) { scene.remove(P.self); P.self = null; }
  vm.visible = false; $('#phHud')?.classList.remove('show'); $('#phBlind')?.classList.remove('show');
  P.blindT = 0; P.boostT = 0; const fog = $('#phFog'); if (fog) { fog.style.opacity = 0; fog.style.backdropFilter = fog.style.webkitBackdropFilter = 'none'; }
  if (player.eye !== NORMAL.eye) { applySize(NORMAL); camera.fov = 72; camera.updateProjectionMatrix(); }
  if (P.ownData) { S.data = P.ownData; P.ownData = null; build(S.data); }
  if (P.phase !== 'off' && P.phase !== 'lobby') P.phase = 'lobby';
}
function showEnd(m) {
  P.phase = 'end'; P.holding = false; if (locked()) releaseLock();
  const iWon = (m.win === 'seeker') === (P.role === 'seeker' || (P.myId === m.seeker));
  Snd[iWon ? 'level' : 'hurt']();
  const rows = P.players.map(p => `<div style="color:${p.color}">${p.id === m.seeker ? '👹' : m.caught.includes(p.id) ? '😵' : '🏆'} ${p.name}${p.id === P.myId ? '（你）' : ''} <small class="mut">${p.id === m.seeker ? '鬼' : m.caught.includes(p.id) ? '被抓到' : '撐到最後'}</small></div>`).join('');
  const title = m.win === 'seeker' ? '👹 鬼獲勝！' : '🧍 躲藏者獲勝！';
  const btns = P.host ? [['🔁 再來一局', () => bcast({ t: 'again' })], ['🚪 解散房間', () => leave()]] : [['👀 等房主開下一局', () => { }], ['🚪 離開房間', () => leave()]];
  showDialog(title, `${m.why}<br><br>${rows}`, btns);
}

// ---------------- forms (disguises) ----------------
const ray = new THREE.Raycaster(), V = new THREE.Vector3(), V2 = new THREE.Vector3();
function pickQuick() {
  const cnt = {};
  for (const f of S.data.floors) for (const x of f.furniture || []) if (CAT[x.type]) cnt[x.type] = (cnt[x.type] || 0) + 1;
  const ok = t => { const g = buildFurniture(t); const b = new THREE.Box3().setFromObject(g), s = b.getSize(V); return s.y < 1.3 && s.x < 1.3 && s.z < 1.3; };
  const list = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]).filter(ok).slice(0, 8);
  // always a few handy small things too
  for (const t of ['cardboard_box', 'cushion', 'garbage_bag', 'plant', 'trash_can', 'basketball', 'sleeping_cat', 'bucket_mop']) if (list.length < 14 && CAT[t] && !list.includes(t)) list.push(t);
  return list;
}
const surfMat = key => { const s = H.surf[key]?.[0]; if (!s) return new THREE.MeshStandardMaterial({ color: '#bbb' }); return Array.isArray(s.mesh.material) ? s.mesh.material[s.idx] : s.mesh.material; };
const formKey = f => f.k === 'f' ? `f|${f.type}|${f.color || ''}` : f.k === 'floor' || f.k === 'wall' ? `${f.k}|${f.key}` : 'me';
function parseForm(k) { const [a, b, c] = (k || 'me').split('|'); return a === 'f' ? { k: 'f', type: b, color: c || undefined } : a === 'floor' || a === 'wall' ? { k: a, key: b } : { k: 'me' }; }
function personMesh(color, seeker) {
  const g = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ color, roughness: .7 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.085, .2, 4, 10), mat); body.position.y = .27; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.08, 14, 10), mat); head.position.y = .52; g.add(head);
  const eyeM = new THREE.MeshBasicMaterial({ color: seeker ? '#ff2a1a' : '#111' });
  for (const x of [-.03, .03]) { const e = new THREE.Mesh(new THREE.SphereGeometry(.013, 6, 4), eyeM); e.position.set(x, .53, -.072); g.add(e); }
  if (seeker) { const hm = new THREE.MeshStandardMaterial({ color: '#2a0a0a' }); for (const x of [-.045, .045]) { const h = new THREE.Mesh(new THREE.ConeGeometry(.02, .07, 6), hm); h.position.set(x, .62, 0); g.add(h); } const gun = new THREE.Mesh(new THREE.BoxGeometry(.03, .04, .12), new THREE.MeshStandardMaterial({ color: '#222' })); gun.position.set(.1, .3, -.08); g.add(gun); }
  return g;
}
function formMesh(f, color, seeker) {
  if (f.k === 'f') { const g = buildFurniture(f.type, f.color); if (g) return g; }
  if (f.k === 'floor') { const m = new THREE.Mesh(new THREE.BoxGeometry(.6, .025, .6), surfMat(f.key)); m.position.y = .012; const g = new THREE.Group(); g.add(m); return g; }
  if (f.k === 'wall') { const m = new THREE.Mesh(new THREE.BoxGeometry(.62, .85, .035), surfMat(f.key)); m.position.y = .425; const g = new THREE.Group(); g.add(m); return g; }
  return personMesh(color, seeker);
}
function nameTag(text, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
  x.fillStyle = 'rgba(0,0,0,.55)'; x.beginPath(); x.roundRect(8, 8, 240, 48, 20); x.fill(); x.fillStyle = color; x.font = 'bold 30px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 128, 33);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true })); s.scale.set(.5, .125, 1); s.renderOrder = 5; return s;
}
function setForm(f) {
  if (P.role !== 'hider' && f.k !== 'me') return;
  P.form = f; if (f.k === 'wall') P.anchor = player.pos.clone();
  if (P.self) scene.remove(P.self);
  P.self = f.k === 'me' ? null : formMesh(f, colorOf(P.myId)); if (P.self) scene.add(P.self);
  document.querySelectorAll('#phForms [data-fm]').forEach(b => b.classList.toggle('on', b.dataset.fm === formSlot(f)));
}
const formSlot = f => f.k === 'f' ? P.slot : f.k;
// hidden things (name tags the seeker can't see, caught players) never stop a shot; hit boxes do
const shown = o => { for (; o; o = o.parent) if (!o.visible && !o.userData.hitbox) return false; return true; };
function aimHit(far, objs) { ray.setFromCamera({ x: 0, y: 0 }, camera); ray.far = far; return ray.intersectObjects(objs, true).find(h => shown(h.object)); }
// an invisible box a bit bigger than a hider's disguise, so thin forms (floor tiles, small props) are still hittable
const hbMat = new THREE.MeshBasicMaterial({ visible: false });
function addHitbox(mesh) {
  const b = new THREE.Box3().setFromObject(mesh), sz = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
  const hb = new THREE.Mesh(new THREE.BoxGeometry(Math.max(.26, sz.x + .06), Math.max(.22, sz.y + .06), Math.max(.26, sz.z + .06)), hbMat);
  hb.position.set(c.x - mesh.position.x, Math.max(.11, c.y - mesh.position.y), c.z - mesh.position.z); hb.userData.hitbox = true; mesh.add(hb);
}
function chooseForm(slot) {
  if (P.role !== 'hider' || P.phase === 'end') return;
  if (slot === 'me') return setForm({ k: 'me' });
  if (slot === 'copy') {
    const h = aimHit(4, H.furn.map(e => e.obj)); const e = h?.object; let fe = null; for (let o = e; o && !fe; o = o.parent) fe = o.userData?.furn;
    if (!fe) return toast('🎯 對準一件家具再按（4 公尺內）');
    P.frot = fe.obj.rotation.y - player.yaw; P.slot = 'copy'; toast('🎯 變成 ' + CAT[fe.f.type].n, 1200); return setForm({ k: 'f', type: fe.f.type, color: fe.f.color });
  }
  if (slot === 'floor') {
    ray.set(V.set(player.pos.x, player.pos.y + .4, player.pos.z), V2.set(0, -1, 0)); ray.far = 1.2;
    const h = ray.intersectObjects(H.slabMeshes, false)[0], key = h?.object.userData.surf?.[h.face.materialIndex];
    if (!key) return toast('腳下找不到地板');
    return setForm({ k: 'floor', key });
  }
  if (slot === 'wall') {
    const dir = V2.set(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    ray.set(V.set(player.pos.x, player.pos.y + .35, player.pos.z), dir); ray.far = 1.4;
    const h = ray.intersectObjects(H.wallMeshes, false)[0], key = h?.object.userData.surf?.[h.face.materialIndex];
    if (!key) return toast('🧱 面對牆壁、靠近一點再按');
    const n = h.face.normal.clone().transformDirection(h.object.matrixWorld); n.y = 0; n.normalize();
    P.wallAt = [h.point.x + n.x * .02, player.pos.y, h.point.z + n.z * .02, Math.atan2(n.x, n.z)];
    return setForm({ k: 'wall', key });
  }
  if (slot.startsWith('q:')) { P.frot = 0; P.slot = slot; return setForm({ k: 'f', type: slot.slice(2) }); }
}

// ---------------- thumbnails for the quick bar ----------------
let thumbR = null; const thumbs = {};
function thumb(type) {
  if (thumbs[type]) return thumbs[type];
  if (!thumbR) { const rt = new THREE.WebGLRenderTarget(72, 72); rt.texture.colorSpace = THREE.SRGBColorSpace; const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight('#ffffff', '#777777', 2.4)); const dl = new THREE.DirectionalLight('#ffffff', 1.6); dl.position.set(2, 4, 3); sc.add(dl); thumbR = { rt, sc, cam: new THREE.PerspectiveCamera(32, 1, .01, 60) }; }
  const { rt, sc, cam } = thumbR, g = buildFurniture(type); if (!g) return '';
  sc.add(g); const b = new THREE.Box3().setFromObject(g), c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3()).length();
  cam.position.set(c.x + s * .8, c.y + s * .65, c.z + s * 1.25); cam.lookAt(c);
  const old = renderer.getRenderTarget(), oc = renderer.getClearColor(new THREE.Color()), oa = renderer.getClearAlpha();
  renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(sc, cam);
  const px = new Uint8Array(72 * 72 * 4); renderer.readRenderTargetPixels(rt, 0, 0, 72, 72, px);
  renderer.setRenderTarget(old); renderer.setClearColor(oc, oa); sc.remove(g);
  const cv = document.createElement('canvas'); cv.width = cv.height = 72; const x = cv.getContext('2d'), im = x.createImageData(72, 72);
  for (let y = 0; y < 72; y++) im.data.set(px.subarray((71 - y) * 288, (72 - y) * 288), y * 288);
  x.putImageData(im, 0, 0); return thumbs[type] = cv.toDataURL();
}

// ---------------- seeker: weapons ----------------
const vm = new THREE.Group(); vm.visible = false;
{
  const dark = new THREE.MeshStandardMaterial({ color: '#2a2a2e', metalness: .5, roughness: .4 }), steel = new THREE.MeshStandardMaterial({ color: '#d8dde2', metalness: .9, roughness: .2 });
  const gun = new THREE.Group(); gun.name = 'gun'; const b1 = new THREE.Mesh(new THREE.BoxGeometry(.035, .05, .2), dark); gun.add(b1); const h1 = new THREE.Mesh(new THREE.BoxGeometry(.03, .08, .04), dark); h1.position.set(0, -.055, .06); gun.add(h1);
  const knife = new THREE.Group(); knife.name = 'knife'; const bl = new THREE.Mesh(new THREE.BoxGeometry(.012, .035, .2), steel); bl.position.z = -.06; knife.add(bl); const hd = new THREE.Mesh(new THREE.BoxGeometry(.025, .03, .09), new THREE.MeshStandardMaterial({ color: '#3a2214' })); hd.position.z = .08; knife.add(hd);
  vm.add(gun, knife); vm.position.set(.13, -.12, -.3);
}
let swing = 0;
function fire() {
  const now = performance.now(); if (P.role !== 'seeker' || P.phase !== 'seek' || now < P.cd) return;
  const w = WEAP[P.weapon]; P.cd = now + w.cd * 1000; swing = 1; Snd.init();
  const targets = Object.values(P.remotes).filter(r => r.alive && r.id !== P.seeker).map(r => r.g);
  const h = aimHit(w.range, [...targets, ...H.wallMeshes, ...H.slabMeshes, ...H.furn.map(e => e.obj)]);
  if (P.weapon === 'gun') Snd.gun(); else Snd.whoosh();
  send({ t: 'fx', k: P.weapon, p: [camera.position.x, camera.position.y, camera.position.z] });
  if (!h) return;
  let rid = null, fe = null; for (let o = h.object; o; o = o.parent) { if (o.userData?.rid) rid = o.userData.rid; if (o.userData?.furn) fe = o.userData.furn; }
  if (rid) { send({ t: 'hit', to: rid, dmg: w.dmg }); blood(h.point); Snd.tone(120, .06, 'sine', .08, 60); }
  else if (P.weapon === 'gun') spark(h.point, '#ffd24a');
}
// a small spray of blood where a hider was hit: just enough for the seeker to notice
function blood(p) {
  for (let i = 0; i < 7; i++) {
    const m = new THREE.Mesh(BLOOD_G, new THREE.MeshBasicMaterial({ color: i % 2 ? '#a00d0d' : '#d01818', transparent: true }));
    m.position.copy(p); m.scale.setScalar(.6 + Math.random() * .8); scene.add(m);
    sparks.push({ m, t: .45, T: .45, v: new THREE.Vector3((Math.random() - .5) * 1.4, .4 + Math.random() * 1.1, (Math.random() - .5) * 1.4) });
  }
}
function hitMark() { const c = $('#phHit'); c.classList.remove('on'); void c.offsetWidth; c.classList.add('on'); }
const sparks = [], BLOOD_G = new THREE.SphereGeometry(.012, 5, 4);
function spark(p, color) { const m = new THREE.Mesh(new THREE.SphereGeometry(.03, 6, 4), new THREE.MeshBasicMaterial({ color, transparent: true })); m.position.copy(p); scene.add(m); sparks.push({ m, t: .3 }); }
function playFx(m) {
  const d = Math.hypot(m.p[0] - camera.position.x, m.p[2] - camera.position.z) + Math.abs(m.p[1] - camera.position.y) * 2, v = clamp(1 - d / 22, 0, 1);
  if (v < .05) return; Snd.init();
  if (m.k === 'gun') { Snd.noise(.09, .45 * v, 2600, 'lowpass', 300); Snd.tone(200, .08, 'square', .12 * v, 70); } else Snd.noise(.15, .2 * v, 2500, 'bandpass', 500);
}
function hurt(dmg) {
  if (P.role !== 'hider') return;
  P.hp = Math.max(0, P.hp - dmg); Snd.hurt(); fx.shake = .45;
  const f = $('#flash'); f.style.background = 'rgba(255,0,0,.35)'; f.style.opacity = 1; setTimeout(() => f.style.opacity = 0, 160);
  if (P.hp <= CAUGHT_HP) { P.hp = Math.max(P.hp, 1); send({ t: 'caught' }); }
  updateHud();
}
function spray() {
  if (S.mode !== 'prop' || P.role !== 'hider' || P.spray <= 0 || P.phase === 'end') return;
  P.spray--; Snd.init();
  const d = V.set(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  send({ t: 'spray', p: [player.pos.x + d.x * .4, player.pos.y + .3, player.pos.z + d.z * .4], d: [d.x, d.z] });
  if (P.form.k === 'wall') setForm({ k: 'me' });
  updateHud();
}
const fogG = new THREE.SphereGeometry(.12, 8, 6);
function sprayFx(m) {
  const o = new THREE.Vector3(...m.p);
  for (let i = 0; i < 26; i++) {
    const mt = new THREE.MeshBasicMaterial({ color: i % 3 ? '#e8eef2' : '#bfe6d0', transparent: true, opacity: .7, depthWrite: false });
    const mesh = new THREE.Mesh(fogG, mt); mesh.position.copy(o); mesh.scale.setScalar(.5 + Math.random()); scene.add(mesh);
    const sp = 1.2 + Math.random() * 2.4;
    sparks.push({ m: mesh, t: 1.6, T: 1.6, grow: 1.8, v: new THREE.Vector3(m.d[0] * sp + (Math.random() - .5) * 1.2, (Math.random() - .2) * .7, m.d[1] * sp + (Math.random() - .5) * 1.2), drag: 1 });
  }
  const dist = o.distanceTo(player.pos);
  if (dist < 14) { Snd.noise(.6, .25 * clamp(1 - dist / 14, 0, 1), 3000, 'highpass', 900); }
  if (P.role === 'seeker' && P.phase === 'seek' && dist < SPRAY_R) { P.blindT = SPRAY_T; fx.shake = .3; toast('🌫 被噴霧噴到了，看不清楚！', 1500); }
  else if (m.by === P.myId) toast('🌫 噴霧！', 900);
}
function taunt() {
  Snd.init();
  if (P.role === 'hider') { Snd.giggle(0, .07); toast('😄 你發出了笑聲…', 1000); }
  for (const r of Object.values(P.remotes)) if (r.alive && r.id !== P.seeker) giggleFrom(r, .3, 20);
}
// a giggle that sounds like it comes from where that player is
function giggleFrom(r, vol, range) {
  const dx = r.g.position.x - player.pos.x, dz = r.g.position.z - player.pos.z, d = Math.hypot(dx, dz) + Math.abs(r.g.position.y - player.pos.y) * 2;
  const v = vol * clamp(1 - d / range, 0, 1); if (v < .02) return;
  const ang = Math.atan2(dx, -dz) + player.yaw; Snd.giggle(clamp(Math.sin(ang), -1, 1), v);
}
// 😄 a hider laughs on purpose to tease the seeker (everyone hears it from that spot)
function laugh() {
  if (S.mode !== 'prop' || P.role !== 'hider' || P.phase === 'end' || P.laughCD > 0) return;
  P.laughCD = 2.5; send({ t: 'laugh' });
}
function laughFx(id) {
  Snd.init();
  if (id === P.myId) { Snd.giggle(0, .12); toast('😄 哈哈哈～鬼聽得到你在哪', 1000); return; }
  const r = P.remotes[id]; if (r && r.alive) { giggleFrom(r, .45, 26); setTimeout(() => P.remotes[id] && giggleFrom(P.remotes[id], .3, 26), 260); }
}
// 🔒 lock mode: the disguise stays put and the camera orbits around it (drag to turn, wheel / pinch to zoom)
function setLock(on) {
  if (on && (S.mode !== 'prop' || P.role !== 'hider' || P.phase === 'end')) return;
  if (!on && !P.lock) return;
  P.lock = !!on; document.body.classList.toggle('phlock', P.lock); input.noJoy = P.lock; input.jx = input.jy = 0; pinch = null;
  if (P.lock) {
    P.lockYaw = player.yaw; P.zoom = P.form.k === 'f' ? 2.6 : 2;
    if (!P.self) { P.lockMesh = formMesh({ k: 'me' }, colorOf(P.myId)); scene.add(P.lockMesh); }
    toast(isTouch ? '🔒 鎖定：滑動轉視角、兩指縮放' : '🔒 鎖定：移動滑鼠轉視角、滾輪縮放，L 解除', 2200);
  } else {
    if (P.lockMesh) { scene.remove(P.lockMesh); P.lockMesh = null; }
    if (P.form.k === 'f') P.frot += P.lockYaw - player.yaw; // keep the furniture facing the same way
  }
  updateHud();
}
let pinch = null;
renderer.domElement.addEventListener('touchmove', e => {
  if (!P.lock || S.mode !== 'prop' || e.touches.length !== 2) return;
  const [a, b] = e.touches, d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  if (!pinch) pinch = { d, z: P.zoom, yaw: player.yaw, pitch: player.pitch }; else P.zoom = clamp(pinch.z * pinch.d / Math.max(20, d), .8, 7);
}, { passive: true });
renderer.domElement.addEventListener('touchend', e => { if (e.touches.length < 2) pinch = null; });
addEventListener('wheel', e => { if (P.lock && S.mode === 'prop') P.zoom = clamp(P.zoom * (e.deltaY > 0 ? 1.12 : 1 / 1.12), .8, 7); }, { passive: true });

// ---------------- HUD & lobby UI ----------------
const CSS = `
#phLobby{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.55);z-index:44;padding:16px}
#phLobby.show{display:flex}
#phLobby .card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:18px;width:min(480px,100%);max-height:92vh;overflow:auto}
#phLobby h2{margin:0 0 4px} #phLobby .code{font-size:46px;font-weight:800;letter-spacing:8px;color:#ffd24a;text-align:center;margin:6px 0}
#phLobby .pl{display:flex;flex-direction:column;gap:4px;margin:8px 0} #phLobby .pl div{background:rgba(255,255,255,.06);border-radius:8px;padding:6px 10px}
#phLobby .row{display:flex;gap:8px;align-items:center;margin:8px 0} #phLobby .row input{flex:1} #phLobby .row label{white-space:nowrap;font-size:13px;color:var(--mut)}
#phLobby .row select{width:auto;flex:1}
#phHud{position:fixed;inset:0;pointer-events:none;z-index:7;display:none} #phHud.show{display:block}
#phHud button{pointer-events:auto}
#phTop{position:absolute;left:50%;top:calc(8px + var(--sat));transform:translateX(-50%);background:rgba(0,0,0,.6);padding:6px 14px;border-radius:12px;text-align:center;font-weight:700;white-space:nowrap}
#phTop small{display:block;font-weight:400;color:var(--mut);font-size:12px}
#phRole{position:absolute;left:10px;top:calc(8px + var(--sat));background:rgba(0,0,0,.6);padding:6px 10px;border-radius:10px;font-size:13px;line-height:1.5}
#phMenu{position:absolute;right:10px;top:calc(8px + var(--sat))}
#phBottom{position:absolute;left:50%;bottom:calc(10px + var(--sab));transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:6px;max-width:calc(100vw - 20px)}
#phStat{display:flex;gap:7px;align-items:center;background:rgba(0,0,0,.5);padding:3px 7px;border-radius:9px;font-size:11px}
#phStat button{font-size:11px;padding:2px 7px;border-radius:8px;background:rgba(255,255,255,.12);white-space:nowrap} #phStat kbd{font-size:9px;opacity:.6;margin-left:2px}
body.touch #phStat kbd{display:none}
#phHp{width:72px;height:6px;background:rgba(255,255,255,.15);border-radius:3px;overflow:hidden} #phHp i{display:block;height:100%;background:linear-gradient(90deg,#3c3,#9e4);width:100%}
#phForms,#phWeap{display:flex;gap:5px;overflow-x:auto;max-width:100%;padding:2px}
#phCats{display:flex;gap:4px;overflow-x:auto;max-width:100%;padding:1px 2px}
#phCats button{flex:none;font-size:10px;padding:2px 7px;border-radius:10px;background:rgba(20,24,30,.8)} #phCats button.on{background:#ffb020;color:#111}
#phForms button,#phWeap button{flex:none;width:58px;height:58px;padding:2px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:20px;background:rgba(20,24,30,.85);line-height:1.1}
#phForms{gap:3px} #phForms button{width:30px;height:30px;padding:1px;font-size:14px;border-radius:7px} #phForms button small{display:none}
#phForms button small,#phWeap button small{font-size:10px;color:#ddd;max-width:54px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
#phForms button img{width:24px;height:24px} #phForms button.on,#phWeap button.on{background:var(--acc)}
#phForms button i{position:absolute;margin:-40px 0 0 -40px;font-size:9px;font-style:normal;color:#aaa}
#phTouch{position:absolute;right:12px;bottom:calc(84px + var(--sab));display:none;flex-direction:column;gap:10px;align-items:flex-end}
body.touch #phTouch{display:flex}
#phTouch button{width:62px;height:62px;border-radius:50%;font-size:24px;background:rgba(0,0,0,.45)} #phTouch .big{width:84px;height:84px;font-size:34px}
#phBlind{position:fixed;inset:0;background:#000;z-index:8;display:none;align-items:center;justify-content:center;flex-direction:column;font-size:22px;text-align:center;pointer-events:none}
#phBlind.show{display:flex} #phBlind b{font-size:64px;color:#ff5a3a}
#phHit{position:fixed;left:50%;top:50%;width:26px;height:26px;margin:-13px;pointer-events:none;z-index:9;opacity:0;border:3px solid #ff3a2a;border-radius:50%}
#phFog{position:fixed;inset:0;pointer-events:none;z-index:6;opacity:0;background:radial-gradient(circle,rgba(235,240,238,.55),rgba(215,228,222,.9))}
#phHit.on{animation:phh .25s} @keyframes phh{0%{opacity:1;transform:scale(.6)}100%{opacity:0;transform:scale(1.4)}}
body[data-mode=prop] #cross{display:block} body[data-mode=prop] #flname{display:block}
body.touch #phBottom{left:auto;right:auto;left:50%}
@media (max-width:760px){#phWeap button{width:50px;height:50px} #phForms button{width:28px;height:28px} #phForms button img{width:22px;height:22px} #phTop{font-size:13px}}
body.phlock #phTop,body.phlock #phRole,body.phlock #phMenu,body.phlock #phCats,body.phlock #phForms,body.phlock #phTouch,body.phlock #cross,body.phlock #hint,body.phlock #flname,body.phlock #joy,body.phlock #topr,body.phlock #phFog{display:none!important}
body.phlock #phStat{font-size:13px;padding:5px 9px;gap:9px} body.phlock #phStat button{font-size:13px;padding:5px 11px}
`;
function ensureDom() {
  if ($('#phLobby')) return;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const d = document.createElement('div'); d.innerHTML = `<div id="phLobby"></div>
  <div id="phHud"><div id="phTop"></div><div id="phRole"></div><button id="phMenu">☰</button>
    <div id="phBottom"><div id="phStat"><button id="phLockB"></button><span id="phStatT"></span><button id="phLaughB">😄<kbd>T</kbd></button></div><div id="phCats"></div><div id="phForms"></div><div id="phWeap"></div></div>
    <div id="phTouch"><button data-pt="jump">⤒</button><button data-pt="spray">🌫</button><button data-pt="dash">💨</button><button data-pt="sw">🔄</button><button data-pt="atk" class="big">🔫</button></div></div>
  <div id="phBlind"><b>👹</b><div>你是鬼，眼睛先矇住</div><div id="phBlindT" style="font-size:40px;margin-top:10px"></div></div><div id="phHit"></div><div id="phFog"></div>`;
  while (d.firstChild) document.body.appendChild(d.firstChild);
  $('#phMenu').onclick = e => { e.stopPropagation(); pause(); };
  $('#phLockB').onclick = e => { e.stopPropagation(); setLock(!P.lock); };
  $('#phLaughB').onclick = e => { e.stopPropagation(); laugh(); };
  document.querySelectorAll('#phTouch [data-pt]').forEach(b => {
    const a = b.dataset.pt;
    b.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); if (a === 'atk') { P.holding = true; fire(); } if (a === 'jump') input.keys.Space = true; if (a === 'dash') dash(); if (a === 'spray') spray(); if (a === 'sw') switchW(); }, { passive: false });
    b.addEventListener('touchend', e => { e.preventDefault(); if (a === 'atk') P.holding = false; if (a === 'jump') input.keys.Space = false; }, { passive: false });
    b.onclick = e => { e.stopPropagation(); if (isTouch) return; if (a === 'spray') spray(); if (a === 'dash') dash(); if (a === 'sw') switchW(); };
  });
}
// furniture you can turn into, by category (wall / ceiling mounted things and huge ones are left out)
const HIDE_GRP = new Set(['後室']);
function catList(g) {
  if (g === '常用') return P.quick;
  return Object.keys(CAT).filter(id => CAT[id].grp === g && !(CAT[id].y > 1)).filter(id => { const f = footprint(id); return f.w < 2.6 && f.d < 2.6 && f.h < 2.6; });
}
function buildForms() {
  const groups = ['常用', '小物件', ...new Set(Object.values(CAT).map(d => d.grp).filter(g => !HIDE_GRP.has(g) && g !== '小物件'))];
  $('#phCats').innerHTML = groups.map(g => `<button data-cg="${g}" class="${g === P.cat ? 'on' : ''}">${g}</button>`).join('');
  $('#phCats').querySelectorAll('[data-cg]').forEach(b => b.onclick = e => { e.stopPropagation(); P.cat = b.dataset.cg; buildForms(); });
  const slots = [['me', '🧍', '人'], ['copy', '🎯', '複製'], ['floor', '🟫', '地板'], ['wall', '🧱', '牆壁'], ...catList(P.cat).map(t => ['q:' + t, `<img src="${thumb(t)}">`, CAT[t].n])];
  $('#phForms').innerHTML = slots.map(([id, ic, n], i) => `<button data-fm="${id}" title="${i < 9 ? i + 1 : ''}" class="${id === formSlot(P.form) ? 'on' : ''}">${ic}<small>${n}</small></button>`).join('');
  $('#phForms').querySelectorAll('[data-fm]').forEach(b => b.onclick = e => { e.stopPropagation(); chooseForm(b.dataset.fm); });
  $('#phForms').scrollLeft = 0;
}
function buildHud() {
  ensureDom(); $('#phHud').classList.add('show');
  const hider = P.role === 'hider';
  $('#phForms').style.display = hider ? 'flex' : 'none'; $('#phWeap').style.display = P.role === 'seeker' ? 'flex' : 'none';
  $('#phCats').style.display = hider ? 'flex' : 'none';
  if (hider) buildForms();
  $('#phWeap').innerHTML = Object.entries(WEAP).map(([id, w]) => `<button data-w="${id}">${w.ic}<small>${w.n}</small></button>`).join('');
  $('#phWeap').querySelectorAll('[data-w]').forEach(b => b.onclick = e => { e.stopPropagation(); P.weapon = b.dataset.w; updateHud(); });
  $('#phTouch [data-pt=atk]').style.display = $('#phTouch [data-pt=sw]').style.display = P.role === 'seeker' ? '' : 'none';
  $('#phTouch [data-pt=dash]').style.display = $('#phTouch [data-pt=spray]').style.display = P.role === 'hider' ? '' : 'none';
  if (!camera.parent) scene.add(camera); if (vm.parent !== camera) camera.add(vm);
}
const fmt = s => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;
let hudT = 0;
function updateHud() {
  if (!$('#phHud')) return;
  const hiders = P.players.filter(p => p.id !== P.seeker), alive = hiders.filter(p => !P.caught.has(p.id)).length;
  $('#phTop').innerHTML = P.phase === 'hide' ? `🙈 躲藏時間 ${fmt(P.left)}<small>鬼還矇著眼睛</small>` : P.phase === 'seek' ? `👹 尋找中 ${fmt(P.left)}<small>還有 ${alive} / ${hiders.length} 人沒被抓</small>` : '🏁 這局結束';
  $('#phRole').innerHTML = (P.role === 'seeker' ? '👹 你是<b>鬼</b>' : P.role === 'spec' ? '😵 已被抓（觀戰）' : '🧍 你是<b>躲藏者</b>') + `<br><span class="mut">鬼：</span><span style="color:${colorOf(P.seeker)}">${nameOf(P.seeker)}</span>`;
  const show = P.role === 'hider';
  $('#phStat').style.display = show ? 'flex' : 'none';
  $('#phLockB').innerHTML = P.lock ? '🔓 解除<kbd>L</kbd>' : '🔒 鎖定<kbd>L</kbd>';
  $('#phLaughB').style.opacity = P.laughCD > 0 ? .4 : 1;
  $('#phStatT').innerHTML = `❤️ <div id="phHp" style="display:inline-block;vertical-align:middle"><i style="width:${P.hp}%;${P.hp < 35 ? 'background:#e33' : ''}"></i></div> ${Math.ceil(P.hp)}` + (P.lock ? '' : `　💨 ${P.boostT > 0 ? `<b style="color:#7cf">${P.boostT.toFixed(1)}s</b> ` : ''}${'●'.repeat(P.dash)}${'○'.repeat(Math.max(0, DASHES - P.dash))}　<span style="opacity:${P.spray ? 1 : .35}">🌫 ${P.spray}</span>`);
  $('#phWeap').querySelectorAll('[data-w]').forEach(b => b.classList.toggle('on', b.dataset.w === P.weapon));
  $('#phTouch [data-pt=atk]').textContent = WEAP[P.weapon].ic;
  $('#phTouch [data-pt=spray]').style.opacity = P.spray ? 1 : .35;
  if (P.role === 'spec') $('#phForms').style.display = $('#phCats').style.display = 'none';
  $('#phBlind').classList.toggle('show', P.role === 'seeker' && P.phase === 'hide');
  $('#phBlindT').textContent = Math.ceil(P.left);
}
function bigText(t, s, ms) { const b = $('#banner'); b.innerHTML = `<b>${t}</b><span>${s}</span>`; b.classList.add('show'); clearTimeout(bigText.t); bigText.t = setTimeout(() => b.classList.remove('show'), ms); }
function setBusy(t) { P.view = 'busy'; P.busy = t; renderLobby(); }
function fail(t) { try { P.peer?.destroy(); } catch (e) { } P.peer = null; P.phase = 'off'; P.view = 'home'; renderLobby(); toast(t, 3500); }
export function openLobby(code) {
  ensureDom(); try { P.name = P.name || localStorage.getItem('home3d_ph_name') || ''; } catch (e) { }
  if (code) P.prefill = code;
  $('#phLobby').classList.add('show'); renderLobby();
}
function closeLobby() { $('#phLobby')?.classList.remove('show'); }
function renderLobby() {
  const el = $('#phLobby'); if (!el) return;
  const saveName = () => { const v = ($('#phName')?.value || '').trim().slice(0, 10); if (!v) { toast('先輸入你的名字'); return false; } P.name = v; try { localStorage.setItem('home3d_ph_name', v); } catch (e) { } return true; };
  if (P.view === 'busy') { el.innerHTML = `<div class="card"><h2>🎭 道具躲貓貓</h2><p>${P.busy}</p><div class="rowb"><button id="phCancel">取消</button></div></div>`; $('#phCancel').onclick = () => fail('已取消'); return; }
  if (P.view === 'home') {
    el.innerHTML = `<div class="card"><h2>🎭 道具躲貓貓 <small class="mut" style="font-size:13px">多人連線</small></h2>
      <p class="mut" style="font-size:13px;margin:4px 0 10px">家人用手機或電腦打開這個網站，連同一個 Wi-Fi。一個人建立房間，其他人輸入房間號碼加入。</p>
      <div class="row"><label>你的名字</label><input id="phName" maxlength="10" value="${(P.name || '').replace(/"/g, '')}" placeholder="例如：爸爸"></div>
      <div class="rowb"><button id="phCreate" class="go" style="flex:1">🏠 建立房間</button></div>
      <div class="row"><input id="phCode" inputmode="numeric" maxlength="4" placeholder="4 位數房間號碼" value="${P.prefill || ''}"><button id="phJoin">🔗 加入</button></div>
      <details style="margin-top:8px"><summary class="mut" style="font-size:13px">📖 怎麼玩</summary><p style="font-size:13px;line-height:1.6">${HELP}</p></details>
      <div class="rowb"><button id="phClose">✖ 關閉</button></div></div>`;
    $('#phCreate').onclick = () => saveName() && createRoom();
    $('#phJoin').onclick = () => saveName() && joinRoom($('#phCode').value);
    $('#phCode').onkeydown = e => { if (e.key === 'Enter') $('#phJoin').click(); };
    $('#phClose').onclick = () => closeLobby();
    return;
  }
  // room
  const me = P.host, url = location.origin + location.pathname + '?room=' + P.code;
  el.innerHTML = `<div class="card"><h2>🎭 房間</h2><div class="mut" style="text-align:center;font-size:13px">房間號碼</div><div class="code">${P.code}</div>
    <div class="mut" style="text-align:center;font-size:12px;word-break:break-all">家人打開網站 → 道具躲貓貓 → 輸入號碼<br>或直接開：${url}</div>
    <div class="grp">玩家（${P.players.length} 人）</div><div class="pl">${P.players.map(p => `<div style="color:${p.color}">● ${p.name}${p.id === P.players[0]?.id ? ' 👑房主' : ''}${p.id === P.myId ? '（你）' : ''}</div>`).join('')}</div>
    ${me ? `<div class="row"><label>躲藏時間</label><select id="phHideT">${[20, 30, 45, 60].map(s => `<option value="${s}" ${s === P.settings.hide ? 'selected' : ''}>${s} 秒</option>`).join('')}</select>
      <label>尋找時間</label><select id="phSeekT">${[120, 180, 240, 300, 480].map(s => `<option value="${s}" ${s === P.settings.seek ? 'selected' : ''}>${s / 60} 分鐘</option>`).join('')}</select></div>
      <div class="row"><label>💨 加速次數</label><select id="phDashN">${[3, 4, 5, 6, 7, 8, 9, 10].map(n => `<option value="${n}" ${n === (P.settings.dashes || 3) ? 'selected' : ''}>每人 ${n} 次</option>`).join('')}</select><label class="mut">每次 ${BOOST_T} 秒</label></div>
      <div class="mut" style="font-size:12px">開始時隨機選一個人當鬼，用房主目前設計的家來玩。</div>
      <div class="rowb"><button id="phStart" class="go" style="flex:1" ${P.players.length < 2 ? 'disabled' : ''}>▶ 開始遊戲${P.players.length < 2 ? '（等其他人加入）' : ''}</button></div>`
      : `<p class="mut" style="text-align:center">⏳ 等房主開始遊戲…<br><small>躲藏 ${P.settings.hide} 秒 · 尋找 ${P.settings.seek / 60} 分鐘 · 加速 ${P.settings.dashes || 3} 次</small></p>`}
    <details><summary class="mut" style="font-size:13px">📖 怎麼玩</summary><p style="font-size:13px;line-height:1.6">${HELP}</p></details>
    <div class="rowb"><button id="phLeave" class="danger">🚪 ${me ? '解散房間' : '離開房間'}</button></div></div>`;
  $('#phLeave').onclick = () => leave();
  if (me) {
    $('#phHideT').onchange = e => { P.settings.hide = +e.target.value; bcastLobby(); };
    $('#phSeekT').onchange = e => { P.settings.seek = +e.target.value; bcastLobby(); };
    $('#phDashN').onchange = e => { P.settings.dashes = +e.target.value; bcastLobby(); };
    $('#phStart').onclick = () => { Snd.init(); startRoundHost(); };
  }
}
export function pause() {
  if (S.mode !== 'prop' || $('#dialog').classList.contains('show')) return;
  showDialog('🎭 道具躲貓貓', `房間 ${P.code} · 遊戲還在進行，其他人不會暫停。`, [['▶ 繼續', () => { }], ['📖 遊戲說明', () => showDialog('📖 道具躲貓貓', HELP, [['◀ 返回', () => pause()]])], ['🚪 離開房間', () => showDialog('確定離開？', P.host ? '你是房主，離開後房間會解散。' : '離開後這局就不能再回來了。', [['🚪 離開', () => leave()], ['取消', () => { }]])]]);
}

// ---------------- input ----------------
function switchW() { if (P.role !== 'seeker') return; P.weapon = P.weapon === 'gun' ? 'knife' : 'gun'; updateHud(); }
function dash() {
  if (S.mode !== 'prop' || P.role !== 'hider' || P.dash <= 0 || P.boostT > 0 || P.phase === 'end') return;
  P.dash--; P.boostT = BOOST_T; Snd.init(); Snd.whoosh(); fx.kick = -.03; toast(`💨 加速 ${BOOST_T} 秒！`, 1000);
  if (P.form.k === 'wall') setForm({ k: 'me' });
  updateHud();
}
on.propDown = () => { if (P.role === 'seeker') { P.holding = true; fire(); } };
on.propUp = () => { P.holding = false; };
addEventListener('keydown', e => {
  if (S.mode !== 'prop' || e.repeat || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
  if (e.code === 'KeyL') setLock(!P.lock);
  if (e.code === 'KeyT') laugh();
  if (P.lock) return;
  if (e.code === 'KeyF') dash();
  if (e.code === 'KeyV') spray();
  if (e.code === 'KeyQ') switchW();
  if (e.code === 'KeyR' && P.role === 'hider' && P.form.k === 'f') P.frot += Math.PI / 4;
  if (/^Digit[1-9]$/.test(e.code)) { const b = document.querySelectorAll('#phForms [data-fm]')[+e.code.slice(5) - 1]; if (b && P.role === 'hider') chooseForm(b.dataset.fm); if (P.role === 'seeker') { P.weapon = e.code === 'Digit2' ? 'knife' : 'gun'; updateHud(); } }
});

// ---------------- per frame ----------------
export function canMove() { return S.mode === 'prop' && !(P.role === 'seeker' && P.phase === 'hide') && P.form.k !== 'wall' && !P.lock && !$('#dialog').classList.contains('show'); }
const camBack = new THREE.Vector3();
export function updateProp(dt) {
  for (let i = sparks.length - 1; i >= 0; i--) { const s = sparks[i]; s.t -= dt; s.m.material.opacity = s.t / (s.T || .3); if (s.v) { if (s.drag) s.v.multiplyScalar(Math.max(0, 1 - dt * 2.2)); else s.v.y -= 6 * dt; s.m.position.addScaledVector(s.v, dt); } if (s.grow) s.m.scale.multiplyScalar(1 + s.grow * dt); if (s.t <= 0) { scene.remove(s.m); sparks.splice(i, 1); } }
  if (S.mode !== 'prop') return;
  if (P.blindT > 0) P.blindT = Math.max(0, P.blindT - dt);
  { const f = $('#phFog'); if (f) { const a = clamp(P.blindT / SPRAY_T * 1.4, 0, 1); f.style.opacity = a; f.style.backdropFilter = f.style.webkitBackdropFilter = `blur(${(a * 14).toFixed(1)}px)`; } }
  if (P.holding && P.role === 'seeker') fire();
  // 💨 boost: run faster for a few seconds
  if (P.base) { if (P.boostT > 0) P.boostT = Math.max(0, P.boostT - dt); const m = P.boostT > 0 ? BOOST_X : 1; player.speed = P.base.speed * m; player.run = P.base.run * m; }
  // own disguise follows you; disguised hiders get a camera behind them so they can see what they look like
  if (P.laughCD > 0) P.laughCD -= dt;
  if (pinch) { player.yaw = pinch.yaw; player.pitch = pinch.pitch; } // pinching zooms, it shouldn't also spin the view
  const me = P.self || P.lockMesh;
  if (me) {
    const yaw = P.lock ? P.lockYaw : player.yaw;
    if (P.form.k === 'wall' && P.wallAt) { me.position.set(P.wallAt[0], P.wallAt[1], P.wallAt[2]); me.rotation.y = P.wallAt[3]; }
    else { me.position.copy(player.pos); me.rotation.y = yaw + (P.form.k === 'f' ? P.frot : 0); }
    const head = V.set(player.pos.x, player.pos.y + (P.lock ? .4 : .55), player.pos.z);
    camBack.set(Math.sin(player.yaw) * Math.cos(player.pitch), -Math.sin(player.pitch), Math.cos(player.yaw) * Math.cos(player.pitch));
    let dist = P.lock ? P.zoom : P.form.k === 'f' ? 1.9 : 1.3; ray.set(head, camBack); ray.far = dist; const h = ray.intersectObjects([...H.wallMeshes, ...H.slabMeshes], false)[0]; if (h) dist = Math.max(.15, h.distance - .12);
    camera.position.copy(head).addScaledVector(camBack, dist);
  }
  vm.visible = P.role === 'seeker' && P.phase !== 'end';
  if (vm.visible) { swing = Math.max(0, swing - dt * 5); vm.getObjectByName('gun').visible = P.weapon === 'gun'; vm.getObjectByName('knife').visible = P.weapon === 'knife'; vm.rotation.x = P.weapon === 'knife' ? -swing * 1.2 : swing * .25; vm.position.z = -.3 + swing * (P.weapon === 'gun' ? .04 : -.08); }
  // (my own state and door changes are sent from the timer in sendMine)
  // the other players
  const k = 1 - Math.exp(-dt * 12);
  for (const pl of P.players) {
    if (pl.id === P.myId) continue; const s = P.states[pl.id]; if (!s) continue;
    let r = P.remotes[pl.id];
    if (!r) { r = P.remotes[pl.id] = { id: pl.id, g: new THREE.Group(), fk: null, alive: true }; scene.add(r.g); r.g.position.set(s.x, s.y, s.z); r.tag = nameTag(pl.name, pl.color); r.g.add(r.tag); }
    if (r.fk !== s.f) { if (r.mesh) r.g.remove(r.mesh); r.fk = s.f; r.mesh = formMesh(parseForm(s.f), pl.color, pl.id === P.seeker); if (pl.id !== P.seeker) addHitbox(r.mesh); r.mesh.traverse(o => o.userData.rid = pl.id); r.g.add(r.mesh); }
    r.alive = !P.caught.has(pl.id); r.g.visible = r.alive || pl.id === P.seeker;
    if (s.w) { r.g.position.set(s.w[0], s.w[1], s.w[2]); r.mesh.rotation.y = s.w[3]; }
    else { r.g.position.lerp(V2.set(s.x, s.y, s.z), k); r.mesh.rotation.y = s.yaw + (s.f.startsWith('f|') ? s.fr : 0); }
    // names: teammates and spectators see them, the seeker never does (that would give everyone away)
    r.tag.visible = P.phase === 'end' || P.role === 'spec' || (P.role === 'hider' && pl.id !== P.seeker) || (P.role !== 'seeker' && pl.id === P.seeker);
    r.tag.position.y = (r.fk === 'me' ? .78 : 1.2);
  }
  hudT -= dt; if (hudT <= 0) { hudT = .25; updateHud(); }
}
export function initProp(hooks) {
  P.hooks = hooks;
  const room = new URLSearchParams(location.search).get('room');
  if (room && /^\d{4}$/.test(room)) setTimeout(() => openLobby(room), 600);
}
