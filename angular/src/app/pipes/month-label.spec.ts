import { MonthLabelPipe } from './month-label';

describe('MonthLabelPipe', () => {
  describe('transform', () => {
    it.each([
      ['2023-12', 'Dec 2023'],
      ['2020-02', 'Feb 2020'],
      ['1999-01', 'Jan 1999'],
    ])('should transform %s into %s', (input, expected) => {
      // Arrange
      const pipe = new MonthLabelPipe();

      // Act
      const label = pipe.transform(input);

      // Assert
      expect(label).toBe(expected);
    });

    it.each(['', 'Dec 2023', '2023-13', '2023-00', '2023-1', 'not-a-date'])('should return %j unchanged when unparseable', (input) => {
      // Arrange
      const pipe = new MonthLabelPipe();

      // Act
      const label = pipe.transform(input);

      // Assert
      expect(label).toBe(input);
    });
  });
});
