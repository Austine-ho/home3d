// zones = extra levels that are not regular floors: basement + sewer (B1) and admin-only backrooms.
// Also the default portals, monsters, treasure chests and street props.
import { rng } from './core.js';

const FH = 3.2;
let idf = null;
const W = (x1, d1, x2, d2, a, b, ops = [], extra = {}) => ({ id: idf('w'), x1, d1, x2, d2, a, b, kind: 'wall', ops: ops.map(o => ({ id: idf('o'), ...o })), ...extra });
const R = (name, x0, d0, x1, d1, floor, extra = {}) => ({ id: idf('r'), name, x0, d0, x1, d1, floor, ...extra });
const F = (type, x, d, rot = 0, y = 0, extra = {}) => ({ type, x, d, rot, y, ...extra });

export function makeBasement(nid) {
  idf = nid;
  return {
    id: 'b1', name: 'B1 地下室', kind: 'basement', y: -FH,
    env: { bright: .85, tint: '#e6ecef', lamp: '#e8f0ff', fog: .035, sky: '#0a0f0a' },
    rooms: [R('地下室', 0, 0, 6, 9, 'concrete'), R('機房', 0, 9, 6, 12.5, 'concrete'), R('通道', 2.4, -4, 3.6, 0, 'concrete'), R('下水道', -6, -9, 12, -4, 'sewer')],
    walls: [
      W(0, 0, 6, 0, 'concrete', 'gray', [{ type: 'opening', at: 3, w: 1.2, h: 2.2, sill: 0 }]),
      W(6, 0, 6, 12.5, 'concrete', 'gray'), W(6, 12.5, 0, 12.5, 'concrete', 'gray'), W(0, 12.5, 0, 0, 'concrete', 'gray'),
      W(0, 9, 6, 9, 'gray', 'gray', [{ type: 'door', at: 1.5, w: .85, h: 2.1, sill: 0, style: 'steel', swing: 'b', hinge: 's' }]),
      W(2.4, 0, 2.4, -4, 'sewer', 'concrete'), W(3.6, -4, 3.6, 0, 'sewer', 'concrete'),
      W(-6, -9, 12, -9, 'sewer', 'sewer'), W(12, -9, 12, -4, 'sewer', 'sewer'), W(12, -4, 3.6, -4, 'sewer', 'sewer'), W(2.4, -4, -6, -4, 'sewer', 'sewer'), W(-6, -4, -6, -9, 'sewer', 'sewer'),
    ],
    furniture: [
      F('water_heater', 5.6, 9.6, -90), F('pipes', 5.85, 11, -90, 1.8), F('generator', 4.4, 12.0, 180), F('barrel', 0.5, 9.5), F('barrel', 1.0, 9.4), F('crate', 3.0, 12.0),
      F('workbench', 0.45, 4, 90), F('shelf_rack', 0.3, 6.5, 90), F('boxes', 5.5, 2.2), F('crate', 5.4, 7.6), F('crate', 5.4, 8.3, 20), F('bike', 1.2, 1.0, 90), F('pillar', 3, 4.5),
      F('sewer_water', -1.5, -7.8, 0, 0), F('sewer_water', 7.5, -7.8, 0, 0), F('pipes', -3, -8.9, 0, 2.0), F('pipes', 8, -8.9, 0, 2.0), F('barrel', 10.8, -4.6), F('crate', -5.2, -4.6),
    ],
  };
}

// a backroom level: a maze of yellow wallpaper on damp carpet under buzzing panel lights
export function makeBackroom(nid, k = 0, seed = 7) {
  idf = nid;
  const N = 8, C = 2.5, size = N * C, r = rng(seed + k * 31);
  const east = [], south = []; for (let i = 0; i < N; i++) { east.push(Array(N).fill(true)); south.push(Array(N).fill(true)); }
  const seen = Array.from({ length: N }, () => Array(N).fill(false)), stack = [[0, 0]]; seen[0][0] = true;
  while (stack.length) {
    const [i, j] = stack[stack.length - 1], nb = [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < N && b < N && !seen[a][b]);
    if (!nb.length) { stack.pop(); continue; }
    const [a, b] = nb[Math.floor(r() * nb.length)];
    if (a > i) east[i][j] = false; else if (a < i) east[a][b] = false; else if (b > j) south[i][j] = false; else south[a][b] = false;
    seen[a][b] = true; stack.push([a, b]);
  }
  const walls = [W(0, 0, size, 0, 'backroom', 'backroom'), W(size, 0, size, size, 'backroom', 'backroom'), W(size, size, 0, size, 'backroom', 'backroom'), W(0, size, 0, 0, 'backroom', 'backroom')];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    if (i < N - 1 && east[i][j] && r() > .15) walls.push(W((i + 1) * C, j * C, (i + 1) * C, (j + 1) * C, 'backroom', 'backroom'));
    if (j < N - 1 && south[i][j] && r() > .15) walls.push(W(i * C, (j + 1) * C, (i + 1) * C, (j + 1) * C, 'backroom', 'backroom'));
  }
  return {
    id: 'br' + (k + 1) + '_' + Math.floor(r() * 1e4), name: `後室 Level ${k}`, kind: 'backroom', admin: 1, y: -40 - k * 20,
    env: { bright: 1.1, tint: '#fff1b0', lamp: '#fff3c0', fog: .06, sky: '#b8a860' },
    rooms: [R(`後室 Level ${k}`, 0, 0, size, size, 'moistcarpet')], walls,
    furniture: [F('backroom_chair', 6.2, 3.6, 40), F('wet_floor', 11.2, 8.8), F('backroom_chair', 16.2, 13.7, 200)],
  };
}

