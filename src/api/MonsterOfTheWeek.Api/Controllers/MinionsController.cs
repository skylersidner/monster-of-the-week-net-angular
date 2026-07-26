using Microsoft.AspNetCore.Mvc;
using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Services;

namespace MonsterOfTheWeek.Api.Controllers;

[ApiController]
public sealed class MinionsController(IMinionService minionService) : ControllerBase
{
    [HttpGet("api/minions")]
    public async Task<ActionResult<IReadOnlyList<MinionListItemResponse>>> GetAll(CancellationToken cancellationToken) =>
        Ok(await minionService.GetAllAsync(cancellationToken));

    [HttpGet("api/monsters/{monsterId:guid}/minions")]
    public async Task<ActionResult<IReadOnlyList<MinionListItemResponse>>> GetByMonster(Guid monsterId, CancellationToken cancellationToken) =>
        ToActionResult(await minionService.GetByMonsterAsync(monsterId, cancellationToken));

    [HttpPost("api/monsters/{monsterId:guid}/minions")]
    public async Task<ActionResult<MinionDetailResponse>> Create(Guid monsterId, [FromBody] UpsertMinionRequest request, CancellationToken cancellationToken)
    {
        var result = await minionService.CreateAsync(monsterId, request, cancellationToken);
        if (!result.IsSuccess)
        {
            return ToErrorResult(result.Error!);
        }

        return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
    }

