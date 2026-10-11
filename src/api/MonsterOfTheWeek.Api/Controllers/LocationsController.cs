using Microsoft.AspNetCore.Mvc;
using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Data.Entities;
using MonsterOfTheWeek.Api.Services;
using MonsterOfTheWeek.Api.Services.ResourceImages;

namespace MonsterOfTheWeek.Api.Controllers;

[ApiController]
public sealed class LocationsController(ILocationService locationService, IResourceImageService resourceImageService) : ControllerBase
{
    [HttpGet("api/locations")]
    public async Task<ActionResult<IReadOnlyList<LocationListItemResponse>>> GetAll(CancellationToken cancellationToken)
    {
        var result = await locationService.GetAllAsync(cancellationToken);
        return Ok(result);
    }

    [HttpGet("api/mysteries/{mysteryId:guid}/locations")]
    public async Task<ActionResult<IReadOnlyList<LocationListItemResponse>>> GetByMystery(
        Guid mysteryId,
        CancellationToken cancellationToken)
    {
        var result = await locationService.GetByMysteryAsync(mysteryId, cancellationToken);
        if (!result.IsSuccess)
        {
            return NotFound();
        }

        return Ok(result.Value);
    }

    [HttpPost("api/mysteries/{mysteryId:guid}/locations")]
    public async Task<ActionResult<LocationDetailResponse>> Create(
        Guid mysteryId,
        [FromBody] UpsertLocationRequest request,
        CancellationToken cancellationToken)
    {
        var result = await locationService.CreateAsync(mysteryId, request, cancellationToken);
        if (!result.IsSuccess)
        {
            return result.Error!.Type switch
            {
                ServiceErrorType.NotFound => NotFound(),
                ServiceErrorType.Validation => BadRequest(new { message = result.Error.Message }),
                _ => BadRequest()
            };
        }

        return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
    }

    [HttpPost("api/locations")]
    public async Task<ActionResult<LocationDetailResponse>> Create(
        [FromBody] UpsertLocationRequest request,
        CancellationToken cancellationToken)
    {
        var result = await locationService.CreateAsync(request, cancellationToken);
        if (!result.IsSuccess)
        {
            return result.Error!.Type switch
            {
                ServiceErrorType.NotFound => NotFound(),
                ServiceErrorType.Validation => BadRequest(new { message = result.Error.Message }),
                _ => BadRequest()
            };
        }

        return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
    }

