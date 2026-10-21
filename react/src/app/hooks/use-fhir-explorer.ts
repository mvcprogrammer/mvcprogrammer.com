import { useCallback, useEffect, useRef, useState } from 'react';
import { FhirProblemError } from '../exceptions/fhir-problem-error';
import { describeCache } from '../formatters/fhir-labels';
import type { FhirClient } from '../interfaces/fhir-client';
import type { FhirResponse } from '../models/fhir-response';
import type { LogLine } from '../models/log-line';
import type { PatientListItem } from '../models/patient-list-item';
import type { PatientSummary } from '../models/patient-summary';
import type { Trace } from '../models/trace';
import { validateFhirSearch, type FhirSearchErrors, type FhirSearchValues } from '../validators/fhir-search-validation';

/** Base path of the API, for the log and the status line. */
export const FHIR_API = '/api/fhir';

/** The prefilled example and the names tried in turn when it returns nothing (the sandbox is wiped now and then). */
export const FALLBACK_FAMILIES: readonly string[] = ['Watsica', 'Grant', 'Meridius', 'Deshmukh', 'Smith', 'Johnson', 'Williams'];

/** Lines kept in the log. */
export const LOG_LIMIT = 60;

/** Pages the function follows per search, used when a trace does not say. */
export const PAGE_CAP = 5;

export const NO_MATCH_MESSAGE = 'No patients match. Try another family name; the sandbox is wiped now and then.';
export const LIST_PROMPT = 'Run a search to list matching patients.';
export const SUMMARY_PROMPT = 'Select a patient to load the summary: demographics, counts, active conditions, and recent vital signs.';
export const SUMMARY_SELECT_PROMPT = 'Select a patient to load the summary.';
export const SUMMARY_UPSTREAM_MESSAGE = 'The sandbox did not answer in time. The explorer will work again as soon as it does.';
export const SUMMARY_FAILED_MESSAGE = 'Nothing to show.';
export const RAW_FAILED_MESSAGE = 'The raw bundle could not be loaded.';

/** The explorer's whole state, held in one object so a flow can patch several fields at once. */
export interface FhirExplorerState {
  readonly values: FhirSearchValues;

  /** True once a submit found the form invalid; errors show from then on. */
  readonly validated: boolean;
  readonly statusText: string;
  readonly statusKind: 'is-ok' | 'is-error' | '';
  readonly searching: boolean;

  /** Null before the first search. */
  readonly patients: readonly PatientListItem[] | null;
  readonly countLabel: string;
  readonly listMessage: string;
  readonly selectedId: string | null;
  readonly summary: PatientSummary | null;
  readonly summaryMessage: string;
  readonly summaryBusy: boolean;
  readonly resolvedShown: boolean;
  readonly lines: readonly LogLine[];
  readonly dtoName: string | null;
  readonly dtoJson: string;
  readonly rawOpen: boolean;
  readonly rawText: string;
  readonly sourceLabel: string;
}

/** What the explorer component can do. */
export interface FhirExplorerActions {
  /** Changes one search field. */
  setValue(name: keyof FhirSearchValues, value: string): void;

  /** Validates, then searches. The prefilled example walks the fallback list when it returns nothing. */
  submit(): void;

  /** Loads a patient's summary and marks its row. */
  select(id: string): void;

  /** Shows or hides the resolved conditions. */
  toggleResolved(): void;

  /** Shows or hides the raw bundle, loading it once per patient. */
  toggleRaw(): void;
}

/** What useFhirExplorer() returns. */
export interface FhirExplorerHandle {
  readonly state: FhirExplorerState;

  /** Validation messages, present only after a failed submit. */
  readonly errors: FhirSearchErrors;
  readonly actions: FhirExplorerActions;
}

