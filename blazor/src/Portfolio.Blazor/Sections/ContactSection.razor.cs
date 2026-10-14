using System.Diagnostics;
using System.Net;
using Microsoft.AspNetCore.Components;
using Portfolio.Blazor.Interfaces;
using Portfolio.Blazor.ViewModels;

namespace Portfolio.Blazor.Sections;

/// <summary>Code-behind for the contact form: topic preselection, submission, and status messages.</summary>
public sealed partial class ContactSection : IDisposable
{
    private readonly CancellationTokenSource _cts = new();
    private readonly Stopwatch _opened = Stopwatch.StartNew();
    private ContactForm _form = new();
    private string _status = string.Empty;
    private string? _statusClass;
    private bool _sending;
    private bool _sent;

    [Inject]
    private IContactClient Client { get; set; } = null!;

    [Inject]
    private IContactTopicState TopicState { get; set; } = null!;

    private string FormClass => _sent ? "contact-form is-sent" : "contact-form";

    /// <inheritdoc />
    public void Dispose()
    {
        TopicState.Unsubscribe(OnTopicSelected);
        _cts.Cancel();
        _cts.Dispose();
    }

    /// <inheritdoc />
    protected override void OnInitialized() => TopicState.Subscribe(OnTopicSelected);

    private void OnTopicSelected(string topic)
    {
        _form.Topic = topic;
        StateHasChanged();
    }

    private void SetStatus(string text, string? cssClass)
    {
        _status = text;
        _statusClass = cssClass;
    }

    private void ShowInvalid() => SetStatus("Please check the highlighted fields.", "is-error");

    private async Task SendAsync()
    {
        _sending = true;
        SetStatus("Sending…", null);

        try
        {
            await Client.SendAsync(_form.ToRequest(_opened.ElapsedMilliseconds), _cts.Token);

            var byPhone = _form.WantsCall;
            _form = new ContactForm();
            _sent = true;
            SetStatus(
                byPhone
                    ? "Thanks, your message is on its way. I will call you at the number you gave."
                    : "Thanks, your message is on its way. I will reply by email.",
                "is-ok");
        }
        catch (HttpRequestException ex)
        {
            SetStatus(
                ex.StatusCode == HttpStatusCode.TooManyRequests
                    ? "That is a few messages in a row. Please try again in an hour."
                    : "Something went wrong sending that. Please try again in a moment, or reach me on LinkedIn.",
                "is-error");
        }
        catch (TaskCanceledException)
        {
            SetStatus("That took too long to send. Please try again in a moment, or reach me on LinkedIn.", "is-error");
        }
        finally
        {
            _sending = false;
        }
    }
}
