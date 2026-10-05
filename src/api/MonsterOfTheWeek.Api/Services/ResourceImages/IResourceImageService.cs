using MonsterOfTheWeek.Api.Data.Entities;

namespace MonsterOfTheWeek.Api.Services.ResourceImages;

/// <summary>
/// Why this reason exists and what it means: <c>design.md</c> §3/§7.
/// </summary>
public enum ResourceImageRejectionReason
{
    /// <summary>Magic-byte sniffing did not recognize the file as JPEG, PNG, or WebP.</summary>
    UnsupportedType,

    /// <summary>The file is larger than the 2 MiB (2,097,152-byte) per-file cap.</summary>
    TooLarge,

    /// <summary>
    /// The owner already has (or this batch would already put it at) 10 images. Checked last,
    /// against the running count of files already accepted earlier in the same batch, in drop
    /// order — not against the pre-batch count alone (design.md §7.4).
    /// </summary>
    CapExceeded,

    /// <summary>
    /// Bowser's decompression-bomb guard (phases.md §1 item 7, not in <c>design.md</c>'s
    /// original table). Covers two cases under one name: the header-only dimension read failed
    /// outright (an unreadable/corrupt file that still passed the magic-byte sniff), or it
    /// succeeded but declared a canvas larger than the accepted cap. Either way, the full image
    /// is never decoded.
    /// </summary>
    UnreadableOrOversizedDimensions,
}

/// <summary>One file from a multipart upload batch, before any validation has run.</summary>
public sealed record ResourceImageUploadFile(string FileName, byte[] Content);

/// <summary>A file that did not make it into storage, and why.</summary>
public sealed record RejectedResourceImage(string FileName, ResourceImageRejectionReason Reason);

/// <summary>
/// The outcome of one <see cref="IResourceImageService.UploadAsync"/> call. Exact, not hedged
/// (design.md §3): every file in the batch lands in exactly one of these two lists.
/// </summary>
public sealed record ResourceImageUploadResult(
    IReadOnlyList<ResourceImage> Uploaded,
    IReadOnlyList<RejectedResourceImage> Rejected);

/// <summary>
/// The single service behind all four owner types' image sub-resources (design.md §1.3). Owner
/// existence/type validation, per-file checks, the cap, thumbnail generation, and primary
/// derivation all live here — once, not duplicated per controller.
///
/// <para>
/// Phase 2 scope: this service has no HTTP surface yet (phases.md Phase 2/Phase 3). The methods
/// here are the ones Phase 2 calls for: upload (with its validation/cap/thumbnail/derivation
/// logic), the primary-image derivation rule standing alone (reused by Phase 4's list projection
/// and, eventually, by the detail-list endpoint), and the owner-delete cleanup helper Phase 3
/// will wire into the four existing domain delete flows. Single-image delete, set-primary, and
/// the list/file/thumbnail reads are deliberately left for Phase 3, alongside the controllers
/// that are their only caller.
/// </para>
/// </summary>
public interface IResourceImageService
{
    /// <summary>
    /// Validates and stores as many of <paramref name="files"/> as the type/size/dimension
    /// checks and the 10-image cap allow, generates a thumbnail for each accepted file, and
    /// writes the whole accepted set in one <c>SaveChangesAsync</c> call. Returns
    /// <see cref="ServiceResult{T}.NotFound"/> only when the owner itself does not exist (or is
    /// not the type it claims to be) — once that's established, every file is independently
    /// accepted or rejected, never the batch as a whole.
    /// </summary>
    Task<ServiceResult<ResourceImageUploadResult>> UploadAsync(
        ResourceOwnerType ownerType,
        Guid ownerId,
        IReadOnlyList<ResourceImageUploadFile> files,
        CancellationToken cancellationToken);

    /// <summary>
    /// The one derivation rule (phases.md Phase 2): the owner's explicit <c>PrimaryImageId</c> if
    /// it is set, else the lowest-<c>SortOrder</c> image for that owner, with lowest <c>Id</c> as
    /// a deterministic tie-break for the accepted <c>SortOrder</c> race (phases.md §3.3). Returns
    /// <c>null</c> when the owner has no images at all.
    /// </summary>
    Task<Guid?> GetPrimaryImageIdAsync(
        ResourceOwnerType ownerType,
        Guid ownerId,
        CancellationToken cancellationToken);

    /// <summary>
    /// Deletes every <c>ResourceImage</c> row for this owner. Not wired into any controller yet —
    /// Phase 3 calls this from each of the four existing domain delete flows (phases.md §3.6) so a
    /// deleted Monster/Minion/Bystander/Location doesn't leave orphaned image bytes behind.
    /// </summary>
    Task DeleteAllForOwnerAsync(
        ResourceOwnerType ownerType,
        Guid ownerId,
        CancellationToken cancellationToken);
}
