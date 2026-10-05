import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ResourceImageResponse } from '../core/models';
import { ImageCarouselComponent } from './image-carousel.component';

function imageFixture(id: string, sortOrder: number, overrides: Partial<ResourceImageResponse> = {}): ResourceImageResponse {
  return {
    id,
    fileName: `${id}.webp`,
    contentType: 'image/webp',
    sizeBytes: 150_000,
    width: 1024,
    height: 1024,
    sortOrder,
    isPrimary: false,
    createdAt: '2026-10-05T00:00:00Z',
    ...overrides,
  };
}

@Component({
  imports: [ImageCarouselComponent],
  template: `
    <app-image-carousel
      ownerType="Monster"
      ownerId="m1"
      ownerName="The Hex"
      [images]="images()"
      [primaryImageId]="primaryId()"
      [(activeImageId)]="activeId"
      [busy]="busy()"
      (setPrimary)="events.push('setPrimary:' + $event)"
      (deleteRequested)="events.push('delete:' + $event.id)"
    />
  `,
})
class HostComponent {
  readonly images = signal<ResourceImageResponse[]>([imageFixture('a', 1), imageFixture('b', 2), imageFixture('c', 3), imageFixture('d', 4)]);
  readonly primaryId = signal<string | null>('b');
  readonly activeId = signal<string | null>(null);
  readonly busy = signal(false);
  readonly events: string[] = [];
}

