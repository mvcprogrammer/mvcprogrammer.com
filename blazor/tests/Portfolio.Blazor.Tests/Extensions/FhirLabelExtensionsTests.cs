using Portfolio.Blazor.Enumerations;
using Portfolio.Blazor.Extensions;
using Portfolio.Blazor.Models;
using Portfolio.Blazor.Tests.Helpers;

namespace Portfolio.Blazor.Tests.Extensions;

/// <summary>Tests for <see cref="FhirLabelExtensions"/>.</summary>
public sealed class FhirLabelExtensionsTests
{
    #region ToAvatarHue and ToAvatarClass Tests

    /// <summary>The same id always gets the same hue within the stylesheet's range.</summary>
    [Fact]
    public void ToAvatarHue_ShouldBeStableAndInRange()
    {
        // Act
        var hue = "78785".ToAvatarHue();

        // Assert
        Assert.Equal(hue, "78785".ToAvatarHue());
        Assert.InRange(hue, 0, FhirLabelExtensions.AVATAR_HUES - 1);
        Assert.Equal($"fhir-avatar fhir-avatar-sm fhir-avatar-{hue}", "78785".ToAvatarClass(true));
        Assert.Equal($"fhir-avatar fhir-avatar-{hue}", "78785".ToAvatarClass(false));
    }

    #endregion

    #region ToInitials Tests

    /// <summary>Initials come from the given and family names; an unknown family is skipped; nothing becomes a question mark.</summary>
    [Fact]
    public void ToInitials_ShouldUseGivenAndFamily()
    {
        // Act and Assert
        Assert.Equal("KW", TestData.CreatePatientListItem().ToInitials());
        Assert.Equal("W", TestData.CreatePatientListItem(givenName: null).ToInitials());
        Assert.Equal("?", TestData.CreatePatientListItem(givenName: null, familyName: "Unknown").ToInitials());
    }

    #endregion

    #region ToRowLabel Tests

    /// <summary>The row label joins the birth year, sex, and reference, skipping what is missing.</summary>
    [Fact]
    public void ToRowLabel_ShouldJoinKnownParts()
    {
        // Act and Assert
        Assert.Equal("born 1963 · female · Patient/78785", TestData.CreatePatientListItem().ToRowLabel());
        Assert.Equal("birth year unknown · Patient/78785", TestData.CreatePatientListItem(birthYear: null, sex: null).ToRowLabel());
    }

    #endregion

    #region ToAgeLabel Tests

    /// <summary>The age wins, then the birth date, then unknown.</summary>
    [Fact]
    public void ToAgeLabel_ShouldPreferAgeThenBirthDate()
    {
        // Arrange
        var patient = TestData.CreatePatientSummary().Patient;

        // Act and Assert
        Assert.Equal("63 years", patient.ToAgeLabel());
        Assert.Equal("born 1963-03-02", (patient with { Age = null }).ToAgeLabel());
        Assert.Equal("age unknown", (patient with { Age = null, BirthDate = null }).ToAgeLabel());
    }

    #endregion

    #region ToPillCode and ToPillTitle Tests

    /// <summary>A named system prefixes the code; "other" does not; an onset date makes a title.</summary>
    [Fact]
    public void ToPillCode_ShouldPrefixNamedSystem()
    {
        // Arrange
        var condition = TestData.CreatePatientSummary().Conditions.Active[0];

        // Act and Assert
        Assert.Equal("SNOMED CT 59621000", condition.ToPillCode());
        Assert.Equal("59621000", (condition with { SystemLabel = "other" }).ToPillCode());
        Assert.Equal("Onset 2010-05-01 · active", condition.ToPillTitle());
        Assert.Null((condition with { OnsetDate = null }).ToPillTitle());
    }

    #endregion

    #region ToValueLabel Tests

    /// <summary>Components join with a slash and share the first unit; plain values round to two decimals.</summary>
    [Fact]
    public void ToValueLabel_ShouldJoinComponentsOrRoundValue()
    {
        // Arrange
        var vitals = TestData.CreatePatientSummary().Vitals;

        // Act and Assert
        Assert.Equal("108/82 mm[Hg]", vitals[0].ToValueLabel());
        Assert.Equal("64.6 kg", vitals[1].ToValueLabel());
        Assert.Equal("27.74 kg/m2", new VitalSign("2026-01-01", "BMI", "39156-5", 27.7449, "kg/m2", null).ToValueLabel());
        Assert.Equal("5", new VitalSign("2026-01-01", "x", "1", 5, null, null).ToValueLabel());
    }

    #endregion

    #region ToDateParts Tests

    /// <summary>A bare date keeps no time; a date-time splits into the date and clock time as sent; junk keeps its date prefix.</summary>
    [Fact]
    public void ToDateParts_ShouldSplitDateAndTime()
    {
        // Act and Assert
        Assert.Equal(("2026-03-31", string.Empty), "2026-03-31".ToDateParts());
        Assert.Equal(("2026-03-31", "10:47"), "2026-03-31T10:47:00Z".ToDateParts());
        Assert.Equal(("2026-03-31", string.Empty), "2026-03-31Tnonsense".ToDateParts());
    }

    #endregion

    #region ToCacheLabel and ToLabel Tests

    /// <summary>The cache note names the header or says no edge answered; a sex label is the lowercase code.</summary>
    [Fact]
    public void ToCacheLabel_ShouldNameHeaderOrSayNone()
    {
        // Act and Assert
        Assert.Equal("X-Cache: Hit from cloudfront", "Hit from cloudfront".ToCacheLabel());
        Assert.Equal("X-Cache: n/a (no CloudFront in front of this origin)", ((string?)null).ToCacheLabel());
        Assert.Equal("female", Sex.Female.ToLabel());
    }

    #endregion
}
