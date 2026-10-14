import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImageOwnerType } from '../core/models';
import { ResourceImagesCardComponent } from './resource-images-card.component';

@Component({
  imports: [ResourceImagesCardComponent],
  template: `
    <app-resource-images-card
      [ownerType]="ownerType()"
      [currentCount]="count()"
      [disabled]="disabled()"
      (addImages)="addCount = addCount + 1"
    >
      <p data-projected>carousel goes here</p>
    </app-resource-images-card>
  `,
})
class HostComponent {
  readonly ownerType = signal<ImageOwnerType>('Bystander');
  readonly count = signal(3);
  readonly disabled = signal(false);
  addCount = 0;
}

describe('ResourceImagesCardComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const query = (selector: string): HTMLElement | null => element().querySelector<HTMLElement>(selector);
  const button = (attr: string): HTMLButtonElement => query(`[${attr}]`) as HTMLButtonElement;
  const text = (selector: string): string => query(selector)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  beforeEach(() => {
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders the header, the Add Images button and the projected carousel', () => {
    expect(text('h3')).toBe('Images');
    expect(text('[data-add-images]')).toBe('+ Add Images');
    expect(query('[data-projected]')).not.toBeNull();
    expect(query('[data-empty-state]')).toBeNull();
  });

  it('is not a drop target and owns no file input', () => {
    // Drag-and-drop is modal-only (design.md §4.1), so none of this belongs on the card.
    expect(query('input[type="file"]')).toBeNull();
    const card = query('[data-images-card]')!;
    for (const attribute of Array.from(card.attributes)) {
      expect(attribute.name).not.toMatch(/drag|drop/i);
    }
  });

  it('raises addImages from the header button', () => {
    button('data-add-images').click();
    expect(host.addCount).toBe(1);
  });

  it('renders the empty state, with no droppable dashed border, and its button also raises addImages', () => {
    host.count.set(0);
    fixture.detectChanges();

    expect(query('[data-projected]')).toBeNull();
    expect(text('[data-empty-state]')).toContain('No images yet.');
    expect(query('[data-empty-state] app-domain-icon use')!.getAttribute('href')).toBe('#icon-nav-bystanders');
    expect(query('[data-empty-state] svg')!.getAttribute('class')).toBe('h-12 w-12');
    // §5.5: the dashed border moved into the modal, where dropping actually works.
    expect(query('[data-empty-state]')!.className).not.toContain('border-dashed');

    button('data-empty-add-images').click();
    expect(host.addCount).toBe(1);
  });

  it('disables Add Images at 10/10 with the inline note', () => {
    host.count.set(10);
    fixture.detectChanges();

    expect(text('[data-at-cap]')).toBe('10/10 images — delete one to add another');
    expect(button('data-add-images').disabled).toBe(true);
  });

  it('shows no cap note below 10', () => {
    expect(query('[data-at-cap]')).toBeNull();
    expect(button('data-add-images').disabled).toBe(false);
  });

  it('disables Add Images while another image mutation is in flight', () => {
    host.disabled.set(true);
    fixture.detectChanges();
    expect(button('data-add-images').disabled).toBe(true);
  });

  it('uses the owner type for the empty state icon', () => {
    host.count.set(0);
    host.ownerType.set('Location');
    fixture.detectChanges();
    expect(query('[data-empty-state] app-domain-icon use')!.getAttribute('href')).toBe('#icon-nav-locations');
  });
});
