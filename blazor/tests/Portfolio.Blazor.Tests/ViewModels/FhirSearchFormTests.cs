using System.ComponentModel.DataAnnotations;
using Portfolio.Blazor.ViewModels;

namespace Portfolio.Blazor.Tests.ViewModels;

/// <summary>Tests for <see cref="FhirSearchForm"/> validation and mapping.</summary>
public sealed class FhirSearchFormTests
{
    #region Validate Tests

    /// <summary>The prefilled example is valid.</summary>
    [Fact]
    public void Validate_ShouldAcceptExample()
    {
        // Act and Assert
        Assert.Empty(Validate(new FhirSearchForm { Family = "Watsica" }));
    }

    /// <summary>A blank or whitespace family name is reported as required.</summary>
    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Validate_ShouldRequireFamily(string family)
    {
        // Act
        var results = Validate(new FhirSearchForm { Family = family });

        // Assert
        var result = Assert.Single(results);
        Assert.Equal(FhirSearchForm.FAMILY_REQUIRED_MESSAGE, result.ErrorMessage);
        Assert.Equal(nameof(FhirSearchForm.Family), Assert.Single(result.MemberNames));
    }

    /// <summary>The family name is capped at sixty characters.</summary>
    [Fact]
    public void Validate_ShouldCapFamilyLength()
    {
        // Act
        var tooLong = Validate(new FhirSearchForm { Family = new string('a', 61) });
        var justRight = Validate(new FhirSearchForm { Family = new string('a', 60) });

        // Assert
        Assert.Equal(FhirSearchForm.FAMILY_LENGTH_MESSAGE, Assert.Single(tooLong).ErrorMessage);
        Assert.Empty(justRight);
    }

    /// <summary>A birth date must be an ISO date when given.</summary>
    [Theory]
    [InlineData("1979-04-12", true)]
    [InlineData("", true)]
    [InlineData("1979-4-1", false)]
    public void Validate_ShouldCheckBirthdateShape(string birthdate, bool valid)
    {
        // Act
        var results = Validate(new FhirSearchForm { Family = "Grant", Birthdate = birthdate });

        // Assert
        if (valid)
        {
            Assert.Empty(results);
        }
        else
        {
            Assert.Equal(FhirSearchForm.BIRTHDATE_FORMAT_MESSAGE, Assert.Single(results).ErrorMessage);
        }
    }

    #endregion

    #region ToRequest Tests

    /// <summary>The free-text fields are trimmed; the date passes through.</summary>
    [Fact]
    public void ToRequest_ShouldTrimTextFields()
    {
        // Arrange
        var form = new FhirSearchForm { Family = " Grant ", Birthdate = "1979-04-12", Identifier = " 12345 " };

        // Act
        var request = form.ToRequest();

        // Assert
        Assert.Equal(("Grant", "1979-04-12", "12345"), (request.Family, request.Birthdate, request.Identifier));
    }

    #endregion

    #region Helper Methods

    private static List<ValidationResult> Validate(FhirSearchForm form)
    {
        var results = new List<ValidationResult>();
        Validator.TryValidateObject(form, new ValidationContext(form), results, validateAllProperties: true);
        return results;
    }

    #endregion
}
