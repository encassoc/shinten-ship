import { createHash } from 'node:crypto';
import type { JWK } from 'jose';
import { open } from 'shinten';
import type { Carrier, Delivery } from './carrier.js';
import type { Config } from './config.js';
import { encodeCsv, formatCsv } from './csv.js';
import type { Order } from './orders.js';
import type { Recorder } from './records.js';

export interface Problem {
  order: string;
  problem: string;
}

export interface Labels {
  /** The label file, in the carrier's encoding. */
  file: Buffer;
  /** SHA-256 of the file. */
  digest: string;
  /** Orders written, in file order. */
  written: { id: string; envelope: string }[];
  /** Orders left out, and why. */
  problems: Problem[];
}

export interface MakeLabelsOptions {
  orders: Order[];
  carrier: Carrier;
  config: Config;
  /** The desk's private key. */
  key: JWK;
  recorder?: Recorder;
  now?: () => Date;
}

export function sha256(b: Buffer | string): string {
  return createHash('sha256').update(b).digest('hex');
}

/**
 * Opens each order's envelope with the desk's key and writes the carrier's
 * label file. An order whose envelope does not open, or whose details do
 * not fit the carrier's fields, is left out and reported; the rest are
 * written. The addresses live in the returned bytes and nowhere else.
 */
export async function makeLabels(opts: MakeLabelsOptions): Promise<Labels> {
  const now = opts.now ?? (() => new Date());
  const today = now().toISOString().slice(0, 10);
  const rows: string[][] = [opts.carrier.header];
  const written: Labels['written'] = [];
  const problems: Problem[] = [];
  for (const order of opts.orders) {
    const envelope = sha256(JSON.stringify(order.envelope));
    let delivery: Delivery;
    try {
      const opened = await open({ clear: { postalCode: order.postalCode }, envelope: order.envelope }, opts.key);
      if (opened.profile !== 'shipping') throw new Error(`envelope profile is ${opened.profile}, not shipping`);
      const f = opened.fields;
      delivery = { name: f.name ?? '', address: f.address ?? '', phone: f.phone ?? '', postalCode: order.postalCode, ...(f.building ? { building: f.building } : {}) };
    } catch (e) {
      problems.push({ order: order.id, problem: (e as Error).message });
      continue;
    }
    const r = opts.carrier.row(order, delivery, opts.config, today);
    if (r.problems.length) {
      for (const p of r.problems) problems.push({ order: order.id, problem: p });
      continue;
    }
    rows.push(r.cells);
    written.push({ id: order.id, envelope });
  }
  const file = encodeCsv(formatCsv(rows), opts.carrier.encoding);
  const digest = sha256(file);
  if (opts.recorder && written.length) {
    await opts.recorder.append({ at: now().toISOString(), event: 'labels', carrier: opts.carrier.id, file: digest, orders: written });
  }
  return { file, digest, written, problems };
}
