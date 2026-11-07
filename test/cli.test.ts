import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { access, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';
import { decodeCsv, parseCsv } from '../src/csv.js';
import { config, desk, order } from './fixture.test.js';

const run = promisify(execFile);

test('labels and purge on the command line, with records by digest', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'shinten-ship-'));
  const key = await desk();
  await writeFile(join(dir, 'desk.json'), JSON.stringify(key.privateJwk));
  await writeFile(join(dir, 'ship.json'), JSON.stringify(config));
  await writeFile(join(dir, 'orders.json'), JSON.stringify([await order(key, 'D-4', {})]));
  const env = { ...process.env, SHINTEN_SHIP_RECORDS: join(dir, 'records.jsonl') };
  const cli = (...args: string[]) => run(process.execPath, ['dist/src/cli.js', ...args], { env });
  const out = join(dir, 'labels.csv');
  const r = await cli('labels', '--carrier', 'yamato-b2', '-k', join(dir, 'desk.json'), '-c', join(dir, 'ship.json'), '-o', out, join(dir, 'orders.json'));
  assert.match(r.stderr, /1 of 1 orders written/);
  assert.equal(parseCsv(decodeCsv(await readFile(out)))[1]?.[0], 'D-4');
  await cli('purge', out);
  await assert.rejects(access(out));
  const records = (await readFile(join(dir, 'records.jsonl'), 'utf8')).trim().split('\n').map((l) => JSON.parse(l));
  assert.deepEqual(records.map((x) => x.event), ['labels', 'purged']);
  assert.equal(records[0].file, records[1].file);
  assert.match((await cli('carriers')).stdout, /yamato-b2[\s\S]*japanpost-r/);
});
