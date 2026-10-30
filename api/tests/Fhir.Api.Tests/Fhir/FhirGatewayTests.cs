using Fhir.Api.Fhir;
using Hl7.Fhir.Model;

namespace Fhir.Api.Tests.Fhir;

public sealed class FhirGatewayTests
{
    #region IdFromLocation Tests

    /// <summary>The id is the segment after the resource type, with or without a version, absolute or relative; another type or nothing at all gives null.</summary>
    [Theory]
    [InlineData("https://hapi.fhir.org/baseR4/Condition/361079/_history/1", "361079")]
    [InlineData("https://hapi.fhir.org/baseR4/Condition/361079", "361079")]
    [InlineData("Condition/abc-1", "abc-1")]
    [InlineData("https://hapi.fhir.org/baseR4/Patient/1842/_history/1", null)]
    [InlineData("https://hapi.fhir.org/baseR4/Condition", null)]
    [InlineData("", null)]
    [InlineData(null, null)]
    public void IdFromLocation_ShouldReturnTheIdAfterTheResourceType(string? location, string? expected)
    {
        // Arrange & Act
        var id = FhirGateway.IdFromLocation<Condition>(location);

        // Assert
        Assert.Equal(expected, id);
    }

    #endregion
}
