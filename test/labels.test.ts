import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateKey } from 'shinten';
import { japanpostR } from '../src/carriers/japanpost-r.js';
import { yamatoB2 } from '../src/carriers/yamato-b2.js';
import { decodeCsv, formatCsv, parseCsv } from '../src/csv.js';
import { makeLabels } from '../src/labels.js';
import { parseOrders } from '../src/orders.js';
import { MemoryRecorder } from '../src/records.js';
import { config, desk, order } from './fixture.test.js';

const now = () => new Date('2026-04-01T09:00:00Z');

test('Yamato B2: 97 columns, the address opened on the desk, nothing else in the clear anywhere', async () => {
  const key = await desk();
  const o = await order(key, 'A-1', {}, { deliveryDate: '2026-04-03', timeSlot: '14-16', cool: 'chilled' });
  const rec = new MemoryRecorder();
  const r = await makeLabels({ orders: [o], carrier: yamatoB2, config, key: key.privateJwk, recorder: rec, now });
  assert.deepEqual(r.problems, []);
  const rows = parseCsv(decodeCsv(r.file));
  assert.equal(rows[0]?.length, 97);
  const row = rows[1] as string[];
  assert.equal(row.length, 97);
  assert.equal(row[0], 'A-1');
  assert.equal(row[1], '0');
  assert.equal(row[2], '2'); // chilled
  assert.equal(row[4], '2026/04/01');
  assert.equal(row[5], '2026/04/03');
  assert.equal(row[6], '1416');
  assert.equal(row[8], '090-1234-5678');
  assert.equal(row[10], '150-0001');
  assert.equal(row[11], '東京都渋谷区神宮前1-2-3');
  assert.equal(row[15], '山田 太郎');
  assert.equal(row[17], '様');
  assert.equal(row[24], '株式会社テスト商店');
  assert.equal(row[27], '雑貨');
  assert.equal(row[39], '123456789');
  assert.equal(row[41], '01');
  // The file is CP932: the first row decodes, and the raw bytes are not UTF-8 of the name.
  assert.ok(!r.file.includes(Buffer.from('山田', 'utf8')));
  // The record holds digests only.
  assert.equal(rec.list.length, 1);
  assert.doesNotMatch(JSON.stringify(rec.list), /山田|神宮前|1234/);
  assert.equal(rec.list[0]?.orders?.[0]?.id, 'A-1');
});

test('Japan Post: named columns, addresses split by bytes, cool codes the other way round', async () => {
  const key = await desk();
  const o = await order(key, 'B-2', { address: '北海道札幌市中央区北一条西二丁目三番地四号', building: 'さっぽろタワー1203' }, { cool: 'chilled', timeSlot: 'am' });
  const r = await makeLabels({ orders: [o], carrier: japanpostR, config, key: key.privateJwk, now });
  assert.deepEqual(r.problems, []);
  const rows = parseCsv(decodeCsv(r.file));
  const h = rows[0] as string[];
  const row = rows[1] as string[];
  const at = (name: string) => row[h.indexOf(name)];
  assert.equal(at('発送予定日'), '20260401');
  assert.equal(at('保冷種別'), '1');
  assert.equal(at('配達時間帯区分'), '51');
  assert.equal(at('お届け先 郵便番号'), '150-0001');
  assert.ok((at('お届け先 住所１') as string).length > 0 && (at('お届け先 住所２') as string).length > 0);
  assert.equal(at('お届け先 住所１')! + at('お届け先 住所２') + at('お届け先 住所３'), '北海道札幌市中央区北一条西二丁目三番地四号 さっぽろタワー1203');
  assert.equal(at('お届け先 名称１'), '山田 太郎');
  assert.equal(at('フリー項目０１'), 'B-2');
});

test('an envelope sealed to another desk, a bad slot and an address too long are reported and left out', async () => {
  const key = await desk();
  const other = await generateKey();
  const good = await order(key, 'ok', {});
  const foreign = await order(other, 'foreign', {});
  const slot = await order(key, 'slot', {}, { timeSlot: '12-14' });
  const long = await order(key, 'long', { address: '東京都渋谷区神宮前一丁目二番三号渋谷スクランブルスクエア東棟四十五階' });
  const r = await makeLabels({ orders: [good, foreign, slot, long], carrier: yamatoB2, config, key: key.privateJwk, now });
  assert.deepEqual(r.written.map((w) => w.id), ['ok']);
  assert.deepEqual(r.problems.map((p) => p.order), ['foreign', 'slot', 'long']);
  assert.match(r.problems[0]!.problem, /not sealed to/);
  assert.match(r.problems[1]!.problem, /12-14/);
  assert.match(r.problems[2]!.problem, /of 64 bytes/);
});

test('orders come as JSON, JSON Lines or CSV', async () => {
  const key = await desk();
  const o = await order(key, 'C-3', {});
  const json = JSON.stringify([o]);
  const jsonl = JSON.stringify(o) + '\n';
  const csv = formatCsv([
    ['order_id', 'zip', 'shinten', 'item', 'count'],
    [o.id, o.postalCode, JSON.stringify(o.envelope), '本', '2'],
  ]);
  for (const text of [json, jsonl, csv]) {
    const [p] = parseOrders(text);
    assert.equal(p?.id, 'C-3');
    assert.equal(p?.postalCode, '150-0001');
    assert.deepEqual(p?.envelope, o.envelope);
  }
  assert.equal(parseOrders(csv)[0]?.count, 2);
  assert.throws(() => parseOrders('[{"id":"x"}]'), /postalCode is required/);
});

test('an order sealed to a key the desk did not approve stops the whole batch: the store\'s key list was replaced', async () => {
  const { seal } = await import('shinten');
  const key = await desk();
  const backup = await desk();
  const thief = await desk();
  const approved = { ...config, recipients: [key.publicJwk, backup.publicJwk] };
  const sealedTo = async (id: string, to: typeof key[]) => {
    const s = await seal('shipping', { postalCode: '150-0001', name: '山田 太郎', address: '東京都渋谷区神宮前1-2-3', phone: '090-1234-5678' }, to.map((k) => k.publicJwk));
    return { id, postalCode: s.clear.postalCode as string, envelope: s.envelope, item: '雑貨' };
  };
  const fine = await sealedTo('A-1', [key, backup]);
  const ok = await makeLabels({ orders: [fine], carrier: yamatoB2, config: approved, key: key.privateJwk, now });
  assert.equal(ok.written.length, 1);
  assert.equal(ok.alarm, undefined);
  // After A-1, the site's key list gained the thief's key.
  const stolen = await sealedTo('A-2', [key, backup, thief]);
  const r = await makeLabels({ orders: [fine, stolen], carrier: yamatoB2, config: approved, key: key.privateJwk, now });
  assert.match(r.alarm ?? '', /A-2.*did not approve/);
  assert.deepEqual(r.written, []);
  assert.equal(parseCsv(decodeCsv(r.file)).length, 1); // the header only: no address leaves the envelope
});

test('ship.json takes the approved keys as a JWK Set or a list, public keys only', async () => {
  const { parseConfig } = await import('../src/config.js');
  const key = await desk();
  const base = { sender: config.sender };
  assert.equal(parseConfig(JSON.stringify({ ...base, recipients: { keys: [key.publicJwk] } })).recipients?.length, 1);
  assert.equal(parseConfig(JSON.stringify({ ...base, recipients: [key.publicJwk] })).recipients?.length, 1);
  assert.throws(() => parseConfig(JSON.stringify({ ...base, recipients: [key.privateJwk] })), /public keys/);
});
