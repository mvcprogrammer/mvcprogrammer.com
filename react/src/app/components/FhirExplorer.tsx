import { useEffect, useRef, type FormEvent } from 'react';
import { ageLabel, avatarClass, dateParts, initialsOf, pillCode, pillTitle, rowLabel, vitalValue } from '../formatters/fhir-labels';
import { useFhirExplorer } from '../hooks/use-fhir-explorer';
import { useSite } from '../providers/SiteProvider';
import { FAMILY_MAX_LENGTH, IDENTIFIER_MAX_LENGTH } from '../validators/fhir-search-validation';

/**
 * The FHIR R4 patient explorer inside the FHIR API card: search, the patient list, the summary
 * card, and the "under the hood" log, rendered from useFhirExplorer(). Loaded lazily, so it mounts
 * (and makes its first request, the capability check) only once the card's accordion opens. The
 * markup is the static edition's; ids are kept because the shared stylesheet and aria wiring use them.
 */
export function FhirExplorer() {
  const { fhir } = useSite();
  const { state, errors, actions } = useFhirExplorer(fhir);
  const log = useRef<HTMLPreElement>(null);

  // The log keeps its newest line in view, as a terminal does.
  useEffect(() => {
    const element = log.current;
    if (element !== null) {
      element.scrollTop = element.scrollHeight;
    }
  }, [state.lines]);

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    actions.submit();
  };

  const summary = state.summary;
  const resolvedLabel = `${state.resolvedShown ? 'hide ' : '+'}${summary?.conditions.resolved.length ?? 0} resolved`;

  return (
    <div className="fhir-explorer">
      <div className="fhir-head">
        <h4 className="fhir-title">FHIR R4 patient explorer</h4>
        <p className="fhir-badge">
          <span className="fhir-badge-dot" aria-hidden="true"></span>Synthetic data &middot;{' '}
          <span data-fhir-source>{state.sourceLabel}</span>
        </p>
      </div>
      <p className="fhir-lead">
        A window onto a public FHIR R4 test server seeded with synthetic records. No real
        patient data is involved, nothing is persisted, and nothing beyond request metadata is logged.
      </p>

      {/* Search. The example is prefilled so the first click succeeds; the sandbox is wiped now and
          then, so the hook replaces a family name that returns nothing with the next one in its list. */}
      <form
        className={state.searching ? 'fhir-search is-loading' : 'fhir-search'}
        id="fhir-search"
        role="search"
        aria-label="Patient search"
        noValidate
        onSubmit={submit}
      >
        <div className="fhir-search-row">
          <div className="field">
            <label className="field-label" htmlFor="fhir-family">
              Family name{' '}
              <span className="fhir-required" aria-hidden="true">
                *
              </span>
            </label>
            <input
              id="fhir-family"
              name="family"
              type="text"
              value={state.values.family}
              onChange={(event) => actions.setValue('family', event.target.value)}
              className={errors.family !== undefined ? 'is-invalid' : undefined}
              aria-invalid={errors.family !== undefined ? 'true' : undefined}
              required
              maxLength={FAMILY_MAX_LENGTH}
              autoComplete="off"
              spellCheck={false}
              aria-describedby="fhir-family-error"
            />
            <p className="field-error" id="fhir-family-error" aria-live="polite">
              {errors.family ?? ''}
            </p>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="fhir-birthdate">
              Birth date
            </label>
            <input
              id="fhir-birthdate"
              name="birthdate"
              type="date"
              value={state.values.birthdate}
              onChange={(event) => actions.setValue('birthdate', event.target.value)}
              className={errors.birthdate !== undefined ? 'is-invalid' : undefined}
              aria-invalid={errors.birthdate !== undefined ? 'true' : undefined}
              autoComplete="off"
              aria-describedby="fhir-birthdate-error"
            />
            <p className="field-error" id="fhir-birthdate-error" aria-live="polite">
              {errors.birthdate ?? ''}
            </p>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="fhir-identifier">
              Identifier <span className="fhir-optional">(MRN, optional)</span>
            </label>
            <input
              id="fhir-identifier"
              name="identifier"
              type="text"
              value={state.values.identifier}
              onChange={(event) => actions.setValue('identifier', event.target.value)}
              maxLength={IDENTIFIER_MAX_LENGTH}
              autoComplete="off"
              spellCheck={false}
              placeholder="12345 or system|value"
            />
            <p className="field-error" aria-live="polite"></p>
          </div>
          <div className="field fhir-search-action">
            <button className="button button-primary" type="submit" id="fhir-submit" disabled={state.searching}>
              Search
            </button>
          </div>
        </div>
        <p
          className={state.statusKind === '' ? 'form-status' : `form-status ${state.statusKind}`}
          id="fhir-status"
          role="status"
          aria-live="polite"
        >
          {state.statusText === '' ? (
            <>
              Searches <code>GET /api/fhir/patients?family=&hellip;</code>, which runs{' '}
              <code>GET Patient?family=&hellip;</code> on the sandbox.
            </>
          ) : (
            state.statusText
          )}
        </p>
      </form>

      {/* Results: the list on the left, the summary on the right; stacked on phones. */}
      <div className="fhir-results" id="fhir-results">
        <section className="fhir-panel fhir-list" aria-labelledby="fhir-list-title">
          <h5 className="fhir-panel-title" id="fhir-list-title">
            Patients{' '}
            <span className="fhir-count" id="fhir-count" aria-live="polite">
              {state.countLabel}
            </span>
          </h5>
          <ul className="fhir-patients" id="fhir-patients" role="list">
            {(state.patients ?? []).map((patient) => (
              <li key={patient.id}>
                <button
                  type="button"
                  className="fhir-patient"
                  data-id={patient.id}
                  aria-pressed={state.selectedId === patient.id}
                  onClick={() => actions.select(patient.id)}
                >
                  <span className={avatarClass(patient.id, true)} aria-hidden="true">
                    {initialsOf(patient)}
                  </span>
                  <span className="fhir-patient-text">
                    <span className="fhir-patient-name">{patient.name}</span>
                    <span className="fhir-patient-sub">{rowLabel(patient)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="fhir-empty" id="fhir-list-empty" hidden={(state.patients?.length ?? 0) > 0}>
            {state.listMessage}
          </p>
        </section>

        <section
          className={state.summaryBusy ? 'fhir-panel fhir-summary is-loading' : 'fhir-panel fhir-summary'}
          id="fhir-summary"
          aria-labelledby="fhir-summary-title"
          aria-live="polite"
          aria-busy={state.summaryBusy}
        >
          <h5 className="sr-only" id="fhir-summary-title">
            Patient summary
          </h5>
          {summary === null ? (
            <p className="fhir-empty" id="fhir-summary-empty">
              {state.summaryMessage}
            </p>
          ) : (
            <div className="fhir-card" id="fhir-card">
              <header className="fhir-card-head">
                <span className={avatarClass(summary.patient.id, false)} id="fhir-avatar" aria-hidden="true">
                  {summary.patient.initials}
                </span>
                <div className="fhir-card-ident">
                  <h6 className="fhir-card-name" id="fhir-card-name">
                    {summary.patient.name}
                  </h6>
                  <p className="fhir-card-meta" id="fhir-card-meta">
                    {summary.patient.sex ?? 'sex unknown'} · {ageLabel(summary)} ·{' '}
                    <code>Patient/{summary.patient.id}</code>
                    {summary.patient.mrn && (
                      <>
                        {' '}
                        · MRN <code>{summary.patient.mrn}</code>
                      </>
                    )}
                  </p>
                </div>
              </header>
              <dl className="fhir-tiles" aria-label="Resource counts">
                <div className="fhir-tile">
                  <dt>Conditions</dt>
                  <dd id="fhir-tile-conditions">{summary.counts.conditions}</dd>
                </div>
                <div className="fhir-tile">
                  <dt>Encounters</dt>
                  <dd id="fhir-tile-encounters">{summary.counts.encounters}</dd>
                </div>
                <div className="fhir-tile">
                  <dt>Observations</dt>
                  <dd id="fhir-tile-observations">{summary.counts.observations}</dd>
                </div>
              </dl>
              <h6 className="fhir-subtitle">Active conditions</h6>
              <ul className="fhir-pills" id="fhir-conditions" role="list">
                {summary.conditions.active.length === 0 && summary.conditions.resolved.length === 0 && (
                  <li className="fhir-empty-inline">None recorded.</li>
                )}
                {summary.conditions.active.map((condition, index) => (
                  <li className="fhir-pill" key={index} title={pillTitle(condition)}>
                    <span className="fhir-pill-text">{condition.display}</span>
                    {condition.code && <code className="fhir-pill-code">{pillCode(condition)}</code>}
                  </li>
                ))}
                {summary.conditions.resolved.length > 0 && (
                  <li className="fhir-pill fhir-pill-more">
                    <button
                      type="button"
                      className="fhir-pill-button"
                      aria-expanded={state.resolvedShown}
                      aria-controls="fhir-resolved"
                      onClick={actions.toggleResolved}
                    >
                      {resolvedLabel}
                    </button>
                  </li>
                )}
              </ul>
              <ul className="fhir-pills fhir-pills-resolved" id="fhir-resolved" role="list" hidden={!state.resolvedShown}>
                {summary.conditions.resolved.map((condition, index) => (
                  <li className="fhir-pill is-resolved" key={index} title={pillTitle(condition)}>
                    <span className="fhir-pill-text">{condition.display}</span>
                    {condition.code && <code className="fhir-pill-code">{pillCode(condition)}</code>}
                  </li>
                ))}
              </ul>
              <h6 className="fhir-subtitle">Vitals</h6>
              <div className="fhir-table-wrap">
                <table className="fhir-table" id="fhir-vitals" hidden={summary.vitals.length === 0}>
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">Vital sign</th>
                      <th scope="col">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.vitals.map((vital, index) => {
                      const parts = dateParts(vital.date);
                      return (
                        <tr key={index}>
                          <td className="fhir-table-date">
                            <time dateTime={vital.date}>
                              {parts.date}
                              {parts.time && <span className="fhir-table-time">{parts.time}</span>}
                            </time>
                          </td>
                          <td>
                            {vital.name} <code className="fhir-loinc">{vital.loincCode}</code>
                          </td>
                          <td className="fhir-table-value">{vitalValue(vital)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="fhir-empty fhir-vitals-empty" id="fhir-vitals-empty" hidden={summary.vitals.length > 0}>
                No vital signs recorded for this patient.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* Under the hood: what the browser asked for, what the function asked the sandbox for, and what came back. */}
      <section className="fhir-hood" aria-labelledby="fhir-hood-title">
        <div className="fhir-hood-head">
          <h5 className="fhir-panel-title" id="fhir-hood-title">
            Under the hood
          </h5>
          <div className="fhir-hood-actions">
            <button
              className="button button-secondary fhir-hood-button"
              type="button"
              id="fhir-raw-toggle"
              aria-expanded={state.rawOpen}
              aria-controls="fhir-raw"
              disabled={summary === null}
              onClick={actions.toggleRaw}
            >
              View raw bundle
            </button>
            <a
              className="card-link"
              href="https://github.com/mvcprogrammer/mvcprogrammer.com/blob/main/api/openapi.yaml"
              target="_blank"
              rel="noopener"
            >
              OpenAPI
            </a>
            <a
              className="card-link"
              href="https://github.com/mvcprogrammer/mvcprogrammer.com/tree/main/api/src/Fhir.Api"
              target="_blank"
              rel="noopener"
            >
              Source
            </a>
          </div>
        </div>
        <pre className="fhir-log" id="fhir-log" aria-live="polite" aria-label="Request log" tabIndex={0} ref={log}>
          {state.lines.map((line, index) => (
            <span key={index} className={line.kind ? `fhir-log-${line.kind}` : undefined}>
              {line.text}
              {'\n'}
            </span>
          ))}
        </pre>
        <details className="fhir-dto" id="fhir-dto-details">
          <summary>The {state.dtoName ?? 'DTO'} the function returned</summary>
          <pre className="fhir-log fhir-dto-body" id="fhir-dto" tabIndex={0}>
            {state.dtoJson}
          </pre>
        </details>
        <pre className="fhir-log fhir-raw" id="fhir-raw" hidden={!state.rawOpen} tabIndex={0} aria-label="Raw FHIR bundle">
          {state.rawText}
        </pre>
      </section>
    </div>
  );
}
