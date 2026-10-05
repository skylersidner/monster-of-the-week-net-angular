import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';

import { ResourceImageResponse, ResourceImageUploadResponse } from '../core/models';
import { ResourceImageService } from '../core/resource-images';
import { ImageDropzoneComponent } from './image-dropzone.component';
import { UploadOutcome } from './resource-image-rules';

function imageFixture(id: string, sortOrder: number): ResourceImageResponse {
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
  };
}

function file(name: string, size = 1000, type = 'image/webp'): File {
  const value = new File(['x'], name, { type });
  Object.defineProperty(value, 'size', { value: size });
  return value;
}

/** One pending upload request the test resolves by hand, so the spinner can be observed mid-run. */
interface PendingUpload {
  files: readonly File[];
  response: Subject<ResourceImageUploadResponse>;
}

@Component({
  imports: [ImageDropzoneComponent],
  template: `
    <app-image-dropzone ownerType="Bystander" ownerId="b1" [currentCount]="count()" [disabled]="disabled()" (uploaded)="outcomes.push($event)">
      <p data-projected>carousel goes here</p>
    </app-image-dropzone>
  `,
})
class HostComponent {
  readonly count = signal(3);
  readonly disabled = signal(false);
  readonly outcomes: UploadOutcome[] = [];
}

