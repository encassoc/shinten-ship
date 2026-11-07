import type { Carrier } from '../carrier.js';
import { japanpostR } from './japanpost-r.js';
import { yamatoB2 } from './yamato-b2.js';

export const carriers: { [id: string]: Carrier } = { [yamatoB2.id]: yamatoB2, [japanpostR.id]: japanpostR };

export function carrier(id: string): Carrier {
  const c = carriers[id];
  if (!c) throw new Error(`unknown carrier ${JSON.stringify(id)}; known: ${Object.keys(carriers).join(', ')}`);
  return c;
}
