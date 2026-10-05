import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ResourceOwnerType } from '../core/models';
import { ResourceThumbnailComponent } from './resource-thumbnail.component';

@Component({
  imports: [ResourceThumbnailComponent],
  template: `<app-resource-thumbnail class="h-16 w-16" [ownerType]="ownerType()" [thumbnailUrl]="url()" alt="The Hex" />`,
})
class HostComponent {
  readonly ownerType = signal<ResourceOwnerType>('Monster');
  readonly url = signal<string | null>(null);
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
    // DomainIconComponent's default size is unchanged: the original fixed h-5 w-5.
    expect(placeholder()!.querySelector('svg')!.getAttribute('class')).toBe('h-5 w-5');
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
