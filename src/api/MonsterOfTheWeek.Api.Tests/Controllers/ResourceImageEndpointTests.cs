using System.Net;
using System.Net.Http.Json;
using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Data.Entities;
using MonsterOfTheWeek.Api.Tests.Services.ResourceImages;

namespace MonsterOfTheWeek.Api.Tests.Controllers;

/// <summary>
/// The six resource-images endpoints over real HTTP (design.md §3, phases.md Phase 3), against
/// <b>all four owning domains</b>.
///
/// <para>
/// <b>U1 of <c>docs/resource-images/endpoint-unification.md</c> — the oracle.</b> Until now this
/// file tested Monsters only, on the reasoning that *"the four controllers are deliberately thin,
/// identical wrappers around the one shared <c>IResourceImageService</c>"*. That reasoning is
/// sound about the service and silent about the controllers, and §1.1 measured one real divergence
/// between them: Locations and Bystanders have no <c>ToErrorResult</c> pair and inline
/// <c>return NotFound()</c> instead. A diff of source said the four behave alike; nothing ran them
/// and asked.
/// </para>
///
/// <para>
/// <b>This file is written to need zero edits at U2, and that is the point of it.</b> The URLs do
/// not change when the twenty-four per-domain actions collapse into one controller — the client
/// already builds them from a single segment map — so every assertion below goes on holding
/// against the unified controller. A test file that is byte-identical before and after a refactor,
/// and green both times, is the strongest available statement that nothing observable moved; U2's
/// gate is <c>git diff</c> over this file coming back empty. So: no controller type is named here,
/// no DI is reached into, nothing but URLs, status codes and bodies. Anything that would have to
/// change at U2 belongs in the harness, not here.
/// </para>
///
/// <para>
/// <b>It also stands alone.</b> Three of the four domains had no automated HTTP coverage of the
/// 24 MiB request limit, the 201/400 upload branch, the derived-primary projection or the
/// ownership-mismatch 404 — four behaviours that exist in four copies with nothing comparing them.
/// That gap is real whether or not the unification ever lands (§11 Q8).
/// </para>
/// </summary>
public sealed class ResourceImageEndpointTests
{
    /// <summary>
    /// The four image-owning domains and their shipped route segments.
    ///
    /// <para>
    /// <b>Transcribed, deliberately — this is the side that must not derive.</b> The subject under
    /// test is the running route table: what <c>/api/{segment}/{id}/images</c> actually answers.
    /// Building this list from <c>IResourceImageService.ImageOwnerTypes</c> instead would make the
    /// expectation and the subject two readings of one declaration, and a member quietly dropped
    /// from that set would stop being tested while every case stayed green — exactly the vacuity
    /// that made U0's first Postgres assertion worthless. Relating the declared set to the route
    /// table is U3's job, and U3 can only do it honestly if this side is written down.
    /// </para>
    ///
    /// <para>
    /// Four, not five: <c>Mystery</c> has no images endpoint, which is why
    /// <c>/api/mysteries/{id}/images</c> is a routing 404 today and stays one after U2.
    /// </para>
    /// </summary>
    public static TheoryData<DomainOwnerType, string> EveryImageOwnerSegment() => new()
    {
        { DomainOwnerType.Monster, "monsters" },
        { DomainOwnerType.Minion, "minions" },
        { DomainOwnerType.Location, "locations" },
        { DomainOwnerType.Bystander, "bystanders" },
    };

    /// <summary>
    /// The pin against silent shrinkage. Every theory below runs once per row above, so deleting a
    /// row removes a domain's coverage without failing anything — the matrix would simply get
    /// smaller and stay green. One transcribed count is what turns that into a failure.
    /// </summary>
    [Fact]
    public async Task TheMatrix_CoversEveryDomainTheHarnessSeeds_AndThereAreFour()
    {
        await using var harness = await ResourceImageApiHarness.StartAsync();

        Assert.Equal(4, EveryImageOwnerSegment().Count);
        Assert.Equal(harness.SeededOwnerTypeCount, EveryImageOwnerSegment().Count);
    }

