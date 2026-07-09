const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen',
  'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function numToWords(n: number): string {
  if (n === 0) return '';
  if (n < 20)  return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
  if (n < 1000)
    return ONES[Math.floor(n / 100)] + ' Hundred' +
           (n % 100 ? ' ' + numToWords(n % 100) : '');
  if (n < 100_000)
    return numToWords(Math.floor(n / 1000)) + ' Thousand' +
           (n % 1000 ? ' ' + numToWords(n % 1000) : '');
  if (n < 10_000_000)
    return numToWords(Math.floor(n / 100_000)) + ' Lakh' +
           (n % 100_000 ? ' ' + numToWords(n % 100_000) : '');
  return numToWords(Math.floor(n / 10_000_000)) + ' Crore' +
         (n % 10_000_000 ? ' ' + numToWords(n % 10_000_000) : '');
}

/**
 * Converts a number to Indian-English words.
 * e.g.  55000   → "RUPEES FIFTY-FIVE THOUSAND ONLY"
 *       1500.50 → "RUPEES ONE THOUSAND FIVE HUNDRED AND FIFTY PAISE ONLY"
 */
export function amountToWords(amount: number): string {
  const rupees = Math.floor(amount);
  const paise  = Math.round((amount - rupees) * 100);

  let result = 'Rupees ' + (rupees === 0 ? 'Zero' : numToWords(rupees));
  if (paise > 0) result += ' And ' + numToWords(paise) + ' Paise';
  result += ' Only';
  return result.toUpperCase();
}
