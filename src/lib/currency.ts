
'use client';

/**
 * Formats a number as Indonesian Rupiah (IDR).
 * @param amount The number to format.
 * @returns A string representing the amount in IDR format (e.g., "Rp 10.000").
 */
export function formatCurrency(amount: number): string {
  // Ensure we are working with a number
  const numericAmount = typeof amount === 'number' ? amount : 0;

  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numericAmount);
}
