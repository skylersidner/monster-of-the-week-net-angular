using Microsoft.AspNetCore.Mvc;
using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Services;

namespace MonsterOfTheWeek.Api.Controllers;

[ApiController]
[Route("api")]
public sealed class ReferenceController(IReferenceService referenceService) : ControllerBase
{
    [HttpGet("monster-types")]
    public async Task<ActionResult<IReadOnlyList<TypeRefResponse>>> GetMonsterTypes(CancellationToken cancellationToken) =>
        Ok(await referenceService.GetMonsterTypesAsync(cancellationToken));

    [HttpGet("minion-types")]
    public async Task<ActionResult<IReadOnlyList<TypeRefResponse>>> GetMinionTypes(CancellationToken cancellationToken) =>
        Ok(await referenceService.GetMinionTypesAsync(cancellationToken));

    [HttpGet("location-types")]
    public async Task<ActionResult<IReadOnlyList<TypeRefResponse>>> GetLocationTypes(CancellationToken cancellationToken) =>
        Ok(await referenceService.GetLocationTypesAsync(cancellationToken));

    [HttpGet("bystander-types")]
    public async Task<ActionResult<IReadOnlyList<TypeRefResponse>>> GetBystanderTypes(CancellationToken cancellationToken) =>
        Ok(await referenceService.GetBystanderTypesAsync(cancellationToken));

    [HttpGet("weapon-tags")]
    public async Task<ActionResult<IReadOnlyList<WeaponTagRefResponse>>> GetWeaponTags(CancellationToken cancellationToken) =>
        Ok(await referenceService.GetWeaponTagsAsync(cancellationToken));
}