describe('ImageDropzoneComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let pending: PendingUpload[];

  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const query = (selector: string): HTMLElement | null => element().querySelector<HTMLElement>(selector);
  const dropzone = (): ImageDropzoneComponent =>
    fixture.debugElement.children[0].componentInstance as ImageDropzoneComponent;
  const text = (selector: string): string => query(selector)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  beforeEach(() => {
    pending = [];
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ResourceImageService,
          useValue: {
            upload: (_ownerType: string, _ownerId: string, files: readonly File[]) => {
              const response = new Subject<ResourceImageUploadResponse>();
              pending.push({ files, response });
              return response.asObservable();
            },
          },
        },
      ],
    });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  function resolve(index: number, response: ResourceImageUploadResponse): void {
    pending[index].response.next(response);
    pending[index].response.complete();
    fixture.detectChanges();
  }

  it('is the card shell: header, Add Images button, projected carousel', () => {
    expect(text('h3')).toBe('Images');
    expect(text('[data-add-images]')).toBe('+ Add Images');
    expect(query('[data-projected]')).not.toBeNull();
    expect(query('[data-empty-state]')).toBeNull();
    expect(query('input[type="file"]')!.getAttribute('accept')).toBe('image/jpeg,image/png,image/webp');
  });

  it('renders the empty state (the uploader) instead of the carousel at zero images', () => {
    host.count.set(0);
    fixture.detectChanges();

    expect(query('[data-projected]')).toBeNull();
    expect(text('[data-empty-state]')).toContain('No images yet.');
    expect(query('[data-empty-state] app-domain-icon use')!.getAttribute('href')).toBe('#icon-nav-bystanders');
    expect(query('[data-empty-state] svg')!.getAttribute('class')).toBe('h-12 w-12');

    // The empty state's own button opens the same file input.
    const input = query('input[type="file"]') as HTMLInputElement;
    const click = vi.spyOn(input, 'click').mockImplementation(() => undefined);
    (query('[data-empty-add-images]') as HTMLButtonElement).click();
    expect(click).toHaveBeenCalled();
  });

  it('blocks adding at 10/10 with the inline note', () => {
    host.count.set(10);
    fixture.detectChanges();

    expect(text('[data-at-cap]')).toBe('10/10 images — delete one to add another');
    expect((query('[data-add-images]') as HTMLButtonElement).disabled).toBe(true);
    dropzone().upload([file('a.webp')]);
    expect(pending.length).toBe(0);
  });

  it('rejects wrong-type and oversized files before any request, with the exact copy', () => {
    dropzone().upload([file('swamp.bmp', 100, 'image/bmp'), file('big.png', 3_000_000, 'image/png')]);
    fixture.detectChanges();

    expect(pending.length).toBe(0);
    expect(query('[data-upload-summary]')).toBeNull(); // §7.3: everything failed, no summary line
    const lines = Array.from(element().querySelectorAll('[data-upload-rejections] li')).map((li) =>
      li.textContent!.replace(/\s+/g, ' ').trim(),
    );
    expect(lines).toEqual([
      "swamp.bmp isn't a supported image type — only JPG, PNG, and WebP are allowed.",
      'big.png — File too large to upload. Images must be 2MB or less in size.',
    ]);
    expect(host.outcomes.length).toBe(1);
  });

  it('shows one spinner across sequential chunks and emits one merged outcome', () => {
    const files = Array.from({ length: 12 }, (_, i) => file(`f${i}.webp`));
    dropzone().upload(files);
    fixture.detectChanges();

    // Only the first chunk is in flight: sequential, not parallel.
    expect(pending.length).toBe(1);
    expect(pending[0].files.length).toBe(10);
    expect(text('[data-uploading]')).toBe('Uploading images...');
    expect(query('[data-uploading] use')!.getAttribute('href')).toBe('#icon-spinner');
    expect((query('[data-add-images]') as HTMLButtonElement).disabled).toBe(true);

    resolve(0, {
      uploaded: Array.from({ length: 7 }, (_, i) => imageFixture(`img${i}`, 4 + i)),
      rejected: ['f7.webp', 'f8.webp', 'f9.webp'].map((fileName) => ({ fileName, reason: 'CapExceeded' })),
    });

    // Second chunk now in flight; the spinner never dropped between chunks.
    expect(pending.length).toBe(2);
    expect(pending[1].files.map((f) => f.name)).toEqual(['f10.webp', 'f11.webp']);
    expect(query('[data-uploading]')).not.toBeNull();
    expect(host.outcomes.length).toBe(0);

    resolve(1, {
      uploaded: [],
      rejected: [
        { fileName: 'f10.webp', reason: 'CapExceeded' },
        { fileName: 'f11.webp', reason: 'CapExceeded' },
      ],
    });

    expect(query('[data-uploading]')).toBeNull();
    expect(host.outcomes.length).toBe(1);
    expect(host.outcomes[0].attempted).toBe(12);
    expect(host.outcomes[0].uploaded.length).toBe(7);
    expect(text('[data-upload-summary]')).toBe('7 of 12 images were added.');
    expect(element().querySelectorAll('[data-upload-rejections] li').length).toBe(5);
    expect(text('[data-upload-rejections] li')).toBe("f7.webp wasn't added — over the 10-image limit.");
  });

  it('marks a chunk whose request fails with the generic copy and keeps going', () => {
    dropzone().upload([file('a.webp'), file('b.webp')]);
    pending[0].response.error(new Error('network'));
    fixture.detectChanges();

    expect(query('[data-uploading]')).toBeNull();
    expect(host.outcomes[0].uploaded).toEqual([]);
    expect(text('[data-upload-rejections] li')).toBe('a.webp — File failed to upload. Please try again.');
  });

  it('host disablement blocks the button and uploads', () => {
    host.disabled.set(true);
    fixture.detectChanges();
    expect((query('[data-add-images]') as HTMLButtonElement).disabled).toBe(true);
    dropzone().upload([file('a.webp')]);
    expect(pending.length).toBe(0);
  });

  describe('drag and drop', () => {
    function dragEvent(type: string, types: string[]): DragEvent {
      const event = new Event(type, { bubbles: true, cancelable: true }) as DragEvent;
      Object.defineProperty(event, 'dataTransfer', { value: { types, files: [], dropEffect: 'none' } });
      return event;
    }

    const card = (): HTMLElement => query('[data-dropzone]')!;

    it('highlights the whole card for a file drag, and prevents the browser default', () => {
      const enter = dragEvent('dragenter', ['Files']);
      card().dispatchEvent(enter);
      fixture.detectChanges();

      expect(enter.defaultPrevented).toBe(true);
      expect(card().hasAttribute('data-drag-over')).toBe(true);
      expect(card().classList).toContain('bg-accent-subtle');
      expect(card().classList).toContain('border-dashed');

      card().dispatchEvent(dragEvent('dragleave', ['Files']));
      fixture.detectChanges();
      expect(card().hasAttribute('data-drag-over')).toBe(false);
    });

    it('ignores a drag that carries no files (e.g. an image dragged from inside the card)', () => {
      const enter = dragEvent('dragenter', ['text/uri-list', 'text/html']);
      card().dispatchEvent(enter);
      fixture.detectChanges();

      expect(enter.defaultPrevented).toBe(false);
      expect(card().hasAttribute('data-drag-over')).toBe(false);
    });

    it('still prevents the default for a file drop while blocked, so the browser does not open the file', () => {
      host.count.set(10);
      fixture.detectChanges();

      const enter = dragEvent('dragenter', ['Files']);
      card().dispatchEvent(enter);
      const drop = dragEvent('drop', ['Files']);
      card().dispatchEvent(drop);
      fixture.detectChanges();

      expect(card().hasAttribute('data-drag-over')).toBe(false);
      expect(drop.defaultPrevented).toBe(true);
      expect(pending.length).toBe(0);
    });
  });
});
