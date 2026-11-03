using Efferent.HL7.V2;
using Hl7.Etl.Generators;

namespace Hl7.Etl.Tests.Generators;

public sealed class SyntheticCohortGeneratorTests
{
    [Fact]
    public void Same_seed_gives_the_same_messages()
    {
        var first = new SyntheticCohortGenerator(7).Messages(5);
        var second = new SyntheticCohortGenerator(7).Messages(5);

        Assert.Equal(first, second);
        Assert.NotEqual(first, new SyntheticCohortGenerator(8).Messages(5));
    }

    [Fact]
    public void Each_patient_gets_an_admission_then_one_or_two_results_with_unique_control_ids()
    {
        var messages = new SyntheticCohortGenerator(1).Messages(25);

        Assert.Equal(25, messages.Count(m => m.MessageType == "ADT" && m.TriggerEvent == "A01"));
        Assert.InRange(messages.Count(m => m.MessageType == "ORU" && m.TriggerEvent == "R01"), 25, 50);
        Assert.Equal(messages.Count, messages.Select(m => m.MessageControlId).Distinct(StringComparer.Ordinal).Count());
        Assert.All(messages, m => Assert.Equal(SyntheticCohortGenerator.SENDING_FACILITY, m.SendingFacility));
        Assert.Equal("ADT", messages[0].MessageType);
        Assert.Equal("ORU", messages[1].MessageType);
    }

    [Fact]
    public void Admission_parses_back_with_the_patient_in_PID_and_the_visit_in_PV1()
    {
        var patient = new SyntheticCohortGenerator(3).Patients(1)[0];
        var inbound = Hl7MessageComposer.Admission(patient, "MVC003-000001");

        var message = new Message(inbound.RawMessage);
        Assert.True(message.ParseMessage(), "the composed message parses");
        Assert.Equal("ADT^A01^ADT_A01", message.GetValue("MSH.9"));
        Assert.Equal("MVC003-000001", message.GetValue("MSH.10"));
        Assert.Equal("2.5.1", message.GetValue("MSH.12"));
        Assert.Equal(Hl7MessageComposer.Dtm(patient.AdmittedAt), message.GetValue("MSH.7"));
        Assert.Equal("A01", message.GetValue("EVN.1"));
        Assert.Equal(patient.Mrn, message.GetValue("PID.3.1"));
        Assert.Equal("MR", message.GetValue("PID.3.5"));
        Assert.Equal(patient.FamilyName, message.GetValue("PID.5.1"));
        Assert.Equal(patient.GivenName, message.GetValue("PID.5.2"));
        Assert.Equal(patient.BirthDate.ToString("yyyyMMdd", System.Globalization.CultureInfo.InvariantCulture), message.GetValue("PID.7"));
        Assert.Equal(patient.Sex, message.GetValue("PID.8"));
        Assert.Equal("I", message.GetValue("PV1.2"));
        Assert.Equal(patient.Ward, message.GetValue("PV1.3.1"));
        Assert.Equal(patient.VisitNumber, message.GetValue("PV1.19"));
        Assert.Equal(Hl7MessageComposer.Dtm(patient.AdmittedAt), message.GetValue("PV1.44"));
    }

    [Fact]
    public void Vital_signs_carry_six_LOINC_coded_OBX_segments_with_UCUM_units()
    {
        var patient = new SyntheticCohortGenerator(3).Patients(1)[0];
        var at = new DateTimeOffset(2026, 10, 31, 9, 30, 0, TimeSpan.Zero);
        var inbound = Hl7MessageComposer.VitalSigns(patient, "MVC003-000002", at, new VitalSignValues(72, 120, 80, 36.8, 16, 98));

        var message = new Message(inbound.RawMessage);
        Assert.True(message.ParseMessage());
        Assert.Equal("ORU^R01^ORU_R01", message.GetValue("MSH.9"));
        Assert.Equal(patient.Mrn, message.GetValue("PID.3.1"));
        Assert.Equal("85353-1", message.GetValue("OBR.4.1"));
        Assert.Equal(patient.VisitNumber, message.GetValue("OBR.18"));
        var obx = message.Segments("OBX");
        Assert.Equal(6, obx.Count);
        Assert.Equal("8867-4", obx[0].Fields(3).Components(1).Value);
        Assert.Equal("Heart rate", obx[0].Fields(3).Components(2).Value);
        Assert.Equal("LN", obx[0].Fields(3).Components(3).Value);
        Assert.Equal("72", obx[0].Fields(5).Value);
        Assert.Equal("/min", obx[0].Fields(6).Components(1).Value);
        Assert.Equal("UCUM", obx[0].Fields(6).Components(3).Value);
        Assert.Equal("36.8", obx[3].Fields(5).Value);
        Assert.Equal("Cel", obx[3].Fields(6).Components(1).Value);
        Assert.Equal("20261031093000", obx[5].Fields(14).Value);
        Assert.All(obx, segment => Assert.Equal("F", segment.Fields(11).Value));
    }

    [Fact]
    public void Metabolic_panel_carries_four_results_with_decimal_precision_kept()
    {
        var patient = new SyntheticCohortGenerator(3).Patients(1)[0];
        var at = new DateTimeOffset(2026, 10, 31, 11, 0, 0, TimeSpan.Zero);
        var inbound = Hl7MessageComposer.MetabolicPanel(patient, "MVC003-000003", at, new MetabolicPanelValues(140, 4.1, 95, 0.95));

        var message = new Message(inbound.RawMessage);
        Assert.True(message.ParseMessage());
        Assert.Equal("51990-0", message.GetValue("OBR.4.1"));
        var obx = message.Segments("OBX");
        Assert.Equal(4, obx.Count);
        Assert.Equal(["2951-2", "2823-3", "2345-7", "2160-0"], obx.Select(segment => segment.Fields(3).Components(1).Value));
        Assert.Equal(["140", "4.1", "95", "0.95"], obx.Select(segment => segment.Fields(5).Value));
    }

    [Fact]
    public void Patients_are_plausible_and_distinct_by_mrn()
    {
        var patients = new SyntheticCohortGenerator(5).Patients(40);

        Assert.Equal(40, patients.Select(p => p.Mrn).Distinct(StringComparer.Ordinal).Count());
        Assert.All(patients, p =>
        {
            Assert.Matches("^ETL-005-\\d{4}$", p.Mrn);
            Assert.Contains(p.Sex, new[] { "F", "M" });
            Assert.InRange(p.BirthDate.Year, 1940, 2009);
            Assert.InRange(p.AdmittedAt, SyntheticCohortGenerator.BaseTime.AddDays(-30), SyntheticCohortGenerator.BaseTime);
        });
    }

    [Fact]
    public void Rejects_a_cohort_of_no_patients()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => new SyntheticCohortGenerator(1).Patients(0));
    }
}
