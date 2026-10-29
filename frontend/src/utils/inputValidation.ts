export const digitsOnlyUpTo = (value: string, maxDigits: number): string =>
  value.replace(/\D/g, '').slice(0, maxDigits);

export const digitsOnly = (value: string): string =>
  value.replace(/\D/g, '');

export const parseIntegerInput = (value: string, maxDigits: number): number | undefined => {
  if (value === '') return undefined;

  const digits = digitsOnlyUpTo(value, maxDigits);
  if (!digits) return undefined;

  return Number(digits);
};

export const parseDecimalInput = (value: string, maxDecimalPlaces = 2): number | undefined => {
  if (value === '') return undefined;

  const normalized = decimalInputValue(value, maxDecimalPlaces);
  if (!normalized || normalized === '.') return undefined;

  return Number(normalized);
};

export const decimalInputValue = (value: string, maxDecimalPlaces = 2): string => {
  if (!value) return '';

  const cleaned = value.replace(/[^\d.]/g, '');
  if (!cleaned) return '';

  const [wholePart, ...decimalParts] = cleaned.split('.');
  const whole = wholePart || '';
  const decimal = decimalParts.join('');
  const truncatedDecimal = maxDecimalPlaces > 0 && decimal.length > maxDecimalPlaces
    ? decimal.slice(0, maxDecimalPlaces)
    : decimal;

  if (decimalParts.length === 0) {
    return whole;
  }

  if (!whole) {
    return truncatedDecimal ? `0.${truncatedDecimal}` : '0.';
  }

  return `${whole}.${truncatedDecimal}`;
};

export const preventInvalidNumberKeys = (
  event: { key: string; preventDefault: () => void; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean; },
  allowDecimal = false
): void => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;

  const blockedKeys = allowDecimal ? ['e', 'E', '+', '-'] : ['e', 'E', '+', '-', '.'];
  if (blockedKeys.includes(event.key)) {
    event.preventDefault();
  }
};

export const normalizePhoneNumber = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  const localNumber = digits.length > 10 && digits.startsWith('977')
    ? digits.slice(3)
    : digits;
  return localNumber.slice(0, 10);
};

export const isValidEmail = (value: string): boolean =>
  value.trim().length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
