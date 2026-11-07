// Japan Post ゆうパックプリントR. The software reads any CSV through a filter
// the user defines once, mapping columns to its fields; this file names its
// columns exactly as the fields are named, so the filter is a one-to-one
// mapping. Byte limits are the fields' (CP932 bytes).
import type { Carrier, RowResult } from '../carrier.js';
import { dateParts, phone, postal, splitByWidth, width } from '../text.js';

export const HEADER = [
  'お客様側管理番号', '発送予定日', '郵便種別', '保冷種別', '元／着払／代引',
  'お届け先 郵便番号', 'お届け先 住所１', 'お届け先 住所２', 'お届け先 住所３', 'お届け先 名称１', 'お届け先 名称２', 'お届け先 敬称区分', 'お届け先 電話番号',
  'ご依頼主 郵便番号', 'ご依頼主 住所１', 'ご依頼主 住所２', 'ご依頼主 住所３', 'ご依頼主 名称１', 'ご依頼主 電話番号',
  '配達指定日／希望日', '配達時間帯区分', '品名（明細）', '個数（明細）', 'フリー項目０１',
];

const SLOTS: { [k: string]: string } = { am: '51', '12-14': '52', '14-16': '53', '16-18': '54', '18-20': '55', '20-21': '56', '19-21': '57' };

export const japanpostR: Carrier = {
  id: 'japanpost-r',
  name: '日本郵便 ゆうパックプリントR',
  encoding: 'cp932',
  header: HEADER,
  note: 'ゆうプリRの「フィルタ設定」で取り込み用フィルタを一度作り、1行目を見出しとして各列を同名の項目に対応付けてください。日付は yyyymmdd です。',
  row(order, d, config, today): RowResult {
    const problems: string[] = [];
    const col = (name: string) => HEADER.indexOf(name);
    const cells = new Array<string>(HEADER.length).fill('');
    const set = (name: string, v: string, max?: number) => {
      if (max !== undefined && width(v) > max) problems.push(`${name}: ${width(v)} of ${max} bytes`);
      cells[col(name)] = v;
    };
    const date = (s: string | undefined, what: string) => {
      if (s === undefined) return '';
      const p = dateParts(s);
      if (!p) problems.push(`${what}: ${s} is not a date`);
      return p ? p.join('') : '';
    };
    set('お客様側管理番号', order.id, 15);
    set('発送予定日', date(order.shipDate ?? today, 'shipDate'));
    set('郵便種別', config.japanpost?.mailType ?? '0');
    set('保冷種別', order.cool === 'chilled' ? '1' : order.cool === 'frozen' ? '2' : '0');
    set('元／着払／代引', '0');
    const zip = postal(d.postalCode);
    if (!zip) problems.push(`postal code ${d.postalCode} is not seven digits`);
    set('お届け先 郵便番号', zip);
    const addr = d.building ? `${d.address} ${d.building}` : d.address;
    if (width(addr) > 150) problems.push(`address: ${width(addr)} of 150 bytes`);
    const [a1, a2, a3] = splitByWidth(addr, 50, 3);
    set('お届け先 住所１', a1 ?? '');
    set('お届け先 住所２', a2 ?? '');
    set('お届け先 住所３', a3 ?? '');
    const [n1, n2] = splitByWidth(d.name, 50, 2);
    set('お届け先 名称１', n1 ?? '');
    set('お届け先 名称２', n2 ?? '', 50);
    set('お届け先 敬称区分', '0');
    set('お届け先 電話番号', phone(d.phone), 20);
    const s = config.sender;
    set('ご依頼主 郵便番号', postal(s.postalCode));
    const [s1, s2, s3] = splitByWidth(s.building ? `${s.address} ${s.building}` : s.address, 50, 3);
    set('ご依頼主 住所１', s1 ?? '');
    set('ご依頼主 住所２', s2 ?? '');
    set('ご依頼主 住所３', s3 ?? '');
    set('ご依頼主 名称１', s.name, 50);
    set('ご依頼主 電話番号', phone(s.phone), 20);
    set('配達指定日／希望日', date(order.deliveryDate, 'deliveryDate'));
    if (order.timeSlot) {
      const code = SLOTS[order.timeSlot];
      if (!code) problems.push(`timeSlot ${order.timeSlot} is not one Japan Post offers`);
      set('配達時間帯区分', code ?? '');
    }
    set('品名（明細）', order.item ?? '', 50);
    set('個数（明細）', String(order.count ?? 1));
    set('フリー項目０１', order.id, 50);
    return { cells, problems };
  },
};
