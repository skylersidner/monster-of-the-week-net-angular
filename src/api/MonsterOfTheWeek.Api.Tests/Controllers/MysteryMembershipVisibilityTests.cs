using System.Net;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;

namespace MonsterOfTheWeek.Api.Tests.Controllers;

/// <summary>
/// The halves of Peach's A8, D6 and D7 that say <i>"verify from the <b>second</b> mystery, not just
/// from this one."</i>
///
/// <para>
/// Those three criteria are claims about server state seen through a <b>different</b> mystery's own
/// read route, and the wizard is not what makes them true — the API is. The frontend's share is
/// "which request does pressing Next issue", which
/// <c>mystery-create-phase4-ledger.spec.ts</c> pins exactly; this file is the other half, "and what
/// does that request do to the other mystery." Composed, they cover the criterion without a live
/// stack, with no data left behind and without a browser.
/// </para>
///
/// <para>
/// <see cref="MysteryLinkEndpointTests.Put_LinksOneEntityToTwoMysteries"/> already asserts the same
/// shape by counting <b>bridge rows</b>. It is deliberately not enough for these three: a bridge row
/// is not what the user sees, and the projection that turns bridge rows into
/// <c>GET /api/mysteries/{id}/{collection}</c> and into <c>MysteryIds</c> on the flat catalogue is
/// exactly where a filter could be scoped to the wrong mystery and still leave the row count right.
/// These assert the read routes.
/// </para>
/// </summary>
public sealed class MysteryMembershipVisibilityTests
{
    public static TheoryData<string> Collections() => new() { "monsters", "locations", "bystanders" };

    private static Guid EntityId(MysteryLinkApiHarness harness, string collection) => collection switch
    {
        "monsters" => harness.MonsterId,
        "locations" => harness.LocationId,
        "bystanders" => harness.BystanderId,
        _ => throw new ArgumentOutOfRangeException(nameof(collection)),
    };

    /// <summary>Only the two fields these criteria are about; every list DTO carries both.</summary>
    private sealed record ListItem(Guid Id, IReadOnlyList<Guid> MysteryIds);

    /// <summary>
    /// Reads a list route.
    ///
    /// <para>
    /// The body is read as a <b>string</b> and deserialized from it rather than through
    /// <c>ReadFromJsonAsync</c>, and an empty body fails loudly instead of becoming an empty list.
    /// <c>ReadFromJsonAsync&lt;List&lt;T&gt;&gt;()</c> returns <c>null</c> for an empty body, and the
    /// obvious <c>?? []</c> would turn "this response had no content" into "this mystery has no
    /// locations" — which is the exact distinction every assertion in this file rests on, so it must
    /// not be collapsible. Responses are disposed for the same kind of reason: nothing in this file
    /// should be able to fail for a transport reason while reading like a membership fact.
    /// </para>
    ///
    /// <para>
    /// <b>Recorded because it cost an hour and will cost someone else one.</b> An earlier version of
    /// this file appeared to fail intermittently here, with <c>Assert.Contains() Failure …
    /// Collection: []</c> on the second mystery's list — reproducing consistently in a full run and
    /// vanishing whenever the file was edited. There was nothing wrong with the API, the harness or
    /// the query. Mutation testing had restored the file with <c>Copy-Item</c>, which preserves the
    /// <i>source</i> file's timestamp, so the restored source was <b>older</b> than the assembly
    /// built from the mutant and MSBuild's incremental build skipped it: the runs were executing the
    /// mutated binary. Restoring a mutated file by copy is not enough — touch it, or the next run
    /// silently tests the mutant and every conclusion drawn from it is backwards.
    /// </para>
    /// </summary>
    private static async Task<IReadOnlyList<ListItem>> GetListAsync(MysteryLinkApiHarness harness, string path)
    {
        using var response = await harness.Client.GetAsync(path);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadAsStringAsync();
        Assert.False(string.IsNullOrWhiteSpace(body), $"GET {path} answered 200 with an empty body.");

        return JsonSerializer.Deserialize<List<ListItem>>(body, JsonOptions)
            ?? throw new InvalidOperationException($"GET {path} body did not deserialize: {body}");
    }

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    /// <summary>A status-code-only call whose response is disposed rather than left open.</summary>
    private static async Task<HttpStatusCode> StatusOfAsync(Task<HttpResponseMessage> call)
    {
        using var response = await call;
        return response.StatusCode;
    }

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

