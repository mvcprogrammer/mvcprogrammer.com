/** A CSV document from column headings and rows, quoting fields that need it, with CRLF line ends per RFC 4180. */
export function toCsv(columns: readonly string[], rows: ReadonlyArray<readonly (string | number)[]>): string {
  const quote = (value: string | number) => {
    const text = String(value);
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return [columns, ...rows].map((row) => row.map(quote).join(',')).join('\r\n') + '\r\n';
}

/** A file name safe for every platform: lowercase, dashes, and the .csv extension. */
export function csvFileName(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `${slug === '' ? 'export' : slug}.csv`;
}

/** Offers the text as a file download through a short-lived object URL. */
export function downloadText(fileName: string, text: string, type = 'text/csv;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
