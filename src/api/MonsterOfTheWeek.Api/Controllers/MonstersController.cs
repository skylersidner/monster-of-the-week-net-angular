using Microsoft.AspNetCore.Mvc;
using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Services;

namespace MonsterOfTheWeek.Api.Controllers;

[ApiController]
public sealed class MonstersController(IMonsterService monsterService) : ControllerBase
{
    [HttpGet("api/mysteries/{mysteryId:guid}/monsters")]
    public async Task<ActionResult<IReadOnlyList<MonsterListItemResponse>>> GetByMystery(Guid mysteryId, CancellationToken cancellationToken)
        => ToActionResult(await monsterService.GetByMysteryAsync(mysteryId, cancellationToken));

    [HttpPost("api/mysteries/{mysteryId:guid}/monsters")]
    public async Task<ActionResult<MonsterDetailResponse>> Create(Guid mysteryId, [FromBody] UpsertMonsterRequest request, CancellationToken cancellationToken)
    {
        var result = await monsterService.CreateAsync(mysteryId, request, cancellationToken);
        if (!result.IsSuccess)
        {
            return ToErrorResult(result.Error!);
        }

        return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
    }

    [HttpGet("api/monsters/{id:guid}")]
    public async Task<ActionResult<MonsterDetailResponse>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var response = await monsterService.GetByIdAsync(id, cancellationToken);
        return response is null ? NotFound() : Ok(response);
    }

    [HttpPut("api/monsters/{id:guid}")]
    public async Task<ActionResult<MonsterDetailResponse>> Update(Guid id, [FromBody] UpsertMonsterRequest request, CancellationToken cancellationToken) =>
        ToActionResult(await monsterService.UpdateAsync(id, request, cancellationToken));

    [HttpDelete("api/monsters/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken) =>
        await monsterService.DeleteAsync(id, cancellationToken) ? NoContent() : NotFound();

    [HttpGet("api/monsters/{id:guid}/attacks")]
    public async Task<ActionResult<IReadOnlyList<MonsterAttackResponse>>> GetAttacks(Guid id, CancellationToken cancellationToken) =>
        ToActionResult(await monsterService.GetAttacksAsync(id, cancellationToken));

    [HttpPost("api/monsters/{id:guid}/attacks")]
    public async Task<ActionResult<MonsterAttackResponse>> CreateAttack(Guid id, [FromBody] UpsertMonsterAttackRequest request, CancellationToken cancellationToken) =>
        ToActionResult(await monsterService.CreateAttackAsync(id, request, cancellationToken));

    [HttpPut("api/monsters/{id:guid}/attacks/{attackId:guid}")]
    public async Task<ActionResult<MonsterAttackResponse>> UpdateAttack(Guid id, Guid attackId, [FromBody] UpsertMonsterAttackRequest request, CancellationToken cancellationToken) =>
        ToActionResult(await monsterService.UpdateAttackAsync(id, attackId, request, cancellationToken));

    [HttpDelete("api/monsters/{id:guid}/attacks/{attackId:guid}")]
    public async Task<IActionResult> DeleteAttack(Guid id, Guid attackId, CancellationToken cancellationToken) =>
        await monsterService.DeleteAttackAsync(id, attackId, cancellationToken) ? NoContent() : NotFound();

    [HttpGet("api/monsters/{id:guid}/attacks/{attackId:guid}/weapon-tags")]
    public async Task<ActionResult<IReadOnlyList<WeaponTagRefResponse>>> GetAttackWeaponTags(Guid id, Guid attackId, CancellationToken cancellationToken) =>
        ToActionResult(await monsterService.GetAttackWeaponTagsAsync(id, attackId, cancellationToken));

    [HttpPost("api/monsters/{id:guid}/attacks/{attackId:guid}/weapon-tags")]
    public async Task<IActionResult> AssignAttackWeaponTag(Guid id, Guid attackId, [FromBody] AssignWeaponTagRequest request, CancellationToken cancellationToken)
    {
        var result = await monsterService.AssignAttackWeaponTagAsync(id, attackId, request, cancellationToken);
        return result.IsSuccess ? NoContent() : ToErrorResult(result.Error!);
    }

    [HttpDelete("api/monsters/{id:guid}/attacks/{attackId:guid}/weapon-tags/{tagId:guid}")]
    public async Task<IActionResult> RemoveAttackWeaponTag(Guid id, Guid attackId, Guid tagId, CancellationToken cancellationToken)
    {
        var result = await monsterService.RemoveAttackWeaponTagAsync(id, attackId, tagId, cancellationToken);
        return result.IsSuccess ? NoContent() : ToErrorResult(result.Error!);
    }

    [HttpGet("api/monsters/{id:guid}/powers")]
    public async Task<ActionResult<IReadOnlyList<MonsterPowerResponse>>> GetPowers(Guid id, CancellationToken cancellationToken) =>
        ToActionResult(await monsterService.GetPowersAsync(id, cancellationToken));

    [HttpPost("api/monsters/{id:guid}/powers")]
    public async Task<ActionResult<MonsterPowerResponse>> CreatePower(Guid id, [FromBody] UpsertMonsterPowerRequest request, CancellationToken cancellationToken) =>
        ToActionResult(await monsterService.CreatePowerAsync(id, request, cancellationToken));

    [HttpPut("api/monsters/{id:guid}/powers/{powerId:guid}")]
    public async Task<ActionResult<MonsterPowerResponse>> UpdatePower(Guid id, Guid powerId, [FromBody] UpsertMonsterPowerRequest request, CancellationToken cancellationToken) =>
        ToActionResult(await monsterService.UpdatePowerAsync(id, powerId, request, cancellationToken));

    [HttpDelete("api/monsters/{id:guid}/powers/{powerId:guid}")]
    public async Task<IActionResult> DeletePower(Guid id, Guid powerId, CancellationToken cancellationToken) =>
        await monsterService.DeletePowerAsync(id, powerId, cancellationToken) ? NoContent() : NotFound();

    [HttpGet("api/monsters/{id:guid}/armors")]
    public async Task<ActionResult<IReadOnlyList<MonsterArmorResponse>>> GetArmors(Guid id, CancellationToken cancellationToken) =>
        ToActionResult(await monsterService.GetArmorsAsync(id, cancellationToken));

    [HttpPost("api/monsters/{id:guid}/armors")]
    public async Task<ActionResult<MonsterArmorResponse>> CreateArmor(Guid id, [FromBody] UpsertMonsterArmorRequest request, CancellationToken cancellationToken) =>
        ToActionResult(await monsterService.CreateArmorAsync(id, request, cancellationToken));

    [HttpPut("api/monsters/{id:guid}/armors/{armorId:guid}")]
    public async Task<ActionResult<MonsterArmorResponse>> UpdateArmor(Guid id, Guid armorId, [FromBody] UpsertMonsterArmorRequest request, CancellationToken cancellationToken) =>
        ToActionResult(await monsterService.UpdateArmorAsync(id, armorId, request, cancellationToken));

    [HttpDelete("api/monsters/{id:guid}/armors/{armorId:guid}")]
    public async Task<IActionResult> DeleteArmor(Guid id, Guid armorId, CancellationToken cancellationToken) =>
        await monsterService.DeleteArmorAsync(id, armorId, cancellationToken) ? NoContent() : NotFound();

    [HttpGet("api/monsters/{id:guid}/weaknesses")]
    public async Task<ActionResult<IReadOnlyList<MonsterWeaknessResponse>>> GetWeaknesses(Guid id, CancellationToken cancellationToken) =>
        ToActionResult(await monsterService.GetWeaknessesAsync(id, cancellationToken));

    [HttpPost("api/monsters/{id:guid}/weaknesses")]
    public async Task<ActionResult<MonsterWeaknessResponse>> CreateWeakness(Guid id, [FromBody] UpsertMonsterWeaknessRequest request, CancellationToken cancellationToken) =>
        ToActionResult(await monsterService.CreateWeaknessAsync(id, request, cancellationToken));

    [HttpPut("api/monsters/{id:guid}/weaknesses/{weaknessId:guid}")]
    public async Task<ActionResult<MonsterWeaknessResponse>> UpdateWeakness(Guid id, Guid weaknessId, [FromBody] UpsertMonsterWeaknessRequest request, CancellationToken cancellationToken) =>
        ToActionResult(await monsterService.UpdateWeaknessAsync(id, weaknessId, request, cancellationToken));

    [HttpDelete("api/monsters/{id:guid}/weaknesses/{weaknessId:guid}")]
    public async Task<IActionResult> DeleteWeakness(Guid id, Guid weaknessId, CancellationToken cancellationToken) =>
        await monsterService.DeleteWeaknessAsync(id, weaknessId, cancellationToken) ? NoContent() : NotFound();

    [HttpGet("api/monsters/{id:guid}/custom-moves")]
    public async Task<ActionResult<IReadOnlyList<CustomMoveResponse>>> GetCustomMoves(Guid id, CancellationToken cancellationToken) =>
        ToActionResult(await monsterService.GetCustomMovesAsync(id, cancellationToken));

    [HttpPost("api/monsters/{id:guid}/custom-moves")]
    public async Task<ActionResult<CustomMoveResponse>> CreateCustomMove(Guid id, [FromBody] UpsertCustomMoveRequest request, CancellationToken cancellationToken) =>
        ToActionResult(await monsterService.CreateCustomMoveAsync(id, request, cancellationToken));

    [HttpPut("api/monsters/{id:guid}/custom-moves/{moveId:guid}")]
    public async Task<ActionResult<CustomMoveResponse>> UpdateCustomMove(Guid id, Guid moveId, [FromBody] UpsertCustomMoveRequest request, CancellationToken cancellationToken) =>
        ToActionResult(await monsterService.UpdateCustomMoveAsync(id, moveId, request, cancellationToken));

    [HttpDelete("api/monsters/{id:guid}/custom-moves/{moveId:guid}")]
    public async Task<IActionResult> DeleteCustomMove(Guid id, Guid moveId, CancellationToken cancellationToken) =>
        await monsterService.DeleteCustomMoveAsync(id, moveId, cancellationToken) ? NoContent() : NotFound();

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
