using Microsoft.AspNetCore.Mvc;
using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Services;

namespace MonsterOfTheWeek.Api.Controllers;

[ApiController]
public sealed class BystandersController(IBystanderService bystanderService) : ControllerBase
{
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

    [HttpGet("api/bystanders/{id:guid}/custom-moves")]
    public async Task<ActionResult<IReadOnlyList<CustomMoveResponse>>> GetCustomMoves(Guid id, CancellationToken cancellationToken)
    {
        var result = await bystanderService.GetCustomMovesAsync(id, cancellationToken);
        return result.IsSuccess ? Ok(result.Value) : NotFound();
    }

    [HttpPost("api/bystanders/{id:guid}/custom-moves")]
    public async Task<ActionResult<CustomMoveResponse>> CreateCustomMove(
        Guid id,
        [FromBody] UpsertCustomMoveRequest request,
        CancellationToken cancellationToken)
    {
        var result = await bystanderService.CreateCustomMoveAsync(id, request, cancellationToken);
        return result.IsSuccess ? Ok(result.Value) : NotFound();
    }

    [HttpPut("api/bystanders/{id:guid}/custom-moves/{moveId:guid}")]
    public async Task<ActionResult<CustomMoveResponse>> UpdateCustomMove(
        Guid id,
        Guid moveId,
        [FromBody] UpsertCustomMoveRequest request,
        CancellationToken cancellationToken)
    {
        var result = await bystanderService.UpdateCustomMoveAsync(id, moveId, request, cancellationToken);
        return result.IsSuccess ? Ok(result.Value) : NotFound();
    }

    [HttpDelete("api/bystanders/{id:guid}/custom-moves/{moveId:guid}")]
    public async Task<IActionResult> DeleteCustomMove(Guid id, Guid moveId, CancellationToken cancellationToken) =>
        await bystanderService.DeleteCustomMoveAsync(id, moveId, cancellationToken) ? NoContent() : NotFound();
}
