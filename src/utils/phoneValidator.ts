/**
 * Phone Number Validation Utility for Vodacom RDC (DRC)
 * Valid formats:
 * - 10 digits starting with 08 or 09 (e.g., 0818889900, 0821000001, 0990000036)
 * - 12 digits starting with 2438 or 2439 (e.g., 243818889900, 243990000036)
 */

export function cleanPhoneNumber(phone: string): string {
  if (!phone) return '';
  // Remove spaces, hyphens, dots, parentheses, and leading plus sign
  let cleaned = phone.replace(/[\s\-\.\(\)\+]/g, '');
  // If user entered +243, cleaned will be 243...
  return cleaned;
}

export function isValidMsisdn(phone: string): boolean {
  const cleaned = cleanPhoneNumber(phone);
  if (!cleaned) return false;

  // 10 digits starting with 08 or 09
  const is10DigitRdc = /^(081|082|083|084|085|089|090|097|098|099)\d{7}$/.test(cleaned);
  // 12 digits starting with 2438 or 2439
  const is12DigitRdc = /^243(81|82|83|84|85|89|90|97|98|99)\d{7}$/.test(cleaned);

  // Generic fallback for standard 10-digit RDC mobile numbers starting with 08 or 09
  const isGeneric10Digit = /^(08|09)\d{8}$/.test(cleaned);

  return is10DigitRdc || is12DigitRdc || isGeneric10Digit;
}

export function formatMsisdn(phone: string): string {
  let cleaned = cleanPhoneNumber(phone);
  if (!cleaned) return '';

  // Standardize 243... to 0...
  if (cleaned.startsWith('243') && cleaned.length === 12) {
    cleaned = '0' + cleaned.substring(3);
  }

  // Format as 081 888 9900 or 099 000 0036 for clean readability if 10 digits
  if (cleaned.length === 10) {
    return `${cleaned.substring(0, 3)} ${cleaned.substring(3, 6)} ${cleaned.substring(6)}`;
  }

  return cleaned;
}
