using Fhir.Api.Fhir;
using Fhir.Api.Models;

namespace Fhir.Api.Mapping;

/// <summary>
/// RFC 6902 over the five scalar fields of <see cref="PatientInput"/>. The document is so small
/// (five optional strings, no arrays, no nesting) that the general-purpose patch libraries bring
/// more than they save: this applies the six operations to a record and reports the first one
/// that cannot be applied, which openapi.yaml promises as a 409. Values are strings; <c>sex</c> is
/// parsed from its wire form.
/// </summary>
public static class PatientPatchApplier
{
    /// <summary>The paths a patch may touch, as openapi.yaml lists them.</summary>
    public static readonly IReadOnlyList<string> PATHS = ["/familyName", "/givenName", "/sex", "/birthDate", "/mrn"];

    private static readonly IReadOnlyList<string> OPS = ["add", "remove", "replace", "move", "copy", "test"];

    public const int MAX_OPERATIONS = 20;

    /// <summary>Applies every operation in order. Throws <see cref="PatchConflictException"/> at the first that cannot be applied; the input is never half-patched.</summary>
    public static PatientInput Apply(PatientInput input, IReadOnlyList<PatientPatchOperation> operations)
    {
        ArgumentNullException.ThrowIfNull(input);
        ArgumentNullException.ThrowIfNull(operations);

        var current = input;
        for (var i = 0; i < operations.Count; i++)
        {
            var op = operations[i];
            if (!OPS.Contains(op.Op, StringComparer.Ordinal))
            {
                throw new PatchConflictException(i, $"Operation {i} ('{op.Op}') is not an RFC 6902 operation; the patient was not changed.");
            }

            if (!PATHS.Contains(op.Path, StringComparer.Ordinal))
            {
                throw new PatchConflictException(i, $"Operation {i} ('{op.Op}' on {op.Path}) names a path that is not a PatientInput property; the patient was not changed.");
            }

            current = op.Op switch
            {
                "add" or "replace" => Set(current, op.Path, Required(op.Value, i, op), i),
                "remove" => Set(current, op.Path, null, i),
                "test" => Test(current, op, i),
                "move" => Set(Set(current, op.Path, Get(current, Source(op, i)), i), Source(op, i), null, i),
                _ => Set(current, op.Path, Get(current, Source(op, i)), i),
            };
        }

        return current;
    }

    private static string Source(PatientPatchOperation op, int index) =>
        op.From is not null && PATHS.Contains(op.From, StringComparer.Ordinal)
            ? op.From
            : throw new PatchConflictException(index, $"Operation {index} ('{op.Op}') needs 'from' naming a PatientInput property; the patient was not changed.");

    private static string Required(string? value, int index, PatientPatchOperation op) =>
        value ?? throw new PatchConflictException(index, $"Operation {index} ('{op.Op}' on {op.Path}) needs a value; the patient was not changed.");

    private static PatientInput Test(PatientInput current, PatientPatchOperation op, int index) =>
        string.Equals(Get(current, op.Path), op.Value, StringComparison.Ordinal)
            ? current
            : throw new PatchConflictException(index, $"Operation {index} ('test' on {op.Path}) failed; the patient was not changed.");

    private static string? Get(PatientInput input, string path) => path switch
    {
        "/familyName" => input.FamilyName,
        "/givenName" => input.GivenName,
        "/sex" => input.Sex?.ToString().ToLowerInvariant(),
        "/birthDate" => input.BirthDate,
        _ => input.Mrn,
    };

    private static PatientInput Set(PatientInput input, string path, string? value, int index) => path switch
    {
        "/familyName" => input with { FamilyName = value ?? string.Empty },
        "/givenName" => input with { GivenName = value },
        "/sex" => input with { Sex = ParseSex(value, index) },
        "/birthDate" => input with { BirthDate = value },
        _ => input with { Mrn = value },
    };

    private static Sex? ParseSex(string? value, int index) => value?.ToLowerInvariant() switch
    {
        null => null,
        "male" => Sex.Male,
        "female" => Sex.Female,
        "other" => Sex.Other,
        "unknown" => Sex.Unknown,
        _ => throw new PatchConflictException(index, $"Operation {index} sets sex to '{value}'; use male, female, other, or unknown. The patient was not changed."),
    };
}
