using Fhir.Api.Mapping;
using Fhir.Api.Tests.Fakes;
using Hl7.Fhir.Model;

namespace Fhir.Api.Tests.Mapping;

public sealed class ConditionMapperTests
{
    [Theory]
    [InlineData("active", true)]
    [InlineData("recurrence", true)]
    [InlineData("relapse", true)]
    [InlineData("inactive", false)]
    [InlineData("remission", false)]
    [InlineData("resolved", false)]
    public void Splits_on_clinical_status(string status, bool active)
    {
        var split = ConditionMapper.Split([Fixtures.Condition("c", status, "Thing")]);

        Assert.Equal(active ? 1 : 0, split.Active.Count);
        Assert.Equal(active ? 0 : 1, split.Resolved.Count);
        Assert.Equal(status, (active ? split.Active : split.Resolved)[0].ClinicalStatus);
    }

    [Fact]
    public void Missing_clinical_status_is_unknown_and_stays_visible()
    {
        var condition = Fixtures.Condition("c", "active", "Thing");
        condition.ClinicalStatus = null;

        var split = ConditionMapper.Split([condition]);

        var item = Assert.Single(split.Active);
        Assert.Equal("unknown", item.ClinicalStatus);
    }

    [Fact]
    public void Prefers_snomed_then_icd10cm_and_labels_the_system()
    {
        var condition = Fixtures.Condition("c", "active", "ignored");
        condition.Code = new CodeableConcept
        {
            Text = "High blood pressure",
            Coding =
            [
                new Coding("http://example.org/local", "HBP", "Local HBP"),
                new Coding(Fixtures.ICD10_CM, "I10", "Essential (primary) hypertension"),
                new Coding(Fixtures.SNOMED, "59621000", "Essential hypertension"),
            ],
        };

        var item = ConditionMapper.ToItem(condition);

        Assert.Equal(("59621000", "SNOMED CT", "Essential hypertension"), (item.Code, item.SystemLabel, item.Display));

        condition.Code.Coding.RemoveAt(2);
        Assert.Equal(("I10", "ICD-10-CM"), (ConditionMapper.ToItem(condition).Code, ConditionMapper.ToItem(condition).SystemLabel));

        condition.Code.Coding.RemoveAt(1);
        var local = ConditionMapper.ToItem(condition);
        Assert.Equal(("HBP", "other", "Local HBP"), (local.Code, local.SystemLabel, local.Display));
    }

    [Fact]
    public void Falls_back_to_text_then_code_for_the_display()
    {
        var condition = Fixtures.Condition("c", "active", "x");
        condition.Code = new CodeableConcept { Text = "Just text" };
        Assert.Equal("Just text", ConditionMapper.ToItem(condition).Display);

        condition.Code = new CodeableConcept(Fixtures.SNOMED, "12345");
        Assert.Equal("12345", ConditionMapper.ToItem(condition).Display);

        condition.Code = null;
        var item = ConditionMapper.ToItem(condition);
        Assert.Equal("Unknown condition", item.Display);
        Assert.Null(item.Code);
        Assert.Null(item.SystemLabel);
    }

    [Fact]
    public void Takes_the_date_part_of_onset_and_recorded_date()
    {
        var condition = Fixtures.Condition("c", "active", "Thing", onset: null);
        condition.Onset = new FhirDateTime("2019-02-11T08:30:00+01:00");
        condition.RecordedDate = "2019-02-12";

        var item = ConditionMapper.ToItem(condition);

        Assert.Equal("2019-02-11", item.OnsetDate);
        Assert.Equal("2019-02-12", item.RecordedDate);

        condition.Onset = new Period { Start = "2020-05-01", End = "2020-06-01" };
        Assert.Equal("2020-05-01", ConditionMapper.ToItem(condition).OnsetDate);

        condition.Onset = new Age { Value = 40 };
        Assert.Null(ConditionMapper.ToItem(condition).OnsetDate);

        condition.Onset = new FhirDateTime("2019");
        Assert.Null(ConditionMapper.ToItem(condition).OnsetDate);
    }

    [Fact]
    public void Orders_each_group_newest_first_with_undated_last()
    {
        var split = ConditionMapper.Split(
        [
            Fixtures.Condition("old", "active", "Old", onset: "2010-01-01"),
            Fixtures.Condition("none", "active", "Undated", onset: null),
            Fixtures.Condition("new", "active", "New", onset: "2024-03-03"),
        ]);

        Assert.Equal(["New", "Old", "Undated"], split.Active.Select(c => c.Display));
    }
}
