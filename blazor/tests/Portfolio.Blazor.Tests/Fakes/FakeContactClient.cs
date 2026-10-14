using Portfolio.Blazor.Interfaces;
using Portfolio.Blazor.Requests;

namespace Portfolio.Blazor.Tests.Fakes;

/// <summary>Scriptable <see cref="IContactClient"/> that records every request it receives.</summary>
internal sealed class FakeContactClient : IContactClient
{
    /// <summary>Requests passed to <see cref="SendAsync"/>, in call order.</summary>
    public List<ContactRequest> Sent { get; } = [];

    /// <summary>Behaviour of <see cref="SendAsync"/>; the default succeeds.</summary>
    public Func<ContactRequest, Task> OnSend { get; set; } = _ => Task.CompletedTask;

    /// <inheritdoc />
    public Task SendAsync(ContactRequest request, CancellationToken cancellationToken)
    {
        Sent.Add(request);
        return OnSend(request);
    }
}
