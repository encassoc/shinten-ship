#!/usr/bin/env node
// shinten-ship-mcp: the shipping desk as an MCP server, for the agent that
// runs it. SHINTEN_KEY names the desk's private key, SHINTEN_SHIP_CONFIG the
// sender and carrier configuration. Label files are written to paths the
// agent names, and purged with `purge` after upload.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { readFile, writeFile } from 'node:fs/promises';
import { isMain } from './main.js';
import type { JWK } from 'jose';
import { z } from 'zod';
import { carrier, carriers } from './carriers/index.js';
import { parseConfig } from './config.js';
import { decodeCsv } from './csv.js';
import { makeLabels } from './labels.js';
import { parseOrders } from './orders.js';
import { purge } from './purge.js';
import { JsonlRecorder, type Recorder } from './records.js';

export interface DeskOptions {
  keyPath: string | undefined;
  configPath: string | undefined;
  recorder?: Recorder;
}

export function deskServer(opts: DeskOptions): McpServer {
  const server = new McpServer({ name: 'shinten-ship', version: '0.1.0' });
  const text = (v: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(v, null, 2) }] });
  const recorder = opts.recorder ?? new JsonlRecorder();
  const key = async (): Promise<JWK> => {
    if (!opts.keyPath) throw new Error('SHINTEN_KEY must name the private key file');
    return JSON.parse(await readFile(opts.keyPath, 'utf8')) as JWK;
  };
  const config = async () => {
    if (!opts.configPath) throw new Error('SHINTEN_SHIP_CONFIG must name the configuration file');
    return parseConfig(await readFile(opts.configPath, 'utf8'));
  };

  server.registerTool(
    'carriers',
    { title: 'Carriers', description: 'The label formats this desk can write, and how each carrier’s software reads the file.', outputSchema: { carriers: z.array(z.object({ id: z.string(), name: z.string(), note: z.string() })) } },
    async () => {
      const out = { carriers: Object.values(carriers).map(({ id, name, note }) => ({ id, name, note })) };
      return { ...text(out), structuredContent: out };
    },
  );

  server.registerTool(
    'make_labels',
    {
      title: 'Make labels',
      description:
        'Open the orders’ envelopes with this desk’s key and write the carrier’s label-import file. Orders are a path or inline JSON/CSV. The file is the only place the addresses exist; upload it to the carrier’s software, then call purge.',
      inputSchema: {
        carrier: z.string().describe('yamato-b2 or japanpost-r'),
        orders: z.string().describe('Path to the orders export (JSON array, JSON Lines or CSV), or the export itself'),
        out: z.string().describe('Path to write the label file to'),
      },
      outputSchema: {
        out: z.string(),
        digest: z.string(),
        written: z.array(z.object({ id: z.string(), envelope: z.string() })),
        problems: z.array(z.object({ order: z.string(), problem: z.string() })),
        note: z.string(),
      },
    },
    async ({ carrier: id, orders, out }) => {
      const c = carrier(id);
      const source = orders.trimStart().startsWith('[') || orders.trimStart().startsWith('{') || orders.includes('\n') ? orders : decodeCsv(await readFile(orders));
      const r = await makeLabels({ orders: parseOrders(source), carrier: c, config: await config(), key: await key(), recorder });
      await writeFile(out, r.file, { mode: 0o600 });
      const result = { out, digest: r.digest, written: r.written, problems: r.problems, note: c.note };
      return { ...text(result), structuredContent: result };
    },
  );

  server.registerTool(
    'purge',
    {
      title: 'Purge a label file',
      description: 'Delete a label file after it has been uploaded, recording its digest.',
      inputSchema: { path: z.string() },
      outputSchema: { purged: z.string(), digest: z.string() },
    },
    async ({ path }) => {
      const digest = await purge(path, recorder);
      const out = { purged: path, digest };
      return { ...text(out), structuredContent: out };
    },
  );

  return server;
}

if (isMain(import.meta.url)) {
  deskServer({ keyPath: process.env.SHINTEN_KEY, configPath: process.env.SHINTEN_SHIP_CONFIG })
    .connect(new StdioServerTransport())
    .catch((e: Error) => {
      console.error(e.message);
      process.exit(1);
    });
}
