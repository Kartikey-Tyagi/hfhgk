/**
 * Standardized Date and Time Formatting Utilities for Wind Forecast Intelligence.
 *
 * Rules:
 * - Internal storage and comparisons use UTC.
 * - Presentation conversions to UK local time use the Europe/London timezone.
 * - Timezone abbreviations (GMT/BST) are dynamically determined via Intl.DateTimeFormat.
 * - Calendar date-only strings (YYYY-MM-DD) are parsed without timezone offsets to prevent date shifting.
 */

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * Parse a calendar date string (YYYY-MM-DD) into year, month (1-12), and day components
 * without constructing a timezone-shifted Date object.
 */
export function parseDateOnly(dateStr: string): { year: number; month: number; day: number } | null {
  if (!dateStr) return null;
  const match = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return {
    year: parseInt(match[1], 10),
    month: parseInt(match[2], 10),
    day: parseInt(match[3], 10),
  };
}

/**
 * Safely parse a value into a Date object or null if invalid.
 */
function toDate(val: string | Date | null | undefined): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  const parsed = new Date(val);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Format a delivery interval in UK local time (Europe/London).
 * Preferred format: "30 Jan 2026, 00:00 GMT" (or "15 Jul 2026, 13:00 BST")
 */
export function formatUkLocalInterval(isoOrDate: string | Date | null | undefined): string {
  const d = toDate(isoOrDate);
  if (!d) return '—';

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  }).formatToParts(d);

  const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
  const day = get('day');
  const month = get('month');
  const year = get('year');
  const hour = get('hour');
  const minute = get('minute');
  const tz = get('timeZoneName');

  return `${day} ${month} ${year}, ${hour}:${minute} ${tz}`;
}

/**
 * Format a delivery interval in UTC.
 * Preferred format: "30 Jan 2026, 00:00 UTC"
 */
export function formatUtcInterval(isoOrDate: string | Date | null | undefined): string {
  const d = toDate(isoOrDate);
  if (!d) return '—';

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);

  const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
  const day = get('day');
  const month = get('month');
  const year = get('year');
  const hour = get('hour');
  const minute = get('minute');

  return `${day} ${month} ${year}, ${hour}:${minute} UTC`;
}

/**
 * Format a forecast publication timestamp showing both UTC and UK local time.
 * Preferred format: "29 Jan 2026, 11:30 UTC (11:30 GMT)" or "14 Jul 2026, 11:30 UTC (12:30 BST)"
 */
export function formatPublicationTimestamp(isoOrDate: string | Date | null | undefined): string {
  const d = toDate(isoOrDate);
  if (!d) return '—';

  const utcParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);

  const ldnParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  }).formatToParts(d);

  const getUtc = (type: string) => utcParts.find((p) => p.type === type)?.value || '';
  const getLdn = (type: string) => ldnParts.find((p) => p.type === type)?.value || '';

  const day = getUtc('day');
  const month = getUtc('month');
  const year = getUtc('year');
  const utcHour = getUtc('hour');
  const utcMinute = getUtc('minute');

  const ldnHour = getLdn('hour');
  const ldnMinute = getLdn('minute');
  const ldnTz = getLdn('timeZoneName');

  return `${day} ${month} ${year}, ${utcHour}:${utcMinute} UTC (${ldnHour}:${ldnMinute} ${ldnTz})`;
}

/**
 * Format a calendar date string (YYYY-MM-DD) into "D MMM YYYY" (e.g. "30 Jan 2026").
 * Uses direct component parsing to avoid timezone day-shift bugs.
 */
export function formatDateString(dateStr: string): string {
  const parsed = parseDateOnly(dateStr);
  if (!parsed) return dateStr || '—';
  const monthName = MONTH_NAMES[parsed.month - 1];
  return `${parsed.day} ${monthName} ${parsed.year}`;
}

/**
 * Format a delivery date range.
 * Preferred format: "1 Jan 2026 – 9 Jan 2026" or "1 Jan 2026 – 31 Jan 2026".
 * Single day: "1 Jan 2026".
 */
export function formatDateRange(fromStr: string, toStr: string): string {
  if (!fromStr && !toStr) return '—';
  if (fromStr && !toStr) return formatDateString(fromStr);
  if (!fromStr && toStr) return formatDateString(toStr);

  const fromFormatted = formatDateString(fromStr);
  const toFormatted = formatDateString(toStr);

  if (fromStr === toStr) {
    return fromFormatted;
  }
  return `${fromFormatted} – ${toFormatted}`;
}

/**
 * Format cutoff time with full operational explanation.
 * Preferred format: "12:00 UTC on D−1 (day before delivery)"
 */
export function formatCutoffDisplay(cutoffTimeUtc: string): string {
  if (!cutoffTimeUtc) return '12:00 UTC on D−1 (day before delivery)';
  const cleanTime = cutoffTimeUtc.trim().slice(0, 5);
  return `${cleanTime} UTC on D−1 (day before delivery)`;
}

/**
 * Format cutoff time short.
 * Preferred format: "12:00 UTC on D−1"
 */
export function formatCutoffShort(cutoffTimeUtc: string): string {
  if (!cutoffTimeUtc) return '12:00 UTC on D−1';
  const cleanTime = cutoffTimeUtc.trim().slice(0, 5);
  return `${cleanTime} UTC on D−1`;
}

/**
 * Format chart X-axis tick label.
 * Single day (<= 24h): "00:00", "04:00"
 * Multi-day (> 24h): "1 Jan 00:00", "5 Jan 12:00"
 */
export function formatChartAxisTick(settlementDate: string, hour: number, totalIntervals: number): string {
  const hourPart = `${hour.toString().padStart(2, '0')}:00`;
  if (totalIntervals <= 24) {
    return hourPart;
  }
  const parsed = parseDateOnly(settlementDate);
  if (parsed) {
    const monthName = MONTH_NAMES[parsed.month - 1];
    return `${parsed.day} ${monthName} ${hourPart}`;
  }
  return `${settlementDate.slice(5)} ${hourPart}`;
}
