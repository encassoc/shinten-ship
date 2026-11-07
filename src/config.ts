/** The desk's configuration: who the parcels are from, and the carrier accounts. */
export interface Config {
  sender: Sender;
  yamato?: {
    /** ご請求先顧客コード, 9 to 12 digits. Required by B2 Cloud for imported data. */
    customerCode: string;
    /** ご請求先分類コード, 3 digits, when the billing code has one. */
    classCode?: string;
    /** 運賃管理番号, 2 digits. */
    fareCode: string;
    /** 送り状種類: 0 発払い by default. */
    serviceType?: string;
  };
  japanpost?: {
    /** 郵便種別: 0 ゆうパック by default. */
    mailType?: string;
  };
}

export interface Sender {
  name: string;
  postalCode: string;
  address: string;
  building?: string;
  phone: string;
}

export function parseConfig(json: string): Config {
  const c = JSON.parse(json) as Partial<Config>;
  const s = c.sender;
  if (!s || typeof s.name !== 'string' || typeof s.postalCode !== 'string' || typeof s.address !== 'string' || typeof s.phone !== 'string') {
    throw new Error('config: sender needs name, postalCode, address and phone');
  }
  if (c.yamato && (!/^\d{9,12}$/.test(c.yamato.customerCode ?? '') || !/^\d{2}$/.test(c.yamato.fareCode ?? ''))) {
    throw new Error('config: yamato needs customerCode (9 to 12 digits) and fareCode (2 digits)');
  }
  return c as Config;
}
