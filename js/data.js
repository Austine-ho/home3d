import { F1_DEFAULT, F1_STAIRS } from './f1_default.js';
export const DEFAULT_REV = 2;
// default house data (estimated from home1F.mp4 and "home2f 3f.mp4")
// plan coords: x = 0 (left) .. 5 (right), d = depth from the 1F front door (negative = towards street)
// wall side a = left of the direction (x1,d1)->(x2,d2) when looking down at the plan with d pointing down... see house.js
// ops: { type: door | door2 | sliding | window | opening, at: centre distance from (x1,d1), w, h, sill, style, swing: a|b, hinge: s|e, curtain }
let uid = 1;
const W = (x1, d1, x2, d2, a, b, ops = [], kind = 'wall') => ({ id: 'w' + uid++, x1, d1, x2, d2, a, b, kind, ops: ops.map(o => ({ id: 'o' + uid++, ...o })) });
const R = (name, x0, d0, x1, d1, floor) => ({ id: 'r' + uid++, name, x0, d0, x1, d1, floor });
const F = (type, x, d, rot = 0, y = 0, color) => ({ type, x, d, rot, y, color });
const door = (at, o = {}) => ({ type: 'door', at, w: .8, h: 2.1, sill: 0, style: 'wood', swing: 'b', hinge: 's', ...o });
const win = (at, w = 1.2, o = {}) => ({ type: 'window', at, w, h: 1.2, sill: 0.9, ...o });
const open = (at, w = .9, o = {}) => ({ type: 'opening', at, w, h: 2.1, sill: 0, ...o });

