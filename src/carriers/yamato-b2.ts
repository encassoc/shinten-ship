// Yamato Transport B2 Cloud, 基本レイアウト (送り状発行データレイアウト 入出力用,
// 97 items). The import is positional; the header row is for people, and the
// import is set to start at row 2.
import type { Carrier, RowResult } from '../carrier.js';
import { dateParts, phone, postal, width } from '../text.js';

export const HEADER = [
  'お客様管理番号', '送り状種類', 'クール区分', '伝票番号', '出荷予定日', 'お届け予定（指定）日', '配達時間帯',
  'お届け先コード', 'お届け先電話番号', 'お届け先電話番号枝番', 'お届け先郵便番号', 'お届け先住所',
  'お届け先住所（アパートマンション名）', 'お届け先会社・部門名１', 'お届け先会社・部門名２', 'お届け先名',
  'お届け先名略称カナ', '敬称', 'ご依頼主コード', 'ご依頼主電話番号', 'ご依頼主電話番号枝番', 'ご依頼主郵便番号',
  'ご依頼主住所', 'ご依頼主住所（アパートマンション名）', 'ご依頼主名', 'ご依頼主略称カナ', '品名コード１', '品名１',
  '品名コード２', '品名２', '荷扱い１', '荷扱い２', '記事', 'コレクト代金引換額（税込）', 'コレクト内消費税額等',
  '営業所止置き', '営業所コード', '発行枚数', '個数口枠の印字', 'ご請求先顧客コード', 'ご請求先分類コード', '運賃管理番号',
  'クロネコwebコレクトデータ登録', 'クロネコwebコレクト加盟店番号', 'クロネコwebコレクト申込受付番号１',
  'クロネコwebコレクト申込受付番号２', 'クロネコwebコレクト申込受付番号３', 'お届け予定ｅメール利用区分',
  'お届け予定ｅメールe-mailアドレス', '入力機種', 'お届け予定eメールメッセージ', 'お届け完了ｅメール利用区分',
  'お届け完了ｅメールe-mailアドレス', 'お届け完了eメールメッセージ', 'クロネコ収納代行利用区分', '予備',
  '収納代行請求金額(税込)', '収納代行内消費税額等', '収納代行請求先郵便番号', '収納代行請求先住所',
  '収納代行請求先住所（アパートマンション名）', '収納代行請求先会社・部門名１', '収納代行請求先会社・部門名２',
  '収納代行請求先名(漢字)', '収納代行請求先名(カナ)', '収納代行問合せ先名(漢字)', '収納代行問合せ先郵便番号',
  '収納代行問合せ先住所', '収納代行問合せ先住所（アパートマンション名）', '収納代行問合せ先電話番号', '収納代行管理番号',
  '収納代行品名', '収納代行備考', '複数口くくりキー', '検索キータイトル1', '検索キー1', '検索キータイトル2', '検索キー2',
  '検索キータイトル3', '検索キー3', '検索キータイトル4', '検索キー4', '検索キータイトル5', '検索キー5', '予備', '予備',
  '投函予定メール利用区分', '投函予定メールe-mailアドレス', '投函予定メールメッセージ',
  '投函完了メール（受人宛て）利用区分', '投函完了メール（受人宛て）e-mailアドレス', '投函完了メール（受人宛て）メールメッセージ',
  '投函完了メール（出荷人宛て）利用区分', '投函完了メール（出荷人宛て）e-mailアドレス', '投函完了メール（出荷人宛て）メールメッセージ',
  '連携管理番号', '通知メールアドレス',
];

const SLOTS: { [k: string]: string } = { am: '0812', '14-16': '1416', '16-18': '1618', '18-20': '1820', '19-21': '1921' };

export const yamatoB2: Carrier = {
  id: 'yamato-b2',
  name: 'ヤマト運輸 B2クラウド (基本レイアウト)',
  encoding: 'cp932',
  header: HEADER,
  note: 'B2クラウドの「外部データから発行」で取込パターンに「基本レイアウト」を選び、取込開始行を 2 にしてください。',
  row(order, d, config, today): RowResult {
    const problems: string[] = [];
    const y = config.yamato;
    if (!y) problems.push('config has no yamato section (customerCode, fareCode)');
    const cells = new Array<string>(HEADER.length).fill('');
    const set = (no: number, v: string, max?: number, what?: string) => {
      if (max !== undefined && width(v) > max) problems.push(`${what ?? HEADER[no - 1]}: ${width(v)} of ${max} bytes`);
      cells[no - 1] = v;
    };
    const date = (s: string | undefined, what: string) => {
      if (s === undefined) return '';
      const p = dateParts(s);
      if (!p) problems.push(`${what}: ${s} is not a date`);
      return p ? p.join('/') : '';
    };
    set(1, order.id, 50);
    set(2, y?.serviceType ?? '0');
    set(3, order.cool === 'frozen' ? '1' : order.cool === 'chilled' ? '2' : '');
    set(5, date(order.shipDate ?? today, 'shipDate'));
    set(6, date(order.deliveryDate, 'deliveryDate'));
    if (order.timeSlot) {
      const code = SLOTS[order.timeSlot];
      if (!code) problems.push(`timeSlot ${order.timeSlot} is not one Yamato offers (am, 14-16, 16-18, 18-20, 19-21)`);
      set(7, code ?? '');
    }
    const tel = phone(d.phone);
    if (!tel) problems.push('phone is required by Yamato');
    set(9, tel, 15);
    const zip = postal(d.postalCode);
    if (!zip) problems.push(`postal code ${d.postalCode} is not seven digits`);
    set(11, zip);
    set(12, d.address, 64);
    set(13, d.building ?? '', 32);
    set(16, d.name, 32);
    set(18, '様');
    const s = config.sender;
    set(20, phone(s.phone), 15);
    set(22, postal(s.postalCode));
    set(23, s.address, 64);
    set(24, s.building ?? '', 32);
    set(25, s.name, 32);
    set(28, order.item ?? '', 50);
    if (!order.item) problems.push('item is required by Yamato (品名１)');
    set(38, String(order.count ?? 1));
    set(40, y?.customerCode ?? '');
    set(41, y?.classCode ?? '');
    set(42, y?.fareCode ?? '');
    return { cells, problems };
  },
};
