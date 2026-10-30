using System.Text.Json.Serialization;

namespace Fhir.Api.Models;

/// <summary>What a visitor can write about a condition: a SNOMED CT code from the pick list. Mirrors ConditionInput in openapi.yaml.</summary>
public sealed record ConditionInput(string Code);

/// <summary>One entry of the pick list: a SNOMED CT concept id and its display, as the addCondition operation in openapi.yaml documents them.</summary>
public sealed record PickListCondition(string Code, string Display);

/// <summary>What a condition write returns. Mirrors ConditionWriteResult in openapi.yaml.</summary>
public sealed record ConditionWriteResult(ConditionItem Condition, Trace Trace);

/// <summary>Why a well-formed condition was not recorded. Carried by <see cref="Fhir.ConditionRejectedException"/>.</summary>
public enum ConditionRejection
{
    /// <summary>The code is not one of the ten on the pick list.</summary>
    OffPickList = 1,

    /// <summary>The patient already holds the configured number of active conditions.</summary>
    ActiveCapReached = 2,
}
