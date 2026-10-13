using Microsoft.EntityFrameworkCore;
using MonsterOfTheWeek.Api.Data;
using MonsterOfTheWeek.Api.Data.Entities;
using SkiaSharp;

namespace MonsterOfTheWeek.Api.Services.ResourceImages;

/// <summary>
/// See <see cref="IResourceImageService"/> for scope. Talks to <see cref="MotwDbContext"/>
/// directly rather than through a per-domain repository (phases.md §1 item 4) — no single
/// repository owns Monsters, Minions, Bystanders, and Locations, and this service is the one
/// place design.md §1.3 already says the cross-cutting validation/cap logic belongs.
/// </summary>
public sealed class ResourceImageService(MotwDbContext dbContext) : IResourceImageService
{
    // design.md §0/§7: 2 MB cap, read as 2 MiB (2,097,152 bytes) — the exact byte count the
    // per-file size check and the frontend's copy both need to agree on.
    private const int MaxFileSizeBytes = 2 * 1024 * 1024;

    // design.md §1.4: 10 images per owner.
    private const int MaxImagesPerOwner = 10;

    // Bowser's decompression-bomb guard (phases.md §1 item 7): comfortably above the fixed
    // 1024x1024 design.md expects from fal-image-gen, with real headroom for a manually-sourced
    // image, but far short of a canvas that turns a 2 MB file into a multi-gigabyte decode.
    private const int MaxDimensionPixels = 4096;

    // design.md §2.1: a clean 4x downscale of the fixed 1024x1024 source.
    private const int ThumbnailSizePixels = 256;

    // Thumbnails are navigational/decorative (design.md §2.1), not archival — a mid-range JPEG
    // quality keeps the derived blob small without visible banding at list-row/peek size.
    private const int ThumbnailJpegQuality = 85;

    public async Task<ServiceResult<ResourceImageUploadResult>> UploadAsync(
        DomainOwnerType ownerType,
        Guid ownerId,
        IReadOnlyList<ResourceImageUploadFile> files,
        CancellationToken cancellationToken)
    {
        if (!await OwnerExistsAsync(ownerType, ownerId, cancellationToken))
        {
            return ServiceResult<ResourceImageUploadResult>.NotFound($"{ownerType} {ownerId} was not found.");
        }

        // Read once per batch, not once per file: the cap check and SortOrder assignment both
        // need the owner's current state, and re-reading it per file would just be the same
        // query run N times for the same answer within a single request. (The race this leaves
        // between two concurrent *requests* is accepted, not hardened — phases.md §3.3.)
        var acceptedCount = await dbContext.ResourceImages
            .CountAsync(i => i.OwnerType == ownerType && i.OwnerId == ownerId, cancellationToken);
        var nextSortOrder = 1 + await dbContext.ResourceImages
            .Where(i => i.OwnerType == ownerType && i.OwnerId == ownerId)
            .Select(i => (int?)i.SortOrder)
            .MaxAsync(cancellationToken) ?? 1;

        var uploaded = new List<ResourceImage>();
        var rejected = new List<RejectedResourceImage>();

        foreach (var file in files)
        {
            var (reason, contentType, width, height) = Validate(file);
            if (reason is { } rejectionReason)
            {
                rejected.Add(new RejectedResourceImage(file.FileName, rejectionReason));
                continue;
            }

            // Cap is checked last, against files that are otherwise valid — design.md §7.4's
            // worked example ("accept the first 2... reject the remaining 3") is a count of
            // valid files reaching the cap, not a raw positional index that would waste a
            // CapExceeded rejection on a file that was invalid anyway.
            if (acceptedCount >= MaxImagesPerOwner)
            {
                rejected.Add(new RejectedResourceImage(file.FileName, ResourceImageRejectionReason.CapExceeded));
                continue;
            }

            var image = new ResourceImage
            {
                OwnerType = ownerType,
                OwnerId = ownerId,
                FileName = file.FileName,
                ContentType = contentType!,
                SizeBytes = file.Content.Length,
                Width = width,
                Height = height,
                ImageBytes = file.Content,
                ThumbnailBytes = TryGenerateThumbnail(file.Content),
                SortOrder = nextSortOrder,
                CreatedAt = DateTimeOffset.UtcNow,
            };

            uploaded.Add(image);
            dbContext.ResourceImages.Add(image);
            acceptedCount++;
            nextSortOrder++;
        }

        // One SaveChangesAsync for the whole batch (phases.md Phase 2), not one per file — this
        // app has no BeginTransactionAsync precedent anywhere, so a single atomic SaveChanges
        // call is what keeps a multi-file batch from landing partially-persisted on a mid-batch
        // exception. Skipped entirely when nothing was accepted, so an all-rejected batch never
        // touches the database.
        if (uploaded.Count > 0)
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        return ServiceResult<ResourceImageUploadResult>.Success(new ResourceImageUploadResult(uploaded, rejected));
    }

