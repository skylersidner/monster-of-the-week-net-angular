import { ResourceImageResponse } from '../core/models';
import {
  UPLOAD_TOTAL_FAILURE_TOAST,
  activeImageIdAfterDelete,
  buildUploadOutcome,
  derivePrimaryImageId,
  planUpload,
  preflightRejectionReason,
  resourceImageDeleteFootnote,
  uploadPartialFailureToast,
  uploadRejectionCopy,
} from './resource-image-rules';

/** A §3-shaped image fixture. */
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

const a = imageFixture('a', 1);
const b = imageFixture('b', 2);
const c = imageFixture('c', 3);

describe('derivePrimaryImageId', () => {
  it('uses the explicit primary when it is still in the list', () => {
    expect(derivePrimaryImageId([a, b, c], 'c')).toBe('c');
  });

  it('falls back to the lowest SortOrder when there is no explicit primary', () => {
    expect(derivePrimaryImageId([c, b, a], null)).toBe('a');
  });

  it('falls back to the lowest SortOrder when the explicit primary is gone', () => {
    expect(derivePrimaryImageId([b, c], 'a')).toBe('b');
  });

  it('breaks a SortOrder tie by id, deterministically', () => {
    const y = imageFixture('y', 5);
    const x = imageFixture('x', 5);
    expect(derivePrimaryImageId([y, x], null)).toBe('x');
  });

  it('is null with no images', () => {
    expect(derivePrimaryImageId([], null)).toBeNull();
  });
});

describe('resourceImageDeleteFootnote', () => {
  it('not-primary branch: no footnote', () => {
    expect(resourceImageDeleteFootnote([a, b, c], 'a', 'b', 'The Hex')).toBe('');
  });

  it('still-has-images branch: names the first-uploaded remaining image', () => {
    expect(resourceImageDeleteFootnote([a, b, c], null, 'a', 'The Hex')).toBe(
      "This is the current primary image. After it's deleted, b.webp becomes primary instead.",
    );
  });

  it('names the first-uploaded image, not the neighbour, when an explicit primary is deleted', () => {
    // Explicit primary = C. Deleting C leaves [A, B]; the derived replacement is A (workflow §2.2).
    expect(resourceImageDeleteFootnote([a, b, c], 'c', 'c', 'The Hex')).toBe(
      "This is the current primary image. After it's deleted, a.webp becomes primary instead.",
    );
  });

  it('names the replacement even when exactly one image is left', () => {
    expect(resourceImageDeleteFootnote([a, b], null, 'a', 'The Hex')).toBe(
      "This is the current primary image. After it's deleted, b.webp becomes primary instead.",
    );
  });

  it('last-image branch: says the resource will have no images, and does not mention primary', () => {
    const footnote = resourceImageDeleteFootnote([a], null, 'a', 'The Hex');
    expect(footnote).toBe('This is the last image. The Hex will have no images afterward.');
    expect(footnote).not.toContain('primary');
  });

  it('treats a derived primary the same as an explicit one', () => {
    expect(resourceImageDeleteFootnote([b, c], null, 'b', 'The Hex')).toContain('c.webp becomes primary');
  });
});

describe('activeImageIdAfterDelete', () => {
  it('moves to the next image in SortOrder', () => {
    expect(activeImageIdAfterDelete([a, b, c], 'b')).toBe('c');
  });

  it('moves to the new last image when the deleted image was last', () => {
    expect(activeImageIdAfterDelete([a, b, c], 'c')).toBe('b');
  });

  it('is null when nothing is left', () => {
    expect(activeImageIdAfterDelete([a], 'a')).toBeNull();
  });
});

describe('preflightRejectionReason', () => {
  const file = (name: string, size: number, type: string) => ({ name, size, type });

  it('accepts jpg, jpeg, png and webp up to exactly 2 MiB', () => {
    expect(preflightRejectionReason(file('a.JPG', 100, 'image/jpeg'))).toBeNull();
    expect(preflightRejectionReason(file('a.jpeg', 100, 'image/jpeg'))).toBeNull();
    expect(preflightRejectionReason(file('a.png', 100, 'image/png'))).toBeNull();
    expect(preflightRejectionReason(file('a.webp', 2_097_152, 'image/webp'))).toBeNull();
  });

  it('accepts a known extension with an empty browser type', () => {
    expect(preflightRejectionReason(file('a.webp', 100, ''))).toBeNull();
  });

  it('rejects an unsupported extension or MIME type', () => {
    expect(preflightRejectionReason(file('a.gif', 100, 'image/gif'))).toBe('UnsupportedType');
    expect(preflightRejectionReason(file('a.png', 100, 'image/gif'))).toBe('UnsupportedType');
  });

  it('rejects one byte over 2 MiB', () => {
    expect(preflightRejectionReason(file('a.png', 2_097_153, 'image/png'))).toBe('TooLarge');
  });
});

