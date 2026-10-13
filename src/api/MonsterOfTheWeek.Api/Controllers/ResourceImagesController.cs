using Microsoft.AspNetCore.Mvc;
using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Data.Entities;
using MonsterOfTheWeek.Api.Services;
using MonsterOfTheWeek.Api.Services.ResourceImages;

namespace MonsterOfTheWeek.Api.Controllers;

/// <summary>
/// The one controller behind all four image-owning domains
/// (<c>docs/resource-images/endpoint-unification.md</c> §3, U2). Replaces <b>twenty-four</b>
/// actions across <c>MonstersController</c>, <c>MinionsController</c>, <c>LocationsController</c>
/// and <c>BystandersController</c> with six.
///
/// <para>
/// <b>Not one URL changes.</b> That is the property this whole refactor is built on and the reason
/// it is cheaper than the custom-move switchover it copies: the client already assembles every
/// image URL from one segment map in <c>core/resource-images.ts</c>, the service was already
/// cross-domain, and there is no schema, no migration and no frontend edit. U1's four-owner
/// endpoint matrix is byte-identical before and after this commit and green both times — which is
/// a stronger statement about this change than any assertion written inside it could be.
/// </para>
///
/// <para>
/// <b>What it costs, stated rather than buried</b> (§0, §2.7): the legal owner set moves out of the
/// route table into a regex plus a dictionary, so <i>"which owners have images"</i> stops being
/// readable from <c>/swagger</c>. Skyler accepted that loss rather than build an
/// <c>IOperationFilter</c> for it (§11 Q5); U3's drift test is what replaces the thing Swagger used
/// to show for free.
/// </para>
///
/// <para>
/// <b>Error mapping follows <c>ToErrorResult</c>, which two of the four controllers it replaces
/// already used</b> (§1.2, Q4). <c>LocationsController</c> and <c>BystandersController</c> had no
/// such pair at all and inlined <c>return NotFound()</c>, collapsing every error to 404. One
/// controller can only have one policy, and adopting the stricter one <b>cannot change a single
/// response today</b>: only <c>UploadAsync</c> and <c>ListAsync</c> return a <c>ServiceResult</c>
/// at all, and the only failure constructed anywhere in <c>ResourceImageService</c> is
/// <c>NotFound</c>. It is also the policy that stays correct if a <c>Validation</c> error is ever
/// added, which the inlined one would silently mistranslate.
/// </para>
/// </summary>
[ApiController]
public sealed class ResourceImagesController(IResourceImageService resourceImageService) : ControllerBase
{
    /// <summary>
    /// The four legal owner segments, written down once.
    ///
    /// <para>
    /// <b>Four, not five, and that is a decision rather than an omission</b> (§2.6.3). The enum
    /// this maps into has five members since U0; <c>Mystery</c> is absent here because a Mystery
    /// has no <c>PrimaryImageId</c>, no image FK and no images endpoint. So
    /// <c>GET /api/mysteries/{id}/images</c> stays exactly what it is today — a <b>routing</b> 404
    /// with a zero-byte body, answered by <c>Program.cs</c>'s catch-all, never reaching this file.
    /// A route constraint's job is to express what the <i>feature</i> serves, not what the
    /// <i>domain</i> contains, and it is the right place for that because it fails <b>closed</b>.
    /// </para>
    ///
    /// <para>
    /// <b>Anchored deliberately.</b> <c>RegexInlineRouteConstraint</c> matches with <c>IsMatch</c>,
    /// which is unanchored, so without <c>^...$</c> the segment <c>xmonstersx</c> matches, reaches
    /// <see cref="OwnerTypeOf"/>, and 500s instead of 404ing. Measured on a running host at the
    /// custom-move equivalent, not assumed. The anchors are invisible in review and the whole
    /// route-table isolation argument rests on them.
    /// </para>
    ///
    /// <para>
    /// A <c>const string</c> so all six actions share one literal and U3's drift test can read the
    /// alternation back <b>off the <c>[Http*]</c> attributes by reflection</b> rather than off this
    /// constant — so an action given its own literal template fails too.
    /// </para>
    /// </summary>
    private const string OwnerSegment = "{owner:regex(^(monsters|minions|locations|bystanders)$)}";

