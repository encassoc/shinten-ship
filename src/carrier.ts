import type { Config } from './config.js';
import type { Order } from './orders.js';

/** The delivery details once the envelope is open, in the shipping profile's fields. */
export interface Delivery {
  name: string;
  address: string;
  building?: string;
  phone: string;
  postalCode: string;
}

export interface RowResult {
  cells: string[];
  /** Why the row could not be written, or empty. A row with problems is left out. */
  problems: string[];
}

/** A carrier's label-import format. */
export interface Carrier {
  id: string;
  name: string;
  /** How the carrier's software reads the file. */
  encoding: 'cp932' | 'utf8';
  /** The header row. */
  header: string[];
  /** How the desk tells the software to read the file. */
  note: string;
  row(order: Order, delivery: Delivery, config: Config, today: string): RowResult;
}
