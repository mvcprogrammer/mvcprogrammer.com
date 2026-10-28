using System.Text.Json;
using Microsoft.AspNetCore.Components;
using Microsoft.AspNetCore.Components.Forms;
using Microsoft.JSInterop;
using Portfolio.Blazor.Exceptions;
using Portfolio.Blazor.Extensions;
using Portfolio.Blazor.Interfaces;
using Portfolio.Blazor.Models;
using Portfolio.Blazor.Serialization;
using Portfolio.Blazor.ViewModels;

namespace Portfolio.Blazor.Components;

/// <summary>
/// Code-behind for the patient explorer: the capability check on first render, the search with its
/// fallback families, the summary, the raw bundle, and the request log. The log's newest line is
/// kept in view through site.js.
/// </summary>
public sealed partial class FhirExplorer : IAsyncDisposable
{
    /// <summary>Base path of the API, for the log and the status line.</summary>
    public const string API = "/api/fhir";

    /// <summary>Lines kept in the log.</summary>
    public const int LOG_LIMIT = 60;

    /// <summary>Pages the function follows per search, used when a trace does not say.</summary>
    public const int PAGE_CAP = 5;

    /// <summary>Shown when a search returns nothing.</summary>
    public const string NO_MATCH_MESSAGE = "No patients match. Try another family name; the sandbox is wiped now and then.";

    /// <summary>Shown in the list before the first search.</summary>
    public const string LIST_PROMPT = "Run a search to list matching patients.";

    /// <summary>Shown in the summary before the first search.</summary>
    public const string SUMMARY_PROMPT = "Select a patient to load the summary: demographics, counts, active conditions, and recent vital signs.";

    /// <summary>Shown in the summary after a search with no rows.</summary>
    public const string SUMMARY_SELECT_PROMPT = "Select a patient to load the summary.";

    /// <summary>Shown in the summary when the sandbox did not answer.</summary>
    public const string SUMMARY_UPSTREAM_MESSAGE = "The sandbox did not answer in time. The explorer will work again as soon as it does.";

    /// <summary>Shown in the summary after any other search failure.</summary>
    public const string SUMMARY_FAILED_MESSAGE = "Nothing to show.";

    /// <summary>Shown in the raw panel when the bundle could not be loaded and no status is known.</summary>
    public const string RAW_FAILED_MESSAGE = "The raw bundle could not be loaded.";

    /// <summary>The prefilled example and the names tried in turn when it returns nothing (the sandbox is wiped now and then).</summary>
    public static readonly IReadOnlyList<string> FALLBACK_FAMILIES = ["Programmer", "Grant", "Meridius", "Deshmukh", "Smith", "Johnson", "Williams"];

    private readonly CancellationTokenSource _cts = new();
    private readonly FhirSearchForm _form = new() { Family = FALLBACK_FAMILIES[0] };
    private readonly List<LogLine> _lines = [new("$ waiting for the first search", string.Empty)];
    private EditContext _editContext = null!;
    private ElementReference _log;
    private IJSObjectReference? _module;
    private bool _validated;
    private string _statusText = string.Empty;
    private string _statusKind = string.Empty;
    private bool _searching;
    private IReadOnlyList<PatientListItem>? _patients;
    private string _countLabel = string.Empty;
    private string _listMessage = LIST_PROMPT;
    private string? _selectedId;
    private PatientSummary? _summary;
    private string _summaryMessage = SUMMARY_PROMPT;
    private bool _summaryBusy;
    private bool _resolvedShown;
    private string? _dtoName;
    private string _dtoJson = string.Empty;
    private bool _rawOpen;
    private string _rawText = string.Empty;
    private string? _rawLoadedFor;
    private string _sourceLabel = "HAPI sandbox";
    private int _renderedLines;

    [Inject]
    private IFhirClient Client { get; set; } = null!;

    [Inject]
    private IJSRuntime Js { get; set; } = null!;

    private string FormClass => _searching ? "fhir-search is-loading" : "fhir-search";

    private string StatusClass => _statusKind.Length == 0 ? "form-status" : "form-status " + _statusKind;

    private string SummaryClass => _summaryBusy ? "fhir-panel fhir-summary is-loading" : "fhir-panel fhir-summary";