    [HttpGet("api/locations/{id:guid}")]
    public async Task<ActionResult<LocationDetailResponse>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var response = await locationService.GetByIdAsync(id, cancellationToken);
        return response is null ? NotFound() : Ok(response);
    }

    [HttpPut("api/locations/{id:guid}")]
    public async Task<ActionResult<LocationDetailResponse>> Update(
        Guid id,
        [FromBody] UpsertLocationRequest request,
        CancellationToken cancellationToken)
    {
        var result = await locationService.UpdateAsync(id, request, cancellationToken);
        if (!result.IsSuccess)
        {
            return result.Error!.Type switch
            {
                ServiceErrorType.NotFound => NotFound(),
                ServiceErrorType.Validation => BadRequest(new { message = result.Error.Message }),
                _ => BadRequest()
            };
        }

        return Ok(result.Value);
    }

    [HttpDelete("api/locations/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken) =>
        await locationService.DeleteAsync(id, cancellationToken) ? NoContent() : NotFound();

    [HttpPut("api/mysteries/{mysteryId:guid}/locations/{id:guid}")]
    public async Task<IActionResult> LinkToMystery(Guid mysteryId, Guid id, CancellationToken cancellationToken) =>
        await locationService.LinkToMysteryAsync(mysteryId, id, cancellationToken) ? NoContent() : NotFound();

    [HttpDelete("api/mysteries/{mysteryId:guid}/locations/{id:guid}")]
    public async Task<IActionResult> UnlinkFromMystery(Guid mysteryId, Guid id, CancellationToken cancellationToken) =>
        await locationService.UnlinkFromMysteryAsync(mysteryId, id, cancellationToken) ? NoContent() : NotFound();

    // Custom moves moved to CustomMovesController in Phase 2 of domain-custom-moves
    // (architecture.md §3.3). The four actions that were here hand-rolled
    // `IsSuccess ? Ok : NotFound`, which collapsed every error to 404; the new controller uses
    // the `ToErrorResult` policy the other three already used. That cannot change a single
    // response here, because every failure ICustomMoveService returns is NotFound (B9).
    // ILocationService's four custom-move methods are now called by nothing; Phase 3 removes
    // them with location_custom_moves.

    // --- Images (docs/resource-images/design.md §3, phases.md Phase 3) ---

    private const string ImageCacheControl = "private, max-age=31536000, immutable";
    private const long ImageRequestSizeLimitBytes = 24 * 1024 * 1024;

    [HttpGet("api/locations/{id:guid}/images")]
    public async Task<ActionResult<IReadOnlyList<ResourceImageResponse>>> GetImages(Guid id, CancellationToken cancellationToken)
    {
        var result = await resourceImageService.ListAsync(ResourceOwnerType.Location, id, cancellationToken);
        if (!result.IsSuccess)
        {
            return NotFound();
        }

        var primaryId = await resourceImageService.GetPrimaryImageIdAsync(ResourceOwnerType.Location, id, cancellationToken);
        return Ok(result.Value!.Select(i => i.ToResponse(i.Id == primaryId)).ToList());
    }

    [HttpGet("api/locations/{id:guid}/images/{imageId:guid}/file")]
    public async Task<IActionResult> GetImageFile(Guid id, Guid imageId, CancellationToken cancellationToken)
    {
        var image = await resourceImageService.GetImageAsync(ResourceOwnerType.Location, id, imageId, cancellationToken);
        if (image is null)
        {
            return NotFound();
        }

        Response.Headers.CacheControl = ImageCacheControl;
        return File(image.ImageBytes, image.ContentType);
    }

    [HttpGet("api/locations/{id:guid}/images/{imageId:guid}/thumbnail")]
    public async Task<IActionResult> GetImageThumbnail(Guid id, Guid imageId, CancellationToken cancellationToken)
    {
        var image = await resourceImageService.GetImageAsync(ResourceOwnerType.Location, id, imageId, cancellationToken);
        if (image is null)
        {
            return NotFound();
        }

        Response.Headers.CacheControl = ImageCacheControl;

        return image.ThumbnailBytes is null
            ? File(image.ImageBytes, image.ContentType)
            : File(image.ThumbnailBytes, "image/jpeg");
    }

    // Deliberately not this controller's usual result.IsSuccess ? Ok(...) : NotFound() shape —
    // the response is precise-per-file (design.md §3: an upload batch can be partially
    // accepted), not a single pass/fail, so don't "fix" this to match the others.
    [HttpPost("api/locations/{id:guid}/images")]
    [RequestSizeLimit(ImageRequestSizeLimitBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = ImageRequestSizeLimitBytes)]
    public async Task<IActionResult> UploadImages(Guid id, [FromForm] IFormFileCollection files, CancellationToken cancellationToken)
    {
        var uploadFiles = await files.ToUploadFilesAsync(cancellationToken);
        var result = await resourceImageService.UploadAsync(ResourceOwnerType.Location, id, uploadFiles, cancellationToken);
        if (!result.IsSuccess)
        {
            return NotFound();
        }

        var primaryId = result.Value!.Uploaded.Count > 0
            ? await resourceImageService.GetPrimaryImageIdAsync(ResourceOwnerType.Location, id, cancellationToken)
            : (Guid?)null;

        var response = new ResourceImageUploadResponse(
            result.Value!.Uploaded.Select(i => i.ToResponse(i.Id == primaryId)).ToList(),
            result.Value!.Rejected.Select(r => r.ToResponse()).ToList());

        return result.Value!.Uploaded.Count > 0
            ? StatusCode(StatusCodes.Status201Created, response)
            : BadRequest(response);
    }

    [HttpDelete("api/locations/{id:guid}/images/{imageId:guid}")]
    public async Task<IActionResult> DeleteImage(Guid id, Guid imageId, CancellationToken cancellationToken) =>
        await resourceImageService.DeleteAsync(ResourceOwnerType.Location, id, imageId, cancellationToken) ? NoContent() : NotFound();

    [HttpPut("api/locations/{id:guid}/images/{imageId:guid}/primary")]
    public async Task<IActionResult> SetPrimaryImage(Guid id, Guid imageId, CancellationToken cancellationToken) =>
        await resourceImageService.SetPrimaryAsync(ResourceOwnerType.Location, id, imageId, cancellationToken) ? NoContent() : NotFound();
}
