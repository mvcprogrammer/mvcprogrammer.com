namespace Hl7.Etl.Generators;

/// <summary>Four results of a basic metabolic panel, with their LOINC codes applied by the composer.</summary>
public sealed record MetabolicPanelValues(int Sodium, double Potassium, int Glucose, double Creatinine);
