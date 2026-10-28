using Portfolio.Blazor.Serialization;

namespace Portfolio.Blazor.Tests.Serialization;

/// <summary>Tests for <see cref="JsonIndenter"/>.</summary>
public sealed class JsonIndenterTests
{
    #region Indent Tests

    /// <summary>Compact JSON comes back with two-space indentation, a newline before each member, and "\n" line endings, like JSON.stringify(value, null, 2).</summary>
    [Fact]
    public void Indent_ShouldTransformCompactJsonToTwoSpaceIndentation()
    {
        // Arrange
        const string compact = "{\"count\":1,\"total\":null,\"items\":[{\"id\":\"78785\",\"tags\":[]}],\"query\":{}}";

        // Act
        var indented = JsonIndenter.Indent(compact);

        // Assert
        Assert.Equal(
            "{\n" +
            "  \"count\": 1,\n" +
            "  \"total\": null,\n" +
            "  \"items\": [\n" +
            "    {\n" +
            "      \"id\": \"78785\",\n" +
            "      \"tags\": []\n" +
            "    }\n" +
            "  ],\n" +
            "  \"query\": {}\n" +
            "}",
            indented);
        Assert.DoesNotContain("\r", indented, StringComparison.Ordinal);
    }

    /// <summary>Already indented input is normalised rather than indented twice.</summary>
    [Fact]
    public void Indent_ShouldBeIdempotent()
    {
        // Arrange
        var once = JsonIndenter.Indent("{\"a\":[1,2],\"b\":{\"c\":true}}");

        // Act
        var twice = JsonIndenter.Indent(once);

        // Assert
        Assert.Equal(once, twice);
    }

    /// <summary>Text that is not JSON is returned unchanged so the panel still shows something useful.</summary>
    [Theory]
    [InlineData("")]
    [InlineData("not json")]
    [InlineData("{\"unterminated\":")]
    public void Indent_ShouldReturnInvalidInputUnchanged(string input)
    {
        // Act
        var result = JsonIndenter.Indent(input);

        // Assert
        Assert.Equal(input, result);
    }

    /// <summary>A null document is rejected up front.</summary>
    [Fact]
    public void Indent_ShouldThrowArgumentNullException()
    {
        // Act, Assert
        Assert.Throws<ArgumentNullException>(() => JsonIndenter.Indent(null!));
    }

    #endregion
}
