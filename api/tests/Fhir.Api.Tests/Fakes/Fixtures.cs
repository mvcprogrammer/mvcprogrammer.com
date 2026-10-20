using Hl7.Fhir.Model;

namespace Fhir.Api.Tests.Fakes;

/// <summary>Valid R4 resources with the fields the mappers read. Required elements are filled so a strict parser accepts them.</summary>
public static class Fixtures
{
    public const string SNOMED = "http://snomed.info/sct";
    public const string ICD10_CM = "http://hl7.org/fhir/sid/icd-10-cm";
    public const string LOINC = "http://loinc.org";
    public const string CLINICAL_STATUS = "http://terminology.hl7.org/CodeSystem/condition-clinical";
    public const string V2_0203 = "http://terminology.hl7.org/CodeSystem/v2-0203";

    public static Patient Patient(string id = "1842", string family = "Dickens", string? given = "Charles", string? birthDate = "1979-04-12", AdministrativeGender? gender = AdministrativeGender.Male, string? mrn = "12345")
    {
        var patient = new Patient { Id = id, Gender = gender, BirthDate = birthDate };
        var name = new HumanName { Use = HumanName.NameUse.Official, Family = family };
        if (given is not null)
        {
            name.Given = [given];
        }

        patient.Name.Add(name);
        if (mrn is not null)
        {
            patient.Identifier.Add(new Identifier
            {
                System = "urn:oid:1.2.36.146.595.217.0.1",
                Value = mrn,
                Type = new CodeableConcept(V2_0203, "MR"),
            });
        }

        return patient;
    }

    public static Condition Condition(string id, string status, string display, string code = "59621000", string system = SNOMED, string? onset = "2019-02-11") =>
        new()
        {
            Id = id,
            ClinicalStatus = new CodeableConcept(CLINICAL_STATUS, status),
            Code = new CodeableConcept(system, code, display),
            Subject = new ResourceReference("Patient/1842"),
            Onset = onset is null ? null : new FhirDateTime(onset),
        };

    public static Observation Vital(string id, string loinc, string date, decimal value, string unit) =>
        new()
        {
            Id = id,
            Status = ObservationStatus.Final,
            Category = [new CodeableConcept("http://terminology.hl7.org/CodeSystem/observation-category", "vital-signs")],
            Code = new CodeableConcept(LOINC, loinc),
            Subject = new ResourceReference("Patient/1842"),
            Effective = new FhirDateTime(date),
            Value = new Quantity(value, unit),
        };

    public static Observation BloodPressure(string id, string date, decimal systolic, decimal diastolic) =>
        new()
        {
            Id = id,
            Status = ObservationStatus.Final,
            Category = [new CodeableConcept("http://terminology.hl7.org/CodeSystem/observation-category", "vital-signs")],
            Code = new CodeableConcept(LOINC, "85354-9", "Blood pressure panel"),
            Subject = new ResourceReference("Patient/1842"),
            Effective = new FhirDateTime(date),
            Component =
            [
                new Observation.ComponentComponent { Code = new CodeableConcept(LOINC, "8480-6"), Value = new Quantity(systolic, "mm[Hg]") },
                new Observation.ComponentComponent { Code = new CodeableConcept(LOINC, "8462-4"), Value = new Quantity(diastolic, "mm[Hg]") },
            ],
        };

    /// <summary>A searchset page. <paramref name="next"/> becomes link[rel=next].</summary>
    public static Bundle Searchset(IEnumerable<Resource> resources, int? total = null, string? next = null)
    {
        var bundle = new Bundle { Type = Bundle.BundleType.Searchset, Total = total };
        foreach (var resource in resources)
        {
            bundle.Entry.Add(new Bundle.EntryComponent
            {
                FullUrl = $"https://fhir.test/r4/{resource.TypeName}/{resource.Id}",
                Resource = resource,
            });
        }

        if (next is not null)
        {
            bundle.NextLink = new Uri(next);
        }

        return bundle;
    }

    public static Bundle CountOnly(int total) => new() { Type = Bundle.BundleType.Searchset, Total = total };

    /// <summary>A CapabilityStatement declaring the given resource types with the usual search parameters.</summary>
    public static CapabilityStatement Capability(params string[] resourceTypes)
    {
        var rest = new CapabilityStatement.RestComponent { Mode = CapabilityStatement.RestfulCapabilityMode.Server };
        foreach (var type in resourceTypes)
        {
            var resource = new CapabilityStatement.ResourceComponent
            {
                Type = type,
                Interaction =
                [
                    new CapabilityStatement.ResourceInteractionComponent { Code = CapabilityStatement.TypeRestfulInteraction.Read },
                    new CapabilityStatement.ResourceInteractionComponent { Code = CapabilityStatement.TypeRestfulInteraction.SearchType },
                ],
            };
            var parameters = type switch
            {
                "Patient" => new[] { "family", "birthdate", "identifier", "name" },
                "Observation" => ["patient", "category", "date", "code"],
                _ => ["patient"],
            };
            foreach (var name in parameters)
            {
                resource.SearchParam.Add(new CapabilityStatement.SearchParamComponent { Name = name, Type = SearchParamType.String });
            }

            rest.Resource.Add(resource);
        }

        return new CapabilityStatement
        {
            Status = PublicationStatus.Active,
            Date = "2026-10-20",
            Kind = CapabilityStatementKind.Instance,
            FhirVersion = FHIRVersion.N4_0_1,
            Format = ["application/fhir+json"],
            Software = new CapabilityStatement.SoftwareComponent { Name = "Fake FHIR Server", Version = "1.0" },
            Rest = [rest],
        };
    }
}
