import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { SUPPRESS_ERROR_TOAST } from './http-context-tokens';
import { ResourceImageUploadResponse } from './models';
import {
  ResourceImageService,
  resourceImageFileUrl,
  resourceImageThumbnailUrl,
  resourceImagesPath,
} from './resource-images';

describe('resource image URLs', () => {
  it('maps each owner type to its controller segment', () => {
    expect(resourceImagesPath('Monster', 'm1')).toBe('/api/monsters/m1/images');
    expect(resourceImagesPath('Minion', 'n1')).toBe('/api/minions/n1/images');
    expect(resourceImagesPath('Bystander', 'b1')).toBe('/api/bystanders/b1/images');
    expect(resourceImagesPath('Location', 'l1')).toBe('/api/locations/l1/images');
  });

  it('builds the original and thumbnail URLs', () => {
    expect(resourceImageFileUrl('Monster', 'm1', 'i1')).toBe('/api/monsters/m1/images/i1/file');
    expect(resourceImageThumbnailUrl('Location', 'l1', 'i2')).toBe('/api/locations/l1/images/i2/thumbnail');
  });

  it('returns a null thumbnail URL for a null primary id (the placeholder trigger)', () => {
    expect(resourceImageThumbnailUrl('Monster', 'm1', null)).toBeNull();
    expect(resourceImageThumbnailUrl('Monster', 'm1', undefined)).toBeNull();
  });
});

describe('ResourceImageService', () => {
  let service: ResourceImageService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ResourceImageService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const allRejected: ResourceImageUploadResponse = {
    uploaded: [],
    rejected: [{ fileName: 'a.gif', reason: 'UnsupportedType' }],
  };

  it('uploads every file under the "files" form field, with the generic toast suppressed', () => {
    const files = [new File(['x'], 'one.webp', { type: 'image/webp' }), new File(['y'], 'two.png', { type: 'image/png' })];
    service.upload('Monster', 'm1', files).subscribe();

    const request = http.expectOne('/api/monsters/m1/images');
    expect(request.request.method).toBe('POST');
    const body = request.request.body as FormData;
    expect((body.getAll('files') as File[]).map((file) => file.name)).toEqual(['one.webp', 'two.png']);
    expect(request.request.context.get(SUPPRESS_ERROR_TOAST)).toBe(true);
    request.flush({ uploaded: [], rejected: [] });
  });

  it('turns an all-rejected 400 back into a normal per-file result', () => {
    let result: ResourceImageUploadResponse | undefined;
    service.upload('Monster', 'm1', [new File(['x'], 'a.gif')]).subscribe((value) => (result = value));

    http.expectOne('/api/monsters/m1/images').flush(allRejected, { status: 400, statusText: 'Bad Request' });
    expect(result).toEqual(allRejected);
  });

  it('still errors on a 400 without the per-file body, and on a 5xx', () => {
    const errors: number[] = [];
    service.upload('Monster', 'm1', [new File(['x'], 'a.png')]).subscribe({
      error: (error: HttpErrorResponse) => errors.push(error.status),
    });
    http.expectOne('/api/monsters/m1/images').flush({ message: 'nope' }, { status: 400, statusText: 'Bad Request' });

    service.upload('Monster', 'm1', [new File(['x'], 'a.png')]).subscribe({
      error: (error: HttpErrorResponse) => errors.push(error.status),
    });
    http.expectOne('/api/monsters/m1/images').flush(null, { status: 500, statusText: 'Server Error' });

    expect(errors).toEqual([400, 500]);
  });

  it('suppresses the generic toast on list, delete and set-primary too (failures render inline)', () => {
    service.list('Minion', 'n1').subscribe();
    service.delete('Minion', 'n1', 'i1').subscribe();
    service.setPrimary('Minion', 'n1', 'i2').subscribe();

    const list = http.expectOne((r) => r.method === 'GET' && r.url === '/api/minions/n1/images');
    const del = http.expectOne((r) => r.method === 'DELETE' && r.url === '/api/minions/n1/images/i1');
    const put = http.expectOne((r) => r.method === 'PUT' && r.url === '/api/minions/n1/images/i2/primary');
    for (const request of [list, del, put]) {
      expect(request.request.context.get(SUPPRESS_ERROR_TOAST)).toBe(true);
    }
    list.flush([]);
    del.flush(null);
    put.flush(null);
  });
});