    private const string CollectionRoute = "api/" + OwnerSegment + "/{ownerId:guid}/images";
    private const string ItemRoute = CollectionRoute + "/{imageId:guid}";

    /// <summary>One copy of what was four identical <c>private const</c> pairs, one per controller.</summary>
    private const string ImageCacheControl = "private, max-age=31536000, immutable";

    private const long ImageRequestSizeLimitBytes = 24 * 1024 * 1024;

    /// <summary>
    /// <b><see cref="StringComparer.OrdinalIgnoreCase"/> is load-bearing, not tidiness.</b> Route
    /// matching is case-insensitive <i>including literal segments</i>, and the constraint hands the
    /// action the caller's own casing — so <c>GET /api/MONSTERS/{id}/images</c>, which answers
    /// <c>200</c> on the shipped per-domain routes, arrives here as <c>owner == "MONSTERS"</c>. An
    /// ordinal dictionary would turn a working URL into a 500. Mutation-tested at the custom-move
    /// equivalent and probed against the real host here.
    ///
    /// <para>
    /// <b>Transcribed, not derived from <c>IResourceImageService.ImageOwnerTypes</c>.</b> Building
    /// it from the declared set would make the two one fact wearing two hats, and U3's assertion
    /// that the alternation, this dictionary and that set agree would compare a thing with itself.
    /// Three independent statements is what makes that comparison worth running.
    /// </para>
    /// </summary>
    private static readonly IReadOnlyDictionary<string, DomainOwnerType> Owners =
        new Dictionary<string, DomainOwnerType>(StringComparer.OrdinalIgnoreCase)
        {
            ["monsters"] = DomainOwnerType.Monster,
            ["minions"] = DomainOwnerType.Minion,
            ["locations"] = DomainOwnerType.Location,
            ["bystanders"] = DomainOwnerType.Bystander,
        };

    [HttpGet(CollectionRoute)]
    public async Task<ActionResult<IReadOnlyList<ResourceImageResponse>>> GetImages(
        string owner,
        Guid ownerId,
        CancellationToken cancellationToken)
    {
        var ownerType = OwnerTypeOf(owner);
        var result = await resourceImageService.ListAsync(ownerType, ownerId, cancellationToken);
        if (!result.IsSuccess)
        {
            return ToErrorResult(result.Error!);
        }

        var primaryId = await resourceImageService.GetPrimaryImageIdAsync(ownerType, ownerId, cancellationToken);
        return Ok(result.Value!.Select(i => i.ToResponse(i.Id == primaryId)).ToList());
    }

    // Deliberately not the ToActionResult<T>(ServiceResult<T>) convention the other actions use —
    // the response is precise-per-file (design.md §3: an upload batch can be partially accepted),
    // not a single pass/fail, so don't "fix" this to match the others.
    //
    // Both attributes are per-action endpoint filters with no host coupling, so they survive the
    // move intact — but "survived" is a gate, not an assumption: U1's matrix runs the 24 MiB limit
    // end to end for all four owners.
    [HttpPost(CollectionRoute)]
    [RequestSizeLimit(ImageRequestSizeLimitBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = ImageRequestSizeLimitBytes)]
    public async Task<IActionResult> UploadImages(
        string owner,
        Guid ownerId,
        [FromForm] IFormFileCollection files,
        CancellationToken cancellationToken)
    {
        var ownerType = OwnerTypeOf(owner);
        var uploadFiles = await files.ToUploadFilesAsync(cancellationToken);
        var result = await resourceImageService.UploadAsync(ownerType, ownerId, uploadFiles, cancellationToken);
        if (!result.IsSuccess)
        {
            return ToErrorResult(result.Error!);
        }

        var primaryId = result.Value!.Uploaded.Count > 0
            ? await resourceImageService.GetPrimaryImageIdAsync(ownerType, ownerId, cancellationToken)
            : (Guid?)null;

        var response = new ResourceImageUploadResponse(
            result.Value!.Uploaded.Select(i => i.ToResponse(i.Id == primaryId)).ToList(),
            result.Value!.Rejected.Select(r => r.ToResponse()).ToList());

        // design.md §3: 201 if anything uploaded (even alongside rejections — a 3-for-5 batch is
        // a success with detail, not an error); 400 only if every file in the batch was rejected.
        return result.Value!.Uploaded.Count > 0
            ? StatusCode(StatusCodes.Status201Created, response)
            : BadRequest(response);
    }

