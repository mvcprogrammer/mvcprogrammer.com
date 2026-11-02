using System.Globalization;
using Efferent.HL7.V2;
using Hl7.Etl.Models;

namespace Hl7.Etl.Generators;

/// <summary>
/// Composes HL7 v2.5.1 messages from a synthetic patient with the HL7-V2 library: an ADT^A01
/// admission (MSH, EVN, PID, PV1) and ORU^R01 results (MSH, PID, OBR, one OBX per value). Every
/// observation is LOINC-coded and UCUM-unit, so the mapper can carry both into FHIR unchanged.
/// </summary>
public static class Hl7MessageComposer
{
    /// <summary>MSH-3 on every message.</summary>
    public const string SENDING_APPLICATION = "MVCEHR";

    /// <summary>MSH-5 and MSH-6: the integration engine this feed is addressed to.</summary>
    public const string RECEIVING_APPLICATION = "MVCETL";

    /// <summary>MSH-12.</summary>
    public const string VERSION = "2.5.1";

    /// <summary>PID-3.4, the assigning authority of the MRN.</summary>
    public const string ASSIGNING_AUTHORITY = "MVC";

    private const string DTM_FORMAT = "yyyyMMddHHmmss";

    /// <summary>The admission: ADT^A01 with EVN, PID, and PV1.</summary>
    public static InboundMessage Admission(SyntheticPatient patient, string controlId)
    {
        ArgumentNullException.ThrowIfNull(patient);
        ArgumentException.ThrowIfNullOrWhiteSpace(controlId);

        var message = Header("ADT", "A01", "ADT_A01", controlId, patient.AdmittedAt);
        var evn = new Segment("EVN", message.Encoding);
        evn.AddNewField("A01", 1);
        evn.AddNewField(Dtm(patient.AdmittedAt), 2);
        message.AddNewSegment(evn);
        message.AddNewSegment(Pid(message, patient));
        var pv1 = new Segment("PV1", message.Encoding);
        pv1.AddNewField("1", 1);
        pv1.AddNewField("I", 2);
        pv1.AddNewField($"{patient.Ward}^{101 + patient.Mrn.GetHashCode(StringComparison.Ordinal) % 50 switch { < 0 => 0, var n => n }}^A", 3);
        pv1.AddNewField($"{patient.Ward}", 10);
        pv1.AddNewField(patient.VisitNumber, 19);
        pv1.AddNewField(Dtm(patient.AdmittedAt), 44);
        message.AddNewSegment(pv1);
        return Inbound(message, "ADT", "A01", controlId, patient.AdmittedAt);
    }

    /// <summary>Vital signs: ORU^R01 with one OBX per sign, all LOINC and UCUM.</summary>
    public static InboundMessage VitalSigns(SyntheticPatient patient, string controlId, DateTimeOffset observedAt, VitalSignValues values)
    {
        ArgumentNullException.ThrowIfNull(patient);
        ArgumentException.ThrowIfNullOrWhiteSpace(controlId);
        ArgumentNullException.ThrowIfNull(values);

        var message = Header("ORU", "R01", "ORU_R01", controlId, observedAt);
        message.AddNewSegment(Pid(message, patient));
        message.AddNewSegment(Obr(message, patient, controlId, "85353-1", "Vital signs, weight, height, head circumference, oxygen saturation and BMI panel", observedAt));
        var set = 1;
        message.AddNewSegment(Obx(message, set++, "8867-4", "Heart rate", values.HeartRate.ToString(CultureInfo.InvariantCulture), "/min", "beats per minute", observedAt));
        message.AddNewSegment(Obx(message, set++, "8480-6", "Systolic blood pressure", values.Systolic.ToString(CultureInfo.InvariantCulture), "mm[Hg]", "millimeter of mercury", observedAt));
        message.AddNewSegment(Obx(message, set++, "8462-4", "Diastolic blood pressure", values.Diastolic.ToString(CultureInfo.InvariantCulture), "mm[Hg]", "millimeter of mercury", observedAt));
        message.AddNewSegment(Obx(message, set++, "8310-5", "Body temperature", values.TemperatureCelsius.ToString("0.0", CultureInfo.InvariantCulture), "Cel", "degree Celsius", observedAt));
        message.AddNewSegment(Obx(message, set++, "9279-1", "Respiratory rate", values.RespiratoryRate.ToString(CultureInfo.InvariantCulture), "/min", "breaths per minute", observedAt));
        message.AddNewSegment(Obx(message, set, "2708-6", "Oxygen saturation in Arterial blood", values.OxygenSaturation.ToString(CultureInfo.InvariantCulture), "%", "percent", observedAt));
        return Inbound(message, "ORU", "R01", controlId, observedAt);
    }

