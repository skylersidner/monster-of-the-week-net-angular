import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, throwError } from 'rxjs';

import { NotificationService } from '../core/notifications';
import { ResourceImageResponse, ResourceImageUploadResponse } from '../core/models';
import { ResourceImageService } from '../core/resource-images';
import { ImageUploadModalComponent } from './image-upload-modal.component';
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

@Component({
  imports: [ImageUploadModalComponent],
  template: `
    <app-image-upload-modal
      ownerType="Monster"
      ownerId="m1"
      [currentCount]="count()"
      [visible]="visible()"
      (uploaded)="outcomes.push($event)"
      (closed)="closedCount = closedCount + 1; visible.set(false)"
    />
  `,
})
class HostComponent {
  readonly count = signal(0);
  readonly visible = signal(true);
  readonly outcomes: UploadOutcome[] = [];
  closedCount = 0;
}

describe('ImageUploadModalComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let pending: Subject<ResourceImageUploadResponse>[];
  let submitted: File[][];
  let errors: string[];
  let uploadFails: boolean;

  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const query = (selector: string): HTMLElement | null => element().querySelector<HTMLElement>(selector);
  const all = (selector: string): HTMLElement[] => Array.from(element().querySelectorAll<HTMLElement>(selector));
  const button = (attr: string): HTMLButtonElement => query(`[${attr}]`) as HTMLButtonElement;
  const modal = (): ImageUploadModalComponent =>
    fixture.debugElement.children[0].componentInstance as ImageUploadModalComponent;
  const text = (selector: string): string => query(selector)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const rowNames = (): string[] => all('[data-staged-name]').map((node) => node.textContent!.trim());
  const rowErrors = (): string[] => all('[data-staged-error]').map((node) => node.textContent!.trim());

  function stage(...files: File[]): void {
    modal().stage(files);
    fixture.detectChanges();
  }

  function pressEscape(): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.dispatchEvent(event);
    fixture.detectChanges();
    return event;
  }

  function resolve(response: ResourceImageUploadResponse): void {
    pending[0].next(response);
    pending[0].complete();
    fixture.detectChanges();
  }

  beforeEach(() => {
    pending = [];
    submitted = [];
    errors = [];
    uploadFails = false;

    TestBed.configureTestingModule({
      providers: [
        {
          provide: ResourceImageService,
          useValue: {
            upload: (_t: string, _o: string, files: readonly File[]) => {
              submitted.push([...files]);
              if (uploadFails) {
                return throwError(() => new Error('network'));
              }
              const response = new Subject<ResourceImageUploadResponse>();
              pending.push(response);
              return response.asObservable();
            },
          },
        },
        { provide: NotificationService, useValue: { error: (message: string) => errors.push(message), success: () => {} } },
      ],
    });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders the modal shell, drop area and picker; nothing staged yet', () => {
    expect(query('[data-upload-modal]')!.getAttribute('role')).toBe('dialog');
    expect(query('[data-upload-modal]')!.getAttribute('aria-modal')).toBe('true');
    expect(text('h3')).toBe('Add images');
    expect(text('[data-drop-area]')).toContain('Drag images here, or choose files');
    expect(query('[data-file-input]')!.getAttribute('accept')).toBe('image/jpeg,image/png,image/webp');
    expect(query('[data-staged-list]')).toBeNull();
    expect(button('data-submit').disabled).toBe(true);
  });

  it('renders nothing when not visible', () => {
    host.visible.set(false);
    fixture.detectChanges();
    expect(query('[data-upload-modal]')).toBeNull();
  });

  describe('staging', () => {
    it('lists filenames only — no thumbnail previews', () => {
      stage(file('one.webp'), file('two.png', 1000, 'image/png'));

      expect(rowNames()).toEqual(['one.webp', 'two.png']);
      expect(element().querySelectorAll('[data-staged-list] img').length).toBe(0);
      expect(rowErrors()).toEqual([]);
      expect(button('data-submit').disabled).toBe(false);
    });

    it('flags wrong type and oversized files in place, with §7 copy, and keeps them out of the submission', () => {
      stage(file('good.webp'), file('bad.gif', 1000, 'image/gif'), file('big.png', 3_000_000, 'image/png'));

      expect(rowNames()).toEqual(['good.webp', 'bad.gif', 'big.png']);
      expect(rowErrors()).toEqual([
        "bad.gif isn't a supported image type — only JPG, PNG, and WebP are allowed.",
        'File too large to upload. Images must be 2MB or less in size.',
      ]);
      expect(all('[data-staged-row="invalid"]').length).toBe(2);

      button('data-submit').click();
      expect(submitted[0].map((f) => f.name)).toEqual(['good.webp']);
    });

    it('flags over-cap files at staging time and never sends them (§7.4 worked example: 8 + 5)', () => {
      host.count.set(8);
      fixture.detectChanges();

      stage(...Array.from({ length: 5 }, (_, i) => file(`f${i}.webp`)));

      expect(rowNames().length).toBe(5);
      expect(rowErrors()).toEqual([
        "f2.webp wasn't added — over the 10-image limit.",
        "f3.webp wasn't added — over the 10-image limit.",
        "f4.webp wasn't added — over the 10-image limit.",
      ]);

      button('data-submit').click();
      expect(submitted[0].map((f) => f.name)).toEqual(['f0.webp', 'f1.webp']);
    });

    it('checks type and size before the cap, so an invalid file never consumes a slot', () => {
      host.count.set(9);
      fixture.detectChanges();
      stage(file('bad.gif', 1000, 'image/gif'), file('good.webp'));

      expect(rowErrors()).toEqual(["bad.gif isn't a supported image type — only JPG, PNG, and WebP are allowed."]);
      button('data-submit').click();
      expect(submitted[0].map((f) => f.name)).toEqual(['good.webp']);
    });

    it('revalidates on remove, so freeing a slot clears an over-cap flag', () => {
      host.count.set(9);
      fixture.detectChanges();
      stage(file('first.webp'), file('second.webp'));
      expect(rowErrors()).toEqual(["second.webp wasn't added — over the 10-image limit."]);

      all('[data-remove-file]')[0].click();
      fixture.detectChanges();

      expect(rowNames()).toEqual(['second.webp']);
      expect(rowErrors()).toEqual([]);
    });

    it('Upload stays disabled when nothing staged is valid, and nothing is sent', () => {
      stage(file('bad.gif', 1000, 'image/gif'));

      expect(button('data-submit').disabled).toBe(true);
      modal().submit();
      expect(submitted.length).toBe(0);
    });

    it('accepts files added in a second drop, appending to the list', () => {
      stage(file('one.webp'));
      stage(file('two.webp'));
      expect(rowNames()).toEqual(['one.webp', 'two.webp']);
    });
  });

  describe('drag and drop', () => {
    function dragEvent(type: string, types: string[], files: File[] = []): DragEvent {
      const event = new Event(type, { bubbles: true, cancelable: true }) as DragEvent;
      Object.defineProperty(event, 'dataTransfer', { value: { types, files, dropEffect: 'none' } });
      return event;
    }

    const dropArea = (): HTMLElement => query('[data-drop-area]')!;

    it('tints the drop area for a file drag and stages what is dropped', () => {
      const enter = dragEvent('dragenter', ['Files']);
      dropArea().dispatchEvent(enter);
      fixture.detectChanges();

      expect(enter.defaultPrevented).toBe(true);
      expect(dropArea().hasAttribute('data-drag-over')).toBe(true);
      expect(dropArea().classList).toContain('bg-accent-subtle');

      const drop = dragEvent('drop', ['Files'], [file('dropped.webp')]);
      dropArea().dispatchEvent(drop);
      fixture.detectChanges();

      expect(drop.defaultPrevented).toBe(true);
      expect(dropArea().hasAttribute('data-drag-over')).toBe(false);
      expect(rowNames()).toEqual(['dropped.webp']);
    });

    it('ignores a drag that carries no files', () => {
      const enter = dragEvent('dragenter', ['text/uri-list']);
      dropArea().dispatchEvent(enter);
      fixture.detectChanges();

      expect(enter.defaultPrevented).toBe(false);
      expect(dropArea().hasAttribute('data-drag-over')).toBe(false);
    });

    it('keeps the tint while the pointer crosses child elements', () => {
      dropArea().dispatchEvent(dragEvent('dragenter', ['Files']));
      query('[data-choose-files]')!.dispatchEvent(dragEvent('dragenter', ['Files']));
      query('[data-choose-files]')!.dispatchEvent(dragEvent('dragleave', ['Files']));
      fixture.detectChanges();

      expect(dropArea().hasAttribute('data-drag-over')).toBe(true);
    });
  });

  describe('submit', () => {
    it('replaces the body with a spinner and removes both footer buttons while in flight', () => {
      stage(file('one.webp'));
      button('data-submit').click();
      fixture.detectChanges();

      expect(text('[data-uploading]')).toBe('Uploading images...');
      expect(query('[data-uploading] use')!.getAttribute('href')).toBe('#icon-spinner');
      expect(query('[data-uploading]')!.getAttribute('role')).toBe('status');
      // Nothing interactive is rendered, so there is nothing to click and no shield needed.
      expect(query('[data-submit]')).toBeNull();
      expect(query('[data-cancel]')).toBeNull();
      expect(query('[data-staged-list]')).toBeNull();
      expect(query('[data-drop-area]')).toBeNull();
    });

    it('closes on a clean submit, emits the outcome, and raises no toast', () => {
      stage(file('one.webp'), file('two.webp'));
      button('data-submit').click();
      resolve({ uploaded: [imageFixture('a', 1), imageFixture('b', 2)], rejected: [] });

      expect(host.outcomes.length).toBe(1);
      expect(host.outcomes[0].attempted).toBe(2);
      expect(host.outcomes[0].uploaded.length).toBe(2);
      expect(host.closedCount).toBe(1);
      expect(errors).toEqual([]);
    });

    it('partial rejection: keeps the successes, closes, and toasts the failed names', () => {
      stage(...Array.from({ length: 3 }, (_, i) => file(`f${i}.webp`)));
      button('data-submit').click();
      resolve({
        uploaded: [imageFixture('a', 1)],
        rejected: [
          { fileName: 'f1.webp', reason: 'UnreadableOrOversizedDimensions' },
          { fileName: 'f2.webp', reason: 'UnsupportedType' },
        ],
      });

      expect(host.outcomes[0].uploaded.length).toBe(1);
      expect(host.closedCount).toBe(1);
      expect(errors).toEqual(["Added 1 of 3 images. These couldn't be added: f1.webp, f2.webp."]);
    });

    it('counts submitted files, not staged ones, in the toast', () => {
      host.count.set(0);
      fixture.detectChanges();
      // 3 staged, 1 invalid, so only 2 are submitted — the toast says "of 2", not "of 3".
      stage(file('ok1.webp'), file('bad.gif', 1000, 'image/gif'), file('ok2.webp'));
      button('data-submit').click();
      resolve({ uploaded: [imageFixture('a', 1)], rejected: [{ fileName: 'ok2.webp', reason: 'UnsupportedType' }] });

      expect(errors).toEqual(["Added 1 of 2 images. This one couldn't be added: ok2.webp."]);
    });

    it('total rejection (400, nothing landed): stays open with files staged, generic toast', () => {
      stage(file('one.webp'));
      button('data-submit').click();
      resolve({ uploaded: [], rejected: [{ fileName: 'one.webp', reason: 'UnreadableOrOversizedDimensions' }] });

      expect(host.closedCount).toBe(0);
      expect(query('[data-upload-modal]')).not.toBeNull();
      expect(rowNames()).toEqual(['one.webp']);
      expect(errors).toEqual(["Something went wrong and your images weren't added. Please try again."]);
      // Still retryable without re-picking.
      expect(button('data-submit').disabled).toBe(false);
    });

    it('a transport failure toasts the same generic string and keeps the modal open', () => {
      uploadFails = true;
      stage(file('one.webp'));
      button('data-submit').click();
      fixture.detectChanges();

      expect(errors).toEqual(["Something went wrong and your images weren't added. Please try again."]);
      expect(host.closedCount).toBe(0);
      expect(query('[data-uploading]')).toBeNull();
      expect(rowNames()).toEqual(['one.webp']);
    });
  });

  describe('closing', () => {
    it('closes immediately with nothing staged — no confirmation', () => {
      button('data-cancel').click();
      fixture.detectChanges();

      expect(query('[data-discard-confirm]')).toBeNull();
      expect(host.closedCount).toBe(1);
    });

    it('Cancel with files staged swaps the footer to the confirm step, not a second dialog', () => {
      stage(file('one.webp'), file('two.webp'));
      button('data-cancel').click();
      fixture.detectChanges();

      // One dialog on screen, not two stacked.
      expect(element().querySelectorAll('[role="dialog"]').length).toBe(1);
      expect(text('[data-discard-confirm] h3')).toBe('Discard selected files?');
      expect(text('[data-discard-prompt]')).toBe("2 files haven't been uploaded yet. Closing this window will discard them.");
      expect(text('[data-keep-files]')).toBe('Keep files');
      expect(text('[data-discard-files]')).toBe('Discard files');
      expect(button('data-discard-files').classList).toContain('bg-danger');
      expect(host.closedCount).toBe(0);
      // Deliberately no bare "Cancel" on a dialog about cancelling.
      expect(query('[data-cancel]')).toBeNull();
    });

    it('uses the singular prompt for one staged file', () => {
      stage(file('one.webp'));
      button('data-cancel').click();
      fixture.detectChanges();

      expect(text('[data-discard-prompt]')).toBe("1 file hasn't been uploaded yet. Closing this window will discard it.");
    });

    it('Keep files returns to staging with the list untouched', () => {
      stage(file('one.webp'), file('two.webp'));
      button('data-cancel').click();
      fixture.detectChanges();
      button('data-keep-files').click();
      fixture.detectChanges();

      expect(query('[data-discard-confirm]')).toBeNull();
      expect(rowNames()).toEqual(['one.webp', 'two.webp']);
      expect(host.closedCount).toBe(0);
    });

    it('Discard files closes', () => {
      stage(file('one.webp'));
      button('data-cancel').click();
      fixture.detectChanges();
      button('data-discard-files').click();
      fixture.detectChanges();

      expect(host.closedCount).toBe(1);
    });

    it('the backdrop routes through the confirmation too', () => {
      stage(file('one.webp'));
      (query('.fixed.inset-0') as HTMLElement).click();
      fixture.detectChanges();

      expect(query('[data-discard-confirm]')).not.toBeNull();
      expect(host.closedCount).toBe(0);
    });

    it('Escape does not bypass the confirmation: first press asks, second closes', () => {
      stage(file('one.webp'));

      pressEscape();
      expect(query('[data-discard-confirm]')).not.toBeNull();
      expect(host.closedCount).toBe(0);

      pressEscape();
      expect(host.closedCount).toBe(1);
    });

    it('Escape closes straight away with nothing staged', () => {
      pressEscape();
      expect(host.closedCount).toBe(1);
    });

    it('Escape is consumed, so it cannot also close an enclosing surface', () => {
      const event = pressEscape();
      expect(event.defaultPrevented).toBe(true);
    });

    it('Escape does nothing while the request is in flight', () => {
      stage(file('one.webp'));
      button('data-submit').click();
      fixture.detectChanges();

      pressEscape();
      expect(host.closedCount).toBe(0);
      expect(query('[data-uploading]')).not.toBeNull();
    });

    it('the backdrop does not close during an in-flight request', () => {
      stage(file('one.webp'));
      button('data-submit').click();
      fixture.detectChanges();

      (query('.fixed.inset-0') as HTMLElement).click();
      fixture.detectChanges();
      expect(host.closedCount).toBe(0);
    });

    it('reopening starts clean, with no files from the previous session', () => {
      stage(file('one.webp'));
      button('data-cancel').click();
      fixture.detectChanges();
      button('data-discard-files').click();
      fixture.detectChanges();

      host.visible.set(true);
      fixture.detectChanges();

      expect(query('[data-staged-list]')).toBeNull();
      expect(query('[data-discard-confirm]')).toBeNull();
    });
  });
});
