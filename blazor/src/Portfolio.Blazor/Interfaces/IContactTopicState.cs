namespace Portfolio.Blazor.Interfaces;

/// <summary>
/// Lets a call-to-action elsewhere on the page ("Talk about a role", "Start a conversation")
/// preselect the contact form's topic before the page scrolls to it.
/// </summary>
public interface IContactTopicState
{
    /// <summary>Preselects a topic. The contact form picks it up through <see cref="Subscribe"/>.</summary>
    /// <param name="topic">One of the topics the form offers.</param>
    void Select(string topic);

    /// <summary>Registers a handler that runs with the topic each time one is selected.</summary>
    /// <param name="handler">Receives the selected topic.</param>
    void Subscribe(Action<string> handler);

    /// <summary>Removes a handler added with <see cref="Subscribe"/>.</summary>
    /// <param name="handler">The handler to remove.</param>
    void Unsubscribe(Action<string> handler);
}
