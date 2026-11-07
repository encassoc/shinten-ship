import iconv from 'iconv-lite';

/** Length in CP932 bytes: full-width characters count 2, half-width 1. Carrier limits are given this way. */
export function width(s: string): number {
  return iconv.encode(s, 'cp932').length;
}

/** Splits s into pieces of at most max bytes each, never inside a character. */
export function splitByWidth(s: string, max: number, pieces: number): string[] {
  const out: string[] = [];
  let cur = '';
  for (const ch of s) {
    if (width(cur + ch) > max) {
      out.push(cur);
      cur = ch;
    } else cur += ch;
  }
  out.push(cur);
  while (out.length < pieces) out.push('');
  return out;
}

const FULL = /[０-９Ａ-Ｚａ-ｚ－−ー‐-―]/g;

/** Full-width digits, letters and dashes to their half-width forms. */
export function halfWidth(s: string): string {
  return s.replace(FULL, (c) => {
    const code = c.charCodeAt(0);
    if (code >= 0xff10 && code <= 0xff5a) return String.fromCharCode(code - 0xfee0);
    return '-';
  });
}

/** A phone number as carriers accept it: half-width digits and hyphens, +81 as 0. */
export function phone(s: string): string {
  let p = halfWidth(s).replace(/[\s()（）]/g, '');
  if (p.startsWith('+81')) p = '0' + p.slice(3);
  p = p.replace(/[^0-9-]/g, '');
  return p;
}

/** A postal code as NNN-NNNN, or '' if it is not seven digits. */
export function postal(s: string): string {
  const d = halfWidth(s).replace(/[^0-9]/g, '');
  return d.length === 7 ? `${d.slice(0, 3)}-${d.slice(3)}` : '';
}

/** A date in YYYY-MM-DD or YYYY/MM/DD or YYYYMMDD form, as [YYYY, MM, DD], or undefined. */
export function dateParts(s: string | undefined): [string, string, string] | undefined {
  if (!s) return undefined;
  const m = halfWidth(s).match(/^(\d{4})[-/]?(\d{2})[-/]?(\d{2})$/);
  return m ? [m[1] as string, m[2] as string, m[3] as string] : undefined;
}
