import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dateParts, halfWidth, phone, postal, splitByWidth, width } from '../src/text.js';

test('width counts CP932 bytes', () => {
  assert.equal(width('abc'), 3);
  assert.equal(width('東京'), 4);
  assert.equal(width('ｶﾅ'), 2);
});

test('splitByWidth never cuts a character and pads to the piece count', () => {
  assert.deepEqual(splitByWidth('東京都渋谷区', 5, 3), ['東京', '都渋', '谷区']);
  assert.deepEqual(splitByWidth('ab', 10, 2), ['ab', '']);
});

test('phone and postal are normalised to what carriers accept', () => {
  assert.equal(phone('０９０-１２３４-５６７８'), '090-1234-5678');
  assert.equal(phone('+81 90 (1234) 5678'), '09012345678');
  assert.equal(postal('１５０−０００１'), '150-0001');
  assert.equal(postal('1500001'), '150-0001');
  assert.equal(postal('150-001'), '');
  assert.equal(halfWidth('ＡＢＣ１２３'), 'ABC123');
});

test('dates in the three common forms', () => {
  assert.deepEqual(dateParts('2026-04-01'), ['2026', '04', '01']);
  assert.deepEqual(dateParts('2026/04/01'), ['2026', '04', '01']);
  assert.deepEqual(dateParts('20260401'), ['2026', '04', '01']);
  assert.equal(dateParts('4/1'), undefined);
});