    // =============================================================================================
    // Upload
    // =============================================================================================

    [Theory]
    [MemberData(nameof(EveryImageOwnerSegment))]
    public async Task Upload_Returns201_WithExactPerFileResult_ForAMixedBatch(DomainOwnerType ownerType, string segment)
    {
        await using var harness = await ResourceImageApiHarness.StartAsync();

        var response = await harness.UploadImagesAsync(
            Images(segment, harness.OwnerIdFor(ownerType)),
            ("good.webp", ResourceImageTestFixtures.TinyWebp()),
            ("bad.gif", ResourceImageTestFixtures.GifBytes()));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ResourceImageUploadResponse>();
        var uploaded = Assert.Single(body!.Uploaded);
        Assert.Equal("good.webp", uploaded.FileName);
        Assert.Equal("image/webp", uploaded.ContentType);
        Assert.True(uploaded.IsPrimary); // the only image for this owner, so it's the derived primary
        var rejected = Assert.Single(body.Rejected);
        Assert.Equal("bad.gif", rejected.FileName);
        Assert.Equal("UnsupportedType", rejected.Reason);
    }

    [Theory]
    [MemberData(nameof(EveryImageOwnerSegment))]
    public async Task Upload_Returns400_WhenEveryFileIsRejected(DomainOwnerType ownerType, string segment)
    {
        await using var harness = await ResourceImageApiHarness.StartAsync();

        var response = await harness.UploadImagesAsync(
            Images(segment, harness.OwnerIdFor(ownerType)),
            ("bad.gif", ResourceImageTestFixtures.GifBytes()));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Theory]
    [MemberData(nameof(EveryImageOwnerSegment))]
    public async Task Upload_Returns404_WhenTheOwnerDoesNotExist(DomainOwnerType ownerType, string segment)
    {
        _ = ownerType;
        await using var harness = await ResourceImageApiHarness.StartAsync();

        var response = await harness.UploadImagesAsync(
            Images(segment, Guid.NewGuid()),
            ("good.webp", ResourceImageTestFixtures.TinyWebp()));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    /// <summary>
    /// The 24 MiB ceiling itself is covered: the exact status code a request over it gets back
    /// is not pinned here. Both <c>[RequestSizeLimit]</c> (Kestrel's own body-size feature,
    /// checked against <c>Content-Length</c> and the cumulative bytes read) and
    /// <c>[RequestFormLimits(MultipartBodyLengthLimit = ...)]</c> (the multipart form reader's
    /// own, separate limit) are in play for a multipart POST, and which one fires first — and
    /// whether the raw connection gets reset before a clean 413 can be written — depends on
    /// exactly how the HttpClient/Kestrel pair negotiate the request body, which is sensitive to
    /// plumbing this harness does not control. Confirmed directly against the real dev server
    /// with <c>curl</c> instead (phases.md Phase 3 verification) rather than asserted here.
    ///
    /// <para>
    /// <b>Three of the four domains run this for the first time at U1.</b> Both attributes are
    /// per-action, so there are four independent copies of the pair and nothing has ever compared
    /// them — a limit typed with one digit missing on Locations would be invisible.
    /// </para>
    /// </summary>
    [Theory]
    [MemberData(nameof(EveryImageOwnerSegment))]
    public async Task Upload_RejectsTheRequest_WhenTheBodyExceedsTheTwentyFourMebibyteLimit(DomainOwnerType ownerType, string segment)
    {
        await using var harness = await ResourceImageApiHarness.StartAsync();

        var response = await harness.UploadOversizedBodyAsync(
            Images(segment, harness.OwnerIdFor(ownerType)), (24 * 1024 * 1024) + 1);

        Assert.True(
            response.StatusCode is HttpStatusCode.RequestEntityTooLarge or HttpStatusCode.BadRequest,
            $"Expected the oversized body to be rejected, got {response.StatusCode}.");
    }

    // =============================================================================================
    // List
    // =============================================================================================

    [Theory]
    [MemberData(nameof(EveryImageOwnerSegment))]
    public async Task GetImages_ListsInSortOrder_WithTheDerivedPrimaryFlagged(DomainOwnerType ownerType, string segment)
    {
        await using var harness = await ResourceImageApiHarness.StartAsync();
        var images = Images(segment, harness.OwnerIdFor(ownerType));
        await harness.UploadImagesAsync(
            images,
            ("first.webp", ResourceImageTestFixtures.TinyWebp()),
            ("second.webp", ResourceImageTestFixtures.TinyWebp()));

        var response = await harness.Client.GetAsync(images);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var listed = await response.Content.ReadFromJsonAsync<List<ResourceImageResponse>>();
        Assert.Equal(2, listed!.Count);
        Assert.Equal("first.webp", listed[0].FileName);
        Assert.True(listed[0].IsPrimary);
        Assert.False(listed[1].IsPrimary);
    }

    // =============================================================================================
    // File and thumbnail
    // =============================================================================================

    [Theory]
    [MemberData(nameof(EveryImageOwnerSegment))]
    public async Task GetImageFile_ReturnsTheOriginalBytes_WithContentTypeAndCacheControl(DomainOwnerType ownerType, string segment)
    {
        await using var harness = await ResourceImageApiHarness.StartAsync();
        var images = Images(segment, harness.OwnerIdFor(ownerType));
        var uploaded = await UploadOneAsync(harness, images);

        var response = await harness.Client.GetAsync($"{images}/{uploaded.Id}/file");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("image/webp", response.Content.Headers.ContentType?.MediaType);
        AssertImageCacheControl(response);
        Assert.Equal(ResourceImageTestFixtures.TinyWebp(), await response.Content.ReadAsByteArrayAsync());
    }

    [Theory]
    [MemberData(nameof(EveryImageOwnerSegment))]
    public async Task GetImageThumbnail_ReturnsA256x256Jpeg_WithCacheControl(DomainOwnerType ownerType, string segment)
    {
        await using var harness = await ResourceImageApiHarness.StartAsync();
        var images = Images(segment, harness.OwnerIdFor(ownerType));
        var uploaded = await UploadOneAsync(harness, images);

        var response = await harness.Client.GetAsync($"{images}/{uploaded.Id}/thumbnail");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("image/jpeg", response.Content.Headers.ContentType?.MediaType);
        AssertImageCacheControl(response);
        var bytes = await response.Content.ReadAsByteArrayAsync();
        using var thumbnail = SkiaSharp.SKBitmap.Decode(bytes);
        Assert.Equal(256, thumbnail!.Width);
        Assert.Equal(256, thumbnail.Height);
    }

    /// <summary>
    /// design.md §2.1's fallback: a row whose thumbnail failed to generate streams the original
    /// instead of surfacing a missing-thumbnail state — so the response comes back as the
    /// original's own content type, not <c>image/jpeg</c>, and the caller cannot tell.
    ///
    /// <para>
    /// <b>New at U1, for all four domains rather than three.</b> §4 expected this branch to be
    /// among the facts being widened; it was not among them, and no test anywhere exercised it —
    /// the branch existed in four controller copies with zero coverage. It is included because U2
    /// rewrites exactly this branch into one place, and a branch with no oracle is one a refactor
    /// can quietly drop.
    /// </para>
    /// </summary>
    [Theory]
    [MemberData(nameof(EveryImageOwnerSegment))]
    public async Task GetImageThumbnail_FallsBackToTheOriginal_WhenNoThumbnailWasStored(DomainOwnerType ownerType, string segment)
    {
        await using var harness = await ResourceImageApiHarness.StartAsync();
        var images = Images(segment, harness.OwnerIdFor(ownerType));
        var uploaded = await UploadOneAsync(harness, images);
        await harness.ClearStoredThumbnailAsync(uploaded.Id);

        var response = await harness.Client.GetAsync($"{images}/{uploaded.Id}/thumbnail");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("image/webp", response.Content.Headers.ContentType?.MediaType);
        AssertImageCacheControl(response);
        Assert.Equal(ResourceImageTestFixtures.TinyWebp(), await response.Content.ReadAsByteArrayAsync());
    }

    [Theory]
    [MemberData(nameof(EveryImageOwnerSegment))]
    public async Task GetImageFile_Returns404_WhenTheImageBelongsToADifferentOwner(DomainOwnerType ownerType, string segment)
    {
        await using var harness = await ResourceImageApiHarness.StartAsync();
        var uploaded = await UploadOneAsync(harness, Images(segment, harness.OwnerIdFor(ownerType)));

        // Same imageId, but requested through the OTHER owner of the same type — so the only thing
        // that can produce the 404 is the OwnerId half of the discriminator.
        var response = await harness.Client.GetAsync(
            $"{Images(segment, harness.OtherOwnerIdFor(ownerType))}/{uploaded.Id}/file");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Theory]
    [MemberData(nameof(EveryImageOwnerSegment))]
    public async Task GetImageFile_Returns404_ForAnUnknownImageId(DomainOwnerType ownerType, string segment)
    {
        await using var harness = await ResourceImageApiHarness.StartAsync();

        var response = await harness.Client.GetAsync(
            $"{Images(segment, harness.OwnerIdFor(ownerType))}/{Guid.NewGuid()}/file");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // =============================================================================================
    // Set primary
    // =============================================================================================

    [Theory]
    [MemberData(nameof(EveryImageOwnerSegment))]
    public async Task SetPrimary_Returns204_AndTheNewPrimaryIsReflectedInTheList(DomainOwnerType ownerType, string segment)
    {
        await using var harness = await ResourceImageApiHarness.StartAsync();
        var images = Images(segment, harness.OwnerIdFor(ownerType));
        var uploadResponse = await harness.UploadImagesAsync(
            images,
            ("first.webp", ResourceImageTestFixtures.TinyWebp()),
            ("second.webp", ResourceImageTestFixtures.TinyWebp()));
        var uploaded = (await uploadResponse.Content.ReadFromJsonAsync<ResourceImageUploadResponse>())!.Uploaded;

        var putResponse = await harness.Client.PutAsync($"{images}/{uploaded[1].Id}/primary", content: null);

        Assert.Equal(HttpStatusCode.NoContent, putResponse.StatusCode);
        var listed = await (await harness.Client.GetAsync(images))
            .Content.ReadFromJsonAsync<List<ResourceImageResponse>>();
        Assert.True(listed!.Single(i => i.Id == uploaded[1].Id).IsPrimary);
        Assert.False(listed!.Single(i => i.Id == uploaded[0].Id).IsPrimary);
    }

    [Theory]
    [MemberData(nameof(EveryImageOwnerSegment))]
    public async Task SetPrimary_Returns404_WhenTheImageBelongsToADifferentOwner(DomainOwnerType ownerType, string segment)
    {
        await using var harness = await ResourceImageApiHarness.StartAsync();
        var uploaded = await UploadOneAsync(harness, Images(segment, harness.OwnerIdFor(ownerType)));

        var response = await harness.Client.PutAsync(
            $"{Images(segment, harness.OtherOwnerIdFor(ownerType))}/{uploaded.Id}/primary", content: null);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // =============================================================================================
    // Delete
    // =============================================================================================

    [Theory]
    [MemberData(nameof(EveryImageOwnerSegment))]
    public async Task DeleteImage_Returns204_AndRemovesItFromTheList(DomainOwnerType ownerType, string segment)
    {
        await using var harness = await ResourceImageApiHarness.StartAsync();
        var images = Images(segment, harness.OwnerIdFor(ownerType));
        var uploaded = await UploadOneAsync(harness, images);

        var deleteResponse = await harness.Client.DeleteAsync($"{images}/{uploaded.Id}");

        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);
        var listed = await (await harness.Client.GetAsync(images))
            .Content.ReadFromJsonAsync<List<ResourceImageResponse>>();
        Assert.Empty(listed!);
    }

    [Theory]
    [MemberData(nameof(EveryImageOwnerSegment))]
    public async Task DeleteImage_Returns404_ForAnUnknownImageId(DomainOwnerType ownerType, string segment)
    {
        await using var harness = await ResourceImageApiHarness.StartAsync();

        var response = await harness.Client.DeleteAsync(
            $"{Images(segment, harness.OwnerIdFor(ownerType))}/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Theory]
    [MemberData(nameof(EveryImageOwnerSegment))]
    public async Task DeleteImage_OnTheExplicitPrimary_AutoPromotesTheFirstUploadedRemainingImage(DomainOwnerType ownerType, string segment)
    {
        // The database's own ON DELETE SET NULL (Phase 1) plus the derivation rule (Phase 2),
        // now proven end-to-end through the real HTTP DELETE and GET, for every owning domain —
        // each of which has its own PrimaryImageId column and its own SetNull FK.
        await using var harness = await ResourceImageApiHarness.StartAsync();
        var images = Images(segment, harness.OwnerIdFor(ownerType));
        var uploadResponse = await harness.UploadImagesAsync(
            images,
            ("first.webp", ResourceImageTestFixtures.TinyWebp()),
            ("second.webp", ResourceImageTestFixtures.TinyWebp()));
        var uploaded = (await uploadResponse.Content.ReadFromJsonAsync<ResourceImageUploadResponse>())!.Uploaded;
        await harness.Client.PutAsync($"{images}/{uploaded[1].Id}/primary", content: null);

        var deleteResponse = await harness.Client.DeleteAsync($"{images}/{uploaded[1].Id}");

        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);
        var listed = await (await harness.Client.GetAsync(images))
            .Content.ReadFromJsonAsync<List<ResourceImageResponse>>();
        Assert.True(Assert.Single(listed!).IsPrimary);
    }

    // =============================================================================================
    // Helpers
    // =============================================================================================

    /// <summary>
    /// The collection URL, built from the transcribed segment and a seeded owner id. The one place
    /// a path is assembled, so that U2 — which changes which controller answers, not what the path
    /// is — leaves every call site above untouched.
    /// </summary>
    private static string Images(string segment, Guid ownerId) => $"/api/{segment}/{ownerId}/images";

    private static async Task<ResourceImageResponse> UploadOneAsync(ResourceImageApiHarness harness, string images)
    {
        var response = await harness.UploadImagesAsync(images, ("good.webp", ResourceImageTestFixtures.TinyWebp()));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<ResourceImageUploadResponse>())!.Uploaded[0];
    }

    /// <summary>
    /// Checked token-by-token, not as one exact string: <c>HttpResponseHeaders.CacheControl</c>
    /// is a parsed, strongly-typed <c>CacheControlHeaderValue</c>, and its own
    /// <c>ToString()</c> — and even the header's stored string form by the time the client has
    /// parsed it — reconstructs the directives in .NET's own canonical order
    /// (<c>max-age=31536000, private, immutable</c>), not the literal order the server wrote
    /// them in. The three directives being present at all is what the server actually
    /// controls.
    /// </summary>
    private static void AssertImageCacheControl(HttpResponseMessage response)
    {
        var cacheControl = string.Join(", ", response.Headers.GetValues("Cache-Control"));
        Assert.Contains("private", cacheControl);
        Assert.Contains("max-age=31536000", cacheControl);
        Assert.Contains("immutable", cacheControl);
    }
}
