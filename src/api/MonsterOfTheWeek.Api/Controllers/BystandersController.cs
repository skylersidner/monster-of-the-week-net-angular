using Microsoft.AspNetCore.Mvc;
using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Data.Entities;
using MonsterOfTheWeek.Api.Services;
using MonsterOfTheWeek.Api.Services.ResourceImages;

namespace MonsterOfTheWeek.Api.Controllers;

[ApiController]
public sealed class BystandersController(IBystanderService bystanderService, IResourceImageService resourceImageService) : ControllerBase
{
    [HttpGet("api/bystanders")]
    public async Task<ActionResult<IReadOnlyList<BystanderListItemResponse>>> GetAll(CancellationToken cancellationToken)
    {
        var result = await bystanderService.GetAllAsync(cancellationToken);
        return Ok(result);
    }

    [HttpGet("api/mysteries/{mysteryId:guid}/bystanders")]
    public async Task<ActionResult<IReadOnlyList<BystanderListItemResponse>>> GetByMystery(
        Guid mysteryId,
        CancellationToken cancellationToken)
    {
        var result = await bystanderService.GetByMysteryAsync(mysteryId, cancellationToken);
        return result.IsSuccess ? Ok(result.Value) : NotFound();
    }

    [HttpPost("api/mysteries/{mysteryId:guid}/bystanders")]
    public async Task<ActionResult<BystanderDetailResponse>> Create(
        Guid mysteryId,
        [FromBody] UpsertBystanderRequest request,
        CancellationToken cancellationToken)
    {
        var result = await bystanderService.CreateAsync(mysteryId, request, cancellationToken);
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

    [HttpPost("api/bystanders")]
    public async Task<ActionResult<BystanderDetailResponse>> Create(
        [FromBody] UpsertBystanderRequest request,
        CancellationToken cancellationToken)
    {
        var result = await bystanderService.CreateAsync(request, cancellationToken);
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

    [HttpGet("api/bystanders/{id:guid}")]
    public async Task<ActionResult<BystanderDetailResponse>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var response = await bystanderService.GetByIdAsync(id, cancellationToken);
        return response is null ? NotFound() : Ok(response);
    }

    [HttpPut("api/bystanders/{id:guid}")]
    public async Task<ActionResult<BystanderDetailResponse>> Update(
        Guid id,
        [FromBody] UpsertBystanderRequest request,
        CancellationToken cancellationToken)
    {
        var result = await bystanderService.UpdateAsync(id, request, cancellationToken);
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

    [HttpDelete("api/bystanders/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken) =>
        await bystanderService.DeleteAsync(id, cancellationToken) ? NoContent() : NotFound();

    [HttpPut("api/mysteries/{mysteryId:guid}/bystanders/{id:guid}")]
    public async Task<IActionResult> LinkToMystery(Guid mysteryId, Guid id, CancellationToken cancellationToken) =>
        await bystanderService.LinkToMysteryAsync(mysteryId, id, cancellationToken) ? NoContent() : NotFound();

    [HttpDelete("api/mysteries/{mysteryId:guid}/bystanders/{id:guid}")]
    public async Task<IActionResult> UnlinkFromMystery(Guid mysteryId, Guid id, CancellationToken cancellationToken) =>
        await bystanderService.UnlinkFromMysteryAsync(mysteryId, id, cancellationToken) ? NoContent() : NotFound();

    // Custom moves moved to CustomMovesController in Phase 2 of domain-custom-moves
    // (architecture.md §3.3). Same note as LocationsController: these four hand-rolled
    // `IsSuccess ? Ok : NotFound` and the new controller uses `ToErrorResult`, which changes no
    // response because every ICustomMoveService failure is NotFound (B9). IBystanderService's
    // four custom-move methods went in Phase 3, with bystander_custom_moves and its entity.

    // --- Images (docs/resource-images/design.md §3, phases.md Phase 3) ---

    private const string ImageCacheControl = "private, max-age=31536000, immutable";
    private const long ImageRequestSizeLimitBytes = 24 * 1024 * 1024;

    [HttpGet("api/bystanders/{id:guid}/images")]
    public async Task<ActionResult<IReadOnlyList<ResourceImageResponse>>> GetImages(Guid id, CancellationToken cancellationToken)
    {
        var result = await resourceImageService.ListAsync(ResourceOwnerType.Bystander, id, cancellationToken);
        if (!result.IsSuccess)
        {
            return NotFound();
        }

        var primaryId = await resourceImageService.GetPrimaryImageIdAsync(ResourceOwnerType.Bystander, id, cancellationToken);
        return Ok(result.Value!.Select(i => i.ToResponse(i.Id == primaryId)).ToList());
    }

    [HttpGet("api/bystanders/{id:guid}/images/{imageId:guid}/file")]
    public async Task<IActionResult> GetImageFile(Guid id, Guid imageId, CancellationToken cancellationToken)
    {
        var image = await resourceImageService.GetImageAsync(ResourceOwnerType.Bystander, id, imageId, cancellationToken);
        if (image is null)
        {
            return NotFound();
        }

        Response.Headers.CacheControl = ImageCacheControl;
        return File(image.ImageBytes, image.ContentType);
    }

    [HttpGet("api/bystanders/{id:guid}/images/{imageId:guid}/thumbnail")]
    public async Task<IActionResult> GetImageThumbnail(Guid id, Guid imageId, CancellationToken cancellationToken)
    {
        var image = await resourceImageService.GetImageAsync(ResourceOwnerType.Bystander, id, imageId, cancellationToken);
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
    [HttpPost("api/bystanders/{id:guid}/images")]
    [RequestSizeLimit(ImageRequestSizeLimitBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = ImageRequestSizeLimitBytes)]
    public async Task<IActionResult> UploadImages(Guid id, [FromForm] IFormFileCollection files, CancellationToken cancellationToken)
    {
        var uploadFiles = await files.ToUploadFilesAsync(cancellationToken);
        var result = await resourceImageService.UploadAsync(ResourceOwnerType.Bystander, id, uploadFiles, cancellationToken);
        if (!result.IsSuccess)
        {
            return NotFound();
        }

        var primaryId = result.Value!.Uploaded.Count > 0
            ? await resourceImageService.GetPrimaryImageIdAsync(ResourceOwnerType.Bystander, id, cancellationToken)
            : (Guid?)null;

        var response = new ResourceImageUploadResponse(
            result.Value!.Uploaded.Select(i => i.ToResponse(i.Id == primaryId)).ToList(),
            result.Value!.Rejected.Select(r => r.ToResponse()).ToList());

        return result.Value!.Uploaded.Count > 0
            ? StatusCode(StatusCodes.Status201Created, response)
            : BadRequest(response);
    }

    [HttpDelete("api/bystanders/{id:guid}/images/{imageId:guid}")]
    public async Task<IActionResult> DeleteImage(Guid id, Guid imageId, CancellationToken cancellationToken) =>
        await resourceImageService.DeleteAsync(ResourceOwnerType.Bystander, id, imageId, cancellationToken) ? NoContent() : NotFound();

    [HttpPut("api/bystanders/{id:guid}/images/{imageId:guid}/primary")]
    public async Task<IActionResult> SetPrimaryImage(Guid id, Guid imageId, CancellationToken cancellationToken) =>
        await resourceImageService.SetPrimaryAsync(ResourceOwnerType.Bystander, id, imageId, cancellationToken) ? NoContent() : NotFound();
}
