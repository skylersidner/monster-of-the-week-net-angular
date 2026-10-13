using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using MonsterOfTheWeek.Api.Data;
using MonsterOfTheWeek.Api.Data.Entities;
using MonsterOfTheWeek.Api.Services.ResourceImages;

namespace MonsterOfTheWeek.Api.Tests.Services.ResourceImages;

/// <summary>
/// <b>U0's pinning tests for the three switch arms the enum merge made reachable</b> —
/// <c>docs/resource-images/endpoint-unification.md</c> §2.6.1/§2.6.2.
///
/// <para>
/// Until U0 the image service took a four-member <c>ResourceOwnerType</c> and handled all four, so
/// the <c>_ =&gt;</c> arm in <c>OwnerExistsAsync</c>, <c>GetExplicitPrimaryImageIdAsync</c> and
/// <c>SetPrimaryImageIdAsync</c> was dead by exhaustion. The merged five-member
/// <see cref="DomainOwnerType"/> makes <c>Mystery</c> a value any caller can write, and these tests
/// pin what happens when one does: <b>it throws, and that is the intended behaviour, not a gap.</b>
/// A <c>Mystery =&gt; false</c> arm would compile, pass, and go on quietly answering "no images,
/// ever" the day mystery images ships. If a future change makes one of these tests fail, the fix is
/// the real query, not a softer arm.
/// </para>
///
/// <para>
/// <b>Why <c>ThrowsAsync</c> and not <c>Throws</c>.</b> The throw is raised synchronously out of an
/// expression-bodied method returning a <c>Task</c>, but it is consumed inside the <c>async</c>
/// callers, which capture it onto the returned task. Asserting it synchronously would pass for the
/// wrong reason on one of these and fail outright on the others.
/// </para>
/// </summary>
public sealed class ResourceImageOwnerTypeTests
{
    /// <summary>
    /// The member of <see cref="DomainOwnerType"/> that is not an image owner. Taken from
    /// <see cref="IResourceImageService.ImageOwnerTypes"/> rather than written as
    /// <c>DomainOwnerType.Mystery</c>, so that the day a sixth non-image domain is added, these
    /// tests cover it without being edited.
    /// </summary>
    private static readonly DomainOwnerType[] NonImageOwnerTypes =
        [.. Enum.GetValues<DomainOwnerType>().Where(t => !IResourceImageService.ImageOwnerTypes.Contains(t))];

    private static async Task<MotwDbContext> CreateContextAsync()
    {
        var connection = new SqliteConnection("DataSource=:memory:");
        await connection.OpenAsync();

        var context = new MotwDbContext(new DbContextOptionsBuilder<MotwDbContext>()
            .UseSqlite(connection)
            .Options);
        await context.Database.EnsureCreatedAsync();
        return context;
    }

