using Hl7.Etl.Models;
using Hl7.Fhir.Model;

namespace Hl7.Etl.Mappers;

/// <summary>
/// One transaction bundle per batch: every resource is a conditional create on its ETL identifier
/// (so a rerun matches instead of duplicating), and a conditional reference to a patient or
/// encounter that is in the same bundle becomes an in-bundle <c>urn:uuid</c> reference, so the
/// server does not have to resolve it against resources it has not created yet.
/// </summary>
public static class BundleBuilder
{
    /// <summary>The bundle for the batch, entries in message order, resources in mapper order.</summary>
    public static Bundle Build(IReadOnlyList<(LandedMessage Message, IReadOnlyList<Resource> Resources)> batch, Uri identifierSystem)
    {
        ArgumentNullException.ThrowIfNull(batch);
        ArgumentNullException.ThrowIfNull(identifierSystem);

        var bundle = new Bundle { Type = Bundle.BundleType.Transaction };
        var inBundle = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var (_, resources) in batch)
        {
            foreach (var resource in resources)
            {
                var value = IdentifierOf(resource, identifierSystem).Value!;
                var fullUrl = $"urn:uuid:{Guid.NewGuid()}";
                inBundle[EtlIdentifiers.ConditionalReference(resource.TypeName, identifierSystem, value)] = fullUrl;
                bundle.Entry.Add(new Bundle.EntryComponent
                {
                    FullUrl = fullUrl,
                    Resource = resource,
                    Request = new Bundle.RequestComponent
                    {
                        Method = Bundle.HTTPVerb.POST,
                        Url = resource.TypeName,
                        IfNoneExist = $"identifier={Uri.EscapeDataString(EtlIdentifiers.Token(identifierSystem, value))}",
                    },
                });
            }
        }

        foreach (var entry in bundle.Entry)
        {
            foreach (var reference in ReferencesOf(entry.Resource!))
            {
                if (reference.Reference is not null && inBundle.TryGetValue(reference.Reference, out var fullUrl))
                {
                    reference.Reference = fullUrl;
                }
            }
        }

        return bundle;
    }

    /// <summary>The references a resource makes to a patient or an encounter (its subject and encounter), for rewriting.</summary>
    public static IEnumerable<ResourceReference> ReferencesOf(Resource resource)
    {
        ArgumentNullException.ThrowIfNull(resource);
        switch (resource)
        {
            case Encounter encounter when encounter.Subject is not null:
                yield return encounter.Subject;
                break;
            case Observation observation:
                if (observation.Subject is not null)
                {
                    yield return observation.Subject;
                }

                if (observation.Encounter is not null)
                {
                    yield return observation.Encounter;
                }

                break;
        }
    }

    /// <summary>The resource's identifier under the ETL system; every mapped resource has exactly one.</summary>
    public static Identifier IdentifierOf(Resource resource, Uri identifierSystem)
    {
        ArgumentNullException.ThrowIfNull(resource);
        ArgumentNullException.ThrowIfNull(identifierSystem);

        var identifiers = resource switch
        {
            Patient patient => patient.Identifier,
            Encounter encounter => encounter.Identifier,
            Observation observation => observation.Identifier,
            _ => throw new InvalidOperationException($"{resource.TypeName} is not a resource the ETL writes."),
        };
        return identifiers.FirstOrDefault(i => i.System == identifierSystem.ToString() && !string.IsNullOrWhiteSpace(i.Value))
            ?? throw new InvalidOperationException($"A {resource.TypeName} without an ETL identifier cannot be loaded idempotently.");
    }

}
