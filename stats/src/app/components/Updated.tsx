import { formatRelative, formatStamp } from '../formatters/format';

/** Props of Updated. */
export interface UpdatedProps {
  /** When the exporter last ran, ISO 8601. */
  readonly generatedAt: string;
  readonly now?: Date;
}

/** "Updated 2 h ago", with the exact time in the tooltip, so stale data is never mistaken for a quiet day. */
export function Updated({ generatedAt, now = new Date() }: UpdatedProps) {
  return (
    <p className="updated">
      Updated{' '}
      <time dateTime={generatedAt} title={formatStamp(generatedAt)}>
        {formatRelative(generatedAt, now)}
      </time>
    </p>
  );
}
