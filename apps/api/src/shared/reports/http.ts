/**
 * HTTP helpers shared by every module's report endpoints.
 */
import type { Response } from 'express';
import { z } from 'zod';

export const reportFormatSchema = z.enum(['csv', 'pdf']);
export type ReportFormat = z.infer<typeof reportFormatSchema>;

/** ISO-ish, filesystem-safe timestamp for the downloaded filename. */
function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

export function sendCsvReport(res: Response, baseName: string, csv: string): void {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${baseName}-${timestamp()}.csv"`);
  res.status(200).send(csv);
}

export function sendPdfReport(res: Response, baseName: string, pdf: Buffer): void {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${baseName}-${timestamp()}.pdf"`);
  res.status(200).send(pdf);
}