    private string? FamilyError => _validated ? _editContext.GetValidationMessages(() => _form.Family).FirstOrDefault() : null;

    private string? BirthdateError => _validated ? _editContext.GetValidationMessages(() => _form.Birthdate).FirstOrDefault() : null;

    private string ResolvedLabel => (_resolvedShown ? "hide " : "+") + (_summary?.Conditions.Resolved.Count ?? 0) + " resolved";

    /// <inheritdoc />
    public async ValueTask DisposeAsync()
    {
        _cts.Cancel();
        _cts.Dispose();
        if (_module is not null)
        {
            await _module.DisposeAsync();
        }
    }

    /// <inheritdoc />
    protected override void OnInitialized()
    {
        _editContext = new EditContext(_form);
        _editContext.OnFieldChanged += (_, _) =>
        {
            // A fixed field clears its message as soon as it is typed into, as on the static edition.
            if (_validated)
            {
                _editContext.Validate();
            }
        };
    }

    /// <inheritdoc />
    protected override Task OnInitializedAsync() => CheckCapabilityAsync();

    /// <inheritdoc />
    protected override async Task OnAfterRenderAsync(bool firstRender)
    {
        if (_renderedLines == _lines.Count)
        {
            return;
        }

        _renderedLines = _lines.Count;
        _module ??= await Js.InvokeAsync<IJSObjectReference>("import", "./js/site.js");
        await _module.InvokeVoidAsync("scrollToEnd", _log);
    }

    private static string? InvalidClass(string? error) => error is null ? null : "is-invalid";

    private static string? InvalidAttribute(string? error) => error is null ? null : "true";

    private static string Plural(int count, string one, string many) => count == 1 ? one : many;

    private string Pressed(string id) => string.Equals(_selectedId, id, StringComparison.Ordinal) ? "true" : "false";

    private void ShowInvalid() => _validated = true;

    private void ToggleResolved() => _resolvedShown = !_resolvedShown;

    /// <summary>Validated by the form; searches, walking the fallback list when the prefilled example returns nothing.</summary>
    private async Task SearchAsync()
    {
        _validated = false;
        var request = _form.ToRequest();
        var usingTheExample = string.Equals(request.Family, FALLBACK_FAMILIES[0], StringComparison.Ordinal) && request.Birthdate.Length == 0 && request.Identifier.Length == 0;
        await SearchAsync(request.Family, request.Birthdate, request.Identifier, usingTheExample ? 1 : null);
    }

    private async Task SearchAsync(string family, string birthdate, string identifier, int? fallbackIndex)
    {
        _searching = true;
        SetStatus("Searching…", string.Empty);
        var path = "/patients?family=" + Uri.EscapeDataString(family)
            + (birthdate.Length > 0 ? "&birthdate=" + Uri.EscapeDataString(birthdate) : string.Empty)
            + (identifier.Length > 0 ? "&identifier=" + Uri.EscapeDataString(identifier) : string.Empty);
        Write($"→ GET {API}{path}", "request");

        try
        {
            var response = await Client.SearchPatientsAsync(new(family, birthdate, identifier), _cts.Token);
            var result = response.Body;
            WriteResponse("/patients", response);
            WriteTrace(result.Trace, response);
            Write($"  mapped to PatientSearchResult: {result.Count} {Plural(result.Count, "item", "items")}{(result.Trace.Truncated ? " (one page; more matches exist)" : string.Empty)}", "detail");
            ShowDto("PatientSearchResult", JsonSerializer.Serialize(result, PortfolioJsonContext.Default.PatientSearchResult));

            // The prefilled example may have been wiped from the sandbox; walk the fallback list once, without extra inputs.
            if (result.Count == 0 && birthdate.Length == 0 && identifier.Length == 0 && fallbackIndex is int index && index < FALLBACK_FAMILIES.Count)
            {
                var next = FALLBACK_FAMILIES[index];
                Write($"  nothing for \"{family}\"; the sandbox may have been wiped, trying \"{next}\"", "note");
                _form.Family = next;
                _searching = false;
                await SearchAsync(next, string.Empty, string.Empty, index + 1);
                return;
            }

            _patients = result.Items;
            _countLabel = result.Count == 0 ? "(0)" : $"({result.Count}{(result.Total is int total && total > result.Count ? $" of {total}" : string.Empty)})";
            _listMessage = NO_MATCH_MESSAGE;
            SetStatus(result.Count == 0 ? "No matches." : $"{result.Count} {Plural(result.Count, "patient", "patients")} for “{family}”; the first is selected.", "is-ok");
            if (result.Items.Count > 0)
            {
                await LoadSummaryAsync(result.Items[0].Id);
            }
            else
            {
                ShowSummaryMessage(SUMMARY_SELECT_PROMPT);
            }
        }
        catch (FhirProblemException problem)
        {
            WriteFailure("/patients", problem);
            _patients = [];
            _countLabel = "(0)";
            _listMessage = problem.Message;
            ShowSummaryMessage(problem.UpstreamFailed ? SUMMARY_UPSTREAM_MESSAGE : SUMMARY_FAILED_MESSAGE);
            SetStatus(problem.Message, "is-error");
        }
        catch (OperationCanceledException)
        {
            // The component is going away; nothing to show.
        }
        finally
        {
            _searching = false;
        }
    }