    /// <summary>Links the seeded entity into both seeded mysteries, the way two wizard sessions would.</summary>
    private static async Task LinkToBothAsync(MysteryLinkApiHarness harness, string collection)
    {
        var entityId = EntityId(harness, collection);
        Assert.Equal(
            HttpStatusCode.NoContent,
            await StatusOfAsync(harness.PutAsync($"/api/mysteries/{harness.MysteryId}/{collection}/{entityId}")));
        Assert.Equal(
            HttpStatusCode.NoContent,
            await StatusOfAsync(harness.PutAsync($"/api/mysteries/{harness.OtherMysteryId}/{collection}/{entityId}")));
    }

    /// <summary>
    /// **A8.** Attaching an entity that is already in another mystery leaves <b>one</b> catalogue row
    /// carrying both memberships — decision 1 (shared M:N reuse) made observable from the read
    /// routes rather than from the bridge table.
    /// </summary>
    [Theory]
    [MemberData(nameof(Collections))]
    public async Task A8_LinkingAnEntityAlreadyInAnotherMystery_LeavesOneRowVisibleFromBoth(string collection)
    {
        await using var harness = await MysteryLinkApiHarness.StartAsync();
        var entityId = EntityId(harness, collection);

        await LinkToBothAsync(harness, collection);

        // Seen from the mystery that had it first, and from the one that just attached it.
        var first = await GetListAsync(harness, $"/api/mysteries/{harness.MysteryId}/{collection}");
        var second = await GetListAsync(harness, $"/api/mysteries/{harness.OtherMysteryId}/{collection}");
        Assert.Equal([entityId], first.Where(item => item.Id == entityId).Select(item => item.Id));
        Assert.Equal([entityId], second.Where(item => item.Id == entityId).Select(item => item.Id));

        // One catalogue row, not two: "it stays the same object everywhere it appears" (US-1).
        var catalogue = await GetListAsync(harness, $"/api/{collection}");
        var row = Assert.Single(catalogue, item => item.Id == entityId);

        // And the row itself reports both memberships, which is the field the wizard's removal
        // modal and the list pages' usage disclosure both read.
        Assert.Equal(
            new HashSet<Guid> { harness.MysteryId, harness.OtherMysteryId },
            row.MysteryIds.ToHashSet());
        Assert.Equal(2, row.MysteryIds.Count);
    }

    /// <summary>
    /// **D6, cross-mystery half.** Detach → the membership is gone, the entity is still in the flat
    /// catalogue, and it is still in every other mystery that used it.
    /// </summary>
    [Theory]
    [MemberData(nameof(Collections))]
    public async Task D6_DetachingFromOneMystery_LeavesTheEntityAndEveryOtherMembership(string collection)
    {
        await using var harness = await MysteryLinkApiHarness.StartAsync();
        var entityId = EntityId(harness, collection);
        await LinkToBothAsync(harness, collection);

        Assert.Equal(
            HttpStatusCode.NoContent,
            await StatusOfAsync(harness.DeleteAsync($"/api/mysteries/{harness.MysteryId}/{collection}/{entityId}")));

        Assert.DoesNotContain(
            await GetListAsync(harness, $"/api/mysteries/{harness.MysteryId}/{collection}"),
            item => item.Id == entityId);

        // The whole point of the button that is not Delete.
        Assert.Contains(
            await GetListAsync(harness, $"/api/mysteries/{harness.OtherMysteryId}/{collection}"),
            item => item.Id == entityId);

        var row = Assert.Single(await GetListAsync(harness, $"/api/{collection}"), item => item.Id == entityId);
        Assert.Equal([harness.OtherMysteryId], row.MysteryIds);
    }

