import { monthLabel } from './month-label';

describe('monthLabel', () => {
  it.each([
    ['2023-12', 'Dec 2023'],
    ['2020-01', 'Jan 2020'],
    ['1999-06', 'Jun 1999'],
  ])('should format %s as %s', (input, expected) => {
    // Arrange, Act
    const label = monthLabel(input);

    // Assert
    expect(label).toBe(expected);
  });

  it.each(['', '2023', '2023-1', 'December 2023', '2023-12-01'])(
    'should return unparseable input %j as-is',
    (input) => {
      // Arrange, Act
      const label = monthLabel(input);

      // Assert
      expect(label).toBe(input);
    },
  );

  it.each(['2023-00', '2023-13'])('should return an out-of-range month %s as-is', (input) => {
    // Arrange, Act
    const label = monthLabel(input);

    // Assert
    expect(label).toBe(input);
  });
});
