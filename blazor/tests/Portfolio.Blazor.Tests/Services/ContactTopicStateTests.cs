using Portfolio.Blazor.Services;

namespace Portfolio.Blazor.Tests.Services;

/// <summary>Tests for <see cref="ContactTopicState"/>.</summary>
public sealed class ContactTopicStateTests
{
    #region Select Tests

    /// <summary>Every subscriber hears each selection, in subscription order.</summary>
    [Fact]
    public void Select_ShouldNotifyEverySubscriber()
    {
        // Arrange
        var state = new ContactTopicState();
        var heard = new List<string>();
        state.Subscribe(t => heard.Add("a:" + t));
        state.Subscribe(t => heard.Add("b:" + t));

        // Act
        state.Select("Freelance");

        // Assert
        Assert.Equal(["a:Freelance", "b:Freelance"], heard);
    }

    /// <summary>Selecting with no subscribers is a no-op.</summary>
    [Fact]
    public void Select_ShouldCompleteWithoutSubscribers()
    {
        // Arrange
        var state = new ContactTopicState();

        // Act
        var exception = Record.Exception(() => state.Select("Freelance"));

        // Assert
        Assert.Null(exception);
    }

    /// <summary>A handler that unsubscribes while being notified does not break the loop.</summary>
    [Fact]
    public void Select_ShouldTolerateUnsubscribeDuringNotification()
    {
        // Arrange
        var state = new ContactTopicState();
        var count = 0;
        Action<string> self = null!;
        self = _ => { count++; state.Unsubscribe(self); };
        state.Subscribe(self);
        state.Subscribe(_ => count++);

        // Act
        state.Select("Freelance");
        state.Select("Freelance");

        // Assert
        Assert.Equal(3, count);
    }

    /// <summary>Null topics are rejected.</summary>
    [Fact]
    public void Select_ShouldThrowOnNull()
    {
        // Arrange
        var state = new ContactTopicState();

        // Act and Assert
        Assert.Throws<ArgumentNullException>(() => state.Select(null!));
    }

    #endregion

    #region Unsubscribe Tests

    /// <summary>A removed handler hears nothing further.</summary>
    [Fact]
    public void Unsubscribe_ShouldStopNotifications()
    {
        // Arrange
        var state = new ContactTopicState();
        var count = 0;
        Action<string> handler = _ => count++;
        state.Subscribe(handler);
        state.Select("Freelance");

        // Act
        state.Unsubscribe(handler);
        state.Select("Freelance");

        // Assert
        Assert.Equal(1, count);
    }

    /// <summary>Null handlers are rejected on both calls.</summary>
    [Fact]
    public void Subscribe_ShouldThrowOnNull()
    {
        // Arrange
        var state = new ContactTopicState();

        // Act and Assert
        Assert.Throws<ArgumentNullException>(() => state.Subscribe(null!));
        Assert.Throws<ArgumentNullException>(() => state.Unsubscribe(null!));
    }

    #endregion
}