    private Task SelectAsync(string id) => LoadSummaryAsync(id);

    private async Task LoadSummaryAsync(string id)
    {
        _selectedId = id;
        _rawLoadedFor = null;
        _rawOpen = false;
        _summaryBusy = true;
        var path = $"/patients/{Uri.EscapeDataString(id)}/summary";
        Write($"→ GET {API}{path}", "request");

        try
        {
            var response = await Client.GetSummaryAsync(id, _cts.Token);
            if (!string.Equals(_selectedId, id, StringComparison.Ordinal))
            {
                return;
            }

            var body = response.Body;
            WriteResponse(path, response);
            WriteTrace(body.Trace, response);
            Write($"  mapped to PatientSummary: {body.Conditions.Active.Count} active and {body.Conditions.Resolved.Count} resolved conditions, {body.Vitals.Count} vital signs", "detail");
            ShowDto("PatientSummary", JsonSerializer.Serialize(body, PortfolioJsonContext.Default.PatientSummary));
            _resolvedShown = false;
            _summary = body;
        }
        catch (FhirProblemException problem)
        {
            if (!string.Equals(_selectedId, id, StringComparison.Ordinal))
            {
                return;
            }

            WriteFailure(path, problem);
            ShowSummaryMessage(problem.Message);
        }
        catch (OperationCanceledException)
        {
            // The component is going away; nothing to show.
        }
        finally
        {
            if (string.Equals(_selectedId, id, StringComparison.Ordinal))
            {
                _summaryBusy = false;
            }
        }
    }

    private async Task ToggleRawAsync()
    {
        if (_selectedId is null || _summary is null)
        {
            return;
        }

        if (_rawOpen)
        {
            _rawOpen = false;
            return;
        }

        _rawOpen = true;
        if (!string.Equals(_rawLoadedFor, _selectedId, StringComparison.Ordinal))
        {
            await LoadRawAsync(_selectedId);
        }
    }

    private async Task LoadRawAsync(string id)
    {
        _rawText = "loading…";
        var path = $"/patients/{Uri.EscapeDataString(id)}/raw";
        Write($"→ GET {API}{path}", "request");

        try
        {
            var response = await Client.GetRawBundleAsync(id, _cts.Token);
            if (!string.Equals(_selectedId, id, StringComparison.Ordinal))
            {
                return;
            }

            Write($"← {response.Status} {response.ContentType} in {response.DurationMs} ms · {response.XCache.ToCacheLabel()} · {response.Body.Length} bytes", "response");
            _rawText = response.Body;
            _rawLoadedFor = id;
        }
        catch (FhirProblemException problem)
        {
            if (!string.Equals(_selectedId, id, StringComparison.Ordinal))
            {
                return;
            }

            WriteFailure(path, problem);
            _rawText = problem.Status == 0 ? RAW_FAILED_MESSAGE : $"The raw bundle could not be loaded ({problem.Status}).";
        }
        catch (OperationCanceledException)
        {
            // The component is going away; nothing to show.
        }
    }

