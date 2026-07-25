using Microsoft.AspNetCore.Mvc;
using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Services;

namespace MonsterOfTheWeek.Api.Controllers;

[ApiController]
public sealed class LocationsController(ILocationService locationService) : ControllerBase
{
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

    [HttpDelete("api/mysteries/{mysteryId:guid}/locations/{id:guid}")]
    public async Task<IActionResult> UnlinkFromMystery(Guid mysteryId, Guid id, CancellationToken cancellationToken) =>
        await locationService.UnlinkFromMysteryAsync(mysteryId, id, cancellationToken) ? NoContent() : NotFound();

    [HttpGet("api/locations/{id:guid}/custom-moves")]
    public async Task<ActionResult<IReadOnlyList<CustomMoveResponse>>> GetCustomMoves(Guid id, CancellationToken cancellationToken)
    {
        var result = await locationService.GetCustomMovesAsync(id, cancellationToken);
        return result.IsSuccess ? Ok(result.Value) : NotFound();
    }

    [HttpPost("api/locations/{id:guid}/custom-moves")]
    public async Task<ActionResult<CustomMoveResponse>> CreateCustomMove(
        Guid id,
        [FromBody] UpsertCustomMoveRequest request,
        CancellationToken cancellationToken)
    {
        var result = await locationService.CreateCustomMoveAsync(id, request, cancellationToken);
        return result.IsSuccess ? Ok(result.Value) : NotFound();
    }

    [HttpPut("api/locations/{id:guid}/custom-moves/{moveId:guid}")]
    public async Task<ActionResult<CustomMoveResponse>> UpdateCustomMove(
        Guid id,
        Guid moveId,
        [FromBody] UpsertCustomMoveRequest request,
        CancellationToken cancellationToken)
    {
        var result = await locationService.UpdateCustomMoveAsync(id, moveId, request, cancellationToken);
        return result.IsSuccess ? Ok(result.Value) : NotFound();
    }

    [HttpDelete("api/locations/{id:guid}/custom-moves/{moveId:guid}")]
    public async Task<IActionResult> DeleteCustomMove(Guid id, Guid moveId, CancellationToken cancellationToken) =>
        await locationService.DeleteCustomMoveAsync(id, moveId, cancellationToken) ? NoContent() : NotFound();
}
