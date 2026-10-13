using Microsoft.AspNetCore.Mvc;
using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Data.Entities;
using MonsterOfTheWeek.Api.Services;
using MonsterOfTheWeek.Api.Services.CustomMoves;

namespace MonsterOfTheWeek.Api.Controllers;

/// <summary>
/// The one controller behind all five owner types' custom moves
/// (<c>docs/domain-custom-moves/architecture.md</c> §3.3, §17). Replaces sixteen actions across
/// four controllers with four, and gives Mystery the three verbs it never had.
///
/// <para>
/// <b>Status codes are the shipped ones, not the conventional ones</b> (B9): <c>POST</c> returns
/// <c>200 Ok</c> and not <c>201 Created</c>, because all four actions it replaces did — unlike
/// <c>MonstersController.Create</c>, which uses <c>CreatedAtAction</c>. <c>DELETE</c> is
/// <c>204</c> on success and <c>404</c> on a miss, derived from <c>deleted &gt; 0</c>. Changing
/// either would be a contract change, and §2.1 budgets zero.
/// </para>
///
/// <para>
/// <b>Error mapping follows <c>ToErrorResult</c>, which three of the five controllers it replaces
/// already used</b> — <c>LocationsController</c> and <c>BystandersController</c> hand-rolled
/// <c>IsSuccess ? Ok : NotFound</c>, collapsing every error to 404. One controller can only have
/// one policy, and adopting the stricter one is safe here because it cannot change a single
/// response: every failure <c>ICustomMoveService</c> can return is <c>NotFound</c>. Request-shape
/// validation is <c>[ApiController]</c>'s automatic model-state 400 from
/// <see cref="UpsertCustomMoveRequest"/>, which fires before the action runs and is identical
/// either way.
/// </para>
/// </summary>
[ApiController]
public sealed class CustomMovesController(ICustomMoveService customMoveService) : ControllerBase
{
    /// <summary>
    /// The legal owner segments, written down once.
    ///
    /// <para>
    /// <b>Anchored deliberately.</b> <c>RegexInlineRouteConstraint</c> matches with
    /// <c>IsMatch</c>, which is unanchored, so without <c>^...$</c> the segment
    /// <c>xmonstersx</c> matches and reaches <see cref="Owners"/> below. Verified in a scratch
    /// host, not assumed — architecture.md §17.1 probe B, where the unanchored version answered
    /// <c>200</c> with <c>owner == "xmonstersx"</c>. The anchors are invisible in review and the
    /// whole route-table isolation argument rests on them.
    /// </para>
    ///
    /// <para>
    /// A <c>const string</c> so all four actions share one literal and
    /// <c>CustomMoveOwnerDriftTests</c> can read it back off the attribute by reflection — which
    /// is how the dictionary and the regex are kept from drifting apart (B12 assertion 2). An
    /// <c>IRouteConstraint</c> would have let the set be derived from <c>Enum.GetValues</c>
    /// instead, and was rejected because it lives in <c>RouteOptions.ConstraintMap</c> on the host
    /// and three of the four endpoint harnesses build their own (§17.2).
    /// </para>
    /// </summary>
    private const string OwnerSegment =
        "{owner:regex(^(mysteries|monsters|minions|locations|bystanders)$)}";

    private const string CollectionRoute = "api/" + OwnerSegment + "/{ownerId:guid}/custom-moves";
    private const string ItemRoute = CollectionRoute + "/{moveId:guid}";

    /// <summary>
    /// <b><see cref="StringComparer.OrdinalIgnoreCase"/> is load-bearing, not tidiness.</b> Route
    /// matching is case-insensitive <i>including the literal segments</i>, and the constraint hands
    /// the action the caller's own casing — so
    /// <c>GET /api/MONSTERS/{id}/CUSTOM-MOVES</c>, which returns <c>200 []</c> on the shipped
    /// per-domain routes (measured against a running server, architecture.md §16.2), arrives here
    /// as <c>owner == "MONSTERS"</c>. An ordinal dictionary would miss it and turn a working URL
    /// into a 404 or a 500. B2 and B-R2; the endpoint matrix carries a mixed-case case so this
    /// cannot be undone quietly.
    /// </summary>
    private static readonly IReadOnlyDictionary<string, DomainOwnerType> Owners =
        new Dictionary<string, DomainOwnerType>(StringComparer.OrdinalIgnoreCase)
        {
            ["mysteries"] = DomainOwnerType.Mystery,
            ["monsters"] = DomainOwnerType.Monster,
            ["minions"] = DomainOwnerType.Minion,
            ["locations"] = DomainOwnerType.Location,
            ["bystanders"] = DomainOwnerType.Bystander,
        };

    [HttpGet(CollectionRoute)]
    public async Task<ActionResult<IReadOnlyList<CustomMoveResponse>>> GetCustomMoves(
        string owner,
        Guid ownerId,
        CancellationToken cancellationToken) =>
        ToActionResult(await customMoveService.ListAsync(OwnerTypeOf(owner), ownerId, cancellationToken));

    [HttpPost(CollectionRoute)]
    public async Task<ActionResult<CustomMoveResponse>> CreateCustomMove(
        string owner,
        Guid ownerId,
        [FromBody] UpsertCustomMoveRequest request,
        CancellationToken cancellationToken) =>
        ToActionResult(await customMoveService.CreateAsync(OwnerTypeOf(owner), ownerId, request, cancellationToken));

    [HttpPut(ItemRoute)]
    public async Task<ActionResult<CustomMoveResponse>> UpdateCustomMove(
        string owner,
        Guid ownerId,
        Guid moveId,
        [FromBody] UpsertCustomMoveRequest request,
        CancellationToken cancellationToken) =>
        ToActionResult(await customMoveService.UpdateAsync(OwnerTypeOf(owner), ownerId, moveId, request, cancellationToken));

    [HttpDelete(ItemRoute)]
    public async Task<IActionResult> DeleteCustomMove(
        string owner,
        Guid ownerId,
        Guid moveId,
        CancellationToken cancellationToken) =>
        await customMoveService.DeleteAsync(OwnerTypeOf(owner), ownerId, moveId, cancellationToken)
            ? NoContent()
            : NotFound();

    /// <summary>
    /// <b>Indexer, not <c>TryGetValue</c>, deliberately.</b> The route constraint has already
    /// rejected every segment that is not one of the five, so a miss here is not a client error —
    /// it is the regex and <see cref="Owners"/> having drifted apart, which is a bug in this file
    /// and should surface as a 500 rather than be laundered into a 404 that looks like a stale id.
    /// <c>CustomMoveOwnerDriftTests</c> is what makes that unreachable; this throw is the
    /// backstop, not the guard.
    /// </summary>
    private static DomainOwnerType OwnerTypeOf(string owner) => Owners[owner];

    // Copied from MonstersController/MinionsController/MysteriesController, which each have their
    // own private pair — there is no shared base class or extension method, and starting one in a
    // phase whose point is subtraction would be its own change (B9).
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
