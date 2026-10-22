using System.Net;
using System.Net.Http;
using Microsoft.AspNetCore.Components.Forms;
using Portfolio.Blazor.Sections;
using Portfolio.Blazor.Tests.Fakes;
using Portfolio.Blazor.Tests.Helpers;
using Portfolio.Blazor.ViewModels;

namespace Portfolio.Blazor.Tests.Sections;

/// <summary>Tests for <see cref="ContactSection"/>: topic hand-off, the conditional phone field, and submission.</summary>
public sealed class ContactSectionTests : BunitContext
{
    #region Render Tests

    /// <summary>The form renders with the honeypot, the hidden phone field, and no status.</summary>
    [Fact]
    public void Render_ShouldRenderFormWithPhoneHidden()
    {
        // Arrange
        this.AddSiteServices();

        // Act
        var cut = Render<ContactSection>();

        // Assert
        Assert.NotNull(cut.Find("form#contact-form"));
        Assert.True(cut.Find("label[hidden]").TextContent.Contains("Phone number", StringComparison.Ordinal), "the phone field starts hidden");
        Assert.True(cut.Find("input[type=tel]").HasAttribute("disabled"), "a hidden phone field is disabled so it does not validate");
        Assert.NotNull(cut.Find(".field-trap input"));
        Assert.Equal(string.Empty, cut.Find(".form-status").TextContent);
        Assert.False(cut.Find("button[type=submit]").HasAttribute("disabled"), "the button is enabled until a send starts");
    }

    #endregion

    #region Topic Tests

    /// <summary>Selecting a topic through the shared state preselects it in the form.</summary>
    [Fact]
    public async Task OnTopicSelected_ShouldPreselectTopic()
    {
        // Arrange
        var (_, _, topic) = this.AddSiteServices();
        var cut = Render<ContactSection>();

        // Act (the call-to-action buttons select on the renderer's dispatcher, so the test does too)
        await cut.InvokeAsync(() => topic.Select("Contract or consulting"));

        // Assert
        Assert.Equal("Contract or consulting", cut.FindAll("select")[0].GetAttribute("value"));
    }

    /// <summary>After disposal the form no longer listens, so a later selection does not throw.</summary>
    [Fact]
    public async Task Dispose_ShouldUnsubscribeFromTopicState()
    {
        // Arrange
        var (_, _, topic) = this.AddSiteServices();
        Render<ContactSection>();
        await DisposeComponentsAsync();

        // Act
        var exception = Record.Exception(() => topic.Select("Contract or consulting"));

        // Assert
        Assert.Null(exception);
    }

    #endregion

    #region Phone Field Tests

    /// <summary>Choosing "Phone call" reveals, enables, and requires the phone field.</summary>
    [Fact]
    public void Reply_ShouldRevealPhoneFieldWhenCallRequested()
    {
        // Arrange
        this.AddSiteServices();
        var cut = Render<ContactSection>();

        // Act
        cut.FindAll("select")[1].Change(ContactForm.REPLY_BY_PHONE);

        // Assert
        Assert.Empty(cut.FindAll("label[hidden]"));
        var phone = cut.Find("input[type=tel]");
        Assert.False(phone.HasAttribute("disabled"), "the phone field is enabled when a call is requested");
        Assert.True(phone.HasAttribute("required"), "the phone field is required when a call is requested");
    }

    #endregion

    #region SendAsync Tests

    /// <summary>A valid form posts the payload, clears the fields, and reports success by email.</summary>
    [Fact]
    public async Task SendAsync_ShouldPostRequestAndShowEmailConfirmation()
    {
        // Arrange
        var (_, contact, _) = this.AddSiteServices();
        var cut = Render<ContactSection>();
        Arrange_FilledForm(cut);

        // Act
        await cut.Find("form").SubmitAsync();

        // Assert
        var request = Assert.Single(contact.Sent);
        Assert.Equal("Neal Thomas", request.Name);
        Assert.Equal("neal@example.test", request.Email);
        Assert.Equal("Job opportunity", request.Topic);
        Assert.Equal("Email", request.Reply);
        Assert.Equal(string.Empty, request.Phone);
        Assert.Equal("Hello, I have a role for you.", request.Message);
        Assert.Equal(string.Empty, request.Website);
        Assert.True(request.Elapsed >= 0, "elapsed time is reported");
        Assert.Contains("is-ok", cut.Find(".form-status").ClassList);
        Assert.Equal("Thanks, your message is on its way. I will reply by email.", cut.Find(".form-status").TextContent);
        Assert.Contains("is-sent", cut.Find("form").ClassList);
        Assert.Equal(string.Empty, cut.FindAll("input")[0].GetAttribute("value"));
    }

