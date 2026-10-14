using System.ComponentModel.DataAnnotations;
using Portfolio.Blazor.ViewModels;

namespace Portfolio.Blazor.Tests.ViewModels;

/// <summary>Tests for <see cref="ContactForm"/>: validation rules and the request it produces.</summary>
public sealed class ContactFormTests
{
    #region Validate Tests

    /// <summary>A complete form with an email reply is valid.</summary>
    [Fact]
    public void Validate_ShouldPassForCompleteEmailReply()
    {
        // Arrange
        var form = CreateValidForm();

        // Act
        var results = Validate(form);

        // Assert
        Assert.Empty(results);
    }

    /// <summary>Required fields and formats are enforced by the annotations.</summary>
    [Fact]
    public void Validate_ShouldFailOnMissingAndMalformedFields()
    {
        // Arrange
        var form = new ContactForm { Name = string.Empty, Email = "not-an-email", Message = "short" };

        // Act
        var members = Validate(form).SelectMany(r => r.MemberNames).ToList();

        // Assert
        Assert.Contains(nameof(ContactForm.Name), members);
        Assert.Contains(nameof(ContactForm.Email), members);
        Assert.Contains(nameof(ContactForm.Message), members);
    }

    /// <summary>Requesting a call without a usable number fails on the phone field only.</summary>
    [Fact]
    public void Validate_ShouldRequirePhoneWhenCallRequested()
    {
        // Arrange
        var form = CreateValidForm();
        form.Reply = ContactForm.REPLY_BY_PHONE;
        form.Phone = " 12345 ";

        // Act
        var result = Assert.Single(Validate(form));

        // Assert
        Assert.Equal([nameof(ContactForm.Phone)], result.MemberNames);
        Assert.True(form.WantsCall, "the phone reply option sets WantsCall");
    }

    /// <summary>A phone number of at least seven characters satisfies the call rule.</summary>
    [Fact]
    public void Validate_ShouldPassWithPhoneWhenCallRequested()
    {
        // Arrange
        var form = CreateValidForm();
        form.Reply = ContactForm.REPLY_BY_PHONE;
        form.Phone = "727-555-0100";

        // Act
        var results = Validate(form);

        // Assert
        Assert.Empty(results);
    }

    #endregion

    #region ToRequest Tests

    /// <summary>The phone is sent only when a call was requested; the honeypot and timing travel as-is.</summary>
    [Fact]
    public void ToRequest_ShouldDropPhoneUnlessCallRequested()
    {
        // Arrange
        var form = CreateValidForm();
        form.Phone = "727-555-0100";
        form.Website = "bot";

        // Act
        var byEmail = form.ToRequest(1500);
        form.Reply = ContactForm.REPLY_BY_PHONE;
        var byPhone = form.ToRequest(2500);

        // Assert
        Assert.Equal(string.Empty, byEmail.Phone);
        Assert.Equal("727-555-0100", byPhone.Phone);
        Assert.Equal("bot", byEmail.Website);
        Assert.Equal(1500, byEmail.Elapsed);
        Assert.Equal(2500, byPhone.Elapsed);
        Assert.Equal(form.Name, byPhone.Name);
        Assert.Equal(ContactForm.REPLY_BY_PHONE, byPhone.Reply);
    }

    #endregion

    #region Helper Methods

    private static ContactForm CreateValidForm() => new()
    {
        Name = "Neal Thomas",
        Email = "neal@example.test",
        Topic = "Freelance",
        Reply = "Email",
        Message = "A message long enough to pass.",
    };

    private static List<ValidationResult> Validate(ContactForm form)
    {
        var results = new List<ValidationResult>();
        Validator.TryValidateObject(form, new ValidationContext(form), results, validateAllProperties: true);
        return results;
    }

    #endregion
}
