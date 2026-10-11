using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Data.Entities;

namespace MonsterOfTheWeek.Api.Tests.Controllers;

/// <summary>
/// Phase 2's endpoint gate for <c>CustomMovesController</c>
/// (<c>docs/domain-custom-moves/architecture.md</c> §5 Phase 2, §23 item 4): all four verbs
/// against all five owner segments, an unknown segment 404ing at routing, and the status codes
/// the sixteen replaced actions returned.
///
/// <para>
/// <b>The matrix is a <c>[Theory]</c> over the enum on purpose.</b> Five segments is the claim —
/// four domains that already worked plus the Mystery that never had these verbs — and a matrix
/// written as five <c>[Fact]</c>s is one a sixth owner type can be added without.
/// </para>
/// </summary>
public sealed class CustomMoveEndpointTests
{
    public static TheoryData<CustomMoveOwnerType, string> EveryOwnerSegment() => new()
    {
        { CustomMoveOwnerType.Mystery, "mysteries" },
        { CustomMoveOwnerType.Monster, "monsters" },
        { CustomMoveOwnerType.Minion, "minions" },
        { CustomMoveOwnerType.Location, "locations" },
        { CustomMoveOwnerType.Bystander, "bystanders" },
    };

    private static async Task<T> ReadAsync<T>(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<T>())!;
    }

    [Theory]
    [MemberData(nameof(EveryOwnerSegment))]
    public async Task AllFourVerbs_WorkAgainstEveryOwnerSegment(CustomMoveOwnerType ownerType, string segment)
    {
        await using var harness = await CustomMoveApiHarness.StartAsync();
        var ownerId = harness.OwnerIdFor(ownerType);
        var collection = $"/api/{segment}/{ownerId}/custom-moves";

        // GET on an owner with no moves: 200 [], not 404. The distinction ListAsync's owner check
        // exists to preserve (§18).
        Assert.Empty(await ReadAsync<List<CustomMoveResponse>>(await harness.Client.GetAsync(collection)));

        // POST -> 200, not 201. All sixteen replaced actions returned Ok, and §2.1 budgets no
        // contract change (B9).
        using var created = await harness.Client.PostAsJsonAsync(collection, new UpsertCustomMoveRequest("Vanish", "into the dark"));
        Assert.Equal(HttpStatusCode.OK, created.StatusCode);
        var move = await ReadAsync<CustomMoveResponse>(created);
        Assert.Equal("Vanish", move.Name);

        // The row landed under the right owner type — the one thing a 200 body cannot show,
        // because CustomMoveResponse deliberately carries no owner (§2.1).
        await using (var context = harness.NewContext())
        {
            var stored = await context.CustomMoves.AsNoTracking().SingleAsync(x => x.Id == move.Id);
            Assert.Equal(ownerType, stored.OwnerType);
            Assert.Equal(ownerId, stored.OwnerId);
        }

        Assert.Equal(move.Id, Assert.Single(await ReadAsync<List<CustomMoveResponse>>(await harness.Client.GetAsync(collection))).Id);

        var item = $"{collection}/{move.Id}";
        using var updated = await harness.Client.PutAsJsonAsync(item, new UpsertCustomMoveRequest("Linger", null));
        var updatedMove = await ReadAsync<CustomMoveResponse>(updated);
        Assert.Equal(move.Id, updatedMove.Id);
        Assert.Equal("Linger", updatedMove.Name);
        Assert.Null(updatedMove.Description);

        // DELETE -> 204, and a second one -> 404, derived from `deleted > 0` (B9).
        using (var deleted = await harness.Client.DeleteAsync(item))
        {
            Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
        }

        using (var again = await harness.Client.DeleteAsync(item))
        {
            Assert.Equal(HttpStatusCode.NotFound, again.StatusCode);
        }

        Assert.Empty(await ReadAsync<List<CustomMoveResponse>>(await harness.Client.GetAsync(collection)));
    }

    /// <summary>
    /// An owner id that resolves to nothing is a 404 on every segment — which is the half of the
    /// five-arm <c>OwnerExistsAsync</c> switch a wrong arm would break, since an arm pointed at
    /// the wrong table answers "exists" for ids that do not.
    /// </summary>
    [Theory]
    [InlineData("mysteries")]
    [InlineData("monsters")]
    [InlineData("minions")]
    [InlineData("locations")]
    [InlineData("bystanders")]
    public async Task UnknownOwnerId_Is404_OnEveryOwnerSegment(string segment)
    {
        await using var harness = await CustomMoveApiHarness.StartAsync();
        var missing = $"/api/{segment}/{Guid.NewGuid()}/custom-moves";

        using var listed = await harness.Client.GetAsync(missing);
        using var posted = await harness.Client.PostAsJsonAsync(missing, new UpsertCustomMoveRequest("Vanish", null));

        Assert.Equal(HttpStatusCode.NotFound, listed.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, posted.StatusCode);
    }

    /// <summary>
    /// Every owner id in the harness belongs to exactly one table, so presenting one under
    /// another segment must 404 — the mismatched-pair case no FK can catch, over HTTP.
    /// </summary>
    [Fact]
    public async Task AnOwnerIdPresentedUnderTheWrongSegment_Is404()
    {
        await using var harness = await CustomMoveApiHarness.StartAsync();

        using var response = await harness.Client.PostAsJsonAsync(
            $"/api/monsters/{harness.BystanderId}/custom-moves", new UpsertCustomMoveRequest("Vanish", null));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);

        await using var context = harness.NewContext();
        Assert.Equal(0, await context.CustomMoves.CountAsync());
    }

    /// <summary>
    /// <b><c>/api/MONSTERS/{id}/CUSTOM-MOVES</c> returns <c>200</c> today</b> — measured against
    /// the running dev server before any of this was written (architecture.md §16.2) — because
    /// route matching is case-insensitive including the literal segments. The constraint keeps
    /// that, and hands the action the caller's own casing, so a default (ordinal) segment
    /// dictionary would turn a working URL into a 500 or a 404. B2 and B-R2.
    ///
    /// <para>
    /// In the matrix rather than off on its own, because the matrix is where someone will look.
    /// </para>
    /// </summary>
    [Theory]
    [InlineData("MONSTERS", "CUSTOM-MOVES")]
    [InlineData("Monsters", "Custom-Moves")]
    [InlineData("monsters", "custom-moves")]
    public async Task MixedCaseSegments_StillResolve_AndStillWrite(string ownerSegment, string moveSegment)
    {
        await using var harness = await CustomMoveApiHarness.StartAsync();
        var collection = $"/api/{ownerSegment}/{harness.MonsterId}/{moveSegment}";

        using var listed = await harness.Client.GetAsync(collection);
        Assert.Equal(HttpStatusCode.OK, listed.StatusCode);

        using var created = await harness.Client.PostAsJsonAsync(collection, new UpsertCustomMoveRequest("Vanish", null));
        Assert.Equal(HttpStatusCode.OK, created.StatusCode);

        // Not merely routed — stored under Monster, which is what proves the dictionary lookup
        // succeeded rather than the request having been swallowed somewhere.
        await using var context = harness.NewContext();
        Assert.Equal(CustomMoveOwnerType.Monster, (await context.CustomMoves.AsNoTracking().SingleAsync()).OwnerType);
    }

    /// <summary>
    /// The unknown-segment gate, and the anchors that make it real.
    ///
    /// <para>
    /// <c>xmonstersx</c> is the case that matters: <c>RegexInlineRouteConstraint</c> matches with
    /// the unanchored <c>IsMatch</c>, so without <c>^...$</c> it would match <c>monsters</c>,
    /// reach the action, and be looked up as itself — proven in a scratch host (§17.1 probe B),
    /// where it answered <c>200</c>. The anchors are one character each and invisible in review.
    /// </para>
    ///
    /// <para>
    /// 404 and not 400, deliberately (§16.2): a bad segment and a missing owner are already
    /// byte-identical on the shipped API — both <c>NotFound()</c> with no body, the latter via
    /// <c>Program.cs</c>'s <c>/api/{**rest}</c> catch-all. Answering 400 would mean letting the
    /// request reach application code, which costs exactly the route-table isolation the
    /// constraint buys, and would make a client typo louder than a stale id.
    /// </para>
    /// </summary>
    [Theory]
    [InlineData("xmonstersx")]
    [InlineData("monster")]
    [InlineData("hunters")]
    [InlineData("nonsense")]
    public async Task UnknownOwnerSegment_Is404_AtRouting(string segment)
    {
        await using var harness = await CustomMoveApiHarness.StartAsync();
        var collection = $"/api/{segment}/{harness.MonsterId}/custom-moves";

        using var listed = await harness.Client.GetAsync(collection);
        using var posted = await harness.Client.PostAsJsonAsync(collection, new UpsertCustomMoveRequest("Vanish", null));

        Assert.Equal(HttpStatusCode.NotFound, listed.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, posted.StatusCode);

        // Nothing reached the service: a segment that routed and then failed a lookup would still
        // have been a 404, and this is what tells the two apart.
        await using var context = harness.NewContext();
        Assert.Equal(0, await context.CustomMoves.CountAsync());
    }

    [Fact]
    public async Task MalformedOwnerId_Is404_RatherThan500()
    {
        // {ownerId:guid} does this, exactly as the shipped per-domain routes' {id:guid} did.
        await using var harness = await CustomMoveApiHarness.StartAsync();

        using var response = await harness.Client.GetAsync("/api/monsters/not-a-guid/custom-moves");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task AMoveCannotBeReadWrittenOrDeletedThroughAnotherOwnersUrl()
    {
        // §2.5's closing guarantee, over HTTP rather than at the service: the (OwnerType,
        // OwnerId, Id) predicate is the only thing producing it, and the controller adds no
        // check of its own.
        await using var harness = await CustomMoveApiHarness.StartAsync();

        using var created = await harness.Client.PostAsJsonAsync(
            $"/api/monsters/{harness.MonsterId}/custom-moves", new UpsertCustomMoveRequest("Vanish", null));
        var move = await ReadAsync<CustomMoveResponse>(created);

        // A different owner type, with a real id of its own...
        using var crossType = await harness.Client.PutAsJsonAsync(
            $"/api/bystanders/{harness.BystanderId}/custom-moves/{move.Id}", new UpsertCustomMoveRequest("Stolen", null));
        // ...and a different owner of the same type.
        using var crossOwner = await harness.Client.DeleteAsync(
            $"/api/monsters/{Guid.NewGuid()}/custom-moves/{move.Id}");

        Assert.Equal(HttpStatusCode.NotFound, crossType.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, crossOwner.StatusCode);

        // Untouched, and still readable through its own owner.
        Assert.Equal(
            "Vanish",
            Assert.Single(await ReadAsync<List<CustomMoveResponse>>(
                await harness.Client.GetAsync($"/api/monsters/{harness.MonsterId}/custom-moves"))).Name);
    }

    [Fact]
    public async Task AMissingName_Is400_FromModelState_NotFromTheService()
    {
        // [ApiController]'s automatic model-state 400 from UpsertCustomMoveRequest's
        // [Required, MaxLength(255)], which fires before the action runs — identical to what the
        // sixteen replaced actions did, and the reason adopting ToErrorResult changes nothing
        // (B9).
        await using var harness = await CustomMoveApiHarness.StartAsync();

        using var response = await harness.Client.PostAsJsonAsync(
            $"/api/monsters/{harness.MonsterId}/custom-moves", new { description = "no name" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        await using var context = harness.NewContext();
        Assert.Equal(0, await context.CustomMoves.CountAsync());
    }

    [Fact]
    public async Task TheOldPerDomainRoutesAreGone_AndTheUnifiedOneServesTheSameUrls()
    {
        // The sixteen actions were deleted this phase, so this is really a statement that the
        // URLs did not move: the same paths that MonstersController answered now resolve to
        // CustomMovesController. If both existed, the literal `monsters` segment would outrank
        // the constrained parameter and the old action would silently keep winning — which is
        // why the deletion and the new controller had to land in one commit.
        await using var harness = await CustomMoveApiHarness.StartAsync();

        // This harness registers *only* ICustomMoveService. A surviving MonstersController action
        // would have needed IMonsterService and 500ed here instead of answering 200.
        using var response = await harness.Client.GetAsync($"/api/monsters/{harness.MonsterId}/custom-moves");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
