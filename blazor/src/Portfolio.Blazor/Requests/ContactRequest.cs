namespace Portfolio.Blazor.Requests;

/// <summary>JSON body posted to the contact Lambda. Field names match what the function reads.</summary>
/// <param name="Name">Sender's name.</param>
/// <param name="Email">Sender's email address.</param>
/// <param name="Topic">One of the topics offered in the form.</param>
/// <param name="Reply">"Email" or "Phone call".</param>
/// <param name="Phone">Phone number when a call was requested, otherwise empty.</param>
/// <param name="Message">The message body.</param>
/// <param name="Website">Honeypot. People never see the field, so a value marks a bot.</param>
/// <param name="Elapsed">Milliseconds the form was open before submit; the Lambda drops instant submissions.</param>
public sealed record ContactRequest(
    string Name,
    string Email,
    string Topic,
    string Reply,
    string Phone,
    string Message,
    string Website,
    long Elapsed);