export function defaultHouse() {
  uid = 1;
  const f1 = {
    name: '1F',
    rooms: [
      R('騎樓', 0, -3.2, 5, 0, 'stone'), R('神明廳/客廳', 0, 0, 5, 9, 'marble'), R('走道', 0, 9, 3.2, 12.5, 'marble'),
      R('樓梯間', 3.2, 9, 5, 12.5, 'concrete'), R('廚房', 0, 12.5, 5, 14.3, 'beigetile'), R('廚房', 0, 14.3, 3, 16.5, 'beigetile'), R('浴室', 3, 14.3, 5, 16.5, 'smalltile'),
    ],
    walls: [
      W(0, -3.2, 0, 0, 'facade', 'charcoal'), W(5, -3.2, 5, 0, 'charcoal', 'facade'),
      W(0, 0, 5, 0, 'facade', 'white', [win(1.2, 1.5, { h: 1.3, grille: 1 }), { type: 'door2', at: 2.95, w: 1.3, h: 2.35, sill: 0, style: 'steel', swing: 'b', hinge: 's' }]),
      W(0, 0, 0, 9, 'blue', 'charcoal', [win(6.15, 1.7, { h: 1.3, curtain: '#7f9fcc' })]),
      W(5, 0, 5, 9, 'charcoal', 'white'),
      W(0, 9, 2, 9, 'pink', 'lav'), W(2, 9, 5, 9, 'mint', 'concrete', [open(0.4, 0.8, { h: 2.15 })]),
      W(0, 9, 0, 12.5, 'lav', 'charcoal'),
      W(3.2, 9, 3.2, 12.5, 'concrete', 'lav', [door(3.08, { w: .75, style: 'glassblue', swing: 'a', hinge: 'e' })]),
      W(0, 12.5, 3.2, 12.5, 'lav', 'tile', [open(1.55, 1.3, { h: 2.15 })]),
      W(5, 9, 5, 12.5, 'charcoal', 'concrete'), W(3.2, 12.5, 5, 12.5, 'concrete', 'tile'),
      W(0, 12.5, 0, 16.5, 'tile', 'charcoal'), W(5, 12.5, 5, 16.5, 'charcoal', 'tile'),
      W(0, 16.5, 5, 16.5, 'tile', 'charcoal', [win(1.3, 1.2, { h: .9, sill: 1.15 })]),
      W(3, 14.3, 5, 14.3, 'tile', 'smalltile', [door(0.7, { h: 2.05, style: 'wood', swing: 'b', hinge: 's' })]),
      W(3, 14.3, 3, 16.5, 'smalltile', 'tile'),
    ],
    furniture: [
      F('scooter', 0.9, -1.6), F('plant', 3.95, -0.35), F('plant', 4.4, -0.4),
      F('desk_drawers', 0.36, 1.6, 90), F('chair', 1.0, 1.5, -90), F('ac_unit', 0.13, 2.6, 90, 2.4), F('ac_unit', 0.13, 7.6, 90, 2.4),
      F('dining_table', 2.15, 3.5, 90), F('chair', 2.8, 3.0, -90), F('chair', 1.5, 3.9, 90), F('chair', 2.75, 4.2, -100),
      F('glass_cabinet', 4.75, 2.4, -90), F('helmet_rack', 4.7, 3.75, -90), F('boxes', 4.6, 5.0, -90), F('clutter', 4.3, 6.0), F('clutter', 4.55, 7.7, 20),
      F('calligraphy', 4.93, 6.1, -90, 1.65), F('altar', 3.85, 8.6), F('painting', 2.95, 8.93, 0, 1.5), F('fan', 2.75, 8.3, 20),
      F('sofa3', 0.95, 8.48), F('sofa3', 0.5, 6.15, 90), F('coffee_table', 1.55, 6.9, 90), F('rug', 1.6, 6.9, 90),
      F('tv_cabinet', 1.0, 5.0, 180), F('water_dispenser', 2.05, 5.0, 180), F('stool_red', 1.15, 5.65, 10), F('clock', 0.07, 4.2, 90, 2.2),
      F('shoe_cabinet', 0.2, 9.75, 90), F('shoe_cabinet', 0.2, 10.75, 90), F('armchair_red', 0.55, 11.85, 90), F('coat_rack', 2.85, 9.55), F('glass_cabinet', 2.98, 10.6, -90),
      F('kitchen_counter', 0.95, 16.12), F('stove', 2.25, 16.12), F('fridge', 2.78, 13.05, -90), F('shelf_rack', 0.28, 13.8, 90), F('boxes', 4.5, 13.2),
      F('toilet', 4.55, 16.15), F('basin', 3.55, 16.25), F('washer', 4.6, 14.85, -90),
    ],
  };
  const f2 = {
    name: '2F',
    rooms: [
      R('陽台', 0, -3.2, 5, -1.8, 'smalltile'), R('綠色臥室', 0, -1.8, 5, 3.4, 'lightwood'), R('書桌房', 0, 3.4, 3.2, 8.4, 'graycarpet'),
      R('走廊', 3.2, 3.4, 5, 9, 'graycarpet'), R('梯廳', 1.6, 8.4, 3.2, 12.5, 'graycarpet'), R('儲藏室', 0, 8.4, 1.6, 12.5, 'lightwood'),
      R('樓梯間', 3.2, 9, 5, 12.5, 'graycarpet'), R('臥室', 0, 12.5, 3, 16.5, 'graycarpet'), R('浴室', 3, 12.5, 5, 14.6, 'smalltile'), R('小房間', 3, 14.6, 5, 16.5, 'graycarpet'),
    ],
    walls: [
      W(0, -3.2, 5, -3.2, 'facade', 'facade', [], 'rail'),
      W(0, -3.2, 0, -1.8, 'facade', 'charcoal'), W(5, -3.2, 5, -1.8, 'charcoal', 'facade'),
      W(0, -1.8, 5, -1.8, 'facade', 'lime', [win(1.8, 1.6, { h: 1.3, curtain: '#f3ead2' }), door(3.9, { style: 'alum', swing: 'b', hinge: 'e' })]),
      W(0, -1.8, 0, 3.4, 'lime', 'charcoal'), W(5, -1.8, 5, 3.4, 'charcoal', 'lime'),
      W(0, 3.4, 5, 3.4, 'lime', 'cream', [door(4.1, { style: 'paleblue', swing: 'a', hinge: 'e' })]),
      W(0, 3.4, 0, 8.4, 'cream', 'charcoal', [win(2.5, 1.2, { curtain: '#d9cbb0' })]), W(5, 3.4, 5, 9, 'charcoal', 'cream'),
      W(3.2, 3.4, 3.2, 8.4, 'cream', 'cream', [door(4.4, { swing: 'b', hinge: 'e' })]),
      W(0, 8.4, 3.2, 8.4, 'cream', 'cream'),
      W(1.6, 8.4, 1.6, 12.5, 'blue', 'cream', [open(1.6, .9)]),
      W(0, 8.4, 0, 12.5, 'blue', 'charcoal'),
      W(3.2, 9, 3.2, 11.6, 'cream', 'cream', [], 'rail'), W(3.2, 9, 5, 9, 'cream', 'cream', [], 'rail'),
      W(5, 9, 5, 12.5, 'charcoal', 'cream'),
      W(0, 12.5, 3, 12.5, 'cream', 'cream', [door(2.55, { w: .75, swing: 'b' })]),
      W(3, 12.5, 5, 12.5, 'cream', 'greentile', [door(0.85, { w: .7, swing: 'b', style: 'alum' })]),
      W(3, 12.5, 3, 14.6, 'greentile', 'cream'), W(3, 14.6, 5, 14.6, 'greentile', 'cream'),
      W(3, 14.6, 3, 16.5, 'cream', 'cream', [door(0.8, { w: .75, swing: 'a' })]),
      W(0, 12.5, 0, 16.5, 'cream', 'charcoal', [win(2, 1.2, { curtain: '#c9b7d6' })]), W(5, 12.5, 5, 16.5, 'charcoal', 'greentile'),
      W(0, 16.5, 5, 16.5, 'cream', 'charcoal', [win(1.5, 1.2)]),
    ],
    furniture: [
      F('laundry_rack', 2.3, -2.5), F('washer', 4.5, -2.75, 180), F('ac_outdoor', 0.6, -2.95), F('plant', 3.6, -3.0),
      F('double_bed', 1.08, 1.9, 90), F('vanity', 0.3, -0.7, 90), F('dresser', 2.2, -1.55, 180), F('tv_small', 2.2, -1.55, 180, 1.0), F('fan', 3.0, -1.4), F('clutter', 4.3, 0.5),
      F('ac_unit', 0.13, 1.0, 90, 2.4),
      F('kid_desk', 1.3, 3.8, 180), F('storage_tower', 0.35, 3.75), F('bed', 0.6, 6.9, 90, 0, '#9aa7d6'), F('shelf_rack', 2.8, 6.2, -90),
      F('wardrobe', 1.95, 11.5, 90), F('laundry_rack', 2.85, 9.6, 90),
      F('boxes', 0.4, 9.0), F('clutter', 0.6, 11.8), F('shelf_rack', 0.25, 10.4, 90),
      F('bed', 0.6, 14.6, 90, 0, '#e98ab0'), F('kid_desk', 1.8, 16.15), F('stool_red', 2.4, 13.8), F('wardrobe', 1.5, 12.85, 180),
      F('toilet', 4.5, 14.35), F('basin', 3.45, 14.35), F('boxes', 4.4, 15.5), F('clutter', 3.7, 16.1),
    ],
  };
  const f3 = {
    name: '3F',
    rooms: [
      R('藍色臥室', 0, -3.2, 5, 4.6, 'lightwood'), R('粉紅臥室', 0, 4.6, 3.2, 12.5, 'lightwood'), R('更衣間', 3.2, 4.6, 5, 9, 'lightwood'),
      R('樓梯間', 3.2, 9, 5, 12.5, 'lightwood'), R('儲藏間', 0, 12.5, 5, 16.5, 'lightwood'),
    ],
    walls: [
      W(0, -3.2, 5, -3.2, 'facade', 'skyblue', [win(1.3, 1.4, { curtain: '#5b6fb5' }), win(3.7, 1.4, { curtain: '#5b6fb5' })]),
      W(0, -3.2, 0, 4.6, 'skyblue', 'charcoal', [win(2, 1.2, { curtain: '#8a8fa6' })]), W(5, -3.2, 5, 4.6, 'charcoal', 'skyblue'),
      W(0, 4.6, 3.2, 4.6, 'skyblue', 'pinkwall', [{ type: 'sliding', at: 1.6, w: 2.0, h: 2.2, sill: 0, style: 'wood' }]),
      W(3.2, 4.6, 5, 4.6, 'skyblue', 'cream'),
      W(3.2, 4.6, 3.2, 9, 'cream', 'pinkwall', [door(1.8, { w: .75, swing: 'a', style: 'darkwood' })]),
      W(3.2, 9, 3.2, 12.5, 'blue', 'pinkwall', [door(3.05, { w: .75, swing: 'b', style: 'darkwood', hinge: 'e' })]),
      W(3.2, 9, 5, 9, 'cream', 'blue'),
      W(0, 4.6, 0, 12.5, 'pinkwall', 'charcoal', [win(4, 1.0, { curtain: '#9a9aa8' })]), W(5, 4.6, 5, 9, 'charcoal', 'cream'), W(5, 9, 5, 12.5, 'charcoal', 'blue'),
      W(0, 12.5, 3.2, 12.5, 'pinkwall', 'cream'), W(3.2, 12.5, 5, 12.5, 'blue', 'cream', [door(1.2, { w: .75, swing: 'b', style: 'darkwood' })]),
      W(0, 12.5, 0, 16.5, 'cream', 'charcoal'), W(5, 12.5, 5, 16.5, 'charcoal', 'cream'),
      W(0, 16.5, 5, 16.5, 'cream', 'charcoal', [win(2.5, 1.2)]),
    ],
    furniture: [
      F('double_bed', 1.08, -1.9, 90, 0, '#f2f2f6'), F('bed', 3.0, -2.15, 180, 0, '#9ad0e6'), F('bookshelf', 4.8, 1.0, -90), F('desk_drawers', 4.65, 2.8, -90, 0, '#5a3a2a'),
      F('air_purifier', 4.5, -2.8), F('fan', 3.8, -2.7), F('ac_unit', 2.5, -3.08, 0, 2.4), F('dresser', 0.3, 2.6, 90),
      F('dark_wardrobe', 0.33, 6.5, 90), F('bed', 0.6, 10.5, 90, 0, '#e8a6c0'), F('kid_desk', 2.85, 8.0, -90), F('world_map', 3.12, 7.0, -90, 1.6), F('storage_tower', 0.3, 12.15),
      F('air_purifier', 2.0, 12.2),
      F('clutter', 4.5, 5.2), F('boxes', 4.5, 8.3),
      F('shelf_rack', 0.3, 14.0, 90), F('shelf_rack', 0.3, 15.2, 90), F('boxes', 2.0, 16.0), F('clutter', 3.5, 15.7), F('boxes', 4.5, 15.5), F('clutter', 1.5, 13.4),
    ],
  };
  return {
    version: 2, defaultRev: DEFAULT_REV,
    floors: [JSON.parse(JSON.stringify(F1_DEFAULT)), f2, f3],   // 1F = the user's own design (我家設計.json)
    stairs: [...JSON.parse(JSON.stringify(F1_STAIRS)), { id: 'st2', floor: 1, x: 3.2, d: 9, w: 1.8, len: 3.5 }],
    nextId: Math.max(uid + 1, 200),
  };
}
// bring an older saved design up to the new default 1F (2F/3F and games untouched)
export function migrate(d) {
  if ((d.defaultRev || 0) >= DEFAULT_REV) return d;
  d.floors[0] = JSON.parse(JSON.stringify(F1_DEFAULT));
  d.stairs = [...JSON.parse(JSON.stringify(F1_STAIRS)), ...d.stairs.filter(s => s.floor !== 0)];
  d.nextId = Math.max(d.nextId || 0, 200); d.defaultRev = DEFAULT_REV;
  return d;
}
