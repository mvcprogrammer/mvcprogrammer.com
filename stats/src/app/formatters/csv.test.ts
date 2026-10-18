import { csvFileName, downloadText, toCsv } from './csv';

describe('csv', () => {
  it('should quote fields with commas, quotes, or line breaks and end lines with CRLF', () => {
    expect(toCsv(['Day', 'Visits'], [['Oct 1', 3], ['a, b', 'say "hi"']])).toBe('Day,Visits\r\nOct 1,3\r\n"a, b","say ""hi"""\r\n');
  });

  it('should make a safe file name', () => {
    expect(csvFileName('Visits and visitors · Oct 1 – Oct 7, 2026')).toBe('visits-and-visitors-oct-1-oct-7-2026.csv');
    expect(csvFileName('***')).toBe('export.csv');
  });

  it('should click a download link for the text and release the URL', () => {
    // Arrange
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    vi.useFakeTimers();

    // Act
    downloadText('a.csv', 'x,y\r\n');
    vi.runAllTimers();

    // Assert
    expect(create).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledWith('blob:test');
    expect(document.querySelector('a[download]')).toBeNull();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
});
