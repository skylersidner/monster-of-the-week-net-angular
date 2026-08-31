using Microsoft.AspNetCore.Mvc;
using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Services;

namespace MonsterOfTheWeek.Api.Controllers;

/*
 * Standard CRUD with no mystery-scoping — Playbooks are global reference/template data,
 * not owned by any Mystery.
 *
 * There are deliberately no sub-resource routes here (no /playbooks/{id}/moves and no
 * per-child GET). POST and PUT each carry the entire nested graph in one body and persist
 * it in one transaction; GET returns the same graph back. See phases.md Phase 3.
 */
[ApiController]
public sealed class PlaybooksController(IPlaybookService playbookService) : ControllerBase
{
    [HttpGet("api/playbooks")]
    public async Task<ActionResult<IReadOnlyList<PlaybookListItemResponse>>> GetAll(CancellationToken cancellationToken)
        => Ok(await playbookService.GetAllAsync(cancellationToken));

    [HttpGet("api/playbooks/{id:guid}")]
    public async Task<ActionResult<PlaybookDetailResponse>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var response = await playbookService.GetByIdAsync(id, cancellationToken);
        return response is null ? NotFound() : Ok(response);
    }

    [HttpPost("api/playbooks")]
    public async Task<ActionResult<PlaybookDetailResponse>> Create(
        [FromBody] UpsertPlaybookRequest request,
        CancellationToken cancellationToken)
    {
        var result = await playbookService.CreateAsync(request, cancellationToken);
        if (!result.IsSuccess)
        {
            return ToErrorResult(result.Error!);
        }

        return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
    }

    [HttpPut("api/playbooks/{id:guid}")]
    public async Task<ActionResult<PlaybookDetailResponse>> Update(
        Guid id,
        [FromBody] UpsertPlaybookRequest request,
        CancellationToken cancellationToken) =>
        ToActionResult(await playbookService.UpdateAsync(id, request, cancellationToken));

    [HttpDelete("api/playbooks/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var result = await playbookService.DeleteAsync(id, cancellationToken);
        if (!result.IsSuccess)
        {
            return ToErrorResult(result.Error!);
        }

        return result.Value ? NoContent() : NotFound();
    }

    private ActionResult<T> ToActionResult<T>(ServiceResult<T> result) =>
        result.IsSuccess ? Ok(result.Value) : ToErrorResult(result.Error!);

    private ActionResult ToErrorResult(ServiceError error) =>
        error.Type switch
        {
            ServiceErrorType.NotFound => NotFound(),
            ServiceErrorType.Validation => BadRequest(new { message = error.Message }),
            ServiceErrorType.Conflict => Conflict(new { message = error.Message }),
            _ => BadRequest()
        };
}