    private async Task CheckCapabilityAsync()
    {
        Write($"→ GET {API}/capability", "request");
        try
        {
            var response = await Client.GetCapabilityAsync(_cts.Token);
            var capability = response.Body;
            WriteResponse("/capability", response);
            var missing = new List<string>();
            foreach (var resource in capability.Resources)
            {
                if (!resource.Supported)
                {
                    missing.Add(resource.Type);
                }

                missing.AddRange(resource.SearchParams.Where(p => !p.Supported).Select(p => $"{resource.Type}?{p.Name}"));
            }

            var software = string.IsNullOrEmpty(capability.Software?.Name) ? "sandbox" : $"{capability.Software.Name} {capability.Software.Version}".Trim();
            Write($"  {software} · FHIR {capability.FhirVersion} at {capability.BaseUrl} · checked {capability.CheckedAt}", "detail");
            Write(capability.Ok ? "  every resource and search parameter the explorer needs is supported ✓" : "  not supported: " + string.Join(", ", missing), capability.Ok ? "detail" : "error");
            if (!string.IsNullOrEmpty(capability.BaseUrl))
            {
                _sourceLabel = capability.BaseUrl.Contains("hapi.fhir.org", StringComparison.OrdinalIgnoreCase) ? "HAPI sandbox" : capability.Software?.Name ?? "FHIR sandbox";
            }
        }
        catch (FhirProblemException problem)
        {
            Write("  capability check failed: " + problem.Message, "error");
        }
        catch (OperationCanceledException)
        {
            // The component is going away; nothing to show.
        }
    }

    private void ShowSummaryMessage(string message)
    {
        _summary = null;
        _summaryMessage = message;
    }

    private void ShowDto(string name, string json)
    {
        _dtoName = name;
        _dtoJson = JsonIndenter.Indent(json);
    }

    private void SetStatus(string text, string kind)
    {
        _statusText = text;
        _statusKind = kind;
    }

    private void Write(string text, string kind)
    {
        _lines.Add(new LogLine(text, kind));
        if (_lines.Count > LOG_LIMIT)
        {
            _lines.RemoveRange(0, _lines.Count - LOG_LIMIT);
        }
    }

    private void WriteResponse<T>(string path, FhirResponse<T> response) =>
        Write($"← {response.Status} {path} in {response.DurationMs} ms · {response.XCache.ToCacheLabel()} · ETag {response.ETag ?? "none"}", "response");

    private void WriteFailure(string path, FhirProblemException problem)
    {
        if (problem.Status == 0)
        {
            Write(problem.TimedOut ? $"← timed out after {problem.DurationMs} ms" : "← network error", "error");
            return;
        }

        Write($"← {problem.Status} {path}{(problem.Title is null ? string.Empty : ": " + problem.Title)} in {problem.DurationMs} ms · {problem.XCache.ToCacheLabel()}", "error");
    }

    private void WriteTrace<T>(Trace trace, FhirResponse<T> response)
    {
        if (response.XCache is not null && response.XCache.StartsWith("hit", StringComparison.OrdinalIgnoreCase))
        {
            Write($"  served from the CloudFront cache; the upstream numbers below are from the original request at {trace.GeneratedAt}", "note");
        }

        foreach (var request in trace.Requests)
        {
            Write($"  ↳ {request.Method} {request.Url}", "upstream");
            Write($"    {request.Status} · {request.DurationMs} ms · {request.Entries} {Plural(request.Entries, "entry", "entries")} · {request.Pages} {Plural(request.Pages, "page", "pages")}", "detail");
        }

        var count = trace.Requests.Count;
        var cap = trace.PageCap == 0 ? PAGE_CAP : trace.PageCap;
        Write($"  {count} upstream {Plural(count, "request", "requests")} in {trace.TotalDurationMs} ms wall time · {trace.BundleEntries} bundle {Plural(trace.BundleEntries, "entry", "entries")} · {trace.PagesWalked} {Plural(trace.PagesWalked, "page", "pages")} walked (cap {cap} per search){(trace.Truncated ? " · truncated" : string.Empty)}", "detail");
    }
}
