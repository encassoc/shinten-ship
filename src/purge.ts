import { readFile, unlink } from 'node:fs/promises';
import { sha256 } from './labels.js';
import type { Recorder } from './records.js';

/** Deletes a label file after it has been uploaded, and records its digest. */
export async function purge(path: string, recorder?: Recorder, now: () => Date = () => new Date()): Promise<string> {
  const digest = sha256(await readFile(path));
  await unlink(path);
  if (recorder) await recorder.append({ at: now().toISOString(), event: 'purged', file: digest });
  return digest;
}
