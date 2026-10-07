/**
 * Generic CSV writer shared by every module's reports.
 *
 * No library: RFC 4180 escaping (quote fields containing the separator, a
 * quote or a newline; double internal quotes) is a handful of lines and does
 * not justify a dependency (AGENTS.md §59). UTF-8 BOM + CRLF line endings so
 * Excel (including Spanish-locale builds), Google Sheets and LibreOffice all
 * open accents and ñ correctly on double-click.
 */

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | boolean | null | undefined;
}

const SEPARATOR = ',';
const BOM = '﻿';

function escapeCell(raw: string | number | boolean | null | undefined): string {
  const text = raw === null || raw === undefined ? '' : String(raw);
  if (text.includes(SEPARATOR) || text.includes('"') || text.includes('\n') || text.includes('\r')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** Builds a complete CSV document (with BOM) ready to send as a file download. */
export function buildCsv<T>(rows: readonly T[], columns: ReadonlyArray<CsvColumn<T>>): string {
  const header = columns.map((c) => escapeCell(c.header)).join(SEPARATOR);
  const lines = rows.map((row) => columns.map((c) => escapeCell(c.value(row))).join(SEPARATOR));
  return BOM + [header, ...lines].join('\r\n') + '\r\n';
}
