namespace Fhir.Api.Fhir;

/// <summary>The identifier systems the write operations stamp on the patients they create, as openapi.yaml names them.</summary>
public static class DemoIdentifiers
{
    /// <summary>Carries the visitor's session token; a later write must present the same token.</summary>
    public const string SESSION_SYSTEM = "https://mvcprogrammer.com/fhir/demo-session";

    /// <summary>Carries the Idempotency-Key a create was made with; the conditional create matches on it.</summary>
    public const string IDEMPOTENCY_SYSTEM = "https://mvcprogrammer.com/fhir/idempotency";

    /// <summary>The system of the MRN a visitor types, written as an identifier of type MR.</summary>
    public const string MRN_SYSTEM = "https://mvcprogrammer.com/fhir/mrn";

    /// <summary>The v2-0203 code system and code for a medical record number.</summary>
    public const string V2_0203 = "http://terminology.hl7.org/CodeSystem/v2-0203";
    public const string MRN_TYPE_CODE = "MR";

    /// <summary>The FHIR token search for an identifier in a system, for If-None-Exist and the session count.</summary>
    public static string Token(string system, string value) => $"{system}|{value}";
}
