import { format } from 'date-fns';
import type { OutletInfo, Product, Transaction } from '@/lib/data';
import { formatCurrency } from '@/lib/currency';

const LINE_WIDTH = 32; // 58mm paper, Font A
const encoder = new TextEncoder();

const ESC = 0x1b;
const GS = 0x1d;

function pushBytes(target: number[], bytes: number[]) {
  for (const b of bytes) target.push(b);
}

function pushText(target: number[], text: string) {
  pushBytes(target, Array.from(encoder.encode(text)));
}

function pushLine(target: number[], text = '') {
  pushText(target, text);
  target.push(0x0a);
}

function centerText(text: string, width: number) {
  if (text.length >= width) return text;
  const pad = Math.floor((width - text.length) / 2);
  return ' '.repeat(pad) + text;
}

function wrapText(text: string, width: number) {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > width) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function lineLeftRight(left: string, right: string, width: number) {
  const space = Math.max(1, width - left.length - right.length);
  return `${left}${' '.repeat(space)}${right}`;
}

export function buildReceiptEscPos(
  transaction: Transaction,
  outlet: OutletInfo,
  productsMap: Map<string, Product>
) {
  const bytes: number[] = [];

  // Initialize
  pushBytes(bytes, [ESC, 0x40]);

  // Header (center, bold)
  pushBytes(bytes, [ESC, 0x61, 0x01]); // center
  pushBytes(bytes, [ESC, 0x45, 0x01]); // bold on
  pushLine(bytes, outlet.name.toUpperCase());
  pushBytes(bytes, [ESC, 0x45, 0x00]); // bold off

  pushLine(bytes, `INVOICE: ${transaction.invoice}`);
  pushLine(bytes, `CUSTOMER: ${transaction.customerName}`);
  const date = transaction.createdAt && (transaction.createdAt as any).toDate
    ? (transaction.createdAt as any).toDate()
    : new Date(transaction.createdAt as any);
  pushLine(bytes, format(date, 'dd/MM/yyyy HH:mm:ss'));
  pushLine(bytes, '-'.repeat(LINE_WIDTH));

  // Items (left align)
  pushBytes(bytes, [ESC, 0x61, 0x00]); // left
  for (const item of transaction.items) {
    const product = productsMap.get(item.productId);
    const name = product?.name || 'Unknown Product';
    const nameLines = wrapText(name, LINE_WIDTH);
    for (const line of nameLines) {
      pushLine(bytes, line);
    }
    const qtyPrice = `${item.qty} x ${formatCurrency(item.price)}`;
    const lineTotal = formatCurrency(item.qty * item.price);
    pushLine(bytes, lineLeftRight(qtyPrice, lineTotal, LINE_WIDTH));
  }

  pushLine(bytes, '-'.repeat(LINE_WIDTH));

  const subtotal = transaction.items.reduce((acc, item) => acc + item.price * item.qty, 0);
  const tax = subtotal * 0.11;
  pushLine(bytes, lineLeftRight('Subtotal', formatCurrency(subtotal), LINE_WIDTH));
  pushLine(bytes, lineLeftRight('Tax (11%)', formatCurrency(tax), LINE_WIDTH));
  pushLine(bytes, '-'.repeat(LINE_WIDTH));
  pushBytes(bytes, [ESC, 0x45, 0x01]); // bold on
  pushLine(bytes, lineLeftRight('Total', formatCurrency(transaction.total), LINE_WIDTH));
  pushBytes(bytes, [ESC, 0x45, 0x00]); // bold off

  pushLine(bytes, '-'.repeat(LINE_WIDTH));
  pushBytes(bytes, [ESC, 0x61, 0x01]); // center
  pushLine(bytes, centerText('Thank you for your visit!', LINE_WIDTH));
  pushLine(bytes);

  // Cut (if supported)
  pushBytes(bytes, [GS, 0x56, 0x01]);

  return new Uint8Array(bytes);
}

export function escposBytesToBase64(data: Uint8Array) {
  let binary = '';
  for (const b of data) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function buildTestEscPos(outletName?: string) {
  const bytes: number[] = [];
  pushBytes(bytes, [ESC, 0x40]);
  pushBytes(bytes, [ESC, 0x61, 0x01]); // center
  pushBytes(bytes, [ESC, 0x45, 0x01]); // bold on
  pushLine(bytes, 'TEST PRINT');
  pushBytes(bytes, [ESC, 0x45, 0x00]); // bold off
  if (outletName) {
    pushLine(bytes, outletName);
  }
  pushLine(bytes, format(new Date(), 'dd/MM/yyyy HH:mm:ss'));
  pushBytes(bytes, [ESC, 0x61, 0x00]); // left
  pushLine(bytes, '-'.repeat(LINE_WIDTH));
  pushLine(bytes, 'Printer: OK');
  pushLine(bytes, 'Bluetooth Classic: OK');
  pushLine(bytes, '-'.repeat(LINE_WIDTH));
  pushLine(bytes, 'If you can read this,');
  pushLine(bytes, 'printing works.');
  pushLine(bytes);
  pushBytes(bytes, [GS, 0x56, 0x01]);
  return new Uint8Array(bytes);
}
