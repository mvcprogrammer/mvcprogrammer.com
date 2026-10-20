using Fhir.Api.Mapping;
using Fhir.Api.Tests.Fakes;
using Hl7.Fhir.Model;

namespace Fhir.Api.Tests.Mapping;

public sealed class VitalSignMapperTests
{
    [Theory]
    [InlineData("8867-4", "Heart rate")]
    [InlineData("29463-7", "Body weight")]
    [InlineData("8302-2", "Body height")]
    [InlineData("8310-5", "Body temperature")]
    [InlineData("9279-1", "Respiratory rate")]
    [InlineData("2708-6", "Oxygen saturation")]
    [InlineData("59408-5", "Oxygen saturation")]
    [InlineData("39156-5", "Body mass index")]
    public void Names_the_tracked_loinc_codes(string loinc, string name)
    {
        var vital = VitalSignMapper.ToVitalSign(Fixtures.Vital("o", loinc, "2025-01-01", 1, "u"));

        Assert.NotNull(vital);
        Assert.Equal((name, loinc, 1m, "u"), (vital.Name, vital.LoincCode, vital.Value, vital.Unit));
        Assert.Null(vital.Components);
    }

    [Fact]
    public void Ignores_observations_that_are_not_tracked_vitals()
    {
        Assert.Null(VitalSignMapper.ToVitalSign(Fixtures.Vital("lab", "2093-3", "2025-01-01", 190, "mg/dL")));

        var noLoinc = Fixtures.Vital("x", "8867-4", "2025-01-01", 72, "/min");
        noLoinc.Code = new CodeableConcept("http://example.org", "HR");
        Assert.Null(VitalSignMapper.ToVitalSign(noLoinc));
    }

    [Fact]
    public void Blood_pressure_carries_its_components_and_no_value()
    {
        var vital = VitalSignMapper.ToVitalSign(Fixtures.BloodPressure("bp", "2025-11-03T09:14:00Z", 138, 86));

        Assert.NotNull(vital);
        Assert.Equal("Blood pressure", vital.Name);
        Assert.Null(vital.Value);
        Assert.Null(vital.Unit);
        Assert.Collection(vital.Components!,
            s => Assert.Equal(("Systolic", "8480-6", 138m, "mm[Hg]"), (s.Name, s.LoincCode, s.Value, s.Unit)),
            d => Assert.Equal(("Diastolic", "8462-4", 86m, "mm[Hg]"), (d.Name, d.LoincCode, d.Value, d.Unit)));
    }

    [Fact]
    public void Blood_pressure_components_are_ordered_systolic_first_whatever_the_sandbox_sent()
    {
        var reversed = Fixtures.BloodPressure("bp", "2026-03-31T10:47:00Z", 108, 82);
        reversed.Component.Reverse();

        var vital = VitalSignMapper.ToVitalSign(reversed);

        Assert.NotNull(vital);
        Assert.Equal(["Systolic", "Diastolic"], vital.Components!.Select(c => c.Name));
        Assert.Equal([108m, 82m], vital.Components!.Select(c => c.Value));
    }

    [Fact]
    public void Drops_an_observation_without_a_quantity_or_components()
    {
        var text = Fixtures.Vital("t", "8867-4", "2025-01-01", 72, "/min");
        text.Value = new FhirString("seventy-two");
        Assert.Null(VitalSignMapper.ToVitalSign(text));

        var emptyPanel = Fixtures.BloodPressure("bp", "2025-01-01", 120, 80);
        emptyPanel.Component.Clear();
        Assert.Null(VitalSignMapper.ToVitalSign(emptyPanel));
    }

    [Fact]
    public void Takes_the_date_from_effective_date_time_or_period_start_and_drops_undated()
    {
        var dated = Fixtures.Vital("d", "8867-4", "2025-01-01T10:00:00Z", 72, "/min");
        Assert.Equal("2025-01-01T10:00:00Z", VitalSignMapper.ToVitalSign(dated)!.Date);

        dated.Effective = new Period { Start = "2025-02-02" };
        Assert.Equal("2025-02-02", VitalSignMapper.ToVitalSign(dated)!.Date);

        dated.Effective = null;
        Assert.Null(VitalSignMapper.ToVitalSign(dated));
    }

    [Fact]
    public void Uses_the_unit_code_when_the_unit_text_is_missing()
    {
        var vital = Fixtures.Vital("u", "29463-7", "2025-01-01", 84, "kg");
        vital.Value = new Quantity { Value = 84, Code = "kg", System = "http://unitsofmeasure.org" };

        Assert.Equal("kg", VitalSignMapper.ToVitalSign(vital)!.Unit);
    }

    [Fact]
    public void Selects_newest_first_and_caps_the_list()
    {
        var selected = VitalSignMapper.Select(
        [
            Fixtures.Vital("a", "8867-4", "2025-01-01", 70, "/min"),
            Fixtures.Vital("lab", "2093-3", "2025-12-31", 190, "mg/dL"),
            Fixtures.Vital("b", "29463-7", "2025-06-01", 84, "kg"),
            Fixtures.BloodPressure("c", "2025-11-03T09:14:00Z", 138, 86),
            Fixtures.Vital("d", "8310-5", "2024-01-01", 36.8m, "Cel"),
        ], max: 3);

        Assert.Equal(["Blood pressure", "Body weight", "Heart rate"], selected.Select(v => v.Name));
    }
}
