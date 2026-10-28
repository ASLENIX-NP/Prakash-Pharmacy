export const digitsOnlyUpTo = (value: string, maxDigits: number): string =>
  value.replace(/\D/g, '').slice(0, maxDigits);

export const normalizePhoneNumber = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  const localNumber = digits.length > 10 && digits.startsWith('977')
    ? digits.slice(3)
    : digits;
  return localNumber.slice(0, 10);
};

export const isValidEmail = (value: string): boolean =>
  value.trim().length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
