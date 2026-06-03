import { api } from './api-client';

export type PrintJobType = 'RECEIPT' | 'LABEL' | 'SHIFT_REPORT';

export interface PrintJobBase {
  storeId?: string;
}

export interface ReceiptPrintJob extends PrintJobBase {
  type: 'RECEIPT';
  orderId: string;
}

export interface ShiftReportPrintJob extends PrintJobBase {
  type: 'SHIFT_REPORT';
  shiftId?: string;
  /** Optional cashier-facing range for the report (Today/Yesterday/etc). */
  payload?: { range?: string; from?: string; to?: string };
}

export interface LabelPrintJob extends PrintJobBase {
  type: 'LABEL';
  garmentTagId: string;
}

export type PrintJob = ReceiptPrintJob | ShiftReportPrintJob | LabelPrintJob;

export interface PrintJobResult {
  id: string;
  status: 'QUEUED' | 'SENT' | 'FAILED';
}

export async function enqueuePrintJob(job: PrintJob): Promise<PrintJobResult> {
  return api<PrintJobResult>('/print-jobs', {
    method: 'POST',
    body: job,
    storeId: job.storeId,
  });
}
