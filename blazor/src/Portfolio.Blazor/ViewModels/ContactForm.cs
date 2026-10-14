using System.ComponentModel.DataAnnotations;
using Portfolio.Blazor.Requests;

namespace Portfolio.Blazor.ViewModels;

/// <summary>Mutable model bound to the contact form. Validated by data annotations before it becomes a <see cref="ContactRequest"/>.</summary>
public sealed class ContactForm : IValidatableObject
{
    /// <summary>The reply option that reveals and requires the phone field.</summary>
    public const string REPLY_BY_PHONE = "Phone call";

    /// <summary>Sender's name.</summary>
    [Required]
    [StringLength(120)]
    public string Name { get; set; } = string.Empty;

    /// <summary>Sender's email address.</summary>
    [Required]
    [EmailAddress]
    [StringLength(200)]
    public string Email { get; set; } = string.Empty;

    /// <summary>What the message is about.</summary>
    [Required]
    public string Topic { get; set; } = "Job opportunity";

    /// <summary>How the sender would like to hear back.</summary>
    [Required]
    public string Reply { get; set; } = "Email";

    /// <summary>Phone number, only when a call was requested.</summary>
    [StringLength(30)]
    public string Phone { get; set; } = string.Empty;

    /// <summary>The message body.</summary>
    [Required]
    [StringLength(5000, MinimumLength = 10)]
    public string Message { get; set; } = string.Empty;

    /// <summary>Honeypot field. Hidden from people; bots fill it.</summary>
    public string Website { get; set; } = string.Empty;

    /// <summary>True when the sender asked for a phone call.</summary>
    public bool WantsCall => string.Equals(Reply, REPLY_BY_PHONE, StringComparison.Ordinal);

    /// <summary>Requires a phone number only when a call was requested.</summary>
    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (WantsCall && Phone.Trim().Length < 7)
        {
            yield return new ValidationResult("Please enter a phone number so I can call you.", [nameof(Phone)]);
        }
    }

    /// <summary>Builds the JSON payload for the contact Lambda.</summary>
    /// <param name="elapsedMilliseconds">How long the form was open before submit.</param>
    public ContactRequest ToRequest(long elapsedMilliseconds) =>
        new(Name, Email, Topic, Reply, WantsCall ? Phone : string.Empty, Message, Website, elapsedMilliseconds);
}
