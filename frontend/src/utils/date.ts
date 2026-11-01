/**
 * Format a Date as a local-calendar YYYY-MM-DD value.
 *
 * Do not use toISOString().slice(0, 10) for UI "today" defaults: UTC can be
 * a different calendar day from the pharmacy's local timezone.
 */
export const localDateString = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
