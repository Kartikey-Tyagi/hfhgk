import { describe, it, expect } from 'vitest';
import {
  formatUkLocalInterval,
  formatUtcInterval,
  formatPublicationTimestamp,
  formatDateString,
  formatDateRange,
  formatCutoffDisplay,
  formatCutoffShort,
  formatChartAxisTick,
  parseDateOnly,
} from '../utils/formatters';

describe('Standardized Date and Time Formatting Utilities', () => {
  describe('formatUkLocalInterval', () => {
    it('formats winter GMT interval with dynamic GMT label', () => {
      // 2026-01-30T00:00:00Z -> 30 Jan 2026, 00:00 GMT
      const formatted = formatUkLocalInterval('2026-01-30T00:00:00Z');
      expect(formatted).toBe('30 Jan 2026, 00:00 GMT');
    });

    it('formats January 1st winter GMT interval with single digit day', () => {
      const formatted = formatUkLocalInterval('2026-01-01T00:00:00Z');
      expect(formatted).toBe('1 Jan 2026, 00:00 GMT');
    });

    it('formats summer BST interval with dynamic BST label and +1 hour local shift', () => {
      // 2026-07-15T12:00:00Z in UTC is 13:00 BST in London
      const formatted = formatUkLocalInterval('2026-07-15T12:00:00Z');
      expect(formatted).toBe('15 Jul 2026, 13:00 BST');
    });

    it('handles null and undefined gracefully', () => {
      expect(formatUkLocalInterval(null)).toBe('—');
      expect(formatUkLocalInterval(undefined)).toBe('—');
      expect(formatUkLocalInterval('')).toBe('—');
    });
  });

  describe('formatUtcInterval', () => {
    it('formats delivery interval in UTC without raw ISO strings', () => {
      expect(formatUtcInterval('2026-01-30T00:00:00Z')).toBe('30 Jan 2026, 00:00 UTC');
      expect(formatUtcInterval('2026-01-01T15:30:00Z')).toBe('1 Jan 2026, 15:30 UTC');
    });

    it('retains UTC time during summer without converting to local timezone', () => {
      expect(formatUtcInterval('2026-07-15T12:00:00Z')).toBe('15 Jul 2026, 12:00 UTC');
    });

    it('handles null and undefined gracefully', () => {
      expect(formatUtcInterval(null)).toBe('—');
      expect(formatUtcInterval(undefined)).toBe('—');
    });
  });

  describe('formatPublicationTimestamp', () => {
    it('formats publication timestamp showing both UTC and UK local time in winter', () => {
      // 29 Jan 2026, 11:30 UTC (11:30 GMT)
      const formatted = formatPublicationTimestamp('2026-01-29T11:30:00Z');
      expect(formatted).toBe('29 Jan 2026, 11:30 UTC (11:30 GMT)');
    });

    it('formats publication timestamp showing both UTC and UK local time in summer (BST)', () => {
      // 14 Jul 2026, 11:30 UTC (12:30 BST)
      const formatted = formatPublicationTimestamp('2026-07-14T11:30:00Z');
      expect(formatted).toBe('14 Jul 2026, 11:30 UTC (12:30 BST)');
    });

    it('includes full year for cross-year lookbacks (e.g., 31 Dec 2025 for 1 Jan 2026)', () => {
      const formatted = formatPublicationTimestamp('2025-12-31T11:30:00Z');
      expect(formatted).toBe('31 Dec 2025, 11:30 UTC (11:30 GMT)');
    });

    it('handles null and undefined gracefully', () => {
      expect(formatPublicationTimestamp(null)).toBe('—');
      expect(formatPublicationTimestamp(undefined)).toBe('—');
    });
  });

  describe('formatDateString and parseDateOnly', () => {
    it('parses calendar date without timezone shift', () => {
      const parsed = parseDateOnly('2026-01-30');
      expect(parsed).toEqual({ year: 2026, month: 1, day: 30 });
    });

    it('formats calendar date string into D MMM YYYY', () => {
      expect(formatDateString('2026-01-30')).toBe('30 Jan 2026');
      expect(formatDateString('2026-01-01')).toBe('1 Jan 2026');
      expect(formatDateString('2026-12-31')).toBe('31 Dec 2026');
    });
  });

  describe('formatDateRange', () => {
    it('formats multi-day date range with en-dash', () => {
      expect(formatDateRange('2026-01-01', '2026-01-09')).toBe('1 Jan 2026 – 9 Jan 2026');
      expect(formatDateRange('2026-01-01', '2026-01-31')).toBe('1 Jan 2026 – 31 Jan 2026');
    });

    it('formats single day date range as a single date', () => {
      expect(formatDateRange('2026-01-01', '2026-01-01')).toBe('1 Jan 2026');
    });
  });

  describe('formatCutoffDisplay and formatCutoffShort', () => {
    it('formats cutoff time with operational D-1 explanation', () => {
      expect(formatCutoffDisplay('12:00:00')).toBe('12:00 UTC on D−1 (day before delivery)');
      expect(formatCutoffDisplay('12:00')).toBe('12:00 UTC on D−1 (day before delivery)');
    });

    it('formats short cutoff representation', () => {
      expect(formatCutoffShort('12:00:00')).toBe('12:00 UTC on D−1');
      expect(formatCutoffShort('12:00')).toBe('12:00 UTC on D−1');
    });
  });

  describe('formatChartAxisTick', () => {
    it('formats single-day ticks as HH:00', () => {
      expect(formatChartAxisTick('2026-01-01', 0, 24)).toBe('00:00');
      expect(formatChartAxisTick('2026-01-01', 14, 24)).toBe('14:00');
    });

    it('formats multi-day ticks as D MMM HH:00', () => {
      expect(formatChartAxisTick('2026-01-01', 0, 744)).toBe('1 Jan 00:00');
      expect(formatChartAxisTick('2026-01-15', 12, 168)).toBe('15 Jan 12:00');
    });
  });
});
