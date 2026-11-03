using System.Text.Json;
using Hl7.Etl.Exceptions;
using Hl7.Etl.Generators;
using Hl7.Etl.Mappers;
using Hl7.Etl.Models;
using Hl7.Fhir.Model;
using Hl7.Fhir.Serialization;

namespace Hl7.Etl.Tests.Mappers;

public sealed class MessageMapperTests
{
    private static readonly Uri _system = new("https://mvcprogrammer.com/fhir/etl");
    private static readonly SyntheticPatient _patient = new SyntheticCohortGenerator(3).Patients(1)[0];
    private static readonly DateTimeOffset _at = new(2026, 10, 31, 9, 30, 0, TimeSpan.Zero);

    [Fact]
    public void Admission_maps_to_a_patient_and_an_inpatient_encounter_with_etl_identifiers()
    {
        var landed = Landed(Hl7MessageComposer.Admission(_patient, "MVC003-000001"));

        var resources = MessageMapper.Map(landed, _system);

        var patient = Assert.IsType<Patient>(resources[0]);
        var identifier = Assert.Single(patient.Identifier);
        Assert.Equal(_system.ToString(), identifier.System);
        Assert.Equal(_patient.Mrn, identifier.Value);
        Assert.Equal("MR", identifier.Type!.Coding[0].Code);
        var name = Assert.Single(patient.Name);
        Assert.Equal(HumanName.NameUse.Official, name.Use);
        Assert.Equal(_patient.FamilyName, name.Family);
        Assert.Equal([_patient.GivenName], name.Given);
        Assert.Equal(_patient.Sex == "F" ? AdministrativeGender.Female : AdministrativeGender.Male, patient.Gender);
        Assert.Equal(_patient.BirthDate.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture), patient.BirthDate);

