using System.Net;
using MonsterOfTheWeek.Api.Data.Entities;

namespace MonsterOfTheWeek.Api.Tests.Controllers;

/// <summary>
/// <b>The two assertions only the unified shape can make</b> —
/// <c>docs/resource-images/endpoint-unification.md</c> §4 U2.
///
/// <para>
/// These are deliberately <b>not</b> in <c>ResourceImageEndpointTests</c>. That file is U1's
/// oracle and its value is that it is byte-identical on both sides of this refactor; adding
/// assertions that can only pass <i>after</i> U2 would destroy exactly the property it exists for.
/// So the before/after-identical suite and the only-after suite are separate files, and the
/// separation is the point rather than an accident of organisation.
/// </para>
///
/// <para>
/// <b>Both pin a single token that is invisible in review and invisible to the matrix.</b> U1's
/// sixty cases only ever request the four correct, lower-case segments, so neither the
/// <c>OrdinalIgnoreCase</c> comparer nor the regex anchors change a single one of their results.
/// Measured, not assumed: removing either one leaves the entire rest of the suite green. These two
/// facts are the whole guard, which is why they are written down rather than left to the live
/// probe that first measured them.
/// </para>
/// </summary>
public sealed class ResourceImagesControllerRoutingTests
{
    /// <summary>
    /// Route matching is case-insensitive <i>including literal segments</i>, so
    /// <c>/api/MONSTERS/…</c> matched the shipped per-domain route and must keep matching. The
    /// constraint hands the action the caller's own casing, so the segment arrives as
    /// <c>"MONSTERS"</c> — an ordinal dictionary would throw out of <c>OwnerTypeOf</c> and turn a
    /// working URL into a 500.
    ///
    /// <para>
    /// Asserted as <b>200 with the same body as the lower-case request</b>, not merely "not 500":
    /// a comparison against the canonical casing is what makes this a statement about equivalence
    /// rather than about one status code.
    /// </para>
    /// </summary>
    [Theory]
    [InlineData("MONSTERS")]
    [InlineData("Monsters")]
    [InlineData("mOnStErS")]
    public async Task AnyCasingOfAnOwnerSegment_AnswersIdenticallyToTheCanonicalCasing(string casing)
    {
        await using var harness = await ResourceImageApiHarness.StartAsync();
        var ownerId = harness.OwnerIdFor(DomainOwnerType.Monster);

        var canonical = await harness.Client.GetAsync($"/api/monsters/{ownerId}/images");
        var mixed = await harness.Client.GetAsync($"/api/{casing}/{ownerId}/images");

        Assert.Equal(HttpStatusCode.OK, canonical.StatusCode);
        Assert.Equal(HttpStatusCode.OK, mixed.StatusCode);
        Assert.Equal(await canonical.Content.ReadAsStringAsync(), await mixed.Content.ReadAsStringAsync());
    }

    /// <summary>
    /// <c>RegexInlineRouteConstraint</c> matches with <c>IsMatch</c>, which is <b>unanchored</b>.
    /// Without <c>^…$</c> the segment <c>xmonstersx</c> matches, reaches the controller's segment
    /// dictionary, misses, and 500s.
    ///
    /// <para>
    /// <b>The body length is the assertion, not the status code.</b> Both an unanchored match and a
    /// correct rejection can produce a 404, so 404 alone proves nothing: a request that reaches the
    /// controller and is turned away answers <c>application/problem+json</c> (<c>AddProblemDetails</c>
    /// is registered), while a request the route table never matched has <b>no body and no
    /// Content-Type at all</b>. That difference is the only observable one, so it is what gets
    /// asserted — against a known controller 404 measured in the same run, so "zero bytes" is a
    /// comparison rather than a remembered number.
    /// </para>
    /// </summary>
    [Theory]
    [InlineData("xmonstersx")]
    [InlineData("monstersx")]
    [InlineData("xmonsters")]
    [InlineData("mysteries")]
    public async Task ASegmentOutsideTheAlternation_IsRejectedByRouting_AndNeverReachesTheController(string segment)
    {
        await using var harness = await ResourceImageApiHarness.StartAsync();
        var ownerId = harness.OwnerIdFor(DomainOwnerType.Monster);

        var routingMiss = await harness.Client.GetAsync($"/api/{segment}/{ownerId}/images");

        // The control, in the same run: a segment the route DOES accept, for an owner that does not
        // exist. Same status, and the body is what tells the two apart.
        var controllerMiss = await harness.Client.GetAsync($"/api/monsters/{Guid.NewGuid()}/images");

        Assert.Equal(HttpStatusCode.NotFound, routingMiss.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, controllerMiss.StatusCode);

        Assert.Empty(await routingMiss.Content.ReadAsByteArrayAsync());
        Assert.Null(routingMiss.Content.Headers.ContentType);

        // And the control really is the other shape, so the assertion above cannot pass by both
        // sides being empty for some unrelated reason.
        Assert.NotEmpty(await controllerMiss.Content.ReadAsByteArrayAsync());
        Assert.Equal("application/problem+json", controllerMiss.Content.Headers.ContentType?.MediaType);
    }
}