describe('ImageCarouselComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const region = (): HTMLElement => element().querySelector<HTMLElement>('[data-carousel]')!;
  const slide = (role: string): HTMLElement[] => Array.from(element().querySelectorAll<HTMLElement>(`[data-slide="${role}"]`));
  const activeSlide = (): HTMLElement => slide('active')[0];
  const button = (attr: string): HTMLButtonElement => element().querySelector<HTMLButtonElement>(`[${attr}]`)!;
  const key = (name: string): KeyboardEvent => {
    const event = new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true });
    region().dispatchEvent(event);
    fixture.detectChanges();
    return event;
  };

  beforeEach(() => {
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('starts on the primary image when no active image is set', () => {
    expect(activeSlide().getAttribute('data-image-id')).toBe('b');
    expect(element().querySelector('[data-status]')!.textContent!.trim()).toBe('Image 2 of 4');
  });

  it('active slide loads the original over the thumbnail; peeks load only the thumbnail; far slides nothing', () => {
    const original = activeSlide().querySelector<HTMLImageElement>('img[data-original]')!;
    expect(original.getAttribute('src')).toBe('/api/monsters/m1/images/b/file');
    expect(original.alt).toBe('The Hex image 2 of 4');

    const peeks = slide('peek');
    expect(peeks.map((s) => s.getAttribute('data-image-id'))).toEqual(['a', 'c']);
    for (const peek of peeks) {
      expect(peek.querySelector('img[data-original]')).toBeNull();
      expect(peek.querySelector('img')!.getAttribute('src')).toMatch(/\/thumbnail$/);
    }

    const far = slide('far');
    expect(far.map((s) => s.getAttribute('data-image-id'))).toEqual(['d']);
    expect(far[0].querySelector('img')).toBeNull();
  });

  it('every carousel image is draggable="false"', () => {
    const images = Array.from(element().querySelectorAll('img'));
    expect(images.length).toBeGreaterThan(0);
    for (const img of images) {
      expect(img.getAttribute('draggable')).toBe('false');
    }
  });

  it('peek slides are de-emphasised, hidden from assistive tech and inert', () => {
    for (const peek of slide('peek')) {
      expect(peek.getAttribute('aria-hidden')).toBe('true');
      expect(peek.hasAttribute('inert')).toBe(true);
      expect(peek.firstElementChild!.classList).toContain('opacity-40');
      expect(peek.firstElementChild!.classList).toContain('scale-90');
    }
    expect(activeSlide().getAttribute('aria-hidden')).toBeNull();
  });

  it('marks the active slide with the primary glow only when it is the primary', () => {
    expect(activeSlide().firstElementChild!.classList).toContain('image-primary-glow');

    button('data-next').click();
    fixture.detectChanges();

    expect(activeSlide().firstElementChild!.classList).not.toContain('image-primary-glow');
    expect(element().querySelectorAll('.image-primary-glow').length).toBe(0);
  });

  it('is a focusable, labelled carousel region', () => {
    expect(region().getAttribute('role')).toBe('group');
    expect(region().getAttribute('aria-roledescription')).toBe('carousel');
    expect(region().getAttribute('aria-label')).toBe('Image carousel');
    expect(region().tabIndex).toBe(0);
    expect(region().className).toContain('focus-visible:outline-accent');
    expect(region().className).not.toContain('ring-focus');
    expect(activeSlide().getAttribute('aria-roledescription')).toBe('slide');
    expect(activeSlide().getAttribute('aria-label')).toBe('2 of 4');
  });

  it('ArrowLeft/ArrowRight move one slide and update the two-way binding', () => {
    const right = key('ArrowRight');
    expect(right.defaultPrevented).toBe(true);
    expect(host.activeId()).toBe('c');
    expect(activeSlide().getAttribute('data-image-id')).toBe('c');

    key('ArrowLeft');
    key('ArrowLeft');
    expect(host.activeId()).toBe('a');
  });

  it('does not wrap: arrows at either end do nothing and are not consumed; chevrons disable', () => {
    host.activeId.set('a');
    fixture.detectChanges();
    expect(button('data-previous').disabled).toBe(true);
    expect(key('ArrowLeft').defaultPrevented).toBe(false);
    expect(host.activeId()).toBe('a');

    host.activeId.set('d');
    fixture.detectChanges();
    expect(button('data-next').disabled).toBe(true);
    expect(key('ArrowRight').defaultPrevented).toBe(false);
    expect(activeSlide().getAttribute('data-image-id')).toBe('d');
  });

  it('chevrons are labelled; "next" is the same symbol rotated', () => {
    expect(button('data-previous').getAttribute('aria-label')).toBe('Previous image');
    expect(button('data-next').getAttribute('aria-label')).toBe('Next image');
    expect(button('data-next').querySelector('app-icon')!.classList).toContain('rotate-180');
    expect(button('data-next').querySelector('use')!.getAttribute('href')).toBe('#icon-chevron');
  });

  it('shows no chevrons for a single image', () => {
    host.images.set([imageFixture('a', 1)]);
    fixture.detectChanges();
    expect(element().querySelector('[data-previous]')).toBeNull();
    expect(element().querySelector('[data-next]')).toBeNull();
  });

  describe('primary star', () => {
    it('is filled and pressed on the primary, and clicking it does nothing', () => {
      const star = button('data-star');
      expect(star.getAttribute('aria-pressed')).toBe('true');
      expect(star.getAttribute('aria-label')).toBe('Primary image');
      expect(star.querySelector('app-icon')!.classList).toContain('fill-current');

      star.click();
      expect(host.events).toEqual([]);
    });

    it('is an outline toggle on a non-primary image, and emits setPrimary', () => {
      button('data-next').click();
      fixture.detectChanges();

      const star = button('data-star');
      expect(star.getAttribute('aria-pressed')).toBe('false');
      expect(star.getAttribute('aria-label')).toBe('Set as primary image');
      expect(star.querySelector('app-icon')!.classList).toContain('fill-none');

      star.click();
      expect(host.events).toEqual(['setPrimary:c']);
    });

    it('re-renders filled in place when the host moves the primary to the active image', () => {
      button('data-next').click();
      fixture.detectChanges();
      host.primaryId.set('c');
      fixture.detectChanges();

      expect(activeSlide().getAttribute('data-image-id')).toBe('c');
      expect(button('data-star').getAttribute('aria-pressed')).toBe('true');
    });
  });

  it('the delete button sits beside the star and emits the active image', () => {
    const trash = button('data-delete');
    expect(trash.parentElement).toBe(button('data-star').parentElement);
    expect(trash.getAttribute('aria-label')).toBe('Delete image b.webp');

    trash.click();
    expect(host.events).toEqual(['delete:b']);
  });

  it('busy disables the star toggle and delete, but not navigation', () => {
    button('data-next').click();
    host.busy.set(true);
    fixture.detectChanges();

    expect(button('data-star').disabled).toBe(true);
    expect(button('data-delete').disabled).toBe(true);
    expect(button('data-next').disabled).toBe(false);
  });

  it('keeps focus on a control across a slide change (controls are outside the slides)', () => {
    const star = button('data-star');
    star.focus();
    key('ArrowRight');
    expect(document.activeElement).toBe(star);
  });

  it('turns off the slide transition under reduced motion', () => {
    const track = element().querySelector<HTMLElement>('[data-track]')!;
    expect(track.className).toContain('motion-reduce:transition-none');
    expect(track.style.transform).toContain('translateX');
  });

  it('hides a failed original so the thumbnail beneath shows through', () => {
    activeSlide().querySelector('img[data-original]')!.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(activeSlide().querySelector('img[data-original]')).toBeNull();
    expect(activeSlide().querySelector('img')!.getAttribute('src')).toMatch(/\/thumbnail$/);
  });
});
