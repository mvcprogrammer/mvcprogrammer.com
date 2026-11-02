using Hl7.Etl.Generators;
using Hl7.Etl.Mappers;
using Hl7.Etl.Models;
using Hl7.Fhir.Model;

namespace Hl7.Etl.Tests.Mappers;

public sealed class BundleBuilderTests
{
    private static readonly Uri _system = new("https://mvcprogrammer.com/fhir/etl");
    private static readonly SyntheticPatient _patient = new SyntheticCohortGenerator(3).Patients(1)[0];

    [Fact]
    public void Every_entry_is_a_conditional_create_on_its_ETL_identifier()
    {
        var admission = Landed(Hl7MessageComposer.Admission(_patient, "MVC003-000001"), 1);

        var bundle = BundleBuilder.Build([(admission, MessageMapper.Map(admission, _system))], _system);

        Assert.Equal(Bundle.BundleType.Transaction, bundle.Type);
        Assert.Equal(2, bundle.Entry.Count);
        Assert.All(bundle.Entry, entry =>
        {
            Assert.StartsWith("urn:uuid:", entry.FullUrl, StringComparison.Ordinal);
            Assert.Equal(Bundle.HTTPVerb.POST, entry.Request!.Method);
            Assert.Equal(entry.Resource!.TypeName, entry.Request.Url);
        });
        Assert.Equal($"identifier={Uri.EscapeDataString($"{_system}|{_patient.Mrn}")}", bundle.Entry[0].Request!.IfNoneExist);
        Assert.Equal($"identifier={Uri.EscapeDataString($"{_system}|{_patient.VisitNumber}")}", bundle.Entry[1].Request!.IfNoneExist);
    }

    [Fact]
    public void A_reference_to_a_patient_or_encounter_in_the_same_bundle_becomes_its_urn()
    {
        var admission = Landed(Hl7MessageComposer.Admission(_patient, "MVC003-000001"), 1);
        var vitals = Landed(Hl7MessageComposer.VitalSigns(_patient, "MVC003-000002", new DateTimeOffset(2026, 10, 31, 9, 30, 0, TimeSpan.Zero), new VitalSignValues(72, 120, 80, 36.8, 16, 98)), 2);

        var bundle = BundleBuilder.Build([(admission, MessageMapper.Map(admission, _system)), (vitals, MessageMapper.Map(vitals, _system))], _system);

        var patientUrl = bundle.Entry[0].FullUrl;
        var encounterUrl = bundle.Entry[1].FullUrl;
        Assert.Equal(patientUrl, ((Encounter)bundle.Entry[1].Resource!).Subject!.Reference);
        var observations = bundle.Entry.Skip(2).Select(entry => (Observation)entry.Resource!).ToList();
        Assert.Equal(6, observations.Count);
        Assert.All(observations, observation =>
        {
            Assert.Equal(patientUrl, observation.Subject!.Reference);
            Assert.Equal(encounterUrl, observation.Encounter!.Reference);
        });
    }

    [Fact]
    public void A_reference_to_a_patient_not_in_the_bundle_stays_conditional()
    {
        var vitals = Landed(Hl7MessageComposer.VitalSigns(_patient, "MVC003-000002", new DateTimeOffset(2026, 10, 31, 9, 30, 0, TimeSpan.Zero), new VitalSignValues(72, 120, 80, 36.8, 16, 98)), 2);

        var bundle = BundleBuilder.Build([(vitals, MessageMapper.Map(vitals, _system))], _system);

        var observation = (Observation)bundle.Entry[0].Resource!;
        Assert.Equal($"Patient?identifier={Uri.EscapeDataString($"{_system}|{_patient.Mrn}")}", observation.Subject!.Reference);
        Assert.Equal($"Encounter?identifier={Uri.EscapeDataString($"{_system}|{_patient.VisitNumber}")}", observation.Encounter!.Reference);
    }

    [Fact]
    public void A_resource_without_an_ETL_identifier_is_refused()
    {
        var bare = Landed(Hl7MessageComposer.Admission(_patient, "MVC003-000001"), 1);

        Assert.Throws<InvalidOperationException>(() => BundleBuilder.Build([(bare, [new Patient()])], _system));
    }

    private static LandedMessage Landed(InboundMessage inbound, long id) =>
        new(id, inbound.MessageControlId, inbound.MessageType, inbound.TriggerEvent, inbound.SendingFacility, inbound.ReceivedAt, inbound.RawMessage, 1);
}
