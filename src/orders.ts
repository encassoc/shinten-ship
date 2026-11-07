import type { Sealed } from 'shinten';
import { parseCsv } from './csv.js';

/**
 * One order as the store exports it: the clear fields the site kept, the
 * envelope, and what a label needs that was never personal. Any field a
 * carrier does not use is ignored.
 */
export interface Order {
  /** The store's order id; goes on the label as the customer reference. */
  id: string;
  /** The clear field the shipping profile leaves readable. */
  postalCode: string;
  /** The envelope, as stored. */
  envelope: Sealed['envelope'];
  /** What is in the parcel, as printed on the label. */
  item?: string;
  /** Number of parcels, 1 by default. */
  count?: number;
  /** Ship date, YYYY-MM-DD; today by default. */
  shipDate?: string;
  /** Requested delivery date, YYYY-MM-DD. */
  deliveryDate?: string;
  /** Requested time slot: am, 12-14, 14-16, 16-18, 18-20, 19-21, 20-21. */
  timeSlot?: string;
  /** chilled or frozen; nothing for an ordinary parcel. */
  cool?: 'chilled' | 'frozen';
}

export type TimeSlot = 'am' | '12-14' | '14-16' | '16-18' | '18-20' | '19-21' | '20-21';

/** Reads orders from a JSON array, JSON Lines, or CSV with a header row. */
export function parseOrders(text: string): Order[] {
  const t = text.replace(/^﻿/, '').trim();
  if (t.startsWith('[')) return (JSON.parse(t) as unknown[]).map(toOrder);
  if (t.startsWith('{')) return t.split('\n').filter(Boolean).map((l) => toOrder(JSON.parse(l)));
  const rows = parseCsv(t);
  const header = rows.shift();
  if (!header) return [];
  return rows
    .filter((r) => r.some((c) => c !== ''))
    .map((r) => toOrder(Object.fromEntries(header.map((h, i) => [h.trim(), r[i] ?? '']))));
}

const aliases: { [k: string]: keyof Order } = {
  id: 'id',
  order: 'id',
  orderId: 'id',
  order_id: 'id',
  postalCode: 'postalCode',
  postal_code: 'postalCode',
  zip: 'postalCode',
  shinten: 'envelope',
  envelope: 'envelope',
  item: 'item',
  items: 'item',
  count: 'count',
  shipDate: 'shipDate',
  ship_date: 'shipDate',
  deliveryDate: 'deliveryDate',
  delivery_date: 'deliveryDate',
  timeSlot: 'timeSlot',
  time_slot: 'timeSlot',
  cool: 'cool',
};

function toOrder(raw: unknown): Order {
  const src = raw as { [k: string]: unknown };
  const o: { [k: string]: unknown } = {};
  for (const [k, v] of Object.entries(src)) {
    const key = aliases[k];
    if (key && v !== '' && v !== undefined && v !== null) o[key] = v;
  }
  if (typeof o.envelope === 'string') o.envelope = JSON.parse(o.envelope as string);
  if (typeof o.count === 'string') o.count = Number(o.count);
  if (typeof o.id !== 'string' && typeof o.id !== 'number') throw new Error('an order needs an id');
  o.id = String(o.id);
  if (typeof o.postalCode !== 'string') throw new Error(`order ${o.id}: postalCode is required`);
  if (typeof o.envelope !== 'object' || !o.envelope) throw new Error(`order ${o.id}: no envelope`);
  if (o.cool !== undefined && o.cool !== 'chilled' && o.cool !== 'frozen') throw new Error(`order ${o.id}: cool must be chilled or frozen`);
  return o as unknown as Order;
}
