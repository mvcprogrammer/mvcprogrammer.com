using Fhir.Api.Fhir;
using Fhir.Api.Mapping;
using Fhir.Api.Models;
using Fhir.Api.Tests.Fakes;
using Hl7.Fhir.Model;

namespace Fhir.Api.Tests.Mapping;

public sealed class PatientInputMapperTests
{
    private const string SESSION = "6f1d2c3b-9a8e-4b7c-9d6e-5f4a3b2c1d0e";
    private const string KEY = "0c9b8a7d-6e5f-4a3b-8c2d-1e0f9a8b7c6d";

    #region ToNewPatient Tests

    /// <summary>A create carries the five input fields plus the two demo identifiers and nothing else.</summary>
    [Fact]
    public void ToNewPatient_ShouldMapTheInputAndStampBothIdentifiers()
    {
        // Arrange
        var input = new PatientInput("Dickens", "Charles", Sex.Male, "1979-04-12", "MVC-0042");

        // Act
        var patient = PatientInputMapper.ToNewPatient(input, SESSION, KEY);

        // Assert
        Assert.Null(patient.Id);
        var name = Assert.Single(patient.Name);
        Assert.Equal("Dickens", name.Family);
        Assert.Equal(["Charles"], name.Given);
        Assert.Equal(AdministrativeGender.Male, patient.Gender);
        Assert.Equal("1979-04-12", patient.BirthDate);
        Assert.Collection(patient.Identifier,
            mrn => { Assert.Equal(DemoIdentifiers.MRN_SYSTEM, mrn.System); Assert.Equal("MVC-0042", mrn.Value); Assert.Equal("MR", mrn.Type?.Coding[0].Code); },
            session => { Assert.Equal(DemoIdentifiers.SESSION_SYSTEM, session.System); Assert.Equal(SESSION, session.Value); },
            key => { Assert.Equal(DemoIdentifiers.IDEMPOTENCY_SYSTEM, key.System); Assert.Equal(KEY, key.Value); });
    }

    /// <summary>Omitted optional fields leave the Patient without them.</summary>
    [Fact]
    public void ToNewPatient_ShouldLeaveOptionalFieldsEmpty()
    {
        // Arrange
        var input = new PatientInput("Dickens", null, null, null, null);

        // Act
        var patient = PatientInputMapper.ToNewPatient(input, SESSION, KEY);

        // Assert
        Assert.Empty(patient.Name[0].Given);
        Assert.Null(patient.Gender);
        Assert.Null(patient.BirthDate);
        Assert.Equal(2, patient.Identifier.Count);
    }

    #endregion

    #region ToReplacement Tests

    /// <summary>A replacement keeps the id and the demo identifiers and drops everything else the stored resource had.</summary>
    [Fact]
    public void ToReplacement_ShouldKeepTheIdAndDemoIdentifiersOnly()
    {
        // Arrange
        var stored = Fixtures.Patient("1842", mrn: "old-mrn");
        stored.Identifier.Add(new Hl7.Fhir.Model.Identifier(DemoIdentifiers.SESSION_SYSTEM, SESSION));
        stored.Identifier.Add(new Hl7.Fhir.Model.Identifier(DemoIdentifiers.IDEMPOTENCY_SYSTEM, KEY));
        var input = new PatientInput("Dickens", "Chuck", null, null, null);

        // Act
        var patient = PatientInputMapper.ToReplacement(stored, input);

        // Assert
        Assert.Equal("1842", patient.Id);
        Assert.Equal("Chuck", patient.Name[0].Given.Single());
        Assert.Null(patient.Gender);
        Assert.Null(patient.BirthDate);
        Assert.Equal([DemoIdentifiers.SESSION_SYSTEM, DemoIdentifiers.IDEMPOTENCY_SYSTEM], patient.Identifier.Select(i => i.System));
    }

    #endregion

    #region ToInput Tests

    /// <summary>The input view reads the official name, the sex, a full birth date, and the explorer's MRN.</summary>
    [Fact]
    public void ToInput_ShouldReadTheFiveFields()
    {
        // Arrange
        var stored = Fixtures.Patient("1842", mrn: null);
        stored.Identifier.Add(new Hl7.Fhir.Model.Identifier(DemoIdentifiers.MRN_SYSTEM, "MVC-0042"));

        // Act
        var input = PatientInputMapper.ToInput(stored);

        // Assert
        Assert.Equal(new PatientInput("Dickens", "Charles", Sex.Male, "1979-04-12", "MVC-0042"), input);
    }

    /// <summary>A sandbox patient's own MRN is read when the explorer never wrote one.</summary>
    [Fact]
    public void ToInput_ShouldFallBackToAnyMrn()
    {
        // Act
        var input = PatientInputMapper.ToInput(Fixtures.Patient("1842", mrn: "12345"));

        // Assert
        Assert.Equal("12345", input.Mrn);
    }

    #endregion

    #region SessionTokenOf Tests

    /// <summary>The session token comes from the demo-session identifier, and is null for any other patient.</summary>
    [Fact]
    public void SessionTokenOf_ShouldReadTheSessionIdentifierOrNull()
    {
        // Arrange
        var created = Fixtures.Patient("1");
        created.Identifier.Add(new Hl7.Fhir.Model.Identifier(DemoIdentifiers.SESSION_SYSTEM, SESSION));

        // Act & Assert
        Assert.Equal(SESSION, PatientInputMapper.SessionTokenOf(created));
        Assert.Null(PatientInputMapper.SessionTokenOf(Fixtures.Patient("2")));
    }

    #endregion
}