describe('planUpload', () => {
  const file = (name: string, size = 1000, type = 'image/webp'): File => {
    const value = new File(['x'], name, { type });
    Object.defineProperty(value, 'size', { value: size });
    return value;
  };

  it('design.md §7.4 worked example: 8 existing + 5 dropped → 2 accepted, 3 rejected, none sent', () => {
    const files = Array.from({ length: 5 }, (_, i) => file(`f${i}.webp`));
    const plan = planUpload(files, 2);

    expect(plan.accepted.map((entry) => entry.file.name)).toEqual(['f0.webp', 'f1.webp']);
    expect(plan.rejected.map((entry) => entry.rejection)).toEqual([
      { fileName: 'f2.webp', reason: 'CapExceeded' },
      { fileName: 'f3.webp', reason: 'CapExceeded' },
      { fileName: 'f4.webp', reason: 'CapExceeded' },
    ]);
  });

  it('accepts in drop order up to the remaining slots', () => {
    const plan = planUpload([file('first.webp'), file('second.webp'), file('third.webp')], 1);
    expect(plan.accepted.map((entry) => entry.file.name)).toEqual(['first.webp']);
    expect(plan.rejected.map((entry) => entry.rejection.fileName)).toEqual(['second.webp', 'third.webp']);
  });

  it('rejects everything with CapExceeded when no slots are left', () => {
    const plan = planUpload([file('a.webp')], 0);
    expect(plan.accepted).toEqual([]);
    expect(plan.rejected[0].rejection.reason).toBe('CapExceeded');
  });

  it('checks type and size BEFORE the cap, so an invalid file never consumes a slot', () => {
    // One slot left. The .gif comes first in drop order; if the cap were applied first it would
    // take the slot and the valid .webp would be wrongly rejected as CapExceeded.
    const plan = planUpload([file('bad.gif', 1000, 'image/gif'), file('good.webp')], 1);

    expect(plan.accepted.map((entry) => entry.file.name)).toEqual(['good.webp']);
    expect(plan.rejected.map((entry) => entry.rejection)).toEqual([
      { fileName: 'bad.gif', reason: 'UnsupportedType' },
    ]);
  });

  it('gives an invalid file its own reason, not CapExceeded, even with zero slots left', () => {
    // Matches the server, which validates first and so never labels a .gif CapExceeded.
    const plan = planUpload([file('bad.gif', 1000, 'image/gif'), file('big.png', 3_000_000, 'image/png')], 0);
    expect(plan.rejected.map((entry) => entry.rejection.reason)).toEqual(['UnsupportedType', 'TooLarge']);
  });

  it('mixed batch: type, size and cap rejections coexist, each with its own reason, in drop order', () => {
    const plan = planUpload(
      [
        file('ok1.webp'),
        file('bad.gif', 1000, 'image/gif'),
        file('ok2.png', 1000, 'image/png'),
        file('big.png', 3_000_000, 'image/png'),
        file('ok3.webp'),
      ],
      2,
    );

    expect(plan.accepted.map((entry) => entry.file.name)).toEqual(['ok1.webp', 'ok2.png']);
    expect(plan.rejected.map((entry) => [entry.index, entry.rejection.fileName, entry.rejection.reason])).toEqual([
      [1, 'bad.gif', 'UnsupportedType'],
      [3, 'big.png', 'TooLarge'],
      [4, 'ok3.webp', 'CapExceeded'],
    ]);
  });

  it('keeps every file’s original pick index, so the merged list stays in drop order', () => {
    const plan = planUpload([file('bad.gif', 1000, 'image/gif'), file('ok.webp'), file('over.webp')], 1);
    expect(plan.accepted.map((entry) => entry.index)).toEqual([1]);
    expect(plan.rejected.map((entry) => entry.index)).toEqual([0, 2]);
  });
});