const INITIAL_STATE: FhirExplorerState = {
  values: { family: FALLBACK_FAMILIES[0]!, birthdate: '', identifier: '' },
  validated: false,
  statusText: '',
  statusKind: '',
  searching: false,
  patients: null,
  countLabel: '',
  listMessage: LIST_PROMPT,
  selectedId: null,
  summary: null,
  summaryMessage: SUMMARY_PROMPT,
  summaryBusy: false,
  resolvedShown: false,
  lines: [{ text: '$ waiting for the first search', kind: '' }],
  dtoName: null,
  dtoJson: '',
  rawOpen: false,
  rawText: '',
  sourceLabel: 'HAPI sandbox',
};

/**
 * The patient explorer's state and flows over a FhirClient: the capability check on mount, the
 * search with its fallback families, the summary, the raw bundle, and the request log. The
 * component renders what this returns.
 * @param client The FHIR API client.
 */
export function useFhirExplorer(client: FhirClient): FhirExplorerHandle {
  const [state, setState] = useState<FhirExplorerState>(INITIAL_STATE);

  // Refs carry what async flows must read after awaits: whether the view is alive, which patient is
  // selected now, and which patient's raw bundle is loaded.
  const active = useRef(true);
  const selectedRef = useRef<string | null>(null);
  const rawLoadedFor = useRef<string | null>(null);

  const patch = useCallback((changes: Partial<FhirExplorerState>): void => {
    setState((current) => ({ ...current, ...changes }));
  }, []);

  const write = useCallback((text: string, kind: LogLine['kind']): void => {
    setState((current) => ({ ...current, lines: [...current.lines, { text, kind }].slice(-LOG_LIMIT) }));
  }, []);

  const writeResponse = useCallback(
    (path: string, response: FhirResponse<unknown>): void => {
      write(`← ${response.status} ${path} in ${response.durationMs} ms · ${describeCache(response.xCache)} · ETag ${response.etag ?? 'none'}`, 'response');
    },
    [write],
  );

  const writeFailure = useCallback(
    (path: string, problem: FhirProblemError): void => {
      if (problem.status === 0) {
        write(problem.timedOut ? `← timed out after ${problem.durationMs} ms` : '← network error', 'error');
        return;
      }

      write(`← ${problem.status} ${path}${problem.title ? `: ${problem.title}` : ''} in ${problem.durationMs} ms · ${describeCache(problem.xCache)}`, 'error');
    },
    [write],
  );

  const writeTrace = useCallback(
    (trace: Trace, response: FhirResponse<unknown>): void => {
      if (/^hit/i.test(response.xCache ?? '')) {
        write(`  served from the CloudFront cache; the upstream numbers below are from the original request at ${trace.generatedAt}`, 'note');
      }

      for (const request of trace.requests) {
        write(`  ↳ ${request.method} ${request.url}`, 'upstream');
        write(`    ${request.status} · ${request.durationMs} ms · ${request.entries} ${request.entries === 1 ? 'entry' : 'entries'} · ${request.pages} ${request.pages === 1 ? 'page' : 'pages'}`, 'detail');
      }

      const count = trace.requests.length;
      write(
        `  ${count} upstream ${count === 1 ? 'request' : 'requests'} in ${trace.totalDurationMs} ms wall time · ${trace.bundleEntries} bundle ${trace.bundleEntries === 1 ? 'entry' : 'entries'} · ${trace.pagesWalked} ${trace.pagesWalked === 1 ? 'page' : 'pages'} walked (cap ${trace.pageCap || PAGE_CAP} per search)${trace.truncated ? ' · truncated' : ''}`,
        'detail',
      );
    },
    [write],
  );

  const showDto = useCallback(
    (name: string, value: unknown): void => {
      patch({ dtoName: name, dtoJson: JSON.stringify(value, null, 2) });
    },
    [patch],
  );

  const loadSummary = useCallback(
    async (id: string): Promise<void> => {
      selectedRef.current = id;
      rawLoadedFor.current = null;
      patch({ selectedId: id, rawOpen: false, summaryBusy: true });
      const path = `/patients/${encodeURIComponent(id)}/summary`;
      write(`→ GET ${FHIR_API}${path}`, 'request');

      try {
        const response = await client.getSummary(id);
        if (!active.current || selectedRef.current !== id) {
          return;
        }

        const body = response.body;
        writeResponse(path, response);
        writeTrace(body.trace, response);
        write(`  mapped to PatientSummary: ${body.conditions.active.length} active and ${body.conditions.resolved.length} resolved conditions, ${body.vitals.length} vital signs`, 'detail');
        showDto('PatientSummary', body);
        patch({ summary: body, resolvedShown: false, summaryBusy: false });
      } catch (error: unknown) {
        if (!active.current || selectedRef.current !== id) {
          return;
        }

        const problem = FhirProblemError.fromRejection(error, 0);
        writeFailure(path, problem);
        patch({ summary: null, summaryMessage: problem.message, summaryBusy: false });
      }
    },
    [client, patch, showDto, write, writeFailure, writeResponse, writeTrace],
  );

  const search = useCallback(
    async (family: string, birthdate: string, identifier: string, fallbackIndex: number | null): Promise<void> => {
      patch({ searching: true, statusText: 'Searching…', statusKind: '' });
      const path =
        `/patients?family=${encodeURIComponent(family)}` +
        (birthdate ? `&birthdate=${encodeURIComponent(birthdate)}` : '') +
        (identifier ? `&identifier=${encodeURIComponent(identifier)}` : '');
      write(`→ GET ${FHIR_API}${path}`, 'request');

      try {
        const response = await client.searchPatients({ family, birthdate, identifier });
        if (!active.current) {
          return;
        }

        const result = response.body;
        writeResponse('/patients', response);
        writeTrace(result.trace, response);
        write(`  mapped to PatientSearchResult: ${result.count} ${result.count === 1 ? 'item' : 'items'}${result.trace.truncated ? ' (one page; more matches exist)' : ''}`, 'detail');
        showDto('PatientSearchResult', result);

        // The prefilled example may have been wiped from the sandbox; walk the fallback list once, without extra inputs.
        if (result.count === 0 && !birthdate && !identifier && fallbackIndex !== null && fallbackIndex < FALLBACK_FAMILIES.length) {
          const next = FALLBACK_FAMILIES[fallbackIndex]!;
          write(`  nothing for "${family}"; the sandbox may have been wiped, trying "${next}"`, 'note');
          setState((current) => ({ ...current, values: { ...current.values, family: next } }));
          await search(next, '', '', fallbackIndex + 1);
          return;
        }

        patch({
          patients: result.items,
          countLabel: result.count === 0 ? '(0)' : `(${result.count}${result.total !== undefined && result.total > result.count ? ` of ${result.total}` : ''})`,
          listMessage: NO_MATCH_MESSAGE,
          statusText: result.count === 0 ? 'No matches.' : `${result.count} ${result.count === 1 ? 'patient' : 'patients'} for “${family}”; the first is selected.`,
          statusKind: 'is-ok',
          searching: false,
        });
        if (result.items.length > 0) {
          await loadSummary(result.items[0]!.id);
        } else {
          patch({ summary: null, summaryMessage: SUMMARY_SELECT_PROMPT });
        }
      } catch (error: unknown) {
        if (!active.current) {
          return;
        }

        const problem = FhirProblemError.fromRejection(error, 0);
        writeFailure('/patients', problem);
        patch({
          patients: [],
          countLabel: '(0)',
          listMessage: problem.message,
          summary: null,
          summaryMessage: problem.upstreamFailed ? SUMMARY_UPSTREAM_MESSAGE : SUMMARY_FAILED_MESSAGE,
          statusText: problem.message,
          statusKind: 'is-error',
          searching: false,
        });
      }
    },
    [client, loadSummary, patch, showDto, write, writeFailure, writeResponse, writeTrace],
  );

  const loadRaw = useCallback(
    async (id: string): Promise<void> => {
      patch({ rawText: 'loading…' });
      const path = `/patients/${encodeURIComponent(id)}/raw`;
      write(`→ GET ${FHIR_API}${path}`, 'request');

      try {
        const response = await client.getRawBundle(id);
        if (!active.current || selectedRef.current !== id) {
          return;
        }

        write(`← ${response.status} ${response.contentType ?? ''} in ${response.durationMs} ms · ${describeCache(response.xCache)} · ${response.body.length} bytes`, 'response');
        rawLoadedFor.current = id;
        patch({ rawText: response.body });
      } catch (error: unknown) {
        if (!active.current || selectedRef.current !== id) {
          return;
        }

        const problem = FhirProblemError.fromRejection(error, 0);
        writeFailure(path, problem);
        patch({ rawText: problem.status === 0 ? RAW_FAILED_MESSAGE : `The raw bundle could not be loaded (${problem.status}).` });
      }
    },
    [client, patch, write, writeFailure],
  );

  // The capability check, once per mount, so the log can say what the sandbox supports.
  useEffect(() => {
    active.current = true;
    const check = async (): Promise<void> => {
      write(`→ GET ${FHIR_API}/capability`, 'request');
      try {
        const response = await client.getCapability();
        if (!active.current) {
          return;
        }

        const capability = response.body;
        writeResponse('/capability', response);
        const missing: string[] = [];
        for (const resource of capability.resources) {
          if (!resource.supported) {
            missing.push(resource.type);
          }

          for (const param of resource.searchParams) {
            if (!param.supported) {
              missing.push(`${resource.type}?${param.name}`);
            }
          }
        }

        const software = capability.software?.name ? `${capability.software.name} ${capability.software.version ?? ''}`.trim() : 'sandbox';
        write(`  ${software} · FHIR ${capability.fhirVersion} at ${capability.baseUrl} · checked ${capability.checkedAt}`, 'detail');
        write(capability.ok ? '  every resource and search parameter the explorer needs is supported ✓' : `  not supported: ${missing.join(', ')}`, capability.ok ? 'detail' : 'error');
        if (capability.baseUrl) {
          patch({ sourceLabel: /hapi\.fhir\.org/.test(capability.baseUrl) ? 'HAPI sandbox' : (capability.software?.name ?? 'FHIR sandbox') });
        }
      } catch (error: unknown) {
        if (active.current) {
          write(`  capability check failed: ${FhirProblemError.fromRejection(error, 0).message}`, 'error');
        }
      }
    };

    void check();
    return () => {
      active.current = false;
    };
  }, [client, patch, write, writeResponse]);

  const actions: FhirExplorerActions = {
    setValue: (name, value) => {
      setState((current) => ({ ...current, values: { ...current.values, [name]: value } }));
    },
    submit: () => {
      const errors = validateFhirSearch(state.values);
      if (errors.family !== undefined || errors.birthdate !== undefined) {
        patch({ validated: true });
        return;
      }

      patch({ validated: false });
      const family = state.values.family.trim();
      const identifier = state.values.identifier.trim();
      const usingTheExample = family === FALLBACK_FAMILIES[0] && state.values.birthdate === '' && identifier === '';
      void search(family, state.values.birthdate, identifier, usingTheExample ? 1 : null);
    },
    select: (id) => {
      void loadSummary(id);
    },
    toggleResolved: () => {
      setState((current) => ({ ...current, resolvedShown: !current.resolvedShown }));
    },
    toggleRaw: () => {
      const id = selectedRef.current;
      if (id === null || state.summary === null) {
        return;
      }

      if (state.rawOpen) {
        patch({ rawOpen: false });
        return;
      }

      patch({ rawOpen: true });
      if (rawLoadedFor.current !== id) {
        void loadRaw(id);
      }
    },
  };

  return { state, errors: state.validated ? validateFhirSearch(state.values) : {}, actions };
}