    [HttpGet(ItemRoute + "/file")]
    public async Task<IActionResult> GetImageFile(
        string owner,
        Guid ownerId,
        Guid imageId,
        CancellationToken cancellationToken)
    {
        var image = await resourceImageService.GetImageAsync(OwnerTypeOf(owner), ownerId, imageId, cancellationToken);
        if (image is null)
        {
            return NotFound();
        }

        Response.Headers.CacheControl = ImageCacheControl;
        return File(image.ImageBytes, image.ContentType);
    }

    [HttpGet(ItemRoute + "/thumbnail")]
    public async Task<IActionResult> GetImageThumbnail(
        string owner,
        Guid ownerId,
        Guid imageId,
        CancellationToken cancellationToken)
    {
        var image = await resourceImageService.GetImageAsync(OwnerTypeOf(owner), ownerId, imageId, cancellationToken);
        if (image is null)
        {
            return NotFound();
        }

        Response.Headers.CacheControl = ImageCacheControl;

        // design.md §2.1's stated fallback: a thumbnail that failed to generate at upload time
        // streams the original instead of surfacing a missing-thumbnail state. This branch existed
        // in four copies with no test reaching any of them until U1 gave it one — a branch a
        // refactor could otherwise have dropped silently.
        return image.ThumbnailBytes is null
            ? File(image.ImageBytes, image.ContentType)
            : File(image.ThumbnailBytes, "image/jpeg");
    }

    [HttpDelete(ItemRoute)]
    public async Task<IActionResult> DeleteImage(
        string owner,
        Guid ownerId,
        Guid imageId,
        CancellationToken cancellationToken) =>
        await resourceImageService.DeleteAsync(OwnerTypeOf(owner), ownerId, imageId, cancellationToken)
            ? NoContent()
            : NotFound();

    [HttpPut(ItemRoute + "/primary")]
    public async Task<IActionResult> SetPrimaryImage(
        string owner,
        Guid ownerId,
        Guid imageId,
        CancellationToken cancellationToken) =>
        await resourceImageService.SetPrimaryAsync(OwnerTypeOf(owner), ownerId, imageId, cancellationToken)
            ? NoContent()
            : NotFound();

    /// <summary>
    /// <b>Indexer, not <c>TryGetValue</c>, deliberately.</b> The route constraint has already
    /// rejected every segment that is not one of the four, so a miss here is not a client error —
    /// it is the regex and <see cref="Owners"/> having drifted apart, which is a bug in this file
    /// and should surface as a 500 rather than be laundered into a 404 that looks like a stale id.
    /// U3's drift test is what makes that unreachable; this throw is the backstop, not the guard.
    /// </summary>
    private static DomainOwnerType OwnerTypeOf(string owner) => Owners[owner];

    // Copied from MonstersController/MinionsController, which keep their own private pair for
    // their non-image actions — there is no shared base class or extension method, and starting
    // one in a phase whose point is subtraction would be its own change.
    private ActionResult ToErrorResult(ServiceError error) =>
        error.Type switch
        {
            ServiceErrorType.NotFound => NotFound(),
            ServiceErrorType.Validation => BadRequest(new { message = error.Message }),
            _ => BadRequest()
        };
}
