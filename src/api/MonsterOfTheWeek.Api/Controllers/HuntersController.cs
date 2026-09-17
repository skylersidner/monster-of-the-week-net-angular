using Microsoft.AspNetCore.Mvc;
using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Services;

namespace MonsterOfTheWeek.Api.Controllers;

/*
 * Standard CRUD, no mystery-scoping — Hunters are not owned by a Mystery (architecture.md
 * Section 3). No sub-resource endpoints for the pick bridges, matching Playbook: one request
 * carries the whole hunter.
 *
 * DELETE is here even though phases.md Phase 10 lists only GET/POST/PUT. Without it the
 * playbook-delete 409 added in Phase 9 tells the user to "delete or reassign" hunters they
 * would have no way to delete — a dead end this phase would otherwise create for itself.
 */
[ApiController]
public sealed class HuntersController(IHunterService hunterService) : ControllerBase
{
    [HttpGet("api/hunters")]
    public async Task<ActionResult<IReadOnlyList<HunterListItemResponse>>> GetAll(CancellationToken cancellationToken)
    {
        var result = await hunterService.GetAllAsync(cancellationToken);
        return Ok(result);
    }

    [HttpGet("api/hunters/{id:guid}")]
    public async Task<ActionResult<HunterDetailResponse>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var response = await hunterService.GetByIdAsync(id, cancellationToken);
        return response is null ? NotFound() : Ok(response);
    }

    [HttpPost("api/hunters")]
    public async Task<ActionResult<HunterDetailResponse>> Create(
        [FromBody] UpsertHunterRequest request,
        CancellationToken cancellationToken)
    {
        var result = await hunterService.CreateAsync(request, cancellationToken);
        if (!result.IsSuccess)
        {
            return ToErrorResult(result.Error!);
        }

        return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
    }

    /*
     * The check-only endpoint (hunter-creation-wizard.md 12.8). Takes the same body as Create and
     * answers with what Create would refuse or report, saving nothing. Always 200 once the body
     * binds: a refusal is an answer here, not an error. A malformed body is still refused by
     * model binding with the usual 400.
     *
     * The wizard can call this in bursts on its last step (Q8), so nothing is logged per call
     * beyond the framework defaults, and the request token is passed down so an aborted check
     * stops at its one database read (12.8.1 O3).
     */
    [HttpPost("api/hunters/evaluate")]
    public async Task<ActionResult<HunterEvaluationResponse>> Evaluate(
        [FromBody] UpsertHunterRequest request,
        CancellationToken cancellationToken) =>
        Ok(await hunterService.EvaluateAsync(request, cancellationToken));

    [HttpPut("api/hunters/{id:guid}")]
    public async Task<ActionResult<HunterDetailResponse>> Update(
        Guid id,
        [FromBody] UpsertHunterRequest request,
        CancellationToken cancellationToken)
    {
        var result = await hunterService.UpdateAsync(id, request, cancellationToken);
        return result.IsSuccess ? Ok(result.Value) : ToErrorResult(result.Error!);
    }

    [HttpDelete("api/hunters/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken) =>
        await hunterService.DeleteAsync(id, cancellationToken) ? NoContent() : NotFound();

    private ActionResult ToErrorResult(ServiceError error) =>
        error.Type switch
        {
            ServiceErrorType.NotFound => NotFound(),
            ServiceErrorType.Validation => BadRequest(new { message = error.Message }),
            ServiceErrorType.Conflict => Conflict(new { message = error.Message }),
            _ => BadRequest()
        };
}
