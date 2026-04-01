// Public holidays by country
// Format: "MM-DD" for fixed holidays

export const HOLIDAYS: Record<string, Record<string, string>> = {
  US: {
    "01-01": "New Year's Day",
    "01-15": "MLK Day",
    "02-19": "Presidents Day",
    "05-27": "Memorial Day",
    "06-19": "Juneteenth",
    "07-04": "Independence Day",
    "09-02": "Labor Day",
    "11-28": "Thanksgiving",
    "11-29": "Day after Thanksgiving",
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
    "02-19": "Family Day",
    "05-20": "Victoria Day",
    "07-01": "Canada Day",
    "09-02": "Labour Day",
    "10-14": "Thanksgiving",
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

export function isHoliday(date: Date, country: string): boolean {
  if (!country || country === "NONE") return false;
  const holidays = HOLIDAYS[country];
  if (!holidays) return false;
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}-${day}` in holidays;
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
  const holidays = HOLIDAYS[country];
  if (!holidays) return 0;
  let count = 0;
  const current = new Date(start);
  current.setDate(current.getDate() + 1); // don't count start date itself
  while (current <= end) {
    const month = String(current.getMonth() + 1).padStart(2, '0');
    const day = String(current.getDate()).padStart(2, '0');
    if (`${month}-${day}` in holidays) count++;
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