    [HttpGet("api/minions/{id:guid}")]
    public async Task<ActionResult<MinionDetailResponse>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var response = await minionService.GetByIdAsync(id, cancellationToken);
        return response is null ? NotFound() : Ok(response);
    }

    [HttpPut("api/minions/{id:guid}")]
    public async Task<ActionResult<MinionDetailResponse>> Update(Guid id, [FromBody] UpsertMinionRequest request, CancellationToken cancellationToken) =>
        ToActionResult(await minionService.UpdateAsync(id, request, cancellationToken));

    // --- Attacks ---

    [HttpGet("api/minions/{id:guid}/attacks")]
    public async Task<ActionResult<IReadOnlyList<MinionAttackResponse>>> GetAttacks(Guid id, CancellationToken cancellationToken) =>
        ToActionResult(await minionService.GetAttacksAsync(id, cancellationToken));

    [HttpPost("api/minions/{id:guid}/attacks")]
    public async Task<ActionResult<MinionAttackResponse>> CreateAttack(Guid id, [FromBody] UpsertMinionAttackRequest request, CancellationToken cancellationToken) =>
        ToActionResult(await minionService.CreateAttackAsync(id, request, cancellationToken));

    [HttpPut("api/minions/{id:guid}/attacks/{attackId:guid}")]
    public async Task<ActionResult<MinionAttackResponse>> UpdateAttack(Guid id, Guid attackId, [FromBody] UpsertMinionAttackRequest request, CancellationToken cancellationToken) =>
        ToActionResult(await minionService.UpdateAttackAsync(id, attackId, request, cancellationToken));

    [HttpDelete("api/minions/{id:guid}/attacks/{attackId:guid}")]
    public async Task<IActionResult> DeleteAttack(Guid id, Guid attackId, CancellationToken cancellationToken) =>
        await minionService.DeleteAttackAsync(id, attackId, cancellationToken) ? NoContent() : NotFound();

    [HttpGet("api/minions/{id:guid}/attacks/{attackId:guid}/weapon-tags")]
    public async Task<ActionResult<IReadOnlyList<WeaponTagRefResponse>>> GetAttackWeaponTags(Guid id, Guid attackId, CancellationToken cancellationToken) =>
        ToActionResult(await minionService.GetAttackWeaponTagsAsync(id, attackId, cancellationToken));

    [HttpPost("api/minions/{id:guid}/attacks/{attackId:guid}/weapon-tags")]
    public async Task<IActionResult> AssignAttackWeaponTag(Guid id, Guid attackId, [FromBody] AssignWeaponTagRequest request, CancellationToken cancellationToken)
    {
        var result = await minionService.AssignAttackWeaponTagAsync(id, attackId, request, cancellationToken);
        return result.IsSuccess ? NoContent() : ToErrorResult(result.Error!);
    }

    [HttpDelete("api/minions/{id:guid}/attacks/{attackId:guid}/weapon-tags/{tagId:guid}")]
    public async Task<IActionResult> RemoveAttackWeaponTag(Guid id, Guid attackId, Guid tagId, CancellationToken cancellationToken)
    {
        var result = await minionService.RemoveAttackWeaponTagAsync(id, attackId, tagId, cancellationToken);
        return result.IsSuccess ? NoContent() : ToErrorResult(result.Error!);
    }

    // --- Powers ---

    [HttpGet("api/minions/{id:guid}/powers")]
    public async Task<ActionResult<IReadOnlyList<MinionPowerResponse>>> GetPowers(Guid id, CancellationToken cancellationToken) =>
        ToActionResult(await minionService.GetPowersAsync(id, cancellationToken));

    [HttpPost("api/minions/{id:guid}/powers")]
    public async Task<ActionResult<MinionPowerResponse>> CreatePower(Guid id, [FromBody] UpsertMinionPowerRequest request, CancellationToken cancellationToken) =>
        ToActionResult(await minionService.CreatePowerAsync(id, request, cancellationToken));

    [HttpPut("api/minions/{id:guid}/powers/{powerId:guid}")]
    public async Task<ActionResult<MinionPowerResponse>> UpdatePower(Guid id, Guid powerId, [FromBody] UpsertMinionPowerRequest request, CancellationToken cancellationToken) =>
        ToActionResult(await minionService.UpdatePowerAsync(id, powerId, request, cancellationToken));

    [HttpDelete("api/minions/{id:guid}/powers/{powerId:guid}")]
    public async Task<IActionResult> DeletePower(Guid id, Guid powerId, CancellationToken cancellationToken) =>
        await minionService.DeletePowerAsync(id, powerId, cancellationToken) ? NoContent() : NotFound();

    // --- Armors ---

    [HttpGet("api/minions/{id:guid}/armors")]
    public async Task<ActionResult<IReadOnlyList<MinionArmorResponse>>> GetArmors(Guid id, CancellationToken cancellationToken) =>
        ToActionResult(await minionService.GetArmorsAsync(id, cancellationToken));

    [HttpPost("api/minions/{id:guid}/armors")]
    public async Task<ActionResult<MinionArmorResponse>> CreateArmor(Guid id, [FromBody] UpsertMinionArmorRequest request, CancellationToken cancellationToken) =>
        ToActionResult(await minionService.CreateArmorAsync(id, request, cancellationToken));

    [HttpPut("api/minions/{id:guid}/armors/{armorId:guid}")]
    public async Task<ActionResult<MinionArmorResponse>> UpdateArmor(Guid id, Guid armorId, [FromBody] UpsertMinionArmorRequest request, CancellationToken cancellationToken) =>
        ToActionResult(await minionService.UpdateArmorAsync(id, armorId, request, cancellationToken));

    [HttpDelete("api/minions/{id:guid}/armors/{armorId:guid}")]
    public async Task<IActionResult> DeleteArmor(Guid id, Guid armorId, CancellationToken cancellationToken) =>
        await minionService.DeleteArmorAsync(id, armorId, cancellationToken) ? NoContent() : NotFound();

    // --- Weaknesses ---

    [HttpGet("api/minions/{id:guid}/weaknesses")]
    public async Task<ActionResult<IReadOnlyList<MinionWeaknessResponse>>> GetWeaknesses(Guid id, CancellationToken cancellationToken) =>
        ToActionResult(await minionService.GetWeaknessesAsync(id, cancellationToken));

    [HttpPost("api/minions/{id:guid}/weaknesses")]
    public async Task<ActionResult<MinionWeaknessResponse>> CreateWeakness(Guid id, [FromBody] UpsertMinionWeaknessRequest request, CancellationToken cancellationToken) =>
        ToActionResult(await minionService.CreateWeaknessAsync(id, request, cancellationToken));

    [HttpPut("api/minions/{id:guid}/weaknesses/{weaknessId:guid}")]
    public async Task<ActionResult<MinionWeaknessResponse>> UpdateWeakness(Guid id, Guid weaknessId, [FromBody] UpsertMinionWeaknessRequest request, CancellationToken cancellationToken) =>
        ToActionResult(await minionService.UpdateWeaknessAsync(id, weaknessId, request, cancellationToken));

    [HttpDelete("api/minions/{id:guid}/weaknesses/{weaknessId:guid}")]
    public async Task<IActionResult> DeleteWeakness(Guid id, Guid weaknessId, CancellationToken cancellationToken) =>
        await minionService.DeleteWeaknessAsync(id, weaknessId, cancellationToken) ? NoContent() : NotFound();

    // --- Custom Moves ---

    [HttpGet("api/minions/{id:guid}/custom-moves")]
    public async Task<ActionResult<IReadOnlyList<CustomMoveResponse>>> GetCustomMoves(Guid id, CancellationToken cancellationToken) =>
        ToActionResult(await minionService.GetCustomMovesAsync(id, cancellationToken));

    [HttpPost("api/minions/{id:guid}/custom-moves")]
    public async Task<ActionResult<CustomMoveResponse>> CreateCustomMove(Guid id, [FromBody] UpsertCustomMoveRequest request, CancellationToken cancellationToken) =>
        ToActionResult(await minionService.CreateCustomMoveAsync(id, request, cancellationToken));

    [HttpPut("api/minions/{id:guid}/custom-moves/{moveId:guid}")]
    public async Task<ActionResult<CustomMoveResponse>> UpdateCustomMove(Guid id, Guid moveId, [FromBody] UpsertCustomMoveRequest request, CancellationToken cancellationToken) =>
        ToActionResult(await minionService.UpdateCustomMoveAsync(id, moveId, request, cancellationToken));

    [HttpDelete("api/minions/{id:guid}/custom-moves/{moveId:guid}")]
    public async Task<IActionResult> DeleteCustomMove(Guid id, Guid moveId, CancellationToken cancellationToken) =>
        await minionService.DeleteCustomMoveAsync(id, moveId, cancellationToken) ? NoContent() : NotFound();

    private ActionResult<T> ToActionResult<T>(ServiceResult<T> result) =>
        result.IsSuccess ? Ok(result.Value) : ToErrorResult(result.Error!);

    private ActionResult ToErrorResult(ServiceError error) =>
        error.Type switch
        {
            ServiceErrorType.NotFound => NotFound(),
            ServiceErrorType.Validation => BadRequest(new { message = error.Message }),
            _ => BadRequest()
        };
}