    /// <summary>With a call requested, the phone number is sent and the confirmation says so.</summary>
    [Fact]
    public async Task SendAsync_ShouldIncludePhoneAndShowCallConfirmation()
    {
        // Arrange
        var (_, contact, _) = this.AddSiteServices();
        var cut = Render<ContactSection>();
        Arrange_FilledForm(cut);
        cut.FindAll("select")[1].Change(ContactForm.REPLY_BY_PHONE);
        cut.Find("input[type=tel]").Change("727-555-0100");

        // Act
        await cut.Find("form").SubmitAsync();

        // Assert
        var request = Assert.Single(contact.Sent);
        Assert.Equal(ContactForm.REPLY_BY_PHONE, request.Reply);
        Assert.Equal("727-555-0100", request.Phone);
        Assert.Equal("Thanks, your message is on its way. I will call you at the number you gave.", cut.Find(".form-status").TextContent);
    }

    /// <summary>The honeypot value travels with the request so the Lambda can drop it.</summary>
    [Fact]
    public async Task SendAsync_ShouldForwardHoneypotValue()
    {
        // Arrange
        var (_, contact, _) = this.AddSiteServices();
        var cut = Render<ContactSection>();
        Arrange_FilledForm(cut);
        cut.Find(".field-trap input").Change("https://spam.example.test");

        // Act
        await cut.Find("form").SubmitAsync();

        // Assert
        Assert.Equal("https://spam.example.test", Assert.Single(contact.Sent).Website);
    }

    /// <summary>A 429 from the Lambda shows the rate-limit message.</summary>
    [Fact]
    public async Task SendAsync_ShouldShowRateLimitMessageOn429()
    {
        // Arrange
        var (_, contact, _) = this.AddSiteServices();
        contact.OnSend = _ => throw new HttpRequestException("rate limited", null, HttpStatusCode.TooManyRequests);
        var cut = Render<ContactSection>();
        Arrange_FilledForm(cut);

        // Act
        await cut.Find("form").SubmitAsync();

        // Assert
        Assert.Contains("is-error", cut.Find(".form-status").ClassList);
        Assert.Equal("That is a few messages in a row. Please try again in an hour.", cut.Find(".form-status").TextContent);
        Assert.False(cut.Find("button[type=submit]").HasAttribute("disabled"), "the button is re-enabled after a failure");
        Assert.DoesNotContain("is-sent", cut.Find("form").ClassList);
    }

    /// <summary>Any other HTTP failure shows the generic message and keeps the typed values.</summary>
    [Fact]
    public async Task SendAsync_ShouldShowGenericMessageOnOtherFailure()
    {
        // Arrange
        var (_, contact, _) = this.AddSiteServices();
        contact.OnSend = _ => throw new HttpRequestException("boom", null, HttpStatusCode.InternalServerError);
        var cut = Render<ContactSection>();
        Arrange_FilledForm(cut);

        // Act
        await cut.Find("form").SubmitAsync();

        // Assert
        Assert.Equal("Something went wrong sending that. Please try again in a moment, or reach me on LinkedIn.", cut.Find(".form-status").TextContent);
        Assert.Equal("Neal Thomas", cut.FindAll("input")[0].GetAttribute("value"));
    }

    /// <summary>A timeout shows its own message.</summary>
    [Fact]
    public async Task SendAsync_ShouldShowTimeoutMessageOnCancellation()
    {
        // Arrange
        var (_, contact, _) = this.AddSiteServices();
        contact.OnSend = _ => throw new TaskCanceledException("timeout");
        var cut = Render<ContactSection>();
        Arrange_FilledForm(cut);

        // Act
        await cut.Find("form").SubmitAsync();

        // Assert
        Assert.Equal("That took too long to send. Please try again in a moment, or reach me on LinkedIn.", cut.Find(".form-status").TextContent);
    }

    /// <summary>An invalid model never reaches the client; the status asks for corrections.</summary>
    [Fact]
    public async Task SendAsync_ShouldNotPostWhenModelIsInvalid()
    {
        // Arrange
        var (_, contact, _) = this.AddSiteServices();
        var cut = Render<ContactSection>();

        // Act
        await cut.Find("form").SubmitAsync();

        // Assert
        Assert.Empty(contact.Sent);
        Assert.Equal("Please check the highlighted fields.", cut.Find(".form-status").TextContent);
        Assert.Contains("is-error", cut.Find(".form-status").ClassList);
    }

    /// <summary>Requesting a call without a number is invalid, through the model's own validation.</summary>
    [Fact]
    public async Task SendAsync_ShouldNotPostWhenCallRequestedWithoutPhone()
    {
        // Arrange
        var (_, contact, _) = this.AddSiteServices();
        var cut = Render<ContactSection>();
        Arrange_FilledForm(cut);
        cut.FindAll("select")[1].Change(ContactForm.REPLY_BY_PHONE);

        // Act
        await cut.Find("form").SubmitAsync();

        // Assert
        Assert.Empty(contact.Sent);
        Assert.Equal("Please check the highlighted fields.", cut.Find(".form-status").TextContent);
    }

    #endregion

    #region Helper Methods

    // Each change re-renders the form, so the inputs are looked up again before every change.
    private static void Arrange_FilledForm(IRenderedComponent<ContactSection> cut)
    {
        cut.FindAll("input")[0].Change("Neal Thomas");
        cut.FindAll("input")[1].Change("neal@example.test");
        cut.Find("textarea").Change("Hello, I have a role for you.");
    }

    #endregion
}
