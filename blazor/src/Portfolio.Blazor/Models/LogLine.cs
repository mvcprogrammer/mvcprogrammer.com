namespace Portfolio.Blazor.Models;

/// <summary>One line of the explorer's request log; the kind picks its colour.</summary>
/// <param name="Text">The line.</param>
/// <param name="Kind">request, response, upstream, detail, note, error, or empty for plain.</param>
public sealed record LogLine(string Text, string Kind);
