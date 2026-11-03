using Fhir.Api.Models;

namespace Fhir.Api.Fhir;

/// <summary>A write aimed at the seeded demo patient, which every visitor searches for first.</summary>
public sealed class DemoPatientReadOnlyException(string id)
    : Exception($"Patient '{id}' is the seeded demo patient and cannot be changed. Create a patient of your own and change that.")
{
    public string Id { get; } = id;
}

/// <summary>No patient with that id this session may write to: it may not exist, it may have been wiped, or it may be someone else's. Same answer in every case.</summary>
public sealed class WritablePatientNotFoundException : Exception
{
    /// <summary>The patient-write answer: only a patient this session created may be replaced, patched, or deleted.</summary>
    public WritablePatientNotFoundException(string id)
        : this(id, $"This session created no Patient with id '{id}'. It may have been wiped; create another.")
    {
    }

    private WritablePatientNotFoundException(string id, string message)
        : base(message)
    {
        Id = id;
    }

    public string Id { get; }

    /// <summary>The condition-write answer: a patient this session created or the HL7 ETL loaded may carry conditions.</summary>
    public static WritablePatientNotFoundException ForConditions(string id) =>
        new(id, $"This session created no Patient with id '{id}', and the HL7 ETL loaded none. It may have been wiped; create another, or load the cohort.");
}

/// <summary>A patch operation could not be applied; nothing was written.</summary>
public sealed class PatchConflictException(int operationIndex, string message) : Exception(message)
{
    /// <summary>Zero-based index of the operation that failed.</summary>
    public int OperationIndex { get; } = operationIndex;
}

/// <summary>The session token has created its allowed number of patients.</summary>
public sealed class SessionCapExceededException(int cap)
    : Exception($"This session has created its {cap} patients. Delete one, or start a new session, to create another.")
{
    public int Cap { get; } = cap;
}

/// <summary>No such condition on a patient this session may write conditions on: the condition may not exist, may have been wiped, or may reference another patient. Same answer in every case.</summary>
public sealed class WritableConditionNotFoundException(string patientId, string conditionId)
    : Exception($"Patient '{patientId}' has no Condition with id '{conditionId}' this session may resolve. It may have been wiped.")
{
    public string PatientId { get; } = patientId;
    public string ConditionId { get; } = conditionId;
}

/// <summary>A well-formed condition the function will not record: the code is off the pick list, or the patient holds its cap of active conditions. Nothing was written.</summary>
public sealed class ConditionRejectedException(ConditionRejection reason, string message) : Exception(message)
{
    public ConditionRejection Reason { get; } = reason;
}

/// <summary>The body or a header failed validation; <see cref="Errors"/> names each field.</summary>
public sealed class PatientValidationException(IReadOnlyDictionary<string, string[]> errors) : Exception("One or more fields are invalid.")
{
    public IReadOnlyDictionary<string, string[]> Errors { get; } = errors;
}
