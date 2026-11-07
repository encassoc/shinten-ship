import { generateKey, seal, type KeyPair } from 'shinten';
import type { Config } from '../src/config.js';
import type { Order } from '../src/orders.js';

export const config: Config = {
  sender: { name: '株式会社テスト商店', postalCode: '1000001', address: '東京都千代田区千代田1-1', building: 'テストビル3F', phone: '03-1234-5678' },
  yamato: { customerCode: '123456789', fareCode: '01' },
};

export async function desk(): Promise<KeyPair> {
  return generateKey();
}

export async function order(key: KeyPair, id: string, fields: { [k: string]: string }, extra: Partial<Order> = {}): Promise<Order> {
  const s = await seal('shipping', { postalCode: fields.postalCode ?? '150-0001', name: '山田 太郎', address: '東京都渋谷区神宮前1-2-3', phone: '０９０-１２３４-５６７８', ...fields }, [key.publicJwk]);
  return { id, postalCode: s.clear.postalCode as string, envelope: s.envelope, item: '雑貨', ...extra };
}
