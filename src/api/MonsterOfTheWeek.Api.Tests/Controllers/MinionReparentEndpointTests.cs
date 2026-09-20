using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using MonsterOfTheWeek.Api.Contracts;

namespace MonsterOfTheWeek.Api.Tests.Controllers;

/// <summary>
/// <c>PUT /api/monsters/{monsterId}/minions/{id}</c> — the re-parent verb, end to end.
///
/// <para>
/// **The distinction these tests exist to pin is <i>move</i> versus <i>add</i>.** The route reads
/// like the Phase 1 membership verb and is deliberately shaped on it, but mystery membership is
/// M:N across a bridge table, where asserting a membership inserts a row and disturbs nothing
/// else. <c>Minion.MonsterId</c> is a required, non-nullable, single-valued FK: there is one row
/// and it is updated in place, so arriving at the new monster and leaving the old one are the same
/// event. Every success case below therefore asserts <b>both ends</b> — a test that only checked
/// the minion had arrived would still pass against an implementation that somehow duplicated it.
/// </para>
///
/// <para>
/// **What pins the route's existence is the 204, not the 404s.** An unmatched route is also a 404,
/// so every not-found case here would pass green against a route that was never registered. Only
/// the cases that demand a 204 <i>and</i> an actually changed parent can fail if the action
/// disappears. Named because Phase 2 learned this the expensive way: a test pins the code path it
/// reaches, not the behaviour its name claims.
/// </para>
/// </summary>
public sealed class MinionReparentEndpointTests
{
    [Fact]
    public async Task Put_MovesTheMinion_ToTheTargetMonster_AndOffTheOriginMonster()
    {
        await using var harness = await MinionReparentApiHarness.StartAsync();

        var response = await harness.PutAsync($"/api/monsters/{harness.TargetMonsterId}/minions/{harness.MinionId}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(harness.TargetMonsterId, await harness.ParentOfAsync(harness.MinionId));

        // Both ends, through the read routes a client actually uses.
        Assert.DoesNotContain(await MinionsOfAsync(harness, harness.OriginMonsterId), m => m.Id == harness.MinionId);
        Assert.Contains(await MinionsOfAsync(harness, harness.TargetMonsterId), m => m.Id == harness.MinionId);
    }

    /// <summary>
    /// The parent is denormalised into <c>MinionListItemResponse.MonsterName</c> and
    /// <c>MinionDetailResponse.MonsterName</c>. Both are live projections rather than stored
    /// columns, so a move must be visible in them immediately — this is the assertion that would
    /// fail if anyone ever cached that name.
    /// </summary>
    [Fact]
    public async Task Put_UpdatesTheParentNameCarriedOnEveryMinionResponse()
    {
        await using var harness = await MinionReparentApiHarness.StartAsync();

        var before = await DetailOfAsync(harness, harness.MinionId);
        Assert.Equal("Gravewalker", before.MonsterName);

        Assert.Equal(
            HttpStatusCode.NoContent,
            (await harness.PutAsync($"/api/monsters/{harness.TargetMonsterId}/minions/{harness.MinionId}")).StatusCode);

        var after = await DetailOfAsync(harness, harness.MinionId);
        Assert.Equal(harness.TargetMonsterId, after.MonsterId);
        Assert.Equal("Hollow Choir", after.MonsterName);

        var flat = await ListAsync<MinionListItemResponse>(harness, "/api/minions");
        var listed = Assert.Single(flat, m => m.Id == harness.MinionId);
        Assert.Equal(harness.TargetMonsterId, listed.MonsterId);
        Assert.Equal("Hollow Choir", listed.MonsterName);
    }

    /// <summary>
    /// Sub-resources hang off <c>MinionId</c>, never off the monster, so they travel with the
    /// minion by construction. Asserted rather than assumed, because "the minion moved but its
    /// attacks stayed behind" is the failure this design would be blamed for first.
    /// </summary>
    [Fact]
    public async Task Put_CarriesTheMinionsWholeSubtreeWithIt()
    {
        await using var harness = await MinionReparentApiHarness.StartAsync();

        Assert.Equal(
            HttpStatusCode.NoContent,
            (await harness.PutAsync($"/api/monsters/{harness.TargetMonsterId}/minions/{harness.MinionId}")).StatusCode);

        var detail = await DetailOfAsync(harness, harness.MinionId);
        Assert.Equal(harness.AttackId, Assert.Single(detail.Attacks).Id);
        Assert.Equal(harness.PowerId, Assert.Single(detail.Powers).Id);
        Assert.Equal(harness.ArmorId, Assert.Single(detail.Armors).Id);
        Assert.Equal(harness.WeaknessId, Assert.Single(detail.Weaknesses).Id);
        Assert.Equal(harness.CustomMoveId, Assert.Single(detail.CustomMoves).Id);

        // Same ids, not merely the same count: a move must not re-key anything.
        await using var context = harness.NewContext();
        Assert.Equal(harness.MinionId, await context.MinionAttacks.AsNoTracking().Where(x => x.Id == harness.AttackId).Select(x => x.MinionId).SingleAsync());
    }

    [Fact]
    public async Task Put_IsIdempotent_WhenTheMinionIsAlreadyOnThatMonster()
    {
        await using var harness = await MinionReparentApiHarness.StartAsync();
        var path = $"/api/monsters/{harness.TargetMonsterId}/minions/{harness.MinionId}";

        Assert.Equal(HttpStatusCode.NoContent, (await harness.PutAsync(path)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await harness.PutAsync(path)).StatusCode);

        Assert.Equal(harness.TargetMonsterId, await harness.ParentOfAsync(harness.MinionId));

        // Idempotent in effect *and* in row count — a move must never become a copy.
        await using var context = harness.NewContext();
        Assert.Equal(1, await context.Minions.CountAsync());
    }

    /// <summary>
    /// The concurrency story, characterised sequentially because that is what is deterministic.
    /// There is no insert here and therefore no composite primary key to violate, so the guard
    /// behind the membership verb has no analogue: two re-parents of the same minion are a plain
    /// last-writer-wins update, and every ordering leaves the minion on a real monster.
    /// </summary>
    [Fact]
    public async Task Put_LastWriterWins_WhenTheSameMinionIsMovedTwice()
    {
        await using var harness = await MinionReparentApiHarness.StartAsync();

        Assert.Equal(
            HttpStatusCode.NoContent,
            (await harness.PutAsync($"/api/monsters/{harness.TargetMonsterId}/minions/{harness.MinionId}")).StatusCode);

        // The intermediate state, asserted so this test guards rather than decorates: without it
        // an implementation that never moves anything passes vacuously, because the minion starts
        // on the origin monster and the final assertion expects it there.
        Assert.Equal(harness.TargetMonsterId, await harness.ParentOfAsync(harness.MinionId));

        Assert.Equal(
            HttpStatusCode.NoContent,
            (await harness.PutAsync($"/api/monsters/{harness.OriginMonsterId}/minions/{harness.MinionId}")).StatusCode);

        Assert.Equal(harness.OriginMonsterId, await harness.ParentOfAsync(harness.MinionId));
        Assert.DoesNotContain(await MinionsOfAsync(harness, harness.TargetMonsterId), m => m.Id == harness.MinionId);
    }

    [Fact]
    public async Task Put_ForAnUnknownMonster_Is404_AndLeavesTheMinionWhereItWas()
    {
        await using var harness = await MinionReparentApiHarness.StartAsync();

        var response = await harness.PutAsync($"/api/monsters/{Guid.NewGuid()}/minions/{harness.MinionId}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal(harness.OriginMonsterId, await harness.ParentOfAsync(harness.MinionId));
    }

    [Fact]
    public async Task Put_ForAnUnknownMinion_Is404()
    {
        await using var harness = await MinionReparentApiHarness.StartAsync();

        var response = await harness.PutAsync($"/api/monsters/{harness.TargetMonsterId}/minions/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal(harness.OriginMonsterId, await harness.ParentOfAsync(harness.MinionId));
    }

    /// <summary>
    /// The monster check runs before the minion is loaded, so an unknown monster is a 404 even when
    /// the minion is unknown too. Pins the ordering the membership verb established: parent first,
    /// then child, then the already-there short-circuit.
    /// </summary>
    [Fact]
    public async Task Put_ForTwoUnknownIds_Is404()
    {
        await using var harness = await MinionReparentApiHarness.StartAsync();

        Assert.Equal(
            HttpStatusCode.NotFound,
            (await harness.PutAsync($"/api/monsters/{Guid.NewGuid()}/minions/{Guid.NewGuid()}")).StatusCode);
    }

    /// <summary>
    /// The <c>:guid</c> route constraints reject a malformed id at routing rather than letting it
    /// reach model binding — a 404, not a 500. Same property the membership routes were checked
    /// for, and the reason this harness runs real routing instead of calling the controller.
    /// </summary>
    [Fact]
    public async Task Put_WithAMalformedId_Is404_NotAServerError()
    {
        await using var harness = await MinionReparentApiHarness.StartAsync();

        Assert.Equal(
            HttpStatusCode.NotFound,
            (await harness.PutAsync($"/api/monsters/not-a-guid/minions/{harness.MinionId}")).StatusCode);
        Assert.Equal(
            HttpStatusCode.NotFound,
            (await harness.PutAsync($"/api/monsters/{harness.TargetMonsterId}/minions/not-a-guid")).StatusCode);
    }

    /// <summary>
    /// The new <c>PUT</c> shares its path with the <c>GET</c> collection and the <c>POST</c>
    /// create, which is exactly the coexistence §4.1 checked for the membership verb. Neither
    /// neighbour changed.
    /// </summary>
    [Fact]
    public async Task Put_DoesNotDisturbTheGetAndPostThatShareThisPath()
    {
        await using var harness = await MinionReparentApiHarness.StartAsync();

        Assert.Single(await MinionsOfAsync(harness, harness.OriginMonsterId));
        Assert.Empty(await MinionsOfAsync(harness, harness.TargetMonsterId));

        var created = await harness.Client.PostAsJsonAsync(
            $"/api/monsters/{harness.TargetMonsterId}/minions",
            new { name = "Second Hand", description = (string?)null, harmCapacity = 1, minionTypeId = await AnyMinionTypeIdAsync(harness) });

        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        Assert.Single(await MinionsOfAsync(harness, harness.TargetMonsterId));
    }

    /// <summary>
    /// <b>5a-P5 — the regression guard.</b> A plain <c>PUT /api/minions/{id}</c> edits the minion
    /// and leaves its parent exactly where it was.
    ///
    /// <para>
    /// Peach's phrasing: this "pins the thing both documents wrongly assumed already worked."
    /// Until 5a there was no test anywhere that issued this verb, so "updating a minion does not
    /// re-parent it" was an assumption, not a covered behaviour. It matters now because 5b adds a
    /// monster picker to the minion composer, and the cheap way to build that is to put a
    /// <c>MonsterId</c> on the update body — which would make the plain update a silent re-parent
    /// and give the same intention two verbs with different semantics (architecture §6.4).
    /// </para>
    ///
    /// <para>
    /// The rename is asserted alongside the parent on purpose. Without it, an endpoint that
    /// rejected the body outright would also leave the parent alone and this would pass for the
    /// wrong reason — the vacuous-setup shape 5a hunted elsewhere.
    /// </para>
    /// </summary>
    [Fact]
    public async Task Put_ToThePlainMinionRoute_EditsTheMinion_AndLeavesItsParentAlone()
    {
        await using var harness = await MinionReparentApiHarness.StartAsync();

        var response = await harness.Client.PutAsJsonAsync(
            $"/api/minions/{harness.MinionId}",
            new
            {
                name = "Grave Hand, Renamed",
                description = "Still a Gravewalker minion.",
                harmCapacity = 2,
                minionTypeId = await AnyMinionTypeIdAsync(harness),
            });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        // The edit landed...
        var updated = (await response.Content.ReadFromJsonAsync<MinionDetailResponse>())!;
        Assert.Equal("Grave Hand, Renamed", updated.Name);
        Assert.Equal(2, updated.HarmCapacity);

        // ...and the parent did not move, in the response projection and in the row itself.
        Assert.Equal(harness.OriginMonsterId, updated.MonsterId);
        Assert.Equal(harness.OriginMonsterId, await harness.ParentOfAsync(harness.MinionId));
        Assert.Contains(await MinionsOfAsync(harness, harness.OriginMonsterId), m => m.Id == harness.MinionId);
        Assert.Empty(await MinionsOfAsync(harness, harness.TargetMonsterId));
    }

    /// <summary>
    /// <b>5a-P5, the half that bites later.</b> A <c>monsterId</c> sent in the update body is
    /// ignored rather than honoured.
    ///
    /// <para>
    /// The test above passes against today's contract because <c>UpsertMinionRequest</c> has no
    /// such member, so the property is simply dropped in deserialisation. This one states the
    /// behaviour the contract is protecting, so that adding <i>and wiring</i> a <c>MonsterId</c>
    /// fails here rather than in a browser. Paired with the contract assertion below, which fails
    /// on the field being added at all — the two catch the change at different stages and neither
    /// subsumes the other.
    /// </para>
    /// </summary>
    [Fact]
    public async Task Put_ToThePlainMinionRoute_IgnoresAMonsterIdSmuggledIntoTheBody()
    {
        await using var harness = await MinionReparentApiHarness.StartAsync();

        var response = await harness.Client.PutAsJsonAsync(
            $"/api/minions/{harness.MinionId}",
            new
            {
                name = "Grave Hand",
                description = (string?)null,
                harmCapacity = 1,
                minionTypeId = await AnyMinionTypeIdAsync(harness),
                monsterId = harness.TargetMonsterId,
            });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(harness.OriginMonsterId, await harness.ParentOfAsync(harness.MinionId));
        Assert.Empty(await MinionsOfAsync(harness, harness.TargetMonsterId));
    }

    /// <summary>
    /// <b>5a-P5, stated against the contract.</b> <c>UpsertMinionRequest</c> "has no
    /// <c>MonsterId</c> and must not gain one" (architecture §6.4), so say so where adding one
    /// breaks a test rather than only a convention.
    /// </summary>
    [Fact]
    public void UpsertMinionRequest_CarriesNoParent()
    {
        Assert.DoesNotContain(
            typeof(UpsertMinionRequest).GetProperties(),
            property => property.Name.Contains("Monster", StringComparison.OrdinalIgnoreCase));
    }

    private static async Task<Guid> AnyMinionTypeIdAsync(MinionReparentApiHarness harness)
    {
        await using var context = harness.NewContext();
        return await context.MinionTypes.AsNoTracking().Select(x => x.Id).FirstAsync();
    }

    private static Task<IReadOnlyList<MinionListItemResponse>> MinionsOfAsync(MinionReparentApiHarness harness, Guid monsterId) =>
        ListAsync<MinionListItemResponse>(harness, $"/api/monsters/{monsterId}/minions");

    private static async Task<IReadOnlyList<T>> ListAsync<T>(MinionReparentApiHarness harness, string path)
    {
        var response = await harness.Client.GetAsync(path);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await response.Content.ReadFromJsonAsync<List<T>>() ?? [];
    }

    private static async Task<MinionDetailResponse> DetailOfAsync(MinionReparentApiHarness harness, Guid minionId)
    {
        var response = await harness.Client.GetAsync($"/api/minions/{minionId}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<MinionDetailResponse>())!;
    }
}