        var encounter = Assert.IsType<Encounter>(resources[1]);
        Assert.Equal(_patient.VisitNumber, Assert.Single(encounter.Identifier).Value);
        Assert.Equal("VN", encounter.Identifier[0].Type!.Coding[0].Code);
        Assert.Equal(Encounter.EncounterStatus.InProgress, encounter.Status);
        Assert.Equal("IMP", encounter.Class.Code);
        Assert.Equal($"Patient?identifier={Uri.EscapeDataString($"{_system}|{_patient.Mrn}")}", encounter.Subject!.Reference);
        Assert.Equal(_patient.AdmittedAt.ToUniversalTime(), encounter.Period!.StartElement!.ToDateTimeOffset(TimeSpan.Zero));
        Assert.Equal(_patient.Ward, Assert.Single(encounter.Location).Location.Display);
    }

    [Fact]
    public void Vital_signs_map_to_six_final_vital_sign_observations_with_LOINC_and_UCUM()
    {
        var landed = Landed(Hl7MessageComposer.VitalSigns(_patient, "MVC003-000002", _at, new VitalSignValues(72, 120, 80, 36.8, 16, 98)));

        var resources = MessageMapper.Map(landed, _system);

        Assert.Equal(6, resources.Count);
        var heartRate = Assert.IsType<Observation>(resources[0]);
        Assert.Equal("MVC003-000002-1", Assert.Single(heartRate.Identifier).Value);
        Assert.Equal(ObservationStatus.Final, heartRate.Status);
        Assert.Equal("vital-signs", Assert.Single(heartRate.Category).Coding[0].Code);
        Assert.Equal("8867-4", heartRate.Code.Coding[0].Code);
        Assert.Equal(ResultMapper.LOINC, heartRate.Code.Coding[0].System);
        Assert.Equal("Heart rate", heartRate.Code.Coding[0].Display);
        var quantity = Assert.IsType<Quantity>(heartRate.Value);
        Assert.Equal(72m, quantity.Value);
        Assert.Equal("/min", quantity.Code);
        Assert.Equal(ResultMapper.UCUM, quantity.System);
        Assert.Equal("beats per minute", quantity.Unit);
        Assert.Equal(_at, Assert.IsType<FhirDateTime>(heartRate.Effective).ToDateTimeOffset(TimeSpan.Zero));
        Assert.Equal($"Patient?identifier={Uri.EscapeDataString($"{_system}|{_patient.Mrn}")}", heartRate.Subject!.Reference);
        Assert.Equal($"Encounter?identifier={Uri.EscapeDataString($"{_system}|{_patient.VisitNumber}")}", heartRate.Encounter!.Reference);
        var temperature = Assert.IsType<Observation>(resources[3]);
        Assert.Equal(36.8m, Assert.IsType<Quantity>(temperature.Value).Value);
        Assert.Equal("Cel", Assert.IsType<Quantity>(temperature.Value).Code);
    }

    [Fact]
    public void Metabolic_panel_maps_to_laboratory_observations()
    {
        var landed = Landed(Hl7MessageComposer.MetabolicPanel(_patient, "MVC003-000003", _at, new MetabolicPanelValues(140, 4.1, 95, 0.95)));

        var resources = MessageMapper.Map(landed, _system);

        Assert.Equal(4, resources.Count);
        Assert.All(resources, resource => Assert.Equal("laboratory", Assert.IsType<Observation>(resource).Category[0].Coding[0].Code));
        Assert.Equal(["2951-2", "2823-3", "2345-7", "2160-0"], resources.Select(r => ((Observation)r).Code.Coding[0].Code));
        Assert.Equal(0.95m, Assert.IsType<Quantity>(((Observation)resources[3]).Value).Value);
    }

    [Fact]
    public void Mapped_resources_round_trip_through_the_Firely_JSON_serializer()
    {
        var options = new JsonSerializerOptions().ForFhir(ModelInfo.ModelInspector);
        var messages = new SyntheticCohortGenerator(9).Messages(3);

        foreach (var inbound in messages)
        {
            foreach (var resource in MessageMapper.Map(Landed(inbound), _system))
            {
                var json = JsonSerializer.Serialize(resource, resource.GetType(), options);
                var back = JsonSerializer.Deserialize<Resource>(json, options);
                Assert.NotNull(back);
                Assert.True(resource.IsExactly(back), $"{resource.TypeName} survives the round trip");
            }
        }
    }

    [Fact]
    public void A_message_type_the_ETL_does_not_map_is_reported_with_its_control_id()
    {
        var landed = Landed(Hl7MessageComposer.Admission(_patient, "MVC003-000009")) with { MessageType = "ORM", TriggerEvent = "O01" };

        var ex = Assert.Throws<Hl7MappingException>(() => MessageMapper.Map(landed, _system));

        Assert.Equal("MVC003-000009", ex.MessageControlId);
        Assert.Equal("MSH.9", ex.Location);
        Assert.Equal("ORM^O01 is not a message this ETL maps (ADT^A01, ORU^R01).", ex.Reason);
        Assert.Equal("MVC003-000009: MSH.9: ORM^O01 is not a message this ETL maps (ADT^A01, ORU^R01).", ex.Message);
    }

    [Fact]
    public void An_admission_without_PV1_is_reported_as_missing_the_segment()
    {
        var inbound = Hl7MessageComposer.Admission(_patient, "MVC003-000010");
        var withoutPv1 = string.Join('\r', inbound.RawMessage.Split('\r').Where(segment => !segment.StartsWith("PV1|", StringComparison.Ordinal)));

        var ex = Assert.Throws<Hl7MappingException>(() => MessageMapper.Map(Landed(inbound with { RawMessage = withoutPv1 }), _system));

        Assert.Equal("PV1", ex.Location);
        Assert.Equal("The message has no PV1 segment.", ex.Reason);
    }

    [Fact]
    public void A_malformed_birth_date_is_reported_at_PID_7()
    {
        var inbound = Hl7MessageComposer.Admission(_patient, "MVC003-000011");
        var broken = inbound.RawMessage.Replace(_patient.BirthDate.ToString("yyyyMMdd", System.Globalization.CultureInfo.InvariantCulture), "1979-04-12", StringComparison.Ordinal);

        var ex = Assert.Throws<Hl7MappingException>(() => MessageMapper.Map(Landed(inbound with { RawMessage = broken }), _system));

        Assert.Equal("PID.7", ex.Location);
        Assert.Equal("'1979-04-12' is not a date in yyyyMMdd form.", ex.Reason);
    }

    [Fact]
    public void An_observation_value_type_other_than_NM_is_reported_at_its_OBX()
    {
        var inbound = Hl7MessageComposer.VitalSigns(_patient, "MVC003-000012", _at, new VitalSignValues(72, 120, 80, 36.8, 16, 98));
        var broken = inbound.RawMessage.Replace("OBX|3|NM|", "OBX|3|ST|", StringComparison.Ordinal);

        var ex = Assert.Throws<Hl7MappingException>(() => MessageMapper.Map(Landed(inbound with { RawMessage = broken }), _system));

        Assert.Equal("OBX[3].2", ex.Location);
        Assert.Equal("'ST' is not a value type this feed maps (NM only).", ex.Reason);
    }

    [Fact]
    public void A_result_without_OBX_or_with_an_unknown_status_is_reported()
    {
        var inbound = Hl7MessageComposer.VitalSigns(_patient, "MVC003-000013", _at, new VitalSignValues(72, 120, 80, 36.8, 16, 98));
        var noObx = string.Join('\r', inbound.RawMessage.Split('\r').Where(segment => !segment.StartsWith("OBX|", StringComparison.Ordinal)));
        var badStatus = inbound.RawMessage.Replace("|F|||20261031093000", "|Z|||20261031093000", StringComparison.Ordinal);

        var missing = Assert.Throws<Hl7MappingException>(() => MessageMapper.Map(Landed(inbound with { RawMessage = noObx }), _system));
        var unknown = Assert.Throws<Hl7MappingException>(() => MessageMapper.Map(Landed(inbound with { RawMessage = badStatus }), _system));

        Assert.Equal("OBX", missing.Location);
        Assert.Equal("OBX[1].11", unknown.Location);
        Assert.Equal("'Z' is not a result status this feed maps (F, P, C, X).", unknown.Reason);
    }

    [Fact]
    public void Text_that_is_not_HL7_is_reported_at_MSH()
    {
        var ex = Assert.Throws<Hl7MappingException>(() => MessageMapper.Map(Landed(new InboundMessage("X-1", "ADT", "A01", "T", _at, "not a message")), _system));

        Assert.Equal("MSH", ex.Location);
    }

    [Theory]
    [InlineData("F", AdministrativeGender.Female)]
    [InlineData("m", AdministrativeGender.Male)]
    [InlineData("O", AdministrativeGender.Other)]
    [InlineData("U", AdministrativeGender.Unknown)]
    [InlineData("", AdministrativeGender.Unknown)]
    public void Administrative_sex_maps_to_gender(string sex, AdministrativeGender expected)
    {
        Assert.Equal(expected, AdmissionMapper.ToGender(sex));
    }

    private static LandedMessage Landed(InboundMessage inbound) =>
        new(1, inbound.MessageControlId, inbound.MessageType, inbound.TriggerEvent, inbound.SendingFacility, inbound.ReceivedAt, inbound.RawMessage, 1);
}
