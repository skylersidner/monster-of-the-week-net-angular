import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ResourceOwnerType } from '../core/models';
import { ResourceThumbnailComponent } from './resource-thumbnail.component';

@Component({
  imports: [ResourceThumbnailComponent],
  template: `
    <app-resource-thumbnail
      class="h-16 w-16"
      [ownerType]="ownerType()"
      [thumbnailUrl]="url()"
      [size]="size()"
      alt="The Hex" />
  `,
})
class HostComponent {
  readonly ownerType = signal<ResourceOwnerType>('Monster');
  readonly url = signal<string | null>(null);
  readonly size = signal<'row' | 'compact' | 'fill'>('row');
}

describe('ResourceThumbnailComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const img = (): HTMLImageElement | null => element().querySelector('img');
  const placeholder = (): HTMLElement | null => element().querySelector('[data-placeholder]');

  beforeEach(() => {
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('renders the domain placeholder for a null URL', () => {
    expect(img()).toBeNull();
    expect(placeholder()).not.toBeNull();
    // Literal domain classes, so Tailwind generates them.
    expect(placeholder()!.className).toContain('bg-badge-monster/40');
    expect(placeholder()!.querySelector('use')!.getAttribute('href')).toBe('#icon-nav-monsters');
    expect(placeholder()!.getAttribute('aria-label')).toBe('The Hex');
    // The icon scales with the box: `xl` (48px) in the 128px row square, not a small glyph
    // floating in a large box.
    expect(placeholder()!.querySelector('svg')!.getAttribute('class')).toBe('h-12 w-12');
  });

  it('carries its own 128px row box by default, so list pages need no size classes', () => {
    const host = element().querySelector('app-resource-thumbnail')!;
    for (const expected of ['h-32', 'w-32', 'shrink-0', 'rounded-lg', 'border', 'border-default']) {
      expect(host.classList).toContain(expected);
    }
  });

  it('size="compact" carries a 64px box for a short row', () => {
    fixture.componentInstance.size.set('compact');
    fixture.detectChanges();

    const host = element().querySelector('app-resource-thumbnail')!;
    for (const expected of ['h-16', 'w-16', 'shrink-0', 'rounded-lg', 'border-default']) {
      expect(host.classList).toContain(expected);
    }
    // Not the 128px row size — the two must not both apply.
    expect(host.classList).not.toContain('h-32');
    expect(host.classList).not.toContain('w-32');
  });

  it('size="fill" drops the box, leaving the caller to position it', () => {
    fixture.componentInstance.size.set('fill');
    fixture.detectChanges();

    const host = element().querySelector('app-resource-thumbnail')!;
    for (const absent of ['h-32', 'w-32', 'shrink-0', 'border']) {
      expect(host.classList).not.toContain(absent);
    }
    // The call site's own classes survive — these are per-class host bindings, not a [class] swap.
    expect(host.classList).toContain('h-16');
  });

  it('uses each domain’s own placeholder colour', () => {
    fixture.componentInstance.ownerType.set('Location');
    fixture.detectChanges();
    expect(placeholder()!.className).toContain('bg-badge-location/40');
    expect(placeholder()!.querySelector('use')!.getAttribute('href')).toBe('#icon-nav-locations');
  });

  it('renders a lazy, non-draggable image for a URL', () => {
    fixture.componentInstance.url.set('/api/monsters/m1/images/i1/thumbnail');
    fixture.detectChanges();

    expect(placeholder()).toBeNull();
    expect(img()!.getAttribute('src')).toBe('/api/monsters/m1/images/i1/thumbnail');
    expect(img()!.getAttribute('loading')).toBe('lazy');
    expect(img()!.getAttribute('draggable')).toBe('false');
    expect(img()!.alt).toBe('The Hex');
  });

  it('falls back to the placeholder on a load error, silently', () => {
    fixture.componentInstance.url.set('/broken');
    fixture.detectChanges();

    img()!.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(img()).toBeNull();
    expect(placeholder()).not.toBeNull();
  });

  it('tries again when the URL changes after an error (state keyed on the URL)', () => {
    fixture.componentInstance.url.set('/broken');
    fixture.detectChanges();
    img()!.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    fixture.componentInstance.url.set('/working');
    fixture.detectChanges();

    expect(img()!.getAttribute('src')).toBe('/working');
  });
});
