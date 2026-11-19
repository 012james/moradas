export type InvoiceStatus = 'aberto' | 'pago' | 'vencido';

export interface InvoiceExtraCharge {
  reservationId: string;
  description: string;
  amount: number;
}

export interface InvoiceItem {
  id: string;
  houseNumber: number;
  recipientName: string;
  referenceMonth: string;
  baseAmount?: number;
  extraCharges?: InvoiceExtraCharge[];
  amount: number;
  dueDate: string;
  barcode: string;
  pixCode?: string;
  pdfUrl?: string;
  notes?: string;
  status: InvoiceStatus;
  createdAt: number;
  createdByName: string;
  paidAt?: number;
}