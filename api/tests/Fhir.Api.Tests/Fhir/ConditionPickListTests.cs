using Fhir.Api.Fhir;

namespace Fhir.Api.Tests.Fhir;

public sealed class ConditionPickListTests
{
    #region All Tests

    /// <summary>The list is the ten openapi.yaml documents, each a distinct SNOMED CT concept id of six to eighteen digits with a display.</summary>
    [Fact]
    public void All_ShouldHoldTenDistinctSnomedConcepts()
    {
        // Arrange & Act
        var entries = ConditionPickList.All;

        // Assert
        Assert.Equal(10, entries.Count);
        Assert.Equal(10, entries.Select(e => e.Code).Distinct(StringComparer.Ordinal).Count());
        Assert.All(entries, e =>
        {
            Assert.Matches("^[0-9]{6,18}$", e.Code);
            Assert.False(string.IsNullOrWhiteSpace(e.Display), $"{e.Code} has no display");
        });
        Assert.Equal("59621000", entries[0].Code);
        Assert.Equal("49436004", entries[^1].Code);
    }

    #endregion

    #region Find Tests

    /// <summary>A listed code finds its entry; a well-formed code off the list, an empty one, and null do not.</summary>
    [Theory]
    [InlineData("59621000", "Essential hypertension")]
    [InlineData("49436004", "Atrial fibrillation")]
    [InlineData("123456", null)]
    [InlineData("", null)]
    [InlineData(null, null)]
    public void Find_ShouldReturnTheEntryOnlyForAListedCode(string? code, string? display)
    {
        // Arrange & Act
        var entry = ConditionPickList.Find(code);

        // Assert
        Assert.Equal(display, entry?.Display);
    }

    #endregion
}
