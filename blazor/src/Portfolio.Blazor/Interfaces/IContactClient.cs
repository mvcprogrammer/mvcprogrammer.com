using Portfolio.Blazor.Requests;

namespace Portfolio.Blazor.Interfaces;

/// <summary>Sends the contact form to the contact Lambda.</summary>
public interface IContactClient
{
    /// <summary>Posts the message. Throws <see cref="HttpRequestException"/> with the status code when the Lambda refuses it.</summary>
    /// <param name="request">The message.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    Task SendAsync(ContactRequest request, CancellationToken cancellationToken);
}
