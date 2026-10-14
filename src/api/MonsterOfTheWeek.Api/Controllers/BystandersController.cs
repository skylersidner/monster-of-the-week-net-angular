using Microsoft.AspNetCore.Mvc;
using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Services;

namespace MonsterOfTheWeek.Api.Controllers;

[ApiController]
public sealed class BystandersController(IBystanderService bystanderService) : ControllerBase
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

    // Images moved to ResourceImagesController at U2 of resource-images/endpoint-unification.md.
    // Same note as LocationsController: these six inlined `return NotFound()` and the new
    // controller uses ToErrorResult, which changes no response because every failure
    // ResourceImageService constructs is NotFound. Same URLs, no client edit.
}
