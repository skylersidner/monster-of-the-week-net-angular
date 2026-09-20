using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;

namespace MonsterOfTheWeek.Api.Tests.Controllers;

/// <summary>
/// <c>PUT /api/mysteries/{mysteryId}/{collection}/{id}</c> from the wire: the status codes a
/// client actually receives, and the route-constraint behaviour that no service test can reach.
/// </summary>
public sealed class MysteryLinkEndpointTests
{
    public static TheoryData<string> Collections() => new() { "monsters", "locations", "bystanders" };

    private static Guid EntityId(MysteryLinkApiHarness harness, string collection) => collection switch
    {
        "monsters" => harness.MonsterId,
        "locations" => harness.LocationId,
        "bystanders" => harness.BystanderId,
        _ => throw new ArgumentOutOfRangeException(nameof(collection)),
    };

    private static async Task<int> BridgeRowCountAsync(MysteryLinkApiHarness harness, string collection)
    {
        await using var context = harness.NewContext();
        return collection switch
        {
            "monsters" => await context.MysteryMonsters.CountAsync(),
            "locations" => await context.MysteryLocations.CountAsync(),
            "bystanders" => await context.MysteryBystanders.CountAsync(),
            _ => throw new ArgumentOutOfRangeException(nameof(collection)),
        };
    }

