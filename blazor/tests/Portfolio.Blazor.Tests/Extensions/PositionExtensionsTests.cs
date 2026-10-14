using Portfolio.Blazor.Enumerations;
using Portfolio.Blazor.Extensions;
using Portfolio.Blazor.Tests.Helpers;

namespace Portfolio.Blazor.Tests.Extensions;

/// <summary>Tests for <see cref="PositionExtensions"/>.</summary>
public sealed class PositionExtensionsTests
{
    #region ToMonthLabel Tests

    /// <summary>Year-months become an abbreviated English month and year.</summary>
    [Theory]
    [InlineData("2023-12", "Dec 2023")]
    [InlineData("2010-01", "Jan 2010")]
    [InlineData("2026-05", "May 2026")]
    public void ToMonthLabel_ShouldTransformYearMonth(string input, string expected)
    {
        // Arrange and Act
        var label = input.ToMonthLabel();

        // Assert
        Assert.Equal(expected, label);
    }

    /// <summary>Anything that is not a year-month is returned unchanged rather than throwing.</summary>
    [Theory]
    [InlineData("")]
    [InlineData("2023")]
    [InlineData("2023-13")]
    [InlineData("Present")]
    public void ToMonthLabel_ShouldReturnInputWhenUnparseable(string input)
    {
        // Arrange and Act
        var label = input.ToMonthLabel();

        // Assert
        Assert.Equal(input, label);
    }

    /// <summary>Null is rejected.</summary>
    [Fact]
    public void ToMonthLabel_ShouldThrowOnNull()
    {
        // Act and Assert
        Assert.Throws<ArgumentNullException>(() => ((string)null!).ToMonthLabel());
    }

    #endregion

    #region ToPlaceLabel Tests

    /// <summary>Remote and hybrid roles are labelled by mode; on-site roles by location.</summary>
    [Theory]
    [InlineData(WorkMode.Remote, "Utah", "Remote")]
    [InlineData(WorkMode.Hybrid, "Florida", "Hybrid")]
    [InlineData(WorkMode.OnSite, "Florida", "Florida")]
    [InlineData(WorkMode.OnSite, "", "On-site")]
    [InlineData(WorkMode.OnSite, "   ", "On-site")]
    public void ToPlaceLabel_ShouldFollowWorkMode(WorkMode mode, string location, string expected)
    {
        // Arrange
        var position = TestData.CreatePosition(workMode: mode, location: location);

        // Act
        var label = position.ToPlaceLabel();

        // Assert
        Assert.Equal(expected, label);
    }

    /// <summary>Null is rejected.</summary>
    [Fact]
    public void ToPlaceLabel_ShouldThrowOnNull()
    {
        // Act and Assert
        Assert.Throws<ArgumentNullException>(() => ((Models.Position)null!).ToPlaceLabel());
    }

    #endregion
}