export function streetProps() {
  const s = { street: 1 };
  return [
    F('street_lamp', -0.4, -3.6, 0, 0, s), F('street_lamp', 9, -15.0, 180, 0, s), F('street_lamp', -6, -15.0, 180, 0, s),
    F('car', -3.5, -9.0, 90, 0, s), F('car', 10, -12.5, -90, 0, { ...s, color: '#2d5fa8' }), F('traffic_cone', 6.6, -4.4, 0, 0, s), F('traffic_cone', 7.1, -4.8, 30, 0, s),
    F('fire_hydrant', -1.2, -3.7, 0, 0, s), F('trash_can', 7.4, -3.6, 0, 0, s), F('mailbox', -2.4, -3.75, 0, 0, s), F('bench', 3, -15.0, 180, 0, s),
    F('street_tree', -10, -15.0, 0, 0, s), F('street_tree', 14, -15.0, 0, 0, s), F('bus_stop', -3, -15.0, 180, 0, s), F('vending_machine', 8.2, -3.55, 0, 0, s),
    F('traffic_light', -12, -3.8, 0, 0, s), F('bicycle', 6.2, -14.8, 180, 0, s),
  ];
}

// default portals / monsters / chests that belong to the default zones
export function defaultExtras(nid, br) {
  idf = nid;
  const P_ = (o) => ({ id: idf('p'), rot: 0, ...o });
  const portals = [
    P_({ fi: 0, x: 2.8, d: 10.1, style: 'hatch', name: '地下室入口', to: { zid: 'b1', x: 1.6, d: 11.6 } }),
    P_({ zid: 'b1', x: 1.0, d: 12.38, style: 'ladder', name: '爬上 1F', to: { fi: 0, x: 2.8, d: 11.0 } }),
    P_({ fi: 0, x: 1.0, d: -5.6, style: 'manhole', name: '下水道人孔', to: { zid: 'b1', x: 1.0, d: -5.0 } }),
    P_({ zid: 'b1', x: 0.4, d: -4.12, rot: 180, style: 'ladder', name: '爬回馬路', to: { fi: 0, x: 1.0, d: -6.4 } }),
    P_({ zid: 'b1', x: 5.2, d: 0.9, style: 'portal', name: '奇怪的裂縫', admin: 1, to: { zid: br.id, x: 1.25, d: 1.25 } }),
    P_({ zid: br.id, x: 18.75, d: 18.75, style: 'portal', name: '出口', admin: 1, to: { zid: 'b1', x: 4.2, d: 1.6 } }),
  ];
  const Mn = (o) => ({ id: idf('m'), mode: 'active', speed: 1, hp: 1, dmg: 1, range: 10, respawn: 60, admin: 1, ...o });
  const monsters = [
    Mn({ zid: br.id, x: 8.75, d: 6.25, type: 'smiler', speed: 1.1, range: 9 }), Mn({ zid: br.id, x: 13.75, d: 13.75, type: 'smiler', speed: 1.3, range: 12 }),
    Mn({ zid: br.id, x: 3.75, d: 16.25, type: 'lady', mode: 'passive', speed: .8 }), Mn({ zid: br.id, x: 16.25, d: 3.75, type: 'jiangshi', mode: 'passive' }),
    Mn({ zid: 'b1', x: -3, d: -6, type: 'rat', mode: 'passive', speed: 1 }), Mn({ zid: 'b1', x: 6, d: -6.2, type: 'rat', mode: 'passive' }), Mn({ zid: 'b1', x: 9.5, d: -5, type: 'roach', mode: 'active', range: 6 }),
    Mn({ zid: 'b1', x: -4.5, d: -5, type: 'roach', mode: 'active', range: 6 }),
  ];
  const Ch = (o) => ({ id: idf('c'), loot: 'random', respawn: 0, admin: 1, rot: 0, ...o });
  const chests = [
    Ch({ zid: br.id, x: 1.25, d: 18.75, loot: 'weapon:talisman' }), Ch({ zid: br.id, x: 18.75, d: 1.25, loot: 'power' }), Ch({ zid: br.id, x: 11.25, d: 11.25 }),
    Ch({ zid: 'b1', x: 11.3, d: -8.4, loot: 'speed', rot: -90 }), Ch({ zid: 'b1', x: 5.3, d: 5.5, loot: 'weapon:katana', rot: -90 }), Ch({ zid: 'b1', x: -5.3, d: -8.4, loot: 'potion', rot: 90 }),
  ];
  return { portals, monsters, chests };
}

export function addDefaultZones(d) {
  const nid = p => p + (d.nextId++);
  d.zones = d.zones || [];
  if (!d.zones.some(z => z.id === 'b1')) d.zones.push(makeBasement(nid));
  let br = d.zones.find(z => z.kind === 'backroom'); if (!br) { br = makeBackroom(nid, 0); d.zones.push(br); }
  const ex = defaultExtras(nid, br);
  d.portals = d.portals || ex.portals; d.monsters = d.monsters || ex.monsters; d.chests = d.chests || ex.chests;
  d.env = d.env || { season: 'none', bright: 1, tint: '#ffffff', lamp: '#fff1dc', fog: 0 };
  const f0 = d.floors[0]; if (f0 && !f0.furniture.some(f => f.street)) f0.furniture.push(...streetProps());
  return d;
}
