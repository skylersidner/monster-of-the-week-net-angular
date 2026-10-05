using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using MonsterOfTheWeek.Api.Data;
using MonsterOfTheWeek.Api.Data.Entities;
using MonsterOfTheWeek.Api.Services;
using MonsterOfTheWeek.Api.Services.ResourceImages;

namespace MonsterOfTheWeek.Api.Tests.Services.ResourceImages;

public sealed class ResourceImageServiceTests
{
    // ---------------------------------------------------------------------------------
    // Harness
    // ---------------------------------------------------------------------------------

    private static async Task<(MotwDbContext Context, SaveChangesCountInterceptor Interceptor)> CreateContextAsync()
    {
        var connection = new SqliteConnection("DataSource=:memory:");
        await connection.OpenAsync();

        var interceptor = new SaveChangesCountInterceptor();
        var options = new DbContextOptionsBuilder<MotwDbContext>()
            .UseSqlite(connection)
            .AddInterceptors(interceptor)
            .Options;

        var context = new MotwDbContext(options);
        await context.Database.EnsureCreatedAsync();
        return (context, interceptor);
    }

    private static async Task<Monster> SeedMonsterAsync(MotwDbContext context)
    {
        var monsterType = new MonsterType { Name = "Devourer", Motivation = "To consume." };
        var archetype = new MonsterArchetype { Name = "Heavy Hitter", Description = "It is the threat." };
        var monster = new Monster
        {
            Name = "Test Monster",
            HarmCapacity = 1,
            MonsterType = monsterType,
            MonsterArchetype = archetype,
        };
        context.Monsters.Add(monster);
        await context.SaveChangesAsync();
        return monster;
    }

    /// <summary>Seeds <paramref name="count"/> already-uploaded images for <paramref name="owner"/>,
    /// SortOrder 1..count, so cap/derivation tests don't each hand-roll the same setup.</summary>
    private static async Task<List<ResourceImage>> SeedImagesAsync(MotwDbContext context, ResourceOwnerType ownerType, Guid ownerId, int count)
    {
        var images = new List<ResourceImage>();
        for (var i = 1; i <= count; i++)
        {
            var image = new ResourceImage
            {
                OwnerType = ownerType,
                OwnerId = ownerId,
                FileName = $"existing-{i}.jpg",
                ContentType = "image/jpeg",
                SizeBytes = 1,
                Width = 10,
                Height = 10,
                ImageBytes = ResourceImageTestFixtures.TinyJpeg(),
                SortOrder = i,
                CreatedAt = DateTimeOffset.UtcNow,
            };
            images.Add(image);
            context.ResourceImages.Add(image);
        }

        await context.SaveChangesAsync();
        return images;
    }

    private static ResourceImageUploadFile File(string name, byte[] content) => new(name, content);

    // ---------------------------------------------------------------------------------
    // Owner existence
    // ---------------------------------------------------------------------------------

