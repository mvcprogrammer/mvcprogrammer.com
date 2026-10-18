/** Props of TableTwin. */
export interface TableTwinProps {
  /** Column headings; the first is the row label, the rest are numbers. */
  readonly columns: readonly string[];
  readonly rows: ReadonlyArray<readonly (string | number)[]>;
  /** The summary line, "Show as table" by default. */
  readonly summary?: string;
}

/** The accessible twin of a chart: the same numbers as a table behind a disclosure. Also the source for an export. */
export function TableTwin({ columns, rows, summary = 'Show as table' }: TableTwinProps) {
  return (
    <details className="table-twin">
      <summary>{summary}</summary>
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