    /// <summary>
    /// A stored row for <paramref name="ownerType"/>, written straight through the context. The
    /// service would refuse to create one of these for a non-image owner, which is the point: it is
    /// the only way to get past <c>SetPrimaryAsync</c>'s <c>belongsToOwner</c> check and reach the
    /// third switch at all (§2.6.1 calls that arm "unreachable by construction" — this constructs
    /// it on purpose, so the arm is pinned rather than merely unreached).
    /// </summary>
    private static async Task<ResourceImage> SeedRowAsync(MotwDbContext context, DomainOwnerType ownerType, Guid ownerId)
    {
        var image = new ResourceImage
        {
            OwnerType = ownerType,
            OwnerId = ownerId,
            FileName = "seeded.jpg",
            ContentType = "image/jpeg",
            SizeBytes = 4,
            Width = 1,
            Height = 1,
            ImageBytes = [1, 2, 3, 4],
            SortOrder = 1,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        context.ResourceImages.Add(image);
        await context.SaveChangesAsync();
        return image;
    }

    [Fact]
    public async Task ListAsync_Throws_ForAnOwnerTypeThatCannotOwnImages()
    {
        await using var context = await CreateContextAsync();
        var service = new ResourceImageService(context);

        foreach (var ownerType in NonImageOwnerTypes)
        {
            await Assert.ThrowsAsync<ArgumentOutOfRangeException>(
                () => service.ListAsync(ownerType, Guid.NewGuid(), CancellationToken.None));
        }
    }

    [Fact]
    public async Task UploadAsync_Throws_ForAnOwnerTypeThatCannotOwnImages()
    {
        await using var context = await CreateContextAsync();
        var service = new ResourceImageService(context);

        foreach (var ownerType in NonImageOwnerTypes)
        {
            await Assert.ThrowsAsync<ArgumentOutOfRangeException>(
                () => service.UploadAsync(
                    ownerType,
                    Guid.NewGuid(),
                    [new ResourceImageUploadFile("a.jpg", ResourceImageTestFixtures.TinyJpeg())],
                    CancellationToken.None));
        }
    }

    [Fact]
    public async Task GetPrimaryImageIdAsync_Throws_ForAnOwnerTypeThatCannotOwnImages()
    {
        await using var context = await CreateContextAsync();
        var service = new ResourceImageService(context);

        foreach (var ownerType in NonImageOwnerTypes)
        {
            await Assert.ThrowsAsync<ArgumentOutOfRangeException>(
                () => service.GetPrimaryImageIdAsync(ownerType, Guid.NewGuid(), CancellationToken.None));
        }
    }

    [Fact]
    public async Task SetPrimaryAsync_Throws_ForAnOwnerTypeThatCannotOwnImages_EvenWithAStoredRow()
    {
        await using var context = await CreateContextAsync();
        var service = new ResourceImageService(context);

        foreach (var ownerType in NonImageOwnerTypes)
        {
            var ownerId = Guid.NewGuid();
            var image = await SeedRowAsync(context, ownerType, ownerId);

            await Assert.ThrowsAsync<ArgumentOutOfRangeException>(
                () => service.SetPrimaryAsync(ownerType, ownerId, image.Id, CancellationToken.None));
        }
    }

    /// <summary>
    /// <b>The guard on the declared set itself.</b> <see cref="IResourceImageService.ImageOwnerTypes"/>
    /// is a transcribed constant — before U0 the same fact was <c>Enum.GetValues&lt;ResourceOwnerType&gt;()</c>
    /// and needed no guard at all (§2.6.3). This is the half of that guard U0 can build: every
    /// member of the declared set reaches a real arm of all three switches, and every member outside
    /// it reaches the throwing arm. <b>Both directions, because only the second one can fail
    /// silently</b> — a member quietly dropped from <c>ImageOwnerTypes</c> while the service still
    /// handles it would leave the first half green.
    ///
    /// <para>
    /// U3 extends this to the route alternation and the unified controller's segment dictionary,
    /// which do not exist yet. It is not the whole drift test; it is the part that is true today.
    /// </para>
    /// </summary>
    [Fact]
    public async Task ImageOwnerTypes_PartitionsDomainOwnerType_IntoHandledAndThrowing()
    {
        await using var context = await CreateContextAsync();
        var service = new ResourceImageService(context);

        Assert.NotEmpty(IResourceImageService.ImageOwnerTypes);
        Assert.NotEmpty(NonImageOwnerTypes);
        Assert.Equal(
            Enum.GetValues<DomainOwnerType>().Order(),
            IResourceImageService.ImageOwnerTypes.Concat(NonImageOwnerTypes).Order());

        foreach (var ownerType in IResourceImageService.ImageOwnerTypes)
        {
            var ownerId = Guid.NewGuid();
            var image = await SeedRowAsync(context, ownerType, ownerId);

            // No owner entity exists, so these answer "not found" / "nothing explicit" rather than
            // succeeding. That is the point: any answer at all proves the arm ran, where a throw
            // would prove it did not. What each one returns is pinned by the tests above and in
            // ResourceImageServiceTests; this asserts only that the switch resolved.
            Assert.False((await service.ListAsync(ownerType, ownerId, CancellationToken.None)).IsSuccess);
            Assert.Equal(image.Id, await service.GetPrimaryImageIdAsync(ownerType, ownerId, CancellationToken.None));
            Assert.True(await service.SetPrimaryAsync(ownerType, ownerId, image.Id, CancellationToken.None));
        }

        foreach (var ownerType in NonImageOwnerTypes)
        {
            await Assert.ThrowsAsync<ArgumentOutOfRangeException>(
                () => service.ListAsync(ownerType, Guid.NewGuid(), CancellationToken.None));
        }
    }
}
