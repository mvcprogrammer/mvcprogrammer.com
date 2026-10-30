using Fhir.Api.Fhir;
using Fhir.Api.Mapping;
using Fhir.Api.Models;
using Hl7.Fhir.Model;

namespace Fhir.Api.Tests.Mapping;

public sealed class ConditionInputMapperTests
{
    private static readonly PickListCondition _hypertension = new("59621000", "Essential hypertension");
    private static readonly DateOnly _today = new(2026, 10, 30);

    #region ToNewCondition Tests

    /// <summary>The recorded Condition carries exactly what openapi.yaml promises: active, a problem-list item, the SNOMED coding and display, the subject, and today.</summary>
    [Fact]
    public void ToNewCondition_ShouldBuildAnActiveProblemListItemForThePatient()
    {
        // Arrange & Act
        var condition = ConditionInputMapper.ToNewCondition(_hypertension, "1842", _today);

        // Assert
        Assert.Null(condition.Id);
        Assert.Equal("active", ConditionMapper.ClinicalStatusOf(condition));
        var category = Assert.Single(condition.Category);
        Assert.Equal("problem-list-item", Assert.Single(category.Coding).Code);
        Assert.NotNull(condition.Code);
        var coding = Assert.Single(condition.Code.Coding);
        Assert.Equal(("http://snomed.info/sct", "59621000", "Essential hypertension"), (coding.System, coding.Code, coding.Display));
        Assert.Equal("Essential hypertension", condition.Code.Text);
        Assert.Equal("Patient/1842", condition.Subject.Reference);
        Assert.Equal("2026-10-30", condition.RecordedDate);
        Assert.Null(condition.Onset);
        Assert.Null(condition.VerificationStatus);
    }

    /// <summary>The mapper trusts nothing it is not given: a null entry or a blank patient id is an argument error.</summary>
    [Fact]
    public void ToNewCondition_ShouldThrowOnMissingArguments()
    {
        // Arrange & Act & Assert
        Assert.Throws<ArgumentNullException>(() => ConditionInputMapper.ToNewCondition(null!, "1842", _today));
        Assert.Throws<ArgumentException>(() => ConditionInputMapper.ToNewCondition(_hypertension, " ", _today));
    }

    #endregion

    #region ActiveConditionsQuery Tests

    /// <summary>The cap counts active conditions of the patient and nothing else.</summary>
    [Fact]
    public void ActiveConditionsQuery_ShouldFilterOnPatientAndActiveStatus()
    {
        // Arrange & Act
        var query = ConditionInputMapper.ActiveConditionsQuery("1842").ToUriParamList();

        // Assert
        Assert.Equal(2, query.Count);
        Assert.Equal("Patient/1842", query.SingleValue("patient"));
        Assert.Equal("active", query.SingleValue("clinical-status"));
    }

    #endregion

    #region ExistingActiveQuery Tests

    /// <summary>If-None-Exist matches the same patient, the same code, still active, so a resolved condition does not block a new one.</summary>
    [Fact]
    public void ExistingActiveQuery_ShouldAddTheSnomedTokenToTheActiveFilter()
    {
        // Arrange & Act
        var query = ConditionInputMapper.ExistingActiveQuery("1842", _hypertension).ToUriParamList();

        // Assert
        Assert.Equal(3, query.Count);
        Assert.Equal("Patient/1842", query.SingleValue("patient"));
        Assert.Equal("active", query.SingleValue("clinical-status"));
        Assert.Equal("http://snomed.info/sct|59621000", query.SingleValue("code"));
    }

    #endregion
}