    /// <summary>
    /// **D7, cross-mystery half.** Delete → the entity is gone from the catalogue <b>and</b> from
    /// every other mystery that used it. "Removes it everywhere" is the whole difference between the
    /// two buttons, and the other mystery is the only place that difference is visible.
    /// </summary>
    [Theory]
    [MemberData(nameof(Collections))]
    public async Task D7_DeletingTheEntity_RemovesItFromEveryMysteryAndFromTheCatalogue(string collection)
    {
        await using var harness = await MysteryLinkApiHarness.StartAsync();
        var entityId = EntityId(harness, collection);
        await LinkToBothAsync(harness, collection);

        Assert.Equal(HttpStatusCode.NoContent, await StatusOfAsync(harness.Client.DeleteAsync($"/api/{collection}/{entityId}")));

        Assert.DoesNotContain(
            await GetListAsync(harness, $"/api/mysteries/{harness.MysteryId}/{collection}"),
            item => item.Id == entityId);
        Assert.DoesNotContain(
            await GetListAsync(harness, $"/api/mysteries/{harness.OtherMysteryId}/{collection}"),
            item => item.Id == entityId);
        Assert.DoesNotContain(
            await GetListAsync(harness, $"/api/{collection}"),
            item => item.Id == entityId);

        // No orphaned bridge rows behind the projection: a membership that still exists in the
        // table but is filtered out of the read would pass every assertion above and resurrect the
        // moment anything joined differently.
        Assert.Equal(0, await BridgeRowCountAsync(harness, collection));
    }

    /// <summary>
    /// **D12's server-side premise, and the boundary §7.6 draws.** The wizard's drain maps 404 to
    /// success; a user-initiated delete elsewhere must still see the 404, so the 404 has to actually
    /// be there to be mapped. Also pins the shape of the stale-picker case (G4): a second delete of
    /// something already deleted is a genuine 404, not a silent 204.
    /// </summary>
    [Theory]
    [MemberData(nameof(Collections))]
    public async Task D12_DeletingAnAlreadyDeletedEntity_Is404_SoTheRuleHasSomethingToBeScopedTo(string collection)
    {
        await using var harness = await MysteryLinkApiHarness.StartAsync();
        var entityId = EntityId(harness, collection);
        await LinkToBothAsync(harness, collection);

        Assert.Equal(HttpStatusCode.NoContent, await StatusOfAsync(harness.Client.DeleteAsync($"/api/{collection}/{entityId}")));
        Assert.Equal(HttpStatusCode.NotFound, await StatusOfAsync(harness.Client.DeleteAsync($"/api/{collection}/{entityId}")));

        // And the link that §7.6 says must fail loudly rather than report a membership that was
        // never created: a PUT against the deleted row is a 404, not a 204.
        Assert.Equal(
            HttpStatusCode.NotFound,
            await StatusOfAsync(harness.PutAsync($"/api/mysteries/{harness.MysteryId}/{collection}/{entityId}")));
    }

    /// <summary>
    /// **S5, characterised rather than merely absent.** Detaching an entity from its only mystery
    /// leaves a catalogue entity in no mystery, and that is a first-class state — the same one
    /// standalone creation produces — not an orphan to be cleaned up. Asserted so that a future
    /// "tidy up unreferenced entities" change fails here instead of silently deleting someone's
    /// recurring location.
    /// </summary>
    [Theory]
    [MemberData(nameof(Collections))]
    public async Task S5_DetachingTheOnlyMembership_LeavesTheEntityInTheCatalogueWithNoMysteries(string collection)
    {
        await using var harness = await MysteryLinkApiHarness.StartAsync();
        var entityId = EntityId(harness, collection);

        Assert.Equal(
            HttpStatusCode.NoContent,
            await StatusOfAsync(harness.PutAsync($"/api/mysteries/{harness.MysteryId}/{collection}/{entityId}")));
        Assert.Equal(
            HttpStatusCode.NoContent,
            await StatusOfAsync(harness.DeleteAsync($"/api/mysteries/{harness.MysteryId}/{collection}/{entityId}")));

        var row = Assert.Single(await GetListAsync(harness, $"/api/{collection}"), item => item.Id == entityId);
        Assert.Empty(row.MysteryIds);
        Assert.Equal(0, await BridgeRowCountAsync(harness, collection));
    }
}