    /// <summary>A basic metabolic panel: ORU^R01 with four OBX results.</summary>
    public static InboundMessage MetabolicPanel(SyntheticPatient patient, string controlId, DateTimeOffset observedAt, MetabolicPanelValues values)
    {
        ArgumentNullException.ThrowIfNull(patient);
        ArgumentException.ThrowIfNullOrWhiteSpace(controlId);
        ArgumentNullException.ThrowIfNull(values);

        var message = Header("ORU", "R01", "ORU_R01", controlId, observedAt);
        message.AddNewSegment(Pid(message, patient));
        message.AddNewSegment(Obr(message, patient, controlId, "51990-0", "Basic metabolic panel - Blood", observedAt));
        message.AddNewSegment(Obx(message, 1, "2951-2", "Sodium [Moles/volume] in Serum or Plasma", values.Sodium.ToString(CultureInfo.InvariantCulture), "mmol/L", "millimole per liter", observedAt));
        message.AddNewSegment(Obx(message, 2, "2823-3", "Potassium [Moles/volume] in Serum or Plasma", values.Potassium.ToString("0.0", CultureInfo.InvariantCulture), "mmol/L", "millimole per liter", observedAt));
        message.AddNewSegment(Obx(message, 3, "2345-7", "Glucose [Mass/volume] in Serum or Plasma", values.Glucose.ToString(CultureInfo.InvariantCulture), "mg/dL", "milligram per deciliter", observedAt));
        message.AddNewSegment(Obx(message, 4, "2160-0", "Creatinine [Mass/volume] in Serum or Plasma", values.Creatinine.ToString("0.00", CultureInfo.InvariantCulture), "mg/dL", "milligram per deciliter", observedAt));
        return Inbound(message, "ORU", "R01", controlId, observedAt);
    }

    /// <summary>HL7 DTM (yyyyMMddHHmmss) in UTC.</summary>
    public static string Dtm(DateTimeOffset at) => at.UtcDateTime.ToString(DTM_FORMAT, CultureInfo.InvariantCulture);

    private static Message Header(string type, string trigger, string structure, string controlId, DateTimeOffset at)
    {
        var message = new Message();
        message.AddSegmentMSH(SENDING_APPLICATION, SyntheticCohortGenerator.SENDING_FACILITY, RECEIVING_APPLICATION, RECEIVING_APPLICATION, string.Empty, $"{type}^{trigger}^{structure}", controlId, "P", VERSION);
        // MSH-7, the message time, is not a parameter of AddSegmentMSH; set it on the composed segment.
        message.DefaultSegment("MSH").Fields(7).Value = Dtm(at);
        return message;
    }

    private static Segment Pid(Message message, SyntheticPatient patient)
    {
        var pid = new Segment("PID", message.Encoding);
        pid.AddNewField("1", 1);
        pid.AddNewField($"{patient.Mrn}^^^{ASSIGNING_AUTHORITY}^MR", 3);
        pid.AddNewField($"{patient.FamilyName}^{patient.GivenName}", 5);
        pid.AddNewField(patient.BirthDate.ToString("yyyyMMdd", CultureInfo.InvariantCulture), 7);
        pid.AddNewField(patient.Sex, 8);
        return pid;
    }

    private static Segment Obr(Message message, SyntheticPatient patient, string controlId, string loinc, string display, DateTimeOffset observedAt)
    {
        var obr = new Segment("OBR", message.Encoding);
        obr.AddNewField("1", 1);
        obr.AddNewField($"{controlId}-P^{SENDING_APPLICATION}", 2);
        obr.AddNewField($"{controlId}-F^{RECEIVING_APPLICATION}", 3);
        obr.AddNewField($"{loinc}^{display}^LN", 4);
        obr.AddNewField(Dtm(observedAt), 7);
        obr.AddNewField(patient.VisitNumber, 18);
        obr.AddNewField("F", 25);
        return obr;
    }

    private static Segment Obx(Message message, int setId, string loinc, string display, string value, string ucum, string unitDisplay, DateTimeOffset observedAt)
    {
        var obx = new Segment("OBX", message.Encoding);
        obx.AddNewField(setId.ToString(CultureInfo.InvariantCulture), 1);
        obx.AddNewField("NM", 2);
        obx.AddNewField($"{loinc}^{display}^LN", 3);
        obx.AddNewField(value, 5);
        obx.AddNewField($"{ucum}^{unitDisplay}^UCUM", 6);
        obx.AddNewField("F", 11);
        obx.AddNewField(Dtm(observedAt), 14);
        return obx;
    }

    private static InboundMessage Inbound(Message message, string type, string trigger, string controlId, DateTimeOffset at) =>
        new(controlId, type, trigger, SyntheticCohortGenerator.SENDING_FACILITY, at, message.SerializeMessage());
}
