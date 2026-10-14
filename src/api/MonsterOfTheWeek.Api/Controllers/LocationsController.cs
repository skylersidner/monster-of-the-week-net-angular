using Microsoft.AspNetCore.Mvc;
using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Services;

namespace MonsterOfTheWeek.Api.Controllers;

[ApiController]
public sealed class LocationsController(ILocationService locationService) : ControllerBase
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
    // ILocationService's four custom-move methods went in Phase 3, with location_custom_moves
    // and its entity.

    // Images moved to ResourceImagesController at U2 of resource-images/endpoint-unification.md.
    // The six actions that were here inlined `return NotFound()` with no ToErrorResult pair; the
    // new controller uses ToErrorResult, which changes no response today because the only failure
    // ResourceImageService constructs is NotFound (endpoint-unification.md §1.2, Q4). Same URLs.
}
