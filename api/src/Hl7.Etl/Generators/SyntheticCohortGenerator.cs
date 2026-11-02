using Hl7.Etl.Models;

namespace Hl7.Etl.Generators;

/// <summary>
/// A deterministic synthetic cohort: the same seed always gives the same patients, visits, and
/// results, so a demo can be rerun and a test can assert exact messages. Names and values are
/// invented; nothing comes from a real record. Each patient gets one ADT^A01 admission and one or
/// two ORU^R01 result messages (vital signs, then a basic metabolic panel for some).
/// </summary>
public sealed class SyntheticCohortGenerator
{
    /// <summary>MSH-4 on every generated message.</summary>
    public const string SENDING_FACILITY = "MVCDEMO";

    /// <summary>The admissions all fall in the days before this instant, so the cohort reads as recent.</summary>
    public static readonly DateTimeOffset BASE_TIME = new(2026, 11, 1, 8, 0, 0, TimeSpan.Zero);

    private static readonly string[] _familyNames = ["Okafor", "Lindqvist", "Delgado", "Nakamura", "Brennan", "Haddad", "Castellano", "Mbeki", "Sørensen", "Petrov", "Achterberg", "Quinlan"];
    private static readonly string[] _givenNamesF = ["Amara", "Ingrid", "Lucia", "Hana", "Niamh", "Layla", "Giulia", "Thandiwe", "Freja", "Irina", "Saskia", "Maeve"];
    private static readonly string[] _givenNamesM = ["Chidi", "Erik", "Mateo", "Kenji", "Cormac", "Omar", "Enzo", "Sipho", "Anders", "Dmitri", "Bram", "Declan"];
    private static readonly string[] _wards = ["MED", "SURG", "CARD", "ORTHO", "ICU"];

    private readonly Random _random;
    private readonly int _seed;

    /// <summary>Creates a generator for one seed.</summary>
    public SyntheticCohortGenerator(int seed)
    {
        _seed = seed;
        _random = new Random(seed);
    }

    /// <summary>The patients of the cohort, in generation order.</summary>
    public IReadOnlyList<SyntheticPatient> Patients(int count)
    {
        ArgumentOutOfRangeException.ThrowIfLessThan(count, 1);

        var patients = new List<SyntheticPatient>(count);
        for (var i = 1; i <= count; i++)
        {
            var female = _random.Next(2) == 0;
            var family = _familyNames[_random.Next(_familyNames.Length)];
            var given = (female ? _givenNamesF : _givenNamesM)[_random.Next(_givenNamesF.Length)];
            var birth = new DateOnly(1940 + _random.Next(70), 1 + _random.Next(12), 1 + _random.Next(28));
            var admitted = BASE_TIME.AddDays(-_random.Next(1, 30)).AddMinutes(_random.Next(0, 24 * 60));
            patients.Add(new SyntheticPatient(
                $"ETL-{_seed:D3}-{i:D4}",
                family,
                given,
                female ? "F" : "M",
                birth,
                $"V{_seed:D3}{i:D4}",
                admitted,
                _wards[_random.Next(_wards.Length)]));
        }

        return patients;
    }

    /// <summary>The messages of a cohort, in the order a feed would send them: each patient's admission, then its results.</summary>
    public IReadOnlyList<InboundMessage> Messages(int patientCount)
    {
        var messages = new List<InboundMessage>();
        foreach (var patient in Patients(patientCount))
        {
            var sequence = messages.Count + 1;
            messages.Add(Hl7MessageComposer.Admission(patient, ControlId(sequence)));
            var vitalsAt = patient.AdmittedAt.AddMinutes(20 + _random.Next(0, 40));
            messages.Add(Hl7MessageComposer.VitalSigns(patient, ControlId(sequence + 1), vitalsAt, Vitals()));
            if (_random.Next(2) == 0)
            {
                var panelAt = vitalsAt.AddHours(1 + _random.Next(0, 6));
                messages.Add(Hl7MessageComposer.MetabolicPanel(patient, ControlId(sequence + 2), panelAt, Panel()));
            }
        }

        return messages;
    }

    private string ControlId(int sequence) => $"MVC{_seed:D3}-{sequence:D6}";

    private VitalSignValues Vitals() => new(
        HeartRate: 55 + _random.Next(0, 50),
        Systolic: 100 + _random.Next(0, 60),
        Diastolic: 60 + _random.Next(0, 35),
        TemperatureCelsius: Math.Round(36.2 + _random.NextDouble() * 2.0, 1),
        RespiratoryRate: 12 + _random.Next(0, 10),
        OxygenSaturation: 92 + _random.Next(0, 8));

    private MetabolicPanelValues Panel() => new(
        Sodium: 134 + _random.Next(0, 10),
        Potassium: Math.Round(3.4 + _random.NextDouble() * 1.6, 1),
        Glucose: 70 + _random.Next(0, 110),
        Creatinine: Math.Round(0.6 + _random.NextDouble() * 1.2, 2));
}
