using Microsoft.AspNetCore.Mvc;
using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Services;

namespace MonsterOfTheWeek.Api.Controllers;

[ApiController]
[Route("api/mysteries")]
public sealed class MysteriesController(IMysteryService mysteryService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<MysteryListItemResponse>>> GetAll(CancellationToken cancellationToken) =>
        Ok(await mysteryService.GetAllAsync(cancellationToken));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<MysteryDetailResponse>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var mystery = await mysteryService.GetByIdAsync(id, cancellationToken);
        return mystery is null ? NotFound() : Ok(mystery);
    }

    [HttpPost]
    public async Task<ActionResult<MysteryDetailResponse>> Create(
        [FromBody] UpsertMysteryRequest request,
        CancellationToken cancellationToken)
    {
        var created = await mysteryService.CreateAsync(request, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<MysteryDetailResponse>> Update(
        Guid id,
        [FromBody] UpsertMysteryRequest request,
        CancellationToken cancellationToken)
    {
        var updated = await mysteryService.UpdateAsync(id, request, cancellationToken);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken) =>
        await mysteryService.DeleteAsync(id, cancellationToken) ? NoContent() : NotFound();

    [HttpGet("{id:guid}/countdown")]
    public async Task<ActionResult<CountdownResponse>> GetCountdown(Guid id, CancellationToken cancellationToken)
    {
        var countdown = await mysteryService.GetCountdownAsync(id, cancellationToken);
        return countdown is null ? NotFound() : Ok(countdown);
    }

    [HttpPut("{id:guid}/countdown")]
    public async Task<ActionResult<CountdownResponse>> UpsertCountdown(
        Guid id,
        [FromBody] UpsertCountdownRequest request,
        CancellationToken cancellationToken)
    {
        var result = await mysteryService.UpsertCountdownAsync(id, request, cancellationToken);
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
}
