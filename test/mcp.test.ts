import assert from 'node:assert/strict';
import { access, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { config, desk, order } from './fixture.test.js';

async function call(client: Client, name: string, args: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  const r = await client.callTool({ name, arguments: args });
  if (r.isError) throw new Error((r.content as { text?: string }[])[0]?.text ?? 'tool error');
  return r.structuredContent as Record<string, unknown>;
}

test('the desk runs as an MCP server', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'shinten-ship-'));
  const key = await desk();
  await writeFile(join(dir, 'desk.json'), JSON.stringify(key.privateJwk));
  await writeFile(join(dir, 'ship.json'), JSON.stringify(config));
  const orders = [await order(key, 'E-5', {})];
  const client = new Client({ name: 'test', version: '0' });
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: ['dist/src/mcp.js'],
      env: { ...(process.env as Record<string, string>), SHINTEN_KEY: join(dir, 'desk.json'), SHINTEN_SHIP_CONFIG: join(dir, 'ship.json'), SHINTEN_SHIP_RECORDS: join(dir, 'records.jsonl') },
    }),
  );
  try {
    assert.deepEqual((await client.listTools()).tools.map((t) => t.name).sort(), ['carriers', 'make_labels', 'purge']);
    const out = join(dir, 'labels.csv');
    const made = await call(client, 'make_labels', { carrier: 'japanpost-r', orders: JSON.stringify(orders), out });
    assert.deepEqual((made.written as { id: string }[]).map((w) => w.id), ['E-5']);
    assert.deepEqual(made.problems, []);
    await call(client, 'purge', { path: out });
    await assert.rejects(access(out));
  } finally {
    await client.close();
  }
});
