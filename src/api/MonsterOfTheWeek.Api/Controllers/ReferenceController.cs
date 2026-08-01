using Microsoft.AspNetCore.Mvc;
using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Services;

namespace MonsterOfTheWeek.Api.Controllers;

[ApiController]
[Route("api")]
public sealed class ReferenceController(IReferenceService referenceService) : ControllerBase
{
    [HttpGet("adventure-types")]
    public async Task<ActionResult<IReadOnlyList<AdventureTypeResponse>>> GetAdventureTypes(CancellationToken cancellationToken) =>
        Ok(await referenceService.GetAdventureTypesAsync(cancellationToken));

    [HttpPost("adventure-types")]
    public async Task<ActionResult<AdventureTypeResponse>> CreateAdventureType([FromBody] CreateAdventureTypeRequest request, CancellationToken cancellationToken)
    {
        var created = await referenceService.CreateAdventureTypeAsync(request, cancellationToken);
        return Created($"/api/adventure-types/{created.Id}", created);
    }

    [HttpGet("monster-types")]
    public async Task<ActionResult<IReadOnlyList<TypeRefResponse>>> GetMonsterTypes(CancellationToken cancellationToken) =>
        Ok(await referenceService.GetMonsterTypesAsync(cancellationToken));

    [HttpPost("monster-types")]
    public async Task<ActionResult<TypeRefResponse>> CreateMonsterType([FromBody] CreateTypeRefRequest request, CancellationToken cancellationToken)
    {
        var created = await referenceService.CreateMonsterTypeAsync(request, cancellationToken);
        return Created($"/api/monster-types/{created.Id}", created);
    }

    [HttpGet("minion-types")]
    public async Task<ActionResult<IReadOnlyList<TypeRefResponse>>> GetMinionTypes(CancellationToken cancellationToken) =>
        Ok(await referenceService.GetMinionTypesAsync(cancellationToken));

    [HttpPost("minion-types")]
    public async Task<ActionResult<TypeRefResponse>> CreateMinionType([FromBody] CreateTypeRefRequest request, CancellationToken cancellationToken)
    {
        var created = await referenceService.CreateMinionTypeAsync(request, cancellationToken);
        return Created($"/api/minion-types/{created.Id}", created);
    }

    [HttpGet("location-types")]
    public async Task<ActionResult<IReadOnlyList<TypeRefResponse>>> GetLocationTypes(CancellationToken cancellationToken) =>
        Ok(await referenceService.GetLocationTypesAsync(cancellationToken));

    [HttpPost("location-types")]
    public async Task<ActionResult<TypeRefResponse>> CreateLocationType([FromBody] CreateTypeRefRequest request, CancellationToken cancellationToken)
    {
        var created = await referenceService.CreateLocationTypeAsync(request, cancellationToken);
        return Created($"/api/location-types/{created.Id}", created);
    }

    [HttpGet("bystander-types")]
    public async Task<ActionResult<IReadOnlyList<TypeRefResponse>>> GetBystanderTypes(CancellationToken cancellationToken) =>
        Ok(await referenceService.GetBystanderTypesAsync(cancellationToken));

    [HttpPost("bystander-types")]
    public async Task<ActionResult<TypeRefResponse>> CreateBystanderType([FromBody] CreateTypeRefRequest request, CancellationToken cancellationToken)
    {
        var created = await referenceService.CreateBystanderTypeAsync(request, cancellationToken);
        return Created($"/api/bystander-types/{created.Id}", created);
    }

    [HttpGet("weapon-tags")]
    public async Task<ActionResult<IReadOnlyList<WeaponTagRefResponse>>> GetWeaponTags(CancellationToken cancellationToken) =>
        Ok(await referenceService.GetWeaponTagsAsync(cancellationToken));

    [HttpPost("weapon-tags")]
    public async Task<ActionResult<WeaponTagRefResponse>> CreateWeaponTag([FromBody] CreateWeaponTagRefRequest request, CancellationToken cancellationToken)
    {
        var created = await referenceService.CreateWeaponTagAsync(request, cancellationToken);
        return Created($"/api/weapon-tags/{created.Id}", created);
    }
}
