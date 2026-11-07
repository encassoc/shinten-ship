import { appendFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

/**
 * What the desk records: that a label file was made from these orders, and
 * that it was purged. Records hold digests, never addresses, so that an
 * evidence log can carry them later.
 */
export interface Record {
  at: string;
  event: 'labels' | 'purged';
  carrier?: string;
  /** SHA-256 of the label file. */
  file: string;
  /** Orders in the file, by id and envelope digest. */
  orders?: { id: string; envelope: string }[];
}

export interface Recorder {
  append(r: Record): Promise<void>;
}

/** Records appended to a JSON Lines file: `SHINTEN_SHIP_RECORDS`, or `~/.shinten-ship/records.jsonl`. */
export class JsonlRecorder implements Recorder {
  constructor(readonly path: string = process.env.SHINTEN_SHIP_RECORDS ?? join(homedir(), '.shinten-ship', 'records.jsonl')) {}

  async append(r: Record): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    await appendFile(this.path, JSON.stringify(r) + '\n', { mode: 0o600 });
  }
}

export class MemoryRecorder implements Recorder {
  readonly list: Record[] = [];
  async append(r: Record): Promise<void> {
    this.list.push(r);
  }
}
