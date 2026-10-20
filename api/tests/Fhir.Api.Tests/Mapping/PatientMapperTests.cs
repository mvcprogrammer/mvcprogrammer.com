using Fhir.Api.Mapping;
using Fhir.Api.Models;
using Fhir.Api.Tests.Fakes;
using Hl7.Fhir.Model;
using Identifier = Hl7.Fhir.Model.Identifier;

namespace Fhir.Api.Tests.Mapping;

public sealed class PatientMapperTests
{
    private static readonly DateOnly TODAY = new(2026, 10, 20);

    [Fact]
    public void Prefers_the_official_name_over_the_first()
    {
        var patient = Fixtures.Patient(family: "Nickname", given: "Charlie");
        patient.Name.Insert(0, new HumanName { Use = HumanName.NameUse.Nickname, Family = "Nick", Given = ["Chuck"] });
        patient.Name[1].Use = HumanName.NameUse.Official;

        var item = PatientMapper.ToListItem(patient);

        Assert.Equal("Nickname, Charlie", item.Name);
        Assert.Equal("Nickname", item.FamilyName);
    }

    [Theory]
    [InlineData("Dickens", "Charles", "Dickens, Charles", "CD")]
    [InlineData("Dickens", null, "Dickens", "D")]
    [InlineData("", "Charles", "Charles", "C")]
    [InlineData("", null, "Unknown", "?")]
    public void Builds_display_name_and_initials_from_whatever_is_present(string family, string? given, string display, string initials)
    {
        var patient = new Patient { Id = "x" };
        var name = new HumanName { Family = family.Length == 0 ? null : family };
        if (given is not null)
        {
            name.Given = [given];
        }

        patient.Name.Add(name);

        var demographics = PatientMapper.ToDemographics(patient, TODAY);

        Assert.Equal(display, demographics.Name);
        Assert.Equal(initials, demographics.Initials);
    }

    [Fact]
    public void Joins_several_given_names()
    {
        var patient = Fixtures.Patient(given: null);
        patient.Name[0].Given = ["Robert", "James"];

        Assert.Equal("Dickens, Robert James", PatientMapper.ToListItem(patient).Name);
    }

    [Theory]
    [InlineData("1979-04-12", "1979-04-12", 1979, 47)]
    [InlineData("1979-10-21", "1979-10-21", 1979, 46)]
    [InlineData("1979-10-20", "1979-10-20", 1979, 47)]
    [InlineData("1979-04", null, 1979, null)]
    [InlineData("1979", null, 1979, null)]
    [InlineData(null, null, null, null)]
    public void Passes_only_full_birth_dates_through_and_computes_age(string? fhirDate, string? birthDate, int? year, int? age)
    {
        var patient = Fixtures.Patient(birthDate: fhirDate);

        var item = PatientMapper.ToListItem(patient);
        var demographics = PatientMapper.ToDemographics(patient, TODAY);

        Assert.Equal(birthDate, item.BirthDate);
        Assert.Equal(year, item.BirthYear);
        Assert.Equal(age, demographics.Age);
    }

    [Theory]
    [InlineData(AdministrativeGender.Male, Sex.Male)]
    [InlineData(AdministrativeGender.Female, Sex.Female)]
    [InlineData(AdministrativeGender.Other, Sex.Other)]
    [InlineData(AdministrativeGender.Unknown, Sex.Unknown)]
    [InlineData(null, null)]
    public void Maps_gender(AdministrativeGender? gender, Sex? sex)
    {
        Assert.Equal(sex, PatientMapper.ToListItem(Fixtures.Patient(gender: gender)).Sex);
    }

    [Fact]
    public void Picks_the_mrn_by_type_before_falling_back_to_the_first_identifier()
    {
        var patient = Fixtures.Patient(mrn: null);
        patient.Identifier.Add(new Identifier { System = "urn:ssn", Value = "999-99-9999", Type = new CodeableConcept(Fixtures.V2_0203, "SS") });
        patient.Identifier.Add(new Identifier { System = "urn:mrn", Value = "MRN-7", Type = new CodeableConcept(Fixtures.V2_0203, "MR") });

        var demographics = PatientMapper.ToDemographics(patient, TODAY);

        Assert.Equal("MRN-7", demographics.Mrn);
        Assert.Equal(2, demographics.Identifiers.Count);
        Assert.Equal("SS", demographics.Identifiers[0].Type);

        patient.Identifier.RemoveAt(1);
        Assert.Equal("999-99-9999", PatientMapper.ToListItem(patient).Mrn);
    }

    [Fact]
    public void Has_no_mrn_without_identifiers()
    {
        var demographics = PatientMapper.ToDemographics(Fixtures.Patient(mrn: null), TODAY);

        Assert.Null(demographics.Mrn);
        Assert.Empty(demographics.Identifiers);
    }
}
