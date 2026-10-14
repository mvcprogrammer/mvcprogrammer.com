using System.Globalization;
using Portfolio.Blazor.Enumerations;
using Portfolio.Blazor.Models;

namespace Portfolio.Blazor.Extensions;

/// <summary>Display helpers for positions on the timeline.</summary>
public static class PositionExtensions
{
    /// <summary>"2023-12" becomes "Dec 2023". Anything unparseable is returned as-is.</summary>
    /// <param name="yearMonth">An ISO 8601 year-month.</param>
    public static string ToMonthLabel(this string yearMonth)
    {
        ArgumentNullException.ThrowIfNull(yearMonth);

        return DateOnly.TryParseExact(yearMonth + "-01", "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date)
            ? date.ToString("MMM yyyy", CultureInfo.InvariantCulture)
            : yearMonth;
    }

    /// <summary>"Remote", "Hybrid", or the place for on-site roles.</summary>
    /// <param name="position">The position.</param>
    public static string ToPlaceLabel(this Position position)
    {
        ArgumentNullException.ThrowIfNull(position);

        return position.WorkMode switch
        {
            WorkMode.Remote => "Remote",
            WorkMode.Hybrid => "Hybrid",
            _ => string.IsNullOrWhiteSpace(position.Location) ? "On-site" : position.Location,
        };
    }
}
