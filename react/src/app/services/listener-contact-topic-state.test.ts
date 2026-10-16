import { ListenerContactTopicState } from './listener-contact-topic-state';

describe('ListenerContactTopicState', () => {
  describe('select', () => {
    it('should notify every subscriber with the topic', () => {
      // Arrange
      const state = new ListenerContactTopicState();
      const first = vi.fn();
      const second = vi.fn();
      state.subscribe(first);
      state.subscribe(second);

      // Act
      state.select('Freelance');

      // Assert
      expect(first).toHaveBeenCalledWith('Freelance');
      expect(second).toHaveBeenCalledWith('Freelance');
    });

    it('should do nothing without subscribers', () => {
      // Arrange
      const state = new ListenerContactTopicState();

      // Act, Assert
      expect(() => state.select('Freelance')).not.toThrow();
    });

    it('should not replay earlier topics to a late subscriber', () => {
      // Arrange
      const state = new ListenerContactTopicState();
      state.select('Freelance');
      const listener = vi.fn();

      // Act
      state.subscribe(listener);

      // Assert
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('subscribe', () => {
    it('should stop notifying a listener once its unsubscribe function runs', () => {
      // Arrange
      const state = new ListenerContactTopicState();
      const listener = vi.fn();
      const unsubscribe = state.subscribe(listener);

      // Act
      unsubscribe();
      state.select('Freelance');

      // Assert
      expect(listener).not.toHaveBeenCalled();
    });

    it('should keep notifying the other listeners when one unsubscribes during a select', () => {
      // Arrange
      const state = new ListenerContactTopicState();
      const second = vi.fn();
      const unsubscribeFirst = state.subscribe(() => unsubscribeFirst());
      state.subscribe(second);

      // Act
      state.select('Freelance');

      // Assert
      expect(second).toHaveBeenCalledWith('Freelance');
    });
  });
});
