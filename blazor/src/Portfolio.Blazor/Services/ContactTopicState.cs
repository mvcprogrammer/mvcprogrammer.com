using Portfolio.Blazor.Interfaces;

namespace Portfolio.Blazor.Services;

/// <summary>In-memory topic hand-off between the call-to-action buttons and the contact form. One instance per app.</summary>
public sealed class ContactTopicState : IContactTopicState
{
    private readonly List<Action<string>> _handlers = [];

    /// <inheritdoc />
    public void Select(string topic)
    {
        ArgumentNullException.ThrowIfNull(topic);

        foreach (var handler in _handlers.ToArray())
        {
            handler(topic);
        }
    }

    /// <inheritdoc />
    public void Subscribe(Action<string> handler)
    {
        ArgumentNullException.ThrowIfNull(handler);
        _handlers.Add(handler);
    }

    /// <inheritdoc />
    public void Unsubscribe(Action<string> handler)
    {
        ArgumentNullException.ThrowIfNull(handler);
        _handlers.Remove(handler);
    }
}
