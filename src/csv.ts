import iconv from 'iconv-lite';

/** Parses RFC 4180 CSV text into rows of cells. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i] as string;
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** Rows of cells as CSV text with CRLF line endings, quoting where needed. */
export function formatCsv(rows: string[][]): string {
  return rows.map((r) => r.map(quote).join(',')).join('\r\n') + '\r\n';
}

function quote(cell: string): string {
  return /[",\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

export type Encoding = 'cp932' | 'utf8';

/** CSV text as bytes in the encoding the carrier's software reads. */
export function encodeCsv(text: string, encoding: Encoding): Buffer {
  return encoding === 'cp932' ? iconv.encode(text, 'cp932') : Buffer.from(text, 'utf8');
}

export function decodeCsv(bytes: Buffer): string {
  // UTF-8 with or without BOM, else CP932.
  const utf8 = bytes.toString('utf8');
  if (!utf8.includes('�')) return utf8.replace(/^﻿/, '');
  return iconv.decode(bytes, 'cp932');
}
