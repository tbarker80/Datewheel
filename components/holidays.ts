// Public holidays by country
// Fixed holidays use "MM-DD" format; floating holidays are computed per year.
// HOLIDAYS contains only truly fixed-date holidays (used for visual wheel markers).
// isHoliday() also checks floating holidays for accurate business-day calculations.

export const HOLIDAYS: Record<string, Record<string, string>> = {
  US: {
    "01-01": "New Year's Day",
    "06-19": "Juneteenth",
    "07-04": "Independence Day",
    "12-25": "Christmas Day",
  },
  MX: {
    "01-01": "New Year's Day",
    "02-05": "Constitution Day",
    "03-18": "Benito Juarez Day",
    "05-01": "Labor Day",
    "09-16": "Independence Day",
    "11-18": "Revolution Day",
    "12-25": "Christmas Day",
  },
  CA: {
    "01-01": "New Year's Day",
    "07-01": "Canada Day",
    "11-11": "Remembrance Day",
    "12-25": "Christmas Day",
    "12-26": "Boxing Day",
  },
  CN: {
    "01-01": "New Year's Day",
    "05-01": "Labour Day",
    "10-01": "National Day",
    "10-02": "National Day Holiday",
    "10-03": "National Day Holiday",
  },
};

// ─── Floating holiday helpers ─────────────────────────────────────────────────

// Returns the nth occurrence of `weekday` (0=Sun, 1=Mon…) in the given month.
function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
  const first = new Date(year, month, 1);
  const day = 1 + ((weekday - first.getDay() + 7) % 7) + (n - 1) * 7;
  return new Date(year, month, day);
}

// Returns the last occurrence of `weekday` in the given month.
function lastWeekdayOfMonth(year: number, month: number, weekday: number): Date {
  const last = new Date(year, month + 1, 0);
  const day = last.getDate() - ((last.getDay() - weekday + 7) % 7);
  return new Date(year, month, day);
}

// Victoria Day: last Monday on or before May 25.
function victoriaDay(year: number): Date {
  const daysBack = (new Date(year, 4, 25).getDay() - 1 + 7) % 7;
  return new Date(year, 4, 25 - daysBack);
}

function toKey(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

// Returns a Set of "YYYY-MM-DD" strings for floating holidays in a given year/country.
function computeFloatingHolidays(year: number, country: string): Set<string> {
  const s = new Set<string>();
  if (country === 'US') {
    s.add(toKey(nthWeekdayOfMonth(year, 0, 1, 3)));   // MLK Day: 3rd Mon of Jan
    s.add(toKey(nthWeekdayOfMonth(year, 1, 1, 3)));   // Presidents Day: 3rd Mon of Feb
    s.add(toKey(lastWeekdayOfMonth(year, 4, 1)));      // Memorial Day: last Mon of May
    s.add(toKey(nthWeekdayOfMonth(year, 8, 1, 1)));   // Labor Day: 1st Mon of Sep
    const thanksgiving = nthWeekdayOfMonth(year, 10, 4, 4); // Thanksgiving: 4th Thu of Nov
    s.add(toKey(thanksgiving));
    const dayAfter = new Date(thanksgiving);
    dayAfter.setDate(dayAfter.getDate() + 1);
    s.add(toKey(dayAfter)); // Day after Thanksgiving
  } else if (country === 'CA') {
    s.add(toKey(nthWeekdayOfMonth(year, 1, 1, 3)));   // Family Day: 3rd Mon of Feb
    s.add(toKey(victoriaDay(year)));                   // Victoria Day
    s.add(toKey(nthWeekdayOfMonth(year, 8, 1, 1)));   // Labour Day: 1st Mon of Sep
    s.add(toKey(nthWeekdayOfMonth(year, 9, 1, 2)));   // Thanksgiving: 2nd Mon of Oct
  }
  return s;
}

// Simple cache: avoids recomputing for every day in a range loop.
const floatingCache = new Map<string, Set<string>>();
function getFloatingHolidays(year: number, country: string): Set<string> {
  const key = `${country}-${year}`;
  if (!floatingCache.has(key)) floatingCache.set(key, computeFloatingHolidays(year, country));
  return floatingCache.get(key)!;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function isHoliday(date: Date, country: string): boolean {
  if (!country || country === "NONE") return false;
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  // Check fixed holidays
  if (HOLIDAYS[country] && `${month}-${day}` in HOLIDAYS[country]) return true;
  // Check floating holidays
  return getFloatingHolidays(date.getFullYear(), country).has(toKey(date));
}

export function addBusinessDays(start: Date, days: number, country: string): Date {
  let count = 0;
  const current = new Date(start);
  while (count < days) {
    current.setDate(current.getDate() + 1);
    const day = current.getDay();
    if (day !== 0 && day !== 6 && !isHoliday(current, country)) {
      count++;
    }
  }
  return current;
}

export function countHolidaysInRange(start: Date, end: Date, country: string): number {
  if (!country || country === 'NONE') return 0;
  let count = 0;
  const current = new Date(start);
  current.setDate(current.getDate() + 1); // don't count start date itself
  while (current <= end) {
    if (isHoliday(current, country)) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

export function businessDaysWithHolidays(
  start: Date,
  end: Date,
  country: string
): number {
  let count = 0;
  const current = new Date(start);
  while (current < end) {
    const day = current.getDay();
    if (day !== 0 && day !== 6 && !isHoliday(current, country)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}