    public async Task<Guid?> GetPrimaryImageIdAsync(
        DomainOwnerType ownerType,
        Guid ownerId,
        CancellationToken cancellationToken)
    {
        var explicitPrimaryImageId = await GetExplicitPrimaryImageIdAsync(ownerType, ownerId, cancellationToken);
        if (explicitPrimaryImageId is not null)
        {
            return explicitPrimaryImageId;
        }

        // Null means "no explicit choice" (design.md §1.2) — derive the first-uploaded image.
        // ThenBy(Id) is the deterministic tie-break the accepted SortOrder race (phases.md §3.3)
        // makes necessary: without it, two images tied on SortOrder could be picked differently
        // here than by Phase 4's list projection, which must implement this exact same rule.
        return await dbContext.ResourceImages
            .Where(i => i.OwnerType == ownerType && i.OwnerId == ownerId)
            .OrderBy(i => i.SortOrder).ThenBy(i => i.Id)
            .Select(i => (Guid?)i.Id)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task DeleteAllForOwnerAsync(
        DomainOwnerType ownerType,
        Guid ownerId,
        CancellationToken cancellationToken)
    {
        await dbContext.ResourceImages
            .Where(i => i.OwnerType == ownerType && i.OwnerId == ownerId)
            .ExecuteDeleteAsync(cancellationToken);
    }

    public async Task<ServiceResult<IReadOnlyList<ResourceImage>>> ListAsync(
        DomainOwnerType ownerType,
        Guid ownerId,
        CancellationToken cancellationToken)
    {
        if (!await OwnerExistsAsync(ownerType, ownerId, cancellationToken))
        {
            return ServiceResult<IReadOnlyList<ResourceImage>>.NotFound($"{ownerType} {ownerId} was not found.");
        }

        var images = await dbContext.ResourceImages
            .AsNoTracking()
            .Where(i => i.OwnerType == ownerType && i.OwnerId == ownerId)
            .OrderBy(i => i.SortOrder).ThenBy(i => i.Id)
            .ToListAsync(cancellationToken);

        return ServiceResult<IReadOnlyList<ResourceImage>>.Success(images);
    }

    public Task<ResourceImage?> GetImageAsync(
        DomainOwnerType ownerType,
        Guid ownerId,
        Guid imageId,
        CancellationToken cancellationToken) =>
        dbContext.ResourceImages
            .AsNoTracking()
            .FirstOrDefaultAsync(
                i => i.OwnerType == ownerType && i.OwnerId == ownerId && i.Id == imageId,
                cancellationToken);

    public async Task<bool> DeleteAsync(
        DomainOwnerType ownerType,
        Guid ownerId,
        Guid imageId,
        CancellationToken cancellationToken)
    {
        var deleted = await dbContext.ResourceImages
            .Where(i => i.OwnerType == ownerType && i.OwnerId == ownerId && i.Id == imageId)
            .ExecuteDeleteAsync(cancellationToken);
        return deleted > 0;
    }

    public async Task<bool> SetPrimaryAsync(
        DomainOwnerType ownerType,
        Guid ownerId,
        Guid imageId,
        CancellationToken cancellationToken)
    {
        // Confirmed before the write so a stale/non-owned imageId is a clean false (the caller's
        // 404), never an FK violation surfacing as a 500 (design.md §3) — including the race
        // where the image was deleted between the client's last read and this call.
        var belongsToOwner = await dbContext.ResourceImages
            .AnyAsync(i => i.OwnerType == ownerType && i.OwnerId == ownerId && i.Id == imageId, cancellationToken);
        if (!belongsToOwner)
        {
            return false;
        }

        await SetPrimaryImageIdAsync(ownerType, ownerId, imageId, cancellationToken);
        return true;
    }

    /// <summary>
    /// <b>The default arm here and in the two switches below became reachable at U0</b>
    /// (endpoint-unification.md §2.6.1). Under the old four-member <c>ResourceOwnerType</c> all
    /// four arms were covered, so <c>_ =&gt;</c> was dead by exhaustion; under the merged
    /// five-member <see cref="DomainOwnerType"/>, <c>Mystery</c> is a value any caller can write.
    ///
    /// <para>
    /// <b>It throws on purpose — do not "fix" it with a <c>Mystery =&gt; false</c> arm.</b> That
    /// arm would be a true statement today and a permanent, silent lie the day mystery images
    /// ships: it compiles, it passes, and it answers "this mystery has no images, and never will."
    /// The throw fails in the opposite direction — loudly, at the exact three lines that would need
    /// a real query (§2.6.2). No user can reach it: the route constraint rejects <c>mysteries</c>
    /// before any application code runs, so this is a signal to a developer, not a response.
    /// </para>
    ///
    /// <para>
    /// This method dominates the other two in every call path that exists — <c>UploadAsync</c> and
    /// <c>ListAsync</c> call it first, and nothing reaches <c>SetPrimaryImageIdAsync</c> without a
    /// stored row that <c>UploadAsync</c> would have refused to write. The other two throws are
    /// backstops behind this one, kept because a backstop that is never hit costs nothing.
    /// </para>
    /// </summary>
    private Task<bool> OwnerExistsAsync(DomainOwnerType ownerType, Guid ownerId, CancellationToken cancellationToken) =>
        ownerType switch
        {
            DomainOwnerType.Monster => dbContext.Monsters.AnyAsync(m => m.Id == ownerId, cancellationToken),
            DomainOwnerType.Minion => dbContext.Minions.AnyAsync(m => m.Id == ownerId, cancellationToken),
            DomainOwnerType.Bystander => dbContext.Bystanders.AnyAsync(b => b.Id == ownerId, cancellationToken),
            DomainOwnerType.Location => dbContext.Locations.AnyAsync(l => l.Id == ownerId, cancellationToken),
            _ => throw new ArgumentOutOfRangeException(nameof(ownerType), ownerType, "Unknown owner type."),
        };

    private Task<Guid?> GetExplicitPrimaryImageIdAsync(DomainOwnerType ownerType, Guid ownerId, CancellationToken cancellationToken) =>
        ownerType switch
        {
            DomainOwnerType.Monster => dbContext.Monsters.Where(m => m.Id == ownerId).Select(m => m.PrimaryImageId).FirstOrDefaultAsync(cancellationToken),
            DomainOwnerType.Minion => dbContext.Minions.Where(m => m.Id == ownerId).Select(m => m.PrimaryImageId).FirstOrDefaultAsync(cancellationToken),
            DomainOwnerType.Bystander => dbContext.Bystanders.Where(b => b.Id == ownerId).Select(b => b.PrimaryImageId).FirstOrDefaultAsync(cancellationToken),
            DomainOwnerType.Location => dbContext.Locations.Where(l => l.Id == ownerId).Select(l => l.PrimaryImageId).FirstOrDefaultAsync(cancellationToken),
            _ => throw new ArgumentOutOfRangeException(nameof(ownerType), ownerType, "Unknown owner type."),
        };

    /// <summary>
    /// Bulk update, not a load-mutate-save round trip — matches the <c>ExecuteDeleteAsync</c>
    /// convention this codebase's repositories already use for single-column writes scoped to
    /// one row, and avoids needing the owner entity tracked just to flip one FK.
    /// </summary>
    private Task<int> SetPrimaryImageIdAsync(DomainOwnerType ownerType, Guid ownerId, Guid imageId, CancellationToken cancellationToken) =>
        ownerType switch
        {
            DomainOwnerType.Monster => dbContext.Monsters.Where(m => m.Id == ownerId)
                .ExecuteUpdateAsync(s => s.SetProperty(m => m.PrimaryImageId, imageId), cancellationToken),
            DomainOwnerType.Minion => dbContext.Minions.Where(m => m.Id == ownerId)
                .ExecuteUpdateAsync(s => s.SetProperty(m => m.PrimaryImageId, imageId), cancellationToken),
            DomainOwnerType.Bystander => dbContext.Bystanders.Where(b => b.Id == ownerId)
                .ExecuteUpdateAsync(s => s.SetProperty(b => b.PrimaryImageId, imageId), cancellationToken),
            DomainOwnerType.Location => dbContext.Locations.Where(l => l.Id == ownerId)
                .ExecuteUpdateAsync(s => s.SetProperty(l => l.PrimaryImageId, imageId), cancellationToken),
            _ => throw new ArgumentOutOfRangeException(nameof(ownerType), ownerType, "Unknown owner type."),
        };

    /// <summary>
    /// Per-file gate, evaluated in this order — size first (free, no bytes need reading to
    /// compare a length), then type (a cheap magic-byte sniff), then dimensions (the only check
    /// that needs a decode, even a header-only one). Not specified by design.md as an evaluation
    /// order for a file that fails more than one check at once; this is Bowser's choice,
    /// documented here rather than left implicit.
    /// </summary>
    private static (ResourceImageRejectionReason? Reason, string? ContentType, int Width, int Height) Validate(
        ResourceImageUploadFile file)
    {
        if (file.Content.Length > MaxFileSizeBytes)
        {
            return (ResourceImageRejectionReason.TooLarge, null, 0, 0);
        }

        var contentType = ResourceImageTypeSniffer.DetectContentType(file.Content);
        if (contentType is null)
        {
            return (ResourceImageRejectionReason.UnsupportedType, null, 0, 0);
        }

        // Header-only: SKBitmap.DecodeBounds never decodes pixel data, which is exactly what
        // makes it safe to call on a file whose declared dimensions might otherwise blow up a
        // full decode. SKImageInfo.Empty (Width/Height both 0) is what SkiaSharp returns for a
        // file it can't even parse a header from — folded into the same rejection reason as
        // "declared too large," per the reason's own name. A corrupt-but-signature-matching file
        // (passed the magic-byte sniff, but truncated or otherwise malformed) is a real input a
        // hostile or simply broken upload can produce, so the native decode is not trusted to
        // fail cleanly — any exception here is the same rejection, not an unhandled fault that
        // would otherwise take the rest of the batch down with it.
        SKImageInfo bounds;
        try
        {
            bounds = SKBitmap.DecodeBounds(file.Content);
        }
        catch
        {
            return (ResourceImageRejectionReason.UnreadableOrOversizedDimensions, null, 0, 0);
        }

        if (bounds.Width <= 0 || bounds.Height <= 0 ||
            bounds.Width > MaxDimensionPixels || bounds.Height > MaxDimensionPixels)
        {
            return (ResourceImageRejectionReason.UnreadableOrOversizedDimensions, null, 0, 0);
        }

        return (null, contentType, bounds.Width, bounds.Height);
    }

    /// <summary>
    /// Best-effort: a thumbnail that fails to generate does not fail the upload it belongs to
    /// (design.md §2.1's stated fallback — a null <c>ThumbnailBytes</c> means the eventual
    /// <c>/thumbnail</c> read falls back to streaming <c>ImageBytes</c> instead). The dimension
    /// gate in <see cref="Validate"/> has already bounded how expensive this decode can be.
    /// </summary>
    private static byte[]? TryGenerateThumbnail(byte[] content)
    {
        try
        {
            using var bitmap = SKBitmap.Decode(content);
            if (bitmap is null)
            {
                return null;
            }

            using var resized = bitmap.Resize(new SKImageInfo(ThumbnailSizePixels, ThumbnailSizePixels), SKSamplingOptions.Default);
            if (resized is null)
            {
                return null;
            }

            using var image = SKImage.FromBitmap(resized);
            using var encoded = image.Encode(SKEncodedImageFormat.Jpeg, ThumbnailJpegQuality);
            return encoded?.ToArray();
        }
        catch
        {
            // Any decode/encode failure here is non-fatal by design — see the summary above.
            return null;
        }
    }
}
