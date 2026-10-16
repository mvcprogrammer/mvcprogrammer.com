const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const YEAR_MONTH = /^(\d{4})-(\d{2})$/;

/**
 * "2023-12" becomes "Dec 2023". Anything unparseable is returned as-is.
 * @param yearMonth An ISO 8601 year-month.
 * @returns The month's three-letter English name and the year.
 */
export function monthLabel(yearMonth: string): string {
  const match = YEAR_MONTH.exec(yearMonth);
  if (match === null) {
    return yearMonth;
  }

  const month = Number(match[2]);
  const name = MONTHS[month - 1];
  return name === undefined ? yearMonth : `${name} ${match[1]}`;
}
