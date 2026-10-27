import { useCallback, useEffect, useState } from 'react';
import type { DayKey } from '../dates';
import { parseQuery, serializeQuery, type Query } from './query';

/**
 * The query, read from and written to the URL. Changing it pushes a history entry, so the back
 * button and bookmarks work; a popstate (back, forward) re-reads the URL. The URL is the only
 * state: nothing else remembers the range or the segments. A named range such as "last 7 days"
 * is resolved against `today`, the same day the rest of the page uses, so the two cannot disagree.
 */
export function useQuery(today: DayKey): [Query, (next: Query) => void] {
  const [query, setQueryState] = useState<Query>(() => {
    const search = stripSignInParams(window.location.search);
    if (search !== window.location.search) {
      window.history.replaceState(null, '', `${window.location.pathname}${search}`);
    }
    return parseQuery(search, today);
  });

  useEffect(() => {
    const onPopState = () => setQueryState(parseQuery(window.location.search, today));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [today]);

  const setQuery = useCallback((next: Query) => {
    const search = serializeQuery(next);
    if (search !== window.location.search) {
      window.history.pushState(null, '', `${window.location.pathname}${search}`);
    }
    setQueryState(next);
  }, []);

  return [query, setQuery];
}

/**
 * The search string without the `code` and `state` the sign-in return leaves behind. The edge
 * function has already exchanged the code for the session cookies by the time the page runs; the
 * parameters only clutter the address bar and any bookmark made from it.
 */
export function stripSignInParams(search: string): string {
  const params = new URLSearchParams(search);
  if (!params.has('code') && !params.has('state')) {
    return search;
  }
  params.delete('code');
  params.delete('state');
  const text = params.toString();
  return text === '' ? '' : `?${text}`;
}
