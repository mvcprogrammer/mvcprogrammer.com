import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { ContactTopicState } from '../interfaces/contact-topic-state';

/** In-memory topic hand-off between the call-to-action buttons and the contact form. One instance per app. */
@Injectable()
export class SubjectContactTopicState extends ContactTopicState {
  private readonly subject = new Subject<string>();

  /** @inheritdoc */
  override readonly topics: Observable<string> = this.subject.asObservable();

  /** @inheritdoc */
  override select(topic: string): void {
    this.subject.next(topic);
  }
}
