import { csvFileName, downloadText, toCsv } from '../formatters/csv';

/** Props of TableTwin. */
export interface TableTwinProps {
  /** What the table holds, for the CSV file name; the download button appears when set. */
  readonly name?: string;
  /** Column headings; the first is the row label, the rest are numbers. */
  readonly columns: readonly string[];
  readonly rows: ReadonlyArray<readonly (string | number)[]>;
  /** The summary line, "Show as table" by default. */
  readonly summary?: string;
}

/** The accessible twin of a chart: the same numbers as a table behind a disclosure, with a CSV download of exactly those rows. */
export function TableTwin({ name, columns, rows, summary = 'Show as table' }: TableTwinProps) {
  return (
    <details className="table-twin">
      <summary>{summary}</summary>
      {name !== undefined && (
        <button type="button" className="table-twin-export" onClick={() => downloadText(csvFileName(name), toCsv(columns, rows))}>
          Download CSV
        </button>
      )}
      <div className="table-twin-scroll">
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column} scope="col">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                {row.map((cell, cellIndex) => (cellIndex === 0 ? <th key={cellIndex} scope="row">{cell}</th> : <td key={cellIndex}>{cell}</td>))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
