using System.Net;
using System.Net.Http.Json;
using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Tests.Services.ResourceImages;

namespace MonsterOfTheWeek.Api.Tests.Controllers;

/// <summary>
/// The six resource-images endpoints over real HTTP (design.md §3, phases.md Phase 3), against
/// <see cref="MonstersController"/> — the four controllers are deliberately thin, identical
/// wrappers around the one shared <c>IResourceImageService</c> (design.md §1.3), so this is where
/// the depth belongs; the other three get a manual multipart check per the Phase 3 verification
/// list, not a second copy of this suite.
/// </summary>
public sealed class ResourceImageEndpointTests
{
    [Fact]
    public async Task Upload_Returns201_WithExactPerFileResult_ForAMixedBatch()
    {
        await using var harness = await ResourceImageApiHarness.StartAsync();

        var response = await harness.UploadImagesAsync(
            $"/api/monsters/{harness.MonsterId}/images",
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

    [Fact]
    public async Task Upload_Returns400_WhenEveryFileIsRejected()
    {
        await using var harness = await ResourceImageApiHarness.StartAsync();

        var response = await harness.UploadImagesAsync(
            $"/api/monsters/{harness.MonsterId}/images",
            ("bad.gif", ResourceImageTestFixtures.GifBytes()));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Upload_Returns404_WhenTheMonsterDoesNotExist()
    {
        await using var harness = await ResourceImageApiHarness.StartAsync();

        var response = await harness.UploadImagesAsync(
            $"/api/monsters/{Guid.NewGuid()}/images",
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
    /// </summary>
    [Fact]
    public async Task Upload_RejectsTheRequest_WhenTheBodyExceedsTheTwentyFourMebibyteLimit()
    {
        await using var harness = await ResourceImageApiHarness.StartAsync();

        var response = await harness.UploadOversizedBodyAsync(
            $"/api/monsters/{harness.MonsterId}/images", (24 * 1024 * 1024) + 1);

        Assert.True(
            response.StatusCode is HttpStatusCode.RequestEntityTooLarge or HttpStatusCode.BadRequest,
            $"Expected the oversized body to be rejected, got {response.StatusCode}.");
    }

    [Fact]
    public async Task GetImages_ListsInSortOrder_WithTheDerivedPrimaryFlagged()
    {
        await using var harness = await ResourceImageApiHarness.StartAsync();
        await harness.UploadImagesAsync(
            $"/api/monsters/{harness.MonsterId}/images",
            ("first.webp", ResourceImageTestFixtures.TinyWebp()),
            ("second.webp", ResourceImageTestFixtures.TinyWebp()));

        var response = await harness.Client.GetAsync($"/api/monsters/{harness.MonsterId}/images");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var images = await response.Content.ReadFromJsonAsync<List<ResourceImageResponse>>();
        Assert.Equal(2, images!.Count);
        Assert.Equal("first.webp", images[0].FileName);
        Assert.True(images[0].IsPrimary);
        Assert.False(images[1].IsPrimary);
    }

    [Fact]
    public async Task GetImageFile_ReturnsTheOriginalBytes_WithContentTypeAndCacheControl()
    {
        await using var harness = await ResourceImageApiHarness.StartAsync();
        var uploadResponse = await harness.UploadImagesAsync(
            $"/api/monsters/{harness.MonsterId}/images", ("good.webp", ResourceImageTestFixtures.TinyWebp()));
        var uploaded = (await uploadResponse.Content.ReadFromJsonAsync<ResourceImageUploadResponse>())!.Uploaded[0];

        var response = await harness.Client.GetAsync($"/api/monsters/{harness.MonsterId}/images/{uploaded.Id}/file");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("image/webp", response.Content.Headers.ContentType?.MediaType);
        AssertImageCacheControl(response);
        Assert.Equal(ResourceImageTestFixtures.TinyWebp(), await response.Content.ReadAsByteArrayAsync());
    }

    [Fact]
    public async Task GetImageThumbnail_ReturnsA256x256Jpeg_WithCacheControl()
    {
        await using var harness = await ResourceImageApiHarness.StartAsync();
        var uploadResponse = await harness.UploadImagesAsync(
            $"/api/monsters/{harness.MonsterId}/images", ("good.webp", ResourceImageTestFixtures.TinyWebp()));
        var uploaded = (await uploadResponse.Content.ReadFromJsonAsync<ResourceImageUploadResponse>())!.Uploaded[0];

        var response = await harness.Client.GetAsync($"/api/monsters/{harness.MonsterId}/images/{uploaded.Id}/thumbnail");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("image/jpeg", response.Content.Headers.ContentType?.MediaType);
        AssertImageCacheControl(response);
        var bytes = await response.Content.ReadAsByteArrayAsync();
        using var thumbnail = SkiaSharp.SKBitmap.Decode(bytes);
        Assert.Equal(256, thumbnail!.Width);
        Assert.Equal(256, thumbnail.Height);
    }

    [Fact]
    public async Task GetImageFile_Returns404_WhenTheImageBelongsToADifferentOwner()
    {
        await using var harness = await ResourceImageApiHarness.StartAsync();
        var uploadResponse = await harness.UploadImagesAsync(
            $"/api/monsters/{harness.MonsterId}/images", ("good.webp", ResourceImageTestFixtures.TinyWebp()));
        var uploaded = (await uploadResponse.Content.ReadFromJsonAsync<ResourceImageUploadResponse>())!.Uploaded[0];

        // Same imageId, but requested through the OTHER Monster's URL.
        var response = await harness.Client.GetAsync($"/api/monsters/{harness.OtherMonsterId}/images/{uploaded.Id}/file");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetImageFile_Returns404_ForAnUnknownImageId()
    {
        await using var harness = await ResourceImageApiHarness.StartAsync();

        var response = await harness.Client.GetAsync($"/api/monsters/{harness.MonsterId}/images/{Guid.NewGuid()}/file");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task SetPrimary_Returns204_AndTheNewPrimaryIsReflectedInTheList()
    {
        await using var harness = await ResourceImageApiHarness.StartAsync();
        var uploadResponse = await harness.UploadImagesAsync(
            $"/api/monsters/{harness.MonsterId}/images",
            ("first.webp", ResourceImageTestFixtures.TinyWebp()),
            ("second.webp", ResourceImageTestFixtures.TinyWebp()));
        var uploaded = (await uploadResponse.Content.ReadFromJsonAsync<ResourceImageUploadResponse>())!.Uploaded;

        var putResponse = await harness.Client.PutAsync(
            $"/api/monsters/{harness.MonsterId}/images/{uploaded[1].Id}/primary", content: null);

        Assert.Equal(HttpStatusCode.NoContent, putResponse.StatusCode);
        var images = await (await harness.Client.GetAsync($"/api/monsters/{harness.MonsterId}/images"))
            .Content.ReadFromJsonAsync<List<ResourceImageResponse>>();
        Assert.True(images!.Single(i => i.Id == uploaded[1].Id).IsPrimary);
        Assert.False(images!.Single(i => i.Id == uploaded[0].Id).IsPrimary);
    }

    [Fact]
    public async Task SetPrimary_Returns404_WhenTheImageBelongsToADifferentOwner()
    {
        await using var harness = await ResourceImageApiHarness.StartAsync();
        var uploadResponse = await harness.UploadImagesAsync(
            $"/api/monsters/{harness.MonsterId}/images", ("good.webp", ResourceImageTestFixtures.TinyWebp()));
        var uploaded = (await uploadResponse.Content.ReadFromJsonAsync<ResourceImageUploadResponse>())!.Uploaded[0];

        var response = await harness.Client.PutAsync(
            $"/api/monsters/{harness.OtherMonsterId}/images/{uploaded.Id}/primary", content: null);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task DeleteImage_Returns204_AndRemovesItFromTheList()
    {
        await using var harness = await ResourceImageApiHarness.StartAsync();
        var uploadResponse = await harness.UploadImagesAsync(
            $"/api/monsters/{harness.MonsterId}/images", ("good.webp", ResourceImageTestFixtures.TinyWebp()));
        var uploaded = (await uploadResponse.Content.ReadFromJsonAsync<ResourceImageUploadResponse>())!.Uploaded[0];

        var deleteResponse = await harness.Client.DeleteAsync($"/api/monsters/{harness.MonsterId}/images/{uploaded.Id}");

        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);
        var images = await (await harness.Client.GetAsync($"/api/monsters/{harness.MonsterId}/images"))
            .Content.ReadFromJsonAsync<List<ResourceImageResponse>>();
        Assert.Empty(images!);
    }

    [Fact]
    public async Task DeleteImage_Returns404_ForAnUnknownImageId()
    {
        await using var harness = await ResourceImageApiHarness.StartAsync();

        var response = await harness.Client.DeleteAsync($"/api/monsters/{harness.MonsterId}/images/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task DeleteImage_OnTheExplicitPrimary_AutoPromotesTheFirstUploadedRemainingImage()
    {
        // The database's own ON DELETE SET NULL (Phase 1) plus the derivation rule (Phase 2),
        // now proven end-to-end through the real HTTP DELETE and GET.
        await using var harness = await ResourceImageApiHarness.StartAsync();
        var uploadResponse = await harness.UploadImagesAsync(
            $"/api/monsters/{harness.MonsterId}/images",
            ("first.webp", ResourceImageTestFixtures.TinyWebp()),
            ("second.webp", ResourceImageTestFixtures.TinyWebp()));
        var uploaded = (await uploadResponse.Content.ReadFromJsonAsync<ResourceImageUploadResponse>())!.Uploaded;
        await harness.Client.PutAsync($"/api/monsters/{harness.MonsterId}/images/{uploaded[1].Id}/primary", content: null);

        var deleteResponse = await harness.Client.DeleteAsync($"/api/monsters/{harness.MonsterId}/images/{uploaded[1].Id}");

        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);
        var images = await (await harness.Client.GetAsync($"/api/monsters/{harness.MonsterId}/images"))
            .Content.ReadFromJsonAsync<List<ResourceImageResponse>>();
        Assert.True(Assert.Single(images!).IsPrimary);
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
