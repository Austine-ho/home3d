import { HOUSE_DEFAULT } from './default_house.js';
// the original design is the user's own 我家設計.json (all floors, basement, backrooms, street)
export const DEFAULT_REV = 4;
export function defaultHouse() { return JSON.parse(JSON.stringify(HOUSE_DEFAULT)); }
// saved designs from before rev 4 are replaced by the new original design
export function migrate(d) {
  if ((d.defaultRev || 0) >= DEFAULT_REV) return d;
  return defaultHouse();
}
