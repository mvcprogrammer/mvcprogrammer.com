import { SubjectContactTopicState } from './subject-contact-topic-state';

describe('SubjectContactTopicState', () => {
  describe('select', () => {
    it('should notify every subscriber', () => {
      // Arrange
      const state = new SubjectContactTopicState();
      const first: string[] = [];
      const second: string[] = [];
      state.topics.subscribe((topic) => first.push(topic));
      state.topics.subscribe((topic) => second.push(topic));

      // Act
      state.select('Contract or consulting');
      state.select('Job opportunity');

      // Assert
      expect(first).toEqual(['Contract or consulting', 'Job opportunity']);
      expect(second).toEqual(['Contract or consulting', 'Job opportunity']);
    });

    it('should complete without subscribers', () => {
      // Arrange
      const state = new SubjectContactTopicState();

      // Act and Assert
      expect(() => state.select('Contract or consulting')).not.toThrow();
    });

    it('should stop notifying an unsubscribed listener', () => {
      // Arrange
      const state = new SubjectContactTopicState();
      const received: string[] = [];
      const subscription = state.topics.subscribe((topic) => received.push(topic));
      state.select('Contract or consulting');

      // Act
      subscription.unsubscribe();
      state.select('Job opportunity');

      // Assert
      expect(received).toEqual(['Contract or consulting']);
    });

    it('should not replay earlier selections to a late subscriber', () => {
      // Arrange
      const state = new SubjectContactTopicState();
      state.select('Contract or consulting');
      const received: string[] = [];

      // Act
      state.topics.subscribe((topic) => received.push(topic));

      // Assert
      expect(received).toEqual([]);
    });
  });
});
