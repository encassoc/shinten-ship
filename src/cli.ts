#!/usr/bin/env node
// shinten-ship: the shipping desk for shinten.
//
//   shinten-ship carriers
//   shinten-ship labels --carrier yamato-b2|japanpost-r -k desk.json -c ship.json [-o labels.csv] [orders.json|orders.csv]
//   shinten-ship purge labels.csv
//
// The desk's private key (-k, or SHINTEN_KEY) opens the envelopes. ship.json
// (-c, or SHINTEN_SHIP_CONFIG) holds the sender and the carrier accounts.
// Orders come from a JSON array, JSON Lines or CSV, from a file or standard
// input. What was made and purged is recorded, by digest, in
// SHINTEN_SHIP_RECORDS (default ~/.shinten-ship/records.jsonl).
import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import type { JWK } from 'jose';
import { carrier, carriers } from './carriers/index.js';
import { parseConfig } from './config.js';
import { decodeCsv } from './csv.js';
import { makeLabels } from './labels.js';
import { parseOrders } from './orders.js';
import { purge } from './purge.js';
import { JsonlRecorder } from './records.js';

async function readText(path: string | undefined): Promise<string> {
  if (path && path !== '-') return decodeCsv(await readFile(path));
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  return decodeCsv(Buffer.concat(chunks));
}

function need(v: string | undefined, what: string): string {
  if (!v) throw new Error(`${what} is required`);
  return v;
}

async function main(argv: string[]): Promise<number> {
  const [cmd, ...rest] = argv;
  switch (cmd) {
    case 'carriers': {
      for (const c of Object.values(carriers)) console.log(`${c.id}\n  ${c.name}\n  ${c.note}`);
      return 0;
    }
    case 'labels': {
      const { values, positionals } = parseArgs({
        args: rest,
        allowPositionals: true,
        options: { carrier: { type: 'string' }, key: { type: 'string', short: 'k' }, config: { type: 'string', short: 'c' }, out: { type: 'string', short: 'o' } },
      });
      const c = carrier(need(values.carrier, '--carrier'));
      const key = JSON.parse(await readFile(need(values.key ?? process.env.SHINTEN_KEY, '--key or SHINTEN_KEY'), 'utf8')) as JWK;
      const config = parseConfig(await readFile(need(values.config ?? process.env.SHINTEN_SHIP_CONFIG, '--config or SHINTEN_SHIP_CONFIG'), 'utf8'));
      const orders = parseOrders(await readText(positionals[0]));
      const out = values.out ?? `labels-${c.id}-${new Date().toISOString().slice(0, 10)}.csv`;
      const r = await makeLabels({ orders, carrier: c, config, key, recorder: new JsonlRecorder() });
      await writeFile(out, r.file, { mode: 0o600 });
      for (const p of r.problems) console.error(`order ${p.order}: ${p.problem}`);
      console.error(`${r.written.length} of ${orders.length} orders written to ${out} (sha256 ${r.digest.slice(0, 12)}); ${c.note}`);
      return r.problems.length ? 1 : 0;
    }
    case 'purge': {
      const { positionals } = parseArgs({ args: rest, allowPositionals: true });
      const digest = await purge(need(positionals[0], 'the file to purge'), new JsonlRecorder());
      console.error(`purged ${positionals[0]} (sha256 ${digest.slice(0, 12)})`);
      return 0;
    }
    default:
      console.error('usage: shinten-ship carriers | labels | purge');
      return 2;
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (e: Error) => {
      console.error(e.message);
      process.exit(1);
    },
  );
}
