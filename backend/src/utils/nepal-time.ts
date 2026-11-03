export const NEPAL_TIME_ZONE = "Asia/Kathmandu";

// Nepal uses UTC+05:45 and does not currently observe daylight saving time.
// Business-day boundaries are converted to UTC instants before querying PostgreSQL.
const NEPAL_UTC_OFFSET = "+05:45";
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const nepalDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: NEPAL_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const nepalTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: NEPAL_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const toValidDate = (
  value: Date | string | number
): Date => {
  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date.");
  }

  return date;
};

export const formatNepalDateOnly = (
  value: Date | string | number
): string => {
  const date = toValidDate(value);

  const parts =
    nepalDateFormatter.formatToParts(date);

  const getPart = (
    type: "year" | "month" | "day"
  ): string =>
    parts.find(
      (part) => part.type === type
    )?.value || "";

  return `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
};

export const formatNepalTimeOnly = (
  value: Date | string | number
): string =>
  nepalTimeFormatter.format(
    toValidDate(value)
  );

export const parseNepalDateBoundary = (
  value: unknown,
  endOfDay = false
): Date | null => {
  const text =
    String(value ?? "").trim();

  if (!text) {
    return null;
  }

  if (DATE_ONLY_PATTERN.test(text)) {
    const time =
      endOfDay
        ? "23:59:59.999"
        : "00:00:00.000";

    const date =
      new Date(
        `${text}T${time}${NEPAL_UTC_OFFSET}`
      );

    if (
      Number.isNaN(date.getTime()) ||
      formatNepalDateOnly(date) !== text
    ) {
      return null;
    }

    return date;
  }

  const date = new Date(text);

  return Number.isNaN(date.getTime())
    ? null
    : date;
};

export const startOfNepalDay = (
  at: Date = new Date()
): Date => {
  const dateOnly =
    formatNepalDateOnly(at);

  const start =
    parseNepalDateBoundary(
      dateOnly,
      false
    );

  if (!start) {
    throw new Error(
      "Unable to calculate Nepal day boundary."
    );
  }

  return start;
};

export const addNepalDays = (
  date: Date,
  days: number
): Date =>
  new Date(
    date.getTime() +
      days * ONE_DAY_MS
  );

export const addNepalMonths = (
  at: Date,
  months: number
): Date => {
  if (!Number.isInteger(months)) {
    throw new Error(
      "Nepal month offset must be a whole number."
    );
  }

  const current =
    formatNepalDateOnly(at);

  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      current
    );

  if (!match) {
    throw new Error(
      "Unable to parse Nepal calendar date."
    );
  }

  const year =
    Number(match[1]);

  const month =
    Number(match[2]);

  const day =
    Number(match[3]);

  const rawMonthIndex =
    month - 1 + months;

  const targetYear =
    year +
    Math.floor(rawMonthIndex / 12);

  const targetMonthIndex =
    ((rawMonthIndex % 12) + 12) % 12;

  const lastDayOfTargetMonth =
    new Date(
      Date.UTC(
        targetYear,
        targetMonthIndex + 1,
        0
      )
    ).getUTCDate();

  const targetDay =
    Math.min(
      day,
      lastDayOfTargetMonth
    );

  const targetDate =
    `${String(targetYear).padStart(4, "0")}-${String(
      targetMonthIndex + 1
    ).padStart(2, "0")}-${String(
      targetDay
    ).padStart(2, "0")}`;

  const parsed =
    parseNepalDateBoundary(
      targetDate,
      false
    );

  if (!parsed) {
    throw new Error(
      "Unable to calculate Nepal month offset."
    );
  }

  return parsed;
};

export const startOfNepalMonth = (
  at: Date = new Date()
): Date => {
  const current =
    formatNepalDateOnly(at);

  const monthStart =
    `${current.slice(0, 7)}-01`;

  const parsed =
    parseNepalDateBoundary(
      monthStart,
      false
    );

  if (!parsed) {
    throw new Error(
      "Unable to calculate Nepal month boundary."
    );
  }

  return parsed;
};