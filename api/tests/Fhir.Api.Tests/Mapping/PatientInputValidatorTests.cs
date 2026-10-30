using Fhir.Api.Mapping;
using Fhir.Api.Models;

namespace Fhir.Api.Tests.Mapping;

public sealed class PatientInputValidatorTests
{
    private static readonly DateOnly _today = new(2026, 10, 30);

    #region Validate Tests

    /// <summary>A complete, well-formed input has no errors.</summary>
    [Fact]
    public void Validate_ShouldAcceptAValidInput()
    {
        // Act
        var errors = PatientInputValidator.Validate(new PatientInput("Dickens", "Charles", Sex.Male, "1979-04-12", "MVC-0042"), _today);

        // Assert
        Assert.Empty(errors);
    }

    /// <summary>Each rule openapi.yaml states reports under its own field.</summary>
    [Theory]
    [InlineData("", null, null, null, "familyName")]
    [InlineData("   ", null, null, null, "familyName")]
    [InlineData("x", "y", null, null, null)]
    [InlineData("Dickens", null, "1979-4-12", null, "birthDate")]
    [InlineData("Dickens", null, "2026-10-31", null, "birthDate")]
    [InlineData("Dickens", null, null, "", "mrn")]
    [InlineData("Dickens", null, null, "has space", "mrn")]
    public void Validate_ShouldReportEachRuleUnderItsField(string family, string? given, string? birthDate, string? mrn, string? field)
    {
        // Act
        var errors = PatientInputValidator.Validate(new PatientInput(family, given, null, birthDate, mrn), _today);

        // Assert
        if (field is null)
        {
            Assert.Empty(errors);
        }
        else
        {
            var key = Assert.Single(errors.Keys);
            Assert.Equal(field, key);
        }
    }

    /// <summary>Names longer than the limit are refused.</summary>
    [Fact]
    public void Validate_ShouldRefuseOverlongNames()
    {
        // Arrange
        var long61 = new string('x', 61);

        // Act
        var errors = PatientInputValidator.Validate(new PatientInput(long61, long61, null, null, null), _today);

        // Assert
        Assert.Equal(["familyName", "givenName"], errors.Keys.Order());
    }

    /// <summary>A missing body is one error under "body".</summary>
    [Fact]
    public void Validate_ShouldReportAMissingBody()
    {
        // Act
        var errors = PatientInputValidator.Validate(null, _today);

        // Assert
        Assert.Equal("body", Assert.Single(errors.Keys));
    }

    #endregion
}
