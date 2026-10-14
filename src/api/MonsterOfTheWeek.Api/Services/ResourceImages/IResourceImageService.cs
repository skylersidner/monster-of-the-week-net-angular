using System.Collections.Frozen;
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
    /// The owner types that can own an image — four of <see cref="DomainOwnerType"/>'s five.
    /// <c>Mystery</c> is absent because a Mystery has no <c>PrimaryImageId</c>, no
    /// <c>HasOne&lt;ResourceImage&gt;()</c> FK and no <c>idx_mysteries_primary_image_id</c>, where
    /// the other four have all three.
    ///
    /// <para>
    /// <b>This is a declared set, and it is declared because it stopped being derivable</b>
    /// (endpoint-unification.md §2.6.3). Until U0 the image-legal set was exactly
    /// <c>Enum.GetValues&lt;ResourceOwnerType&gt;()</c> — the four-member enum *was* the
    /// statement. Merging the two owner enums into one five-member <see cref="DomainOwnerType"/>
    /// turned one derived fact into one transcribed constant, and this is that constant. It lives
    /// on the image feature's own contract rather than on a controller because the service's three
    /// <c>switch</c> expressions must be asserted against it too, and a test reading a controller's
    /// internals to check a service is backwards.
    /// </para>
    ///
    /// <para>
    /// Read by the route alternation, the unified controller's segment dictionary and the drift
    /// test (U2/U3), so that "which owners have images" is stated once. A member missing from here
    /// but handled in the service — or the reverse — is what the drift test exists to catch.
    /// </para>
    /// </summary>
    public static readonly FrozenSet<DomainOwnerType> ImageOwnerTypes =
        FrozenSet.ToFrozenSet([
            DomainOwnerType.Monster,
            DomainOwnerType.Minion,
            DomainOwnerType.Bystander,
            DomainOwnerType.Location,
        ]);

    /// <summary>
    /// Validates and stores as many of <paramref name="files"/> as the type/size/dimension
    /// checks and the 10-image cap allow, generates a thumbnail for each accepted file, and
    /// writes the whole accepted set in one <c>SaveChangesAsync</c> call. Returns
    /// <see cref="ServiceResult{T}.NotFound"/> only when the owner itself does not exist (or is
    /// not the type it claims to be) — once that's established, every file is independently
    /// accepted or rejected, never the batch as a whole.
    /// </summary>
    Task<ServiceResult<ResourceImageUploadResult>> UploadAsync(
        DomainOwnerType ownerType,
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
        DomainOwnerType ownerType,
        Guid ownerId,
        CancellationToken cancellationToken);

    /// <summary>
    /// Deletes every <c>ResourceImage</c> row for this owner. Called from each of the four
    /// existing domain delete flows (phases.md §3.6) so a deleted
    /// Monster/Minion/Bystander/Location doesn't leave orphaned image bytes behind.
    /// </summary>
    Task DeleteAllForOwnerAsync(
        DomainOwnerType ownerType,
        Guid ownerId,
        CancellationToken cancellationToken);

    /// <summary>
    /// Every image for this owner, ordered by <c>SortOrder</c> (design.md §3's <c>GET
    /// .../images</c>). <see cref="ServiceResult{T}.NotFound"/> only when the owner itself
    /// doesn't exist. Returns raw entities, not response DTOs — the caller (Phase 3's
    /// controllers) maps each one to a response together with the derived primary id from
    /// <see cref="GetPrimaryImageIdAsync"/>, since "is this the primary" isn't a property of the
    /// row itself.
    /// </summary>
    Task<ServiceResult<IReadOnlyList<ResourceImage>>> ListAsync(
        DomainOwnerType ownerType,
        Guid ownerId,
        CancellationToken cancellationToken);

    /// <summary>
    /// The one image, if and only if it belongs to this owner — <c>null</c> otherwise, which the
    /// caller (the <c>GET .../file</c> and <c>GET .../thumbnail</c> actions) turns into a 404
    /// rather than ever serving an image through the wrong owner's URL.
    /// </summary>
    Task<ResourceImage?> GetImageAsync(
        DomainOwnerType ownerType,
        Guid ownerId,
        Guid imageId,
        CancellationToken cancellationToken);

    /// <summary>
    /// Deletes one image row. The only write is the row delete — no "if this was primary, clear
    /// it" branch; the `SetNull` FK from Phase 1 does that (phases.md §2.8's auto-promote rule:
    /// deleting the primary is always allowed, no restriction). Returns <c>false</c> when the
    /// image doesn't exist or doesn't belong to this owner, which the caller turns into a 404.
    /// </summary>
    Task<bool> DeleteAsync(
        DomainOwnerType ownerType,
        Guid ownerId,
        Guid imageId,
        CancellationToken cancellationToken);

    /// <summary>
    /// Sets the owner's explicit <c>PrimaryImageId</c> to <paramref name="imageId"/>. Returns
    /// <c>false</c> — not an exception, and never an FK violation surfacing as a 500 — when the
    /// image doesn't exist or doesn't belong to this owner, including the race where it was
    /// deleted between the client's last read and this call (design.md §3).
    /// </summary>
    Task<bool> SetPrimaryAsync(
        DomainOwnerType ownerType,
        Guid ownerId,
        Guid imageId,
        CancellationToken cancellationToken);
}
