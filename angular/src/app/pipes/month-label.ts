import { Pipe, PipeTransform } from '@angular/core';

/** "2023-12" becomes "Dec 2023". Anything unparseable is returned as-is. */
@Pipe({ name: 'monthLabel' })
export class MonthLabelPipe implements PipeTransform {
  private static readonly MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  private static readonly YEAR_MONTH = /^(\d{4})-(\d{2})$/;

  /**
   * @param yearMonth An ISO 8601 year-month.
   * @returns The month's three-letter English name and the year.
   */
  transform(yearMonth: string): string {
    const match = MonthLabelPipe.YEAR_MONTH.exec(yearMonth);
    if (match === null) {
      return yearMonth;
    }

    const month = Number(match[2]);
    const name = MonthLabelPipe.MONTHS[month - 1];
    return name === undefined ? yearMonth : `${name} ${match[1]}`;
  }
}