describe('buildUploadOutcome', () => {
  it('counts only the submitted files and matches rejections by name, in submission order', () => {
    const outcome = buildUploadOutcome(['one.webp', 'two.webp', 'three.webp'], {
      uploaded: [imageFixture('one', 1)],
      rejected: [
        { fileName: 'three.webp', reason: 'UnreadableOrOversizedDimensions' },
        { fileName: 'two.webp', reason: 'UnsupportedType' },
      ],
    });

    expect(outcome.attempted).toBe(3);
    expect(outcome.uploaded.map((image) => image.id)).toEqual(['one']);
    expect(outcome.rejected).toEqual([
      { fileName: 'two.webp', reason: 'UnsupportedType' },
      { fileName: 'three.webp', reason: 'UnreadableOrOversizedDimensions' },
    ]);
  });

  it('sorts uploaded images by SortOrder', () => {
    const outcome = buildUploadOutcome(['x', 'y'], {
      uploaded: [imageFixture('late', 9), imageFixture('early', 4)],
      rejected: [],
    });
    expect(outcome.uploaded.map((image) => image.id)).toEqual(['early', 'late']);
  });

  it('keeps a rejection naming a file that was not submitted rather than dropping it', () => {
    const outcome = buildUploadOutcome(['a.webp'], {
      uploaded: [],
      rejected: [{ fileName: 'ghost.webp', reason: 'CapExceeded' }],
    });
    expect(outcome.rejected).toEqual([{ fileName: 'ghost.webp', reason: 'CapExceeded' }]);
  });

  it('is a clean outcome when every submitted file landed', () => {
    const outcome = buildUploadOutcome(['a.webp'], { uploaded: [imageFixture('a', 1)], rejected: [] });
    expect(outcome.rejected).toEqual([]);
    expect(outcome.attempted).toBe(1);
  });
});

describe('upload copy', () => {
  it('wrong type names the file inline and lists the accepted formats', () => {
    expect(uploadRejectionCopy({ fileName: 'swamp.bmp', reason: 'UnsupportedType' })).toEqual({
      message: "swamp.bmp isn't a supported image type — only JPG, PNG, and WebP are allowed.",
      inlineName: true,
    });
  });

  it('too large uses Skyler’s verbatim copy, with the filename as a separate label', () => {
    expect(uploadRejectionCopy({ fileName: 'big.png', reason: 'TooLarge' })).toEqual({
      message: 'File too large to upload. Images must be 2MB or less in size.',
      inlineName: false,
    });
  });

  it('over the cap names the file inline', () => {
    expect(uploadRejectionCopy({ fileName: 'eleven.webp', reason: 'CapExceeded' })).toEqual({
      message: "eleven.webp wasn't added — over the 10-image limit.",
      inlineName: true,
    });
  });

  // Kept because R3's decision rests on it: the two server-only reasons reach the user through
  // this branch, never through per-file modal copy.
  it.each(['UnreadableOrOversizedDimensions', 'SomethingNew'])('%s falls back to the generic copy', (reason) => {
    expect(uploadRejectionCopy({ fileName: 'x.png', reason })).toEqual({
      message: 'File failed to upload. Please try again.',
      inlineName: false,
    });
  });
});

describe('post-submit toast copy (design.md §7.6)', () => {
  const rejections = (...names: string[]) => names.map((fileName) => ({ fileName, reason: 'UnsupportedType' }));

  it('is silent on a clean submit and when nothing landed', () => {
    expect(uploadPartialFailureToast({ attempted: 3, uploaded: [a, b, c], rejected: [] })).toBeNull();
    expect(uploadPartialFailureToast({ attempted: 2, uploaded: [], rejected: rejections('x.png') })).toBeNull();
  });

  it('one failure uses the singular form', () => {
    expect(
      uploadPartialFailureToast({ attempted: 5, uploaded: [a, b, c, imageFixture('d', 4)], rejected: rejections('a.png') }),
    ).toBe("Added 4 of 5 images. This one couldn't be added: a.png.");
  });

  it('two or three failures name them all, with no remainder clause', () => {
    expect(uploadPartialFailureToast({ attempted: 5, uploaded: [a, b, c], rejected: rejections('a.png', 'b.png') })).toBe(
      "Added 3 of 5 images. These couldn't be added: a.png, b.png.",
    );
    expect(
      uploadPartialFailureToast({ attempted: 5, uploaded: [a, b], rejected: rejections('a.png', 'b.png', 'c.png') }),
    ).toBe("Added 2 of 5 images. These couldn't be added: a.png, b.png, c.png.");
  });

  it('four or more truncates at three names and counts the rest — design.md §7.6’s worked example', () => {
    expect(
      uploadPartialFailureToast({
        attempted: 9,
        uploaded: [a, b],
        rejected: rejections('a.png', 'b.png', 'c.png', 'd.png', 'e.png', 'f.png', 'g.png'),
      }),
    ).toBe("Added 2 of 9 images. These couldn't be added: a.png, b.png, c.png and 4 more.");
  });

  it('a remainder of one reads "and 1 more."', () => {
    expect(
      uploadPartialFailureToast({ attempted: 5, uploaded: [a], rejected: rejections('a.png', 'b.png', 'c.png', 'd.png') }),
    ).toBe("Added 1 of 5 images. These couldn't be added: a.png, b.png, c.png and 1 more.");
  });

  it('the total-failure toast names no files', () => {
    expect(UPLOAD_TOTAL_FAILURE_TOAST).toBe("Something went wrong and your images weren't added. Please try again.");
  });
});
