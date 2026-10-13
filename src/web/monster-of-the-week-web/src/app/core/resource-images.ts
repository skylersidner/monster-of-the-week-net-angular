import { Injectable } from '@angular/core';
import { HttpContext, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, of, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiService } from './api';
import { SUPPRESS_ERROR_TOAST } from './http-context-tokens';
import { ResourceImageResponse, ResourceImageUploadResponse, ImageOwnerType } from './models';

/** Images per owner (design.md §1.4). Enforced server-side; the client uses it for the §7.5 pre-flight block. */
export const MAX_IMAGES_PER_RESOURCE = 10;

/**
 * Files per `POST` (phases.md Phase 3). A request-size limit, separate from the per-owner cap above
 * even though the numbers match: 10 × 2 MiB stays under the action's 24 MiB request limit.
 */
export const MAX_FILES_PER_UPLOAD_REQUEST = 10;

/** Per-file cap, in bytes: 2 MiB, the same 2,097,152 the server enforces. */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export const ACCEPTED_IMAGE_MIME_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp'];
export const ACCEPTED_IMAGE_EXTENSIONS: readonly string[] = ['.jpg', '.jpeg', '.png', '.webp'];

/** The `<input type="file" accept>` value. */
export const IMAGE_INPUT_ACCEPT = ACCEPTED_IMAGE_MIME_TYPES.join(',');

/**
 * Owner type → the per-domain controller's route segment (design.md §3: images nest under each domain).
 *
 * **Four keys, and `ImageOwnerType` is what holds it to four.** It is `Exclude<DomainOwnerType,
 * 'Mystery'>`, so `Record<…>` exhaustiveness cannot push a `Mystery: 'mysteries'` entry in here —
 * which would compile, 404 silently under `SUPPRESS_ERROR_TOAST`, and still pass
 * `custom-moves.spec.ts`'s cross-check. endpoint-unification.md §2.6.4 / U-R9.
 */
const OWNER_SEGMENT: Readonly<Record<ImageOwnerType, string>> = {
  Monster: 'monsters',
  Minion: 'minions',
  Bystander: 'bystanders',
  Location: 'locations',
};

/** `/api/{segment}/{ownerId}/images` — rooted, no base URL. ApiService adds that for JSON calls. */
export function resourceImagesPath(ownerType: ImageOwnerType, ownerId: string): string {
  return `/api/${OWNER_SEGMENT[ownerType]}/${ownerId}/images`;
}

/**
 * The original image — what the carousel's active slide shows.
 *
 * Image URLs go straight into `<img src>`, never through `HttpClient`, so they get the base URL
 * here rather than from `ApiService`, using the same normalization. `apiBaseUrl` is `''` today
 * (same-origin), so in practice this is the rooted path.
 */
export function resourceImageFileUrl(ownerType: ImageOwnerType, ownerId: string, imageId: string): string {
  return withBaseUrl(`${resourceImagesPath(ownerType, ownerId)}/${imageId}/file`);
}

/**
 * The 256×256 thumbnail — list rows and carousel peek slides. A `null` image id (an owner with no
 * images; the list's `primaryImageId` is null) returns `null`, which is exactly
 * `app-resource-thumbnail`'s placeholder trigger.
 */
export function resourceImageThumbnailUrl(
  ownerType: ImageOwnerType,
  ownerId: string,
  imageId: string | null | undefined,
): string | null {
  return imageId ? withBaseUrl(`${resourceImagesPath(ownerType, ownerId)}/${imageId}/thumbnail`) : null;
}

function withBaseUrl(path: string): string {
  return `${environment.apiBaseUrl.replace(/\/$/, '')}${path}`;
}

/**
 * Failures render inline in the Images section (design.md §4.3, §6), never as the generic
 * "Request failed (...)" toast. Suppresses only that toast: a 401 still goes to
 * `authErrorInterceptor` (see `http-context-tokens.ts`).
 */
function inlineErrorContext(): HttpContext {
  return new HttpContext().set(SUPPRESS_ERROR_TOAST, true);
}

/**
 * The image endpoints for all four owner types. One shared service because the endpoints have the
 * same shape for every owner; only the route segment differs (design.md §1.3, §3).
 */
@Injectable({
  providedIn: 'root',
})
export class ResourceImageService {
  constructor(private readonly apiService: ApiService) {}

  list(ownerType: ImageOwnerType, ownerId: string): Observable<ResourceImageResponse[]> {
    return this.apiService.get<ResourceImageResponse[]>(resourceImagesPath(ownerType, ownerId), inlineErrorContext());
  }

  /**
   * One `POST` of at most `MAX_FILES_PER_UPLOAD_REQUEST` files — and one is always enough, because
   * `app-image-upload-modal` refuses to stage past that limit, so there is no chunking anywhere.
   *
   * **A 400 carrying `{ uploaded, rejected }` comes back as a normal result, not an error.** The
   * server returns 400 when every file in the batch was rejected (design.md §3). That is still a
   * per-file answer the dropzone renders, and it arrives on `HttpErrorResponse.error`, not on the
   * success path. Every other failure (network, 5xx, a 400 without that body) still errors.
   */
  upload(ownerType: ImageOwnerType, ownerId: string, files: readonly File[]): Observable<ResourceImageUploadResponse> {
    const body = new FormData();
    for (const file of files) {
      // `files`: the controller action binds `[FromForm] IFormFileCollection files`.
      body.append('files', file, file.name);
    }

    return this.apiService
      .post<FormData, ResourceImageUploadResponse>(resourceImagesPath(ownerType, ownerId), body, inlineErrorContext())
      .pipe(
        catchError((error: unknown) =>
          error instanceof HttpErrorResponse && error.status === 400 && isUploadResponse(error.error)
            ? of(error.error)
            : throwError(() => error),
        ),
      );
  }

  delete(ownerType: ImageOwnerType, ownerId: string, imageId: string): Observable<void> {
    return this.apiService.delete(`${resourceImagesPath(ownerType, ownerId)}/${imageId}`, inlineErrorContext());
  }

  /** Bare `PUT`, 204/404, the same "set this relationship" shape as the mystery link-toggle endpoints. */
  setPrimary(ownerType: ImageOwnerType, ownerId: string, imageId: string): Observable<void> {
    return this.apiService.put<null, void>(
      `${resourceImagesPath(ownerType, ownerId)}/${imageId}/primary`,
      null,
      inlineErrorContext(),
    );
  }
}

function isUploadResponse(value: unknown): value is ResourceImageUploadResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return Array.isArray(record['uploaded']) && Array.isArray(record['rejected']);
}
