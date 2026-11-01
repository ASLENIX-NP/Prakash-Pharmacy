export const NEPAL_TIME_ZONE = 'Asia/Kathmandu';

const nepalDateFormatter =
  new Intl.DateTimeFormat('en-US', {
    timeZone: NEPAL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

const nepalDisplayFormatter =
  new Intl.DateTimeFormat('en-NP', {
    timeZone: NEPAL_TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

const DATE_ONLY_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})$/;

export const localDateString = (
  date: Date = new Date()
): string => {
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const parts =
    nepalDateFormatter.formatToParts(date);

  const getPart = (
    type: 'year' | 'month' | 'day'
  ) =>
    parts.find(
      part => part.type === type
    )?.value || '';

  return `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
};

export const shiftDateOnly = (
  dateOnly: string,
  days: number
): string => {
  const match =
    DATE_ONLY_PATTERN.exec(dateOnly);

  if (!match) {
    return '';
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const base =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

  if (
    base.getUTCFullYear() !== year ||
    base.getUTCMonth() !== month - 1 ||
    base.getUTCDate() !== day
  ) {
    return '';
  }

  base.setUTCDate(
    base.getUTCDate() + days
  );

  return base
    .toISOString()
    .slice(0, 10);
};

export const nepalDateDaysAgo = (
  days: number,
  from: Date = new Date()
): string =>
  shiftDateOnly(
    localDateString(from),
    -days
  );

export const nepalMonthStartString = (
  date: Date = new Date()
): string => {
  const today =
    localDateString(date);

  return today
    ? `${today.slice(0, 7)}-01`
    : '';
};

export const instantToNepalDateString = (
  value: string | Date
): string => {
  const date =
    value instanceof Date
      ? value
      : new Date(value);

  return localDateString(date);
};

export const formatNepalDateForDisplay = (
  dateOnly: string
): string => {
  if (!DATE_ONLY_PATTERN.test(dateOnly)) {
    return dateOnly;
  }

  const date =
    new Date(
      `${dateOnly}T00:00:00+05:45`
    );

  if (Number.isNaN(date.getTime())) {
    return dateOnly;
  }

  return nepalDisplayFormatter.format(date);
};