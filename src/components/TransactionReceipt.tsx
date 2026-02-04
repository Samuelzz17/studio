
'use client';

import { Transaction, OutletInfo, Product } from '@/lib/data';
import { formatCurrency } from '@/lib/currency';
import { format } from 'date-fns';
import { Timestamp } from 'firebase/firestore';

interface TransactionReceiptProps {
  transaction: Transaction;
  outlet: OutletInfo;
  productsMap: Map<string, Product>;
}

export function TransactionReceipt({ transaction, outlet, productsMap }: TransactionReceiptProps) {
  const subtotal = transaction.items.reduce((acc, item) => acc + item.price * item.qty, 0);
  const tax = subtotal * 0.11;

  const getTransactionDate = (ts: any): Date => {
    if (!ts) return new Date();
    // Handle Firestore Timestamp
    if (ts.toDate) {
      return ts.toDate();
    }
    // Handle JS Date object
    if (ts instanceof Date) {
      return ts;
    }
    // Handle string or number representations
    return new Date(ts);
  };
  
  const transactionDate = getTransactionDate(transaction.createdAt);

  return (
    <div id="receipt-content" className="bg-white text-black text-sm font-mono p-4 max-w-sm mx-auto">
      <div className="text-center">
        <h2 className="text-lg font-bold">{outlet.name}</h2>
        {/* You can add outlet address here if available */}
        <p>INVOICE: {transaction.invoice}</p>
        <p>CUSTOMER: {transaction.customerName}</p>
        <p>{format(transactionDate, 'dd/MM/yyyy HH:mm:ss')}</p>
      </div>
      <hr className="my-2 border-dashed border-black" />
      <div>
        {transaction.items.map((item) => {
          const product = productsMap.get(item.productId);
          return (
            <div key={`${item.productId}-${item.preference}`} className="space-y-1 mb-1">
              <p>{product?.name || 'Unknown Product'}</p>
              <p className="text-xs -mt-1 capitalize">({item.preference})</p>
              <div className="flex justify-between">
                <span>{item.qty} x {formatCurrency(item.price)}</span>
                <span>{formatCurrency(item.qty * item.price)}</span>
              </div>
            </div>
          );
        })}
      </div>
      <hr className="my-2 border-dashed border-black" />
      <div className="space-y-1">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span>Tax (11%)</span>
          <span>{formatCurrency(tax)}</span>
        </div>
        <hr className="my-1 border-dashed border-black" />
        <div className="flex justify-between font-bold text-base">
          <span>Total</span>
          <span>{formatCurrency(transaction.total)}</span>
        </div>
      </div>
      <hr className="my-2 border-dashed border-black" />
      <div className="text-center mt-4">
        <p>Thank you for your visit!</p>
      </div>
    </div>
  );
}
