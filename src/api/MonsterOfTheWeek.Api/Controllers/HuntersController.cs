using Microsoft.AspNetCore.Mvc;
using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Services;

namespace MonsterOfTheWeek.Api.Controllers;

/*
 * Phase 9 ships the list endpoint only. POST/PUT/GET-by-id and the full Hunter graph land in
 * Phase 10 — see phases.md. The frontend's create/detail links are deliberately dead until then.
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
}