    [Fact]
    public async Task UploadAsync_ReturnsNotFound_WhenOwnerDoesNotExist()
    {
        var (context, _) = await CreateContextAsync();
        await using var _1 = context;
        var service = new ResourceImageService(context);

        var result = await service.UploadAsync(
            ResourceOwnerType.Monster,
            Guid.NewGuid(),
            [File("a.jpg", ResourceImageTestFixtures.TinyJpeg())],
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(ServiceErrorType.NotFound, result.Error!.Type);
    }

    // ---------------------------------------------------------------------------------
    // §7.1 — type checking, including the WebP RIFF-container case
    // ---------------------------------------------------------------------------------

    [Fact]
    public async Task UploadAsync_RejectsUnsupportedType_ForNonImageMagicBytes()
    {
        var (context, _) = await CreateContextAsync();
        await using var _1 = context;
        var monster = await SeedMonsterAsync(context);
        var service = new ResourceImageService(context);

        var result = await service.UploadAsync(
            ResourceOwnerType.Monster,
            monster.Id,
            [File("swamp-thing.gif", ResourceImageTestFixtures.GifBytes())],
            CancellationToken.None);

        var rejected = Assert.Single(result.Value!.Rejected);
        Assert.Equal("swamp-thing.gif", rejected.FileName);
        Assert.Equal(ResourceImageRejectionReason.UnsupportedType, rejected.Reason);
        Assert.Empty(result.Value!.Uploaded);
    }

    [Fact]
    public async Task UploadAsync_RejectsUnsupportedType_ForARiffContainerThatIsNotWebp()
    {
        // Proves the WebP check is genuinely "RIFF + WEBP at offset 8," not just "starts with
        // RIFF" — a validator written as a third literal bolted onto the JPEG/PNG lookup would
        // wrongly accept this.
        var (context, _) = await CreateContextAsync();
        await using var _1 = context;
        var monster = await SeedMonsterAsync(context);
        var service = new ResourceImageService(context);

        var result = await service.UploadAsync(
            ResourceOwnerType.Monster,
            monster.Id,
            [File("sound.wav", ResourceImageTestFixtures.RiffWaveBytes())],
            CancellationToken.None);

        var rejected = Assert.Single(result.Value!.Rejected);
        Assert.Equal(ResourceImageRejectionReason.UnsupportedType, rejected.Reason);
    }

    [Fact]
    public async Task UploadAsync_AcceptsWebp_ViaItsOwnRiffContainerCheck()
    {
        var (context, _) = await CreateContextAsync();
        await using var _1 = context;
        var monster = await SeedMonsterAsync(context);
        var service = new ResourceImageService(context);

        var result = await service.UploadAsync(
            ResourceOwnerType.Monster,
            monster.Id,
            [File("good.webp", ResourceImageTestFixtures.TinyWebp())],
            CancellationToken.None);

        var uploaded = Assert.Single(result.Value!.Uploaded);
        Assert.Equal("image/webp", uploaded.ContentType);
        Assert.Empty(result.Value!.Rejected);
    }

    [Theory]
    [InlineData("image/jpeg")]
    [InlineData("image/png")]
    public async Task UploadAsync_AcceptsJpegAndPng(string expectedContentType)
    {
        var (context, _) = await CreateContextAsync();
        await using var _1 = context;
        var monster = await SeedMonsterAsync(context);
        var service = new ResourceImageService(context);
        var content = expectedContentType == "image/jpeg" ? ResourceImageTestFixtures.TinyJpeg() : ResourceImageTestFixtures.TinyPng();

        var result = await service.UploadAsync(
            ResourceOwnerType.Monster, monster.Id, [File("good", content)], CancellationToken.None);

        var uploaded = Assert.Single(result.Value!.Uploaded);
        Assert.Equal(expectedContentType, uploaded.ContentType);
    }

    // ---------------------------------------------------------------------------------
    // Size cap
    // ---------------------------------------------------------------------------------

    [Fact]
    public async Task UploadAsync_RejectsTooLarge_ForAFileOverTwoMebibytes()
    {
        var (context, _) = await CreateContextAsync();
        await using var _1 = context;
        var monster = await SeedMonsterAsync(context);
        var service = new ResourceImageService(context);

        var result = await service.UploadAsync(
            ResourceOwnerType.Monster,
            monster.Id,
            [File("huge.jpg", ResourceImageTestFixtures.OverTwoMebibytes())],
            CancellationToken.None);

        var rejected = Assert.Single(result.Value!.Rejected);
        Assert.Equal(ResourceImageRejectionReason.TooLarge, rejected.Reason);
    }

    // ---------------------------------------------------------------------------------
    // Decompression-bomb dimension guard
    // ---------------------------------------------------------------------------------

    [Fact]
    public async Task UploadAsync_RejectsOversizedDimensions_WhenDeclaredCanvasExceedsTheCap()
    {
        var (context, _) = await CreateContextAsync();
        await using var _1 = context;
        var monster = await SeedMonsterAsync(context);
        var service = new ResourceImageService(context);

        var result = await service.UploadAsync(
            ResourceOwnerType.Monster,
            monster.Id,
            [File("huge-canvas.jpg", ResourceImageTestFixtures.OversizedDimensionJpeg())],
            CancellationToken.None);

        var rejected = Assert.Single(result.Value!.Rejected);
        Assert.Equal(ResourceImageRejectionReason.UnreadableOrOversizedDimensions, rejected.Reason);
    }

    [Fact]
    public async Task UploadAsync_RejectsUnreadableDimensions_ForATruncatedFileWithAValidSignature()
    {
        var (context, _) = await CreateContextAsync();
        await using var _1 = context;
        var monster = await SeedMonsterAsync(context);
        var service = new ResourceImageService(context);

        var result = await service.UploadAsync(
            ResourceOwnerType.Monster,
            monster.Id,
            [File("truncated.jpg", ResourceImageTestFixtures.TruncatedJpeg())],
            CancellationToken.None);

        var rejected = Assert.Single(result.Value!.Rejected);
        Assert.Equal(ResourceImageRejectionReason.UnreadableOrOversizedDimensions, rejected.Reason);
    }

    // ---------------------------------------------------------------------------------
    // §7.4 — the 10-image cap, partial accept
    // ---------------------------------------------------------------------------------

    [Fact]
    public async Task UploadAsync_PartiallyAcceptsABatch_WhenItWouldPushPastTheCap()
    {
        // design.md §7.4's worked example: 8 existing, drop 5 more (13 total, 3 over) -> accept
        // the first 2, reject the remaining 3 as CapExceeded.
        var (context, _) = await CreateContextAsync();
        await using var _1 = context;
        var monster = await SeedMonsterAsync(context);
        await SeedImagesAsync(context, ResourceOwnerType.Monster, monster.Id, 8);
        var service = new ResourceImageService(context);

        var result = await service.UploadAsync(
            ResourceOwnerType.Monster,
            monster.Id,
            [
                File("new-1.jpg", ResourceImageTestFixtures.TinyJpeg()),
                File("new-2.jpg", ResourceImageTestFixtures.TinyJpeg()),
                File("new-3.jpg", ResourceImageTestFixtures.TinyJpeg()),
                File("new-4.jpg", ResourceImageTestFixtures.TinyJpeg()),
                File("new-5.jpg", ResourceImageTestFixtures.TinyJpeg()),
            ],
            CancellationToken.None);

        Assert.Equal(2, result.Value!.Uploaded.Count);
        Assert.Equal(3, result.Value!.Rejected.Count);
        Assert.All(result.Value!.Rejected, r => Assert.Equal(ResourceImageRejectionReason.CapExceeded, r.Reason));
        Assert.Equal(["new-1.jpg", "new-2.jpg"], result.Value!.Uploaded.Select(i => i.FileName));
        Assert.Equal(["new-3.jpg", "new-4.jpg", "new-5.jpg"], result.Value!.Rejected.Select(r => r.FileName));
    }

    [Fact]
    public async Task UploadAsync_CapIsCheckedAfterValidity_SoAnInvalidFileGetsItsOwnReason_NotCapExceeded()
    {
        var (context, _) = await CreateContextAsync();
        await using var _1 = context;
        var monster = await SeedMonsterAsync(context);
        await SeedImagesAsync(context, ResourceOwnerType.Monster, monster.Id, 10);
        var service = new ResourceImageService(context);

        var result = await service.UploadAsync(
            ResourceOwnerType.Monster,
            monster.Id,
            [File("bad.gif", ResourceImageTestFixtures.GifBytes())],
            CancellationToken.None);

        var rejected = Assert.Single(result.Value!.Rejected);
        Assert.Equal(ResourceImageRejectionReason.UnsupportedType, rejected.Reason);
    }

    // ---------------------------------------------------------------------------------
    // SortOrder assignment, CreatedAt, thumbnail generation, single SaveChanges
    // ---------------------------------------------------------------------------------

    [Fact]
    public async Task UploadAsync_AssignsIncrementingSortOrder_WithinOneBatch()
    {
        var (context, _) = await CreateContextAsync();
        await using var _1 = context;
        var monster = await SeedMonsterAsync(context);
        await SeedImagesAsync(context, ResourceOwnerType.Monster, monster.Id, 2); // SortOrder 1, 2
        var service = new ResourceImageService(context);

        var result = await service.UploadAsync(
            ResourceOwnerType.Monster,
            monster.Id,
            [
                File("a.jpg", ResourceImageTestFixtures.TinyJpeg()),
                File("b.jpg", ResourceImageTestFixtures.TinyJpeg()),
            ],
            CancellationToken.None);

        Assert.Equal([3, 4], result.Value!.Uploaded.Select(i => i.SortOrder));
    }

    [Fact]
    public async Task UploadAsync_SetsCreatedAt_OnEveryAcceptedRow()
    {
        var (context, _) = await CreateContextAsync();
        await using var _1 = context;
        var monster = await SeedMonsterAsync(context);
        var service = new ResourceImageService(context);

        var result = await service.UploadAsync(
            ResourceOwnerType.Monster,
            monster.Id,
            [File("a.jpg", ResourceImageTestFixtures.TinyJpeg())],
            CancellationToken.None);

        var uploaded = Assert.Single(result.Value!.Uploaded);
        Assert.NotEqual(default, uploaded.CreatedAt);
    }

    [Fact]
    public async Task UploadAsync_GeneratesA256x256JpegThumbnail_ForAnAcceptedImage()
    {
        var (context, _) = await CreateContextAsync();
        await using var _1 = context;
        var monster = await SeedMonsterAsync(context);
        var service = new ResourceImageService(context);

        var result = await service.UploadAsync(
            ResourceOwnerType.Monster,
            monster.Id,
            [File("a.jpg", ResourceImageTestFixtures.TinyJpeg())],
            CancellationToken.None);

        var uploaded = Assert.Single(result.Value!.Uploaded);
        Assert.NotNull(uploaded.ThumbnailBytes);
        using var thumbnail = SkiaSharp.SKBitmap.Decode(uploaded.ThumbnailBytes);
        Assert.Equal(256, thumbnail!.Width);
        Assert.Equal(256, thumbnail.Height);
    }

    [Fact]
    public async Task UploadAsync_SavesTheWholeBatch_WithExactlyOneSaveChangesCall()
    {
        var (context, interceptor) = await CreateContextAsync();
        await using var _1 = context;
        var monster = await SeedMonsterAsync(context);
        var service = new ResourceImageService(context);
        var countBeforeUpload = interceptor.Count;

        var result = await service.UploadAsync(
            ResourceOwnerType.Monster,
            monster.Id,
            [
                File("a.jpg", ResourceImageTestFixtures.TinyJpeg()),
                File("b.jpg", ResourceImageTestFixtures.TinyJpeg()),
                File("c.jpg", ResourceImageTestFixtures.TinyJpeg()),
            ],
            CancellationToken.None);

        Assert.Equal(3, result.Value!.Uploaded.Count);
        Assert.Equal(countBeforeUpload + 1, interceptor.Count);
    }

    [Fact]
    public async Task UploadAsync_NeverCallsSaveChanges_WhenEveryFileIsRejected()
    {
        var (context, interceptor) = await CreateContextAsync();
        await using var _1 = context;
        var monster = await SeedMonsterAsync(context);
        var service = new ResourceImageService(context);
        var countBeforeUpload = interceptor.Count;

        var result = await service.UploadAsync(
            ResourceOwnerType.Monster,
            monster.Id,
            [File("bad.gif", ResourceImageTestFixtures.GifBytes())],
            CancellationToken.None);

        Assert.Empty(result.Value!.Uploaded);
        Assert.Equal(countBeforeUpload, interceptor.Count);
    }

    // ---------------------------------------------------------------------------------
    // Primary derivation (the one rule — phases.md Phase 2)
    // ---------------------------------------------------------------------------------

    [Fact]
    public async Task GetPrimaryImageIdAsync_ReturnsNull_WhenOwnerHasNoImages()
    {
        var (context, _) = await CreateContextAsync();
        await using var _1 = context;
        var monster = await SeedMonsterAsync(context);
        var service = new ResourceImageService(context);

        var primaryId = await service.GetPrimaryImageIdAsync(ResourceOwnerType.Monster, monster.Id, CancellationToken.None);

        Assert.Null(primaryId);
    }

    [Fact]
    public async Task GetPrimaryImageIdAsync_ReturnsTheLowestSortOrderImage_WhenPrimaryImageIdIsNull()
    {
        var (context, _) = await CreateContextAsync();
        await using var _1 = context;
        var monster = await SeedMonsterAsync(context);
        var images = await SeedImagesAsync(context, ResourceOwnerType.Monster, monster.Id, 3);
        var service = new ResourceImageService(context);

        var primaryId = await service.GetPrimaryImageIdAsync(ResourceOwnerType.Monster, monster.Id, CancellationToken.None);

        Assert.Equal(images[0].Id, primaryId); // SortOrder 1, the first-uploaded
    }

    [Fact]
    public async Task GetPrimaryImageIdAsync_ReturnsTheExplicitPrimary_RegardlessOfSortOrder()
    {
        var (context, _) = await CreateContextAsync();
        await using var _1 = context;
        var monster = await SeedMonsterAsync(context);
        var images = await SeedImagesAsync(context, ResourceOwnerType.Monster, monster.Id, 3);
        monster.PrimaryImageId = images[2].Id; // explicitly choose the last-uploaded
        await context.SaveChangesAsync();
        var service = new ResourceImageService(context);

        var primaryId = await service.GetPrimaryImageIdAsync(ResourceOwnerType.Monster, monster.Id, CancellationToken.None);

        Assert.Equal(images[2].Id, primaryId);
    }

    [Fact]
    public async Task GetPrimaryImageIdAsync_BreaksATiedSortOrder_ByLowestId()
    {
        var (context, _) = await CreateContextAsync();
        await using var _1 = context;
        var monster = await SeedMonsterAsync(context);

        // The accepted SortOrder race (phases.md §3.3) can leave two rows tied — the derivation
        // rule must still be deterministic.
        var tiedA = new ResourceImage
        {
            Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
            OwnerType = ResourceOwnerType.Monster, OwnerId = monster.Id, FileName = "a.jpg",
            ContentType = "image/jpeg", SizeBytes = 1, Width = 1, Height = 1,
            ImageBytes = ResourceImageTestFixtures.TinyJpeg(), SortOrder = 1, CreatedAt = DateTimeOffset.UtcNow,
        };
        var tiedB = new ResourceImage
        {
            Id = Guid.Parse("00000000-0000-0000-0000-000000000002"),
            OwnerType = ResourceOwnerType.Monster, OwnerId = monster.Id, FileName = "b.jpg",
            ContentType = "image/jpeg", SizeBytes = 1, Width = 1, Height = 1,
            ImageBytes = ResourceImageTestFixtures.TinyJpeg(), SortOrder = 1, CreatedAt = DateTimeOffset.UtcNow,
        };
        context.ResourceImages.AddRange(tiedB, tiedA); // added out of Id order on purpose
        await context.SaveChangesAsync();
        var service = new ResourceImageService(context);

        var primaryId = await service.GetPrimaryImageIdAsync(ResourceOwnerType.Monster, monster.Id, CancellationToken.None);

        Assert.Equal(tiedA.Id, primaryId);
    }

    [Fact]
    public async Task DeletingTheExplicitPrimary_ClearsThePointerViaTheDatabaseSetNullFk_AndDerivationFallsThroughToFirstUploaded()
    {
        var (context, _) = await CreateContextAsync();
        await using var _1 = context;

        // Guards against a vacuous pass: if SQLite's foreign-key enforcement were ever off, the
        // SetNull FK below would not fire and this test would fail loudly instead of passing
        // for the wrong reason. Issued directly against the ADO.NET connection, not through EF's
        // SqlQuery — PRAGMA isn't a SELECT, so EF's own query composition (it tries to add a
        // LIMIT) rejects it as non-composable SQL.
        var connection = (SqliteConnection)context.Database.GetDbConnection();
        using var pragmaCommand = connection.CreateCommand();
        pragmaCommand.CommandText = "PRAGMA foreign_keys;";
        var pragmaValue = (long)(await pragmaCommand.ExecuteScalarAsync())!;
        Assert.Equal(1, pragmaValue);

        var monster = await SeedMonsterAsync(context);
        var images = await SeedImagesAsync(context, ResourceOwnerType.Monster, monster.Id, 3);
        monster.PrimaryImageId = images[2].Id; // explicit primary is the last-uploaded
        await context.SaveChangesAsync();
        var service = new ResourceImageService(context);

        // Delete through a separate, untracked context — proves the database's own ON DELETE
        // SET NULL does this, not EF's in-memory change tracker reacting to a loaded navigation.
        await using (var deleteContext = new MotwDbContext(
            new DbContextOptionsBuilder<MotwDbContext>().UseSqlite(context.Database.GetDbConnection()).Options))
        {
            await deleteContext.ResourceImages.Where(i => i.Id == images[2].Id).ExecuteDeleteAsync();
        }

        await using var verifyContext = new MotwDbContext(
            new DbContextOptionsBuilder<MotwDbContext>().UseSqlite(context.Database.GetDbConnection()).Options);
        var reloaded = await verifyContext.Monsters.SingleAsync(m => m.Id == monster.Id);
        Assert.Null(reloaded.PrimaryImageId);

        // Falls through to the first-uploaded remaining image (lowest SortOrder), not the
        // neighbour of the deleted one — Skyler: "First uploaded image as the next default is good."
        var verifyService = new ResourceImageService(verifyContext);
        var primaryId = await verifyService.GetPrimaryImageIdAsync(ResourceOwnerType.Monster, monster.Id, CancellationToken.None);
        Assert.Equal(images[0].Id, primaryId);
    }

    // ---------------------------------------------------------------------------------
    // DeleteAllForOwnerAsync (Phase 3's owner-delete cleanup helper — not wired yet)
    // ---------------------------------------------------------------------------------

    [Fact]
    public async Task DeleteAllForOwnerAsync_DeletesOnlyThatOwnersImages()
    {
        var (context, _) = await CreateContextAsync();
        await using var _1 = context;
        var monster = await SeedMonsterAsync(context);
        var otherMonster = await SeedMonsterAsync(context);
        await SeedImagesAsync(context, ResourceOwnerType.Monster, monster.Id, 2);
        await SeedImagesAsync(context, ResourceOwnerType.Monster, otherMonster.Id, 2);
        var service = new ResourceImageService(context);

        await service.DeleteAllForOwnerAsync(ResourceOwnerType.Monster, monster.Id, CancellationToken.None);

        Assert.Equal(0, await context.ResourceImages.CountAsync(i => i.OwnerId == monster.Id));
        Assert.Equal(2, await context.ResourceImages.CountAsync(i => i.OwnerId == otherMonster.Id));
    }
}
