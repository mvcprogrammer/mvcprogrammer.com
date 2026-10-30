using Fhir.Api.Fhir;
using Fhir.Api.Mapping;
using Fhir.Api.Models;

namespace Fhir.Api.Tests.Mapping;

public sealed class PatientPatchApplierTests
{
    private static readonly PatientInput _input = new("Dickens", "Charles", Sex.Male, "1979-04-12", "MVC-0042");

    private static PatientPatchOperation Op(string op, string path, string? value = null, string? from = null) => new(op, path, from, value);

    #region Apply Tests

    /// <summary>The six operations do what RFC 6902 says on the five scalar fields.</summary>
    [Fact]
    public void Apply_ShouldApplyEveryOperationInOrder()
    {
        // Arrange
        var operations = new[]
        {
            Op("test", "/givenName", "Charles"),
            Op("replace", "/givenName", "Chuck"),
            Op("remove", "/mrn"),
            Op("add", "/mrn", "MVC-0043"),
            Op("copy", "/familyName", from: "/givenName"),
            Op("move", "/givenName", from: "/mrn"),
            Op("replace", "/sex", "Female"),
        };

        // Act
        var result = PatientPatchApplier.Apply(_input, operations);

        // Assert
        Assert.Equal(new PatientInput("Chuck", "MVC-0043", Sex.Female, "1979-04-12", null), result);
    }

    /// <summary>The input is never changed; a patch returns a new record.</summary>
    [Fact]
    public void Apply_ShouldLeaveTheInputUntouched()
    {
        // Act
        PatientPatchApplier.Apply(_input, [Op("remove", "/givenName")]);

        // Assert
        Assert.Equal("Charles", _input.GivenName);
    }

    /// <summary>An operation that cannot be applied names its index and leaves nothing half-applied.</summary>
    [Theory]
    [InlineData("test", "/givenName", "Nobody", null, 0)]
    [InlineData("replace", "/address", "x", null, 0)]
    [InlineData("frobnicate", "/mrn", null, null, 0)]
    [InlineData("add", "/mrn", null, null, 0)]
    [InlineData("move", "/mrn", null, null, 0)]
    [InlineData("copy", "/mrn", null, "/address", 0)]
    [InlineData("replace", "/sex", "robot", null, 0)]
    public void Apply_ShouldThrowPatchConflictExceptionWithTheOperationIndex(string op, string path, string? value, string? from, int index)
    {
        // Arrange
        var operations = new[] { Op(op, path, value, from) };

        // Act
        var ex = Assert.Throws<PatchConflictException>(() => PatientPatchApplier.Apply(_input, operations));

        // Assert
        Assert.Equal(index, ex.OperationIndex);
        Assert.Contains("not changed", ex.Message);
    }

    /// <summary>The failing operation's index is reported even when earlier ones succeeded.</summary>
    [Fact]
    public void Apply_ShouldReportTheIndexOfALaterFailure()
    {
        // Arrange
        var operations = new[] { Op("replace", "/givenName", "Chuck"), Op("test", "/givenName", "Charles") };

        // Act
        var ex = Assert.Throws<PatchConflictException>(() => PatientPatchApplier.Apply(_input, operations));

        // Assert
        Assert.Equal(1, ex.OperationIndex);
    }

    #endregion
}
