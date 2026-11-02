namespace Hl7.Etl.Generators;

/// <summary>The vital signs one ORU^R01 carries, with their LOINC codes applied by the composer.</summary>
public sealed record VitalSignValues(int HeartRate, int Systolic, int Diastolic, double TemperatureCelsius, int RespiratoryRate, int OxygenSaturation);