    [Theory]
    [MemberData(nameof(Collections))]
    public async Task Put_Returns204_AndCreatesExactlyOneBridgeRow(string collection)
    {
        await using var harness = await MysteryLinkApiHarness.StartAsync();

        var response = await harness.PutAsync($"/api/mysteries/{harness.MysteryId}/{collection}/{EntityId(harness, collection)}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(1, await BridgeRowCountAsync(harness, collection));
    }

    // The idempotency contract as a client sees it: §4.1 requires 204 on a re-link, never 409,
    // because §5.1 fires this unconditionally from forkJoin batches.
    [Theory]
    [MemberData(nameof(Collections))]
    public async Task Put_IsIdempotent_SecondCallIs204AndWritesNoSecondRow(string collection)
    {
        await using var harness = await MysteryLinkApiHarness.StartAsync();
        var path = $"/api/mysteries/{harness.MysteryId}/{collection}/{EntityId(harness, collection)}";

        Assert.Equal(HttpStatusCode.NoContent, (await harness.PutAsync(path)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await harness.PutAsync(path)).StatusCode);

        Assert.Equal(1, await BridgeRowCountAsync(harness, collection));
    }

    [Theory]
    [MemberData(nameof(Collections))]
    public async Task Put_Returns404_WhenMysteryDoesNotExist(string collection)
    {
        await using var harness = await MysteryLinkApiHarness.StartAsync();

        var response = await harness.PutAsync($"/api/mysteries/{Guid.NewGuid()}/{collection}/{EntityId(harness, collection)}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal(0, await BridgeRowCountAsync(harness, collection));
    }

    [Theory]
    [MemberData(nameof(Collections))]
    public async Task Put_Returns404_WhenEntityDoesNotExist(string collection)
    {
        await using var harness = await MysteryLinkApiHarness.StartAsync();

        var response = await harness.PutAsync($"/api/mysteries/{harness.MysteryId}/{collection}/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal(0, await BridgeRowCountAsync(harness, collection));
    }

    // A malformed id must fail the {…:guid} route constraint and never reach model binding, which
    // would otherwise bind Guid.Empty and go looking for it, or throw. 404, not 400 and not 500.
    [Theory]
    [MemberData(nameof(Collections))]
    public async Task Put_Returns404_WhenMysteryIdIsNotAGuid(string collection)
    {
        await using var harness = await MysteryLinkApiHarness.StartAsync();

        var response = await harness.PutAsync($"/api/mysteries/not-a-guid/{collection}/{EntityId(harness, collection)}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Theory]
    [MemberData(nameof(Collections))]
    public async Task Put_Returns404_WhenEntityIdIsNotAGuid(string collection)
    {
        await using var harness = await MysteryLinkApiHarness.StartAsync();

        var response = await harness.PutAsync($"/api/mysteries/{harness.MysteryId}/{collection}/not-a-guid");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // Guid.Empty parses, so it clears the route constraint and has to be refused by the existence
    // check instead. It is what a client sends when a picker's selection is missing.
    [Theory]
    [MemberData(nameof(Collections))]
    public async Task Put_Returns404_ForEmptyGuids(string collection)
    {
        await using var harness = await MysteryLinkApiHarness.StartAsync();

        Assert.Equal(
            HttpStatusCode.NotFound,
            (await harness.PutAsync($"/api/mysteries/{Guid.Empty}/{collection}/{EntityId(harness, collection)}")).StatusCode);
        Assert.Equal(
            HttpStatusCode.NotFound,
            (await harness.PutAsync($"/api/mysteries/{harness.MysteryId}/{collection}/{Guid.Empty}")).StatusCode);
        Assert.Equal(0, await BridgeRowCountAsync(harness, collection));
    }

    // §4.1: "PUT asserts it exists, DELETE asserts it doesn't." Both on the same URI.
    [Theory]
    [MemberData(nameof(Collections))]
    public async Task PutThenDelete_RoundTrips_AndDeleteOfAnAbsentLinkIs404(string collection)
    {
        await using var harness = await MysteryLinkApiHarness.StartAsync();
        var path = $"/api/mysteries/{harness.MysteryId}/{collection}/{EntityId(harness, collection)}";

        Assert.Equal(HttpStatusCode.NoContent, (await harness.PutAsync(path)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await harness.DeleteAsync(path)).StatusCode);
        Assert.Equal(0, await BridgeRowCountAsync(harness, collection));

        // Today's unlink reports 404 for a membership that is not there. Recorded because it is
        // asymmetric with the PUT, which is a deliberate 204 in the same situation.
        Assert.Equal(HttpStatusCode.NotFound, (await harness.DeleteAsync(path)).StatusCode);

        // And the link can be re-asserted afterwards.
        Assert.Equal(HttpStatusCode.NoContent, (await harness.PutAsync(path)).StatusCode);
        Assert.Equal(1, await BridgeRowCountAsync(harness, collection));
    }

    // Decision 1: shared M:N reuse. Two memberships for one entity, and detaching one leaves the
    // other in place.
    [Theory]
    [MemberData(nameof(Collections))]
    public async Task Put_LinksOneEntityToTwoMysteries(string collection)
    {
        await using var harness = await MysteryLinkApiHarness.StartAsync();
        var entityId = EntityId(harness, collection);

        Assert.Equal(HttpStatusCode.NoContent, (await harness.PutAsync($"/api/mysteries/{harness.MysteryId}/{collection}/{entityId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await harness.PutAsync($"/api/mysteries/{harness.OtherMysteryId}/{collection}/{entityId}")).StatusCode);
        Assert.Equal(2, await BridgeRowCountAsync(harness, collection));

        Assert.Equal(HttpStatusCode.NoContent, (await harness.DeleteAsync($"/api/mysteries/{harness.MysteryId}/{collection}/{entityId}")).StatusCode);
        Assert.Equal(1, await BridgeRowCountAsync(harness, collection));
    }

    // The membership PUT takes no body (§4.1: "No request body, therefore no new DTO"). A client
    // that sends one anyway — XHR defaults, an interceptor, a retry wrapper — must still get 204
    // rather than a 415 or a binding failure.
    [Theory]
    [MemberData(nameof(Collections))]
    public async Task Put_Returns204_WhenAClientSendsABodyAnyway(string collection)
    {
        await using var harness = await MysteryLinkApiHarness.StartAsync();
        var path = $"/api/mysteries/{harness.MysteryId}/{collection}/{EntityId(harness, collection)}";

        var response = await harness.Client.PutAsJsonAsync(path, new { ignored = "value" });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(1, await BridgeRowCountAsync(harness, collection));
    }

    // The new action shares its URI with the shipped unlink DELETE and its prefix with the shipped
    // create POST (`POST /api/mysteries/{id}/{collection}`, one segment shorter). If any of them
    // had collided, MapControllers would have thrown at startup or routing would have picked the
    // wrong action. 405 rather than 404 is the proof the URI is known and only PUT/DELETE are
    // defined on it: in particular the create POST does not reach down to the membership URI.
    [Theory]
    [MemberData(nameof(Collections))]
    public async Task MembershipUri_DefinesOnlyPutAndDelete(string collection)
    {
        await using var harness = await MysteryLinkApiHarness.StartAsync();
        var path = $"/api/mysteries/{harness.MysteryId}/{collection}/{EntityId(harness, collection)}";

        var get = await harness.Client.GetAsync(path);
        var post = await harness.Client.PostAsync(path, content: null);

        Assert.Equal(HttpStatusCode.MethodNotAllowed, get.StatusCode);
        Assert.Equal(HttpStatusCode.MethodNotAllowed, post.StatusCode);
        Assert.Equal(0, await BridgeRowCountAsync(harness, collection));
    }

    // The link verb is membership-only: it must not touch the entity's own row. This matters for
    // Phase 4, whose load-bearing regression is "attach an existing entity, press Next, confirm
    // its own fields are unchanged if untouched."
    [Theory]
    [MemberData(nameof(Collections))]
    public async Task Put_DoesNotModifyTheEntityRow(string collection)
    {
        await using var harness = await MysteryLinkApiHarness.StartAsync();
        var before = await ReadEntityStampsAsync(harness, collection);

        Assert.Equal(
            HttpStatusCode.NoContent,
            (await harness.PutAsync($"/api/mysteries/{harness.MysteryId}/{collection}/{EntityId(harness, collection)}")).StatusCode);

        Assert.Equal(before, await ReadEntityStampsAsync(harness, collection));
    }

    // The Phase 2 gate was a race between two concurrent PUTs for the *same* membership: both
    // pass the service's already-linked check, both insert, and before Bowser's repository guard
    // the loser got a 500 on the composite primary key. MysteryLinkRepositoryTests pins the guard
    // by staging the collision deterministically against two DbContexts; this is the same
    // property from the wire, through real routing, the real controller, service and repository,
    // with the two requests genuinely in flight at once rather than one after the other —
    // the gap Put_IsIdempotent_SecondCallIs204AndWritesNoSecondRow leaves open.
    //
    // Whether a given pair actually lands inside the window is a scheduling accident, so the pair
    // is repeated against a cleared membership. That makes "sometimes" into "reliably at least
    // once" without making any assertion probabilistic: every round asserts the whole contract,
    // so one 500 or one duplicate row in any round fails the test.
    //
    // The count is not decorative. Against a build with the repository guard deleted, this test
    // failed on all three collections in 5 of 5 runs at 25 rounds; an earlier harness variant
    // slow enough to serialise the requests failed on only 1–2 of 3 collections per run. If it
    // is ever lowered, re-measure it the same way, because a concurrency test that cannot fail
    // on the bug it names is worse than none.
    private const int ConcurrentPutRounds = 25;

    [Theory]
    [MemberData(nameof(Collections))]
    public async Task ConcurrentPutPair_ForTheSameMembership_BothReturn204_AndLeaveExactlyOneRow(string collection)
    {
        await using var harness = await MysteryLinkApiHarness.StartAsync();
        var path = $"/api/mysteries/{harness.MysteryId}/{collection}/{EntityId(harness, collection)}";

        for (var round = 0; round < ConcurrentPutRounds; round++)
        {
            await ClearBridgeRowsAsync(harness, collection);
            Assert.Equal(0, await BridgeRowCountAsync(harness, collection));

            // Both callers are parked on the gate before either sends, so releasing it puts the
            // requests on the wire together instead of letting the first finish on its own.
            using var gate = new SemaphoreSlim(0, 2);
            var pair = Enumerable.Range(0, 2)
                .Select(async _ =>
                {
                    await gate.WaitAsync();
                    return await harness.PutAsync(path);
                })
                .ToArray();

            gate.Release(2);
            var responses = await Task.WhenAll(pair);

            Assert.All(responses, response => Assert.Equal(HttpStatusCode.NoContent, response.StatusCode));
            Assert.Equal(1, await BridgeRowCountAsync(harness, collection));

            foreach (var response in responses)
            {
                response.Dispose();
            }
        }
    }

    private static async Task ClearBridgeRowsAsync(MysteryLinkApiHarness harness, string collection)
    {
        await using var context = harness.NewContext();
        _ = collection switch
        {
            "monsters" => await context.MysteryMonsters.ExecuteDeleteAsync(),
            "locations" => await context.MysteryLocations.ExecuteDeleteAsync(),
            "bystanders" => await context.MysteryBystanders.ExecuteDeleteAsync(),
            _ => throw new ArgumentOutOfRangeException(nameof(collection)),
        };
    }

    private static async Task<(string Name, DateTimeOffset UpdatedAt)> ReadEntityStampsAsync(
        MysteryLinkApiHarness harness,
        string collection)
    {
        await using var context = harness.NewContext();
        return collection switch
        {
            "monsters" => await context.Monsters.Where(x => x.Id == harness.MonsterId)
                .Select(x => ValueTuple.Create(x.Name, x.UpdatedAt)).SingleAsync(),
            "locations" => await context.Locations.Where(x => x.Id == harness.LocationId)
                .Select(x => ValueTuple.Create(x.Name, x.UpdatedAt)).SingleAsync(),
            "bystanders" => await context.Bystanders.Where(x => x.Id == harness.BystanderId)
                .Select(x => ValueTuple.Create(x.Name, x.UpdatedAt)).SingleAsync(),
            _ => throw new ArgumentOutOfRangeException(nameof(collection)),
        };
    }
}
