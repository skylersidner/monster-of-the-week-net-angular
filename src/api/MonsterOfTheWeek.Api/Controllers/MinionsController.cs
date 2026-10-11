using Microsoft.AspNetCore.Mvc;
using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Data.Entities;
using MonsterOfTheWeek.Api.Services;
using MonsterOfTheWeek.Api.Services.ResourceImages;

namespace MonsterOfTheWeek.Api.Controllers;

[ApiController]
public sealed class MinionsController(IMinionService minionService, IResourceImageService resourceImageService) : ControllerBase
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

    /// <summary>
    /// Re-parents a minion. No body, 204 on success, 404 when either id is unknown.
    ///
    /// <para>
    /// Shaped on the membership verb at <c>PUT /api/mysteries/{mysteryId}/monsters/{id}</c>, but
    /// it is a <b>move</b> rather than an add — see <see cref="MinionService.MoveToMonsterAsync"/>
    /// for why the two are not the same verb. Sits beside the <c>GET</c> and <c>POST</c> that
    /// already own this path; there was no <c>PUT</c> on it before.
    /// </para>
    /// </summary>
    [HttpPut("api/monsters/{monsterId:guid}/minions/{id:guid}")]
    public async Task<IActionResult> MoveToMonster(Guid monsterId, Guid id, CancellationToken cancellationToken) =>
        await minionService.MoveToMonsterAsync(monsterId, id, cancellationToken) ? NoContent() : NotFound();

    [HttpDelete("api/minions/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken) =>
        await minionService.DeleteAsync(id, cancellationToken) ? NoContent() : NotFound();

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

    // Custom moves moved to CustomMovesController in Phase 2 of domain-custom-moves
    // (architecture.md §3.3). IMinionService's four custom-move methods are now called by
    // nothing; Phase 3 removes them with minion_custom_moves.

    // --- Images (docs/resource-images/design.md §3, phases.md Phase 3) ---

    private const string ImageCacheControl = "private, max-age=31536000, immutable";
    private const long ImageRequestSizeLimitBytes = 24 * 1024 * 1024;

    [HttpGet("api/minions/{id:guid}/images")]
    public async Task<ActionResult<IReadOnlyList<ResourceImageResponse>>> GetImages(Guid id, CancellationToken cancellationToken)
    {
        var result = await resourceImageService.ListAsync(ResourceOwnerType.Minion, id, cancellationToken);
        if (!result.IsSuccess)
        {
            return ToErrorResult(result.Error!);
        }

        var primaryId = await resourceImageService.GetPrimaryImageIdAsync(ResourceOwnerType.Minion, id, cancellationToken);
        return Ok(result.Value!.Select(i => i.ToResponse(i.Id == primaryId)).ToList());
    }

    [HttpGet("api/minions/{id:guid}/images/{imageId:guid}/file")]
    public async Task<IActionResult> GetImageFile(Guid id, Guid imageId, CancellationToken cancellationToken)
    {
        var image = await resourceImageService.GetImageAsync(ResourceOwnerType.Minion, id, imageId, cancellationToken);
        if (image is null)
        {
            return NotFound();
        }

        Response.Headers.CacheControl = ImageCacheControl;
        return File(image.ImageBytes, image.ContentType);
    }

    [HttpGet("api/minions/{id:guid}/images/{imageId:guid}/thumbnail")]
    public async Task<IActionResult> GetImageThumbnail(Guid id, Guid imageId, CancellationToken cancellationToken)
    {
        var image = await resourceImageService.GetImageAsync(ResourceOwnerType.Minion, id, imageId, cancellationToken);
        if (image is null)
        {
            return NotFound();
        }

        Response.Headers.CacheControl = ImageCacheControl;

        return image.ThumbnailBytes is null
            ? File(image.ImageBytes, image.ContentType)
            : File(image.ThumbnailBytes, "image/jpeg");
    }

    // Deliberately not the ToActionResult<T>(ServiceResult<T>) convention every other action on
    // this controller uses — the response is precise-per-file (design.md §3: an upload batch can
    // be partially accepted), not a single pass/fail, so don't "fix" this to match the others.
    [HttpPost("api/minions/{id:guid}/images")]
    [RequestSizeLimit(ImageRequestSizeLimitBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = ImageRequestSizeLimitBytes)]
    public async Task<IActionResult> UploadImages(Guid id, [FromForm] IFormFileCollection files, CancellationToken cancellationToken)
    {
        var uploadFiles = await files.ToUploadFilesAsync(cancellationToken);
        var result = await resourceImageService.UploadAsync(ResourceOwnerType.Minion, id, uploadFiles, cancellationToken);
        if (!result.IsSuccess)
        {
            return ToErrorResult(result.Error!);
        }

        var primaryId = result.Value!.Uploaded.Count > 0
            ? await resourceImageService.GetPrimaryImageIdAsync(ResourceOwnerType.Minion, id, cancellationToken)
            : (Guid?)null;

        var response = new ResourceImageUploadResponse(
            result.Value!.Uploaded.Select(i => i.ToResponse(i.Id == primaryId)).ToList(),
            result.Value!.Rejected.Select(r => r.ToResponse()).ToList());

        return result.Value!.Uploaded.Count > 0
            ? StatusCode(StatusCodes.Status201Created, response)
            : BadRequest(response);
    }

    [HttpDelete("api/minions/{id:guid}/images/{imageId:guid}")]
    public async Task<IActionResult> DeleteImage(Guid id, Guid imageId, CancellationToken cancellationToken) =>
        await resourceImageService.DeleteAsync(ResourceOwnerType.Minion, id, imageId, cancellationToken) ? NoContent() : NotFound();

    [HttpPut("api/minions/{id:guid}/images/{imageId:guid}/primary")]
    public async Task<IActionResult> SetPrimaryImage(Guid id, Guid imageId, CancellationToken cancellationToken) =>
        await resourceImageService.SetPrimaryAsync(ResourceOwnerType.Minion, id, imageId, cancellationToken) ? NoContent() : NotFound();

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
