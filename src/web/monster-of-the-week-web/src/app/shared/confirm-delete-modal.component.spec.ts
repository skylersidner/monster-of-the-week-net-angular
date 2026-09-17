import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConfirmDeleteModalComponent } from './confirm-delete-modal.component';

@Component({
  imports: [ConfirmDeleteModalComponent],
  template: `
    <app-confirm-delete-modal
      [visible]="true"
      itemName="The Hex"
      [verb]="verb()"
      [confirmLabel]="confirmLabel()"
      message="These belong to The Crooked and will be cleared:"
      [items]="['2 moves']"
      permanenceNote="Your name, pronouns and History notes stay." />
  `,
})
class HostComponent {
  readonly verb = signal('Delete');
  readonly confirmLabel = signal<string | null>(null);
}

describe('ConfirmDeleteModalComponent', () => {
  let fixture: ComponentFixture<HostComponent>;

  const buttons = (): string[] =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).map((button) => button.textContent?.trim() ?? '');
  const title = (): string | undefined => (fixture.nativeElement as HTMLElement).querySelector('h3')?.textContent?.trim();

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('labels the confirm button with the verb by default, so existing call sites are unchanged', () => {
    expect(title()).toBe('Delete "The Hex"?');
    expect(buttons()).toEqual(['Cancel', 'Delete']);
  });

  it('takes an optional confirmLabel when the verb reads badly on a button (L13)', () => {
    fixture.componentInstance.verb.set('Switch to');
    fixture.componentInstance.confirmLabel.set('Switch playbook');
    fixture.detectChanges();

    expect(title()).toBe('Switch to "The Hex"?');
    expect(buttons()).toEqual(['Cancel', 'Switch playbook']);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Your name, pronouns and History notes stay.');
  });
});
