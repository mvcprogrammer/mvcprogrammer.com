import { useCallback, useEffect, useState } from 'react';
import { todayKey } from '../dates';
import { parseQuery, serializeQuery, type Query } from './query';

/**
 * The query, read from and written to the URL. Changing it pushes a history entry, so the back
 * button and bookmarks work; a popstate (back, forward) re-reads the URL. The URL is the only
 * state: nothing else remembers the range or the segments.
 */
export function useQuery(): [Query, (next: Query) => void] {
  const [query, setQueryState] = useState<Query>(() => parseQuery(window.location.search, todayKey()));

  useEffect(() => {
    const onPopState = () => setQueryState(parseQuery(window.location.search, todayKey()));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const setQuery = useCallback((next: Query) => {
    const search = serializeQuery(next);
    if (search !== window.location.search) {
      window.history.pushState(null, '', `${window.location.pathname}${search}`);
    }
    setQueryState(next);
  }, []);

  return [query, setQuery];
}
