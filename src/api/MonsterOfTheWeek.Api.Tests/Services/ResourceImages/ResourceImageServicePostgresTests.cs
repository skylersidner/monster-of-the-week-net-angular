using Microsoft.EntityFrameworkCore;
using MonsterOfTheWeek.Api.Data;
using MonsterOfTheWeek.Api.Data.Entities;
using MonsterOfTheWeek.Api.Services.ResourceImages;
using MonsterOfTheWeek.Api.Tests.Data;

namespace MonsterOfTheWeek.Api.Tests.Services.ResourceImages;

/// <summary>
/// Phase 2's real-Postgres gate (<c>docs/resource-images/phases.md</c> Phase 2 verification): the
/// primary-derivation rule (<see cref="IResourceImageService.GetPrimaryImageIdAsync"/>) is a LINQ
/// query — <c>OrderBy(SortOrder).ThenBy(Id)</c> coalesced with the owner's explicit column — and
/// every other test in this project proves it only against SQLite. This confirms the same query
/// actually translates and runs on the real provider, and that deleting the derived primary
/// falls through to the next one through <see cref="ResourceImageService"/> itself, not just
/// through a raw delete against the DbContext (Phase 1's migration test already covers that half).
///
/// <para>
/// Skipped unless <see cref="PostgresFactAttribute.ConnectionStringEnvironmentVariable"/> is set;
/// see that attribute for why skip (not a silent pass) is the right default. Drops and recreates
/// the database the connection string names — never point it at the dev <c>motw</c> database.
/// </para>
/// </summary>
[Collection(PostgresCollection.Name)]
public sealed class ResourceImageServicePostgresTests
{
    private static string ConnectionString =>
        Environment.GetEnvironmentVariable(PostgresFactAttribute.ConnectionStringEnvironmentVariable)!;

    [PostgresFact]
    [Trait("Category", "Postgres")]
    public async Task Derivation_FallsThroughToTheNextLowestSortOrder_AfterDeletingTheDerivedPrimary_OnRealPostgres()
    {
        var options = new DbContextOptionsBuilder<MotwDbContext>().UseNpgsql(ConnectionString).Options;

        await using var context = new MotwDbContext(options);
        await context.Database.EnsureDeletedAsync();
        await context.Database.MigrateAsync();

        var monsterType = new MonsterType { Name = "Devourer", Motivation = "To consume." };
        var archetype = new MonsterArchetype { Name = "Heavy Hitter", Description = "It is the threat." };
        var monster = new Monster { Name = "Test Monster", HarmCapacity = 1, MonsterType = monsterType, MonsterArchetype = archetype };
        context.Monsters.Add(monster);
        await context.SaveChangesAsync();

        var service = new ResourceImageService(context);
        var upload = await service.UploadAsync(
            ResourceOwnerType.Monster,
            monster.Id,
            [
                new ResourceImageUploadFile("a.jpg", ResourceImageTestFixtures.TinyJpeg()),
                new ResourceImageUploadFile("b.jpg", ResourceImageTestFixtures.TinyJpeg()),
            ],
            CancellationToken.None);

        var images = upload.Value!.Uploaded;
        Assert.Equal(2, images.Count);

        // PrimaryImageId is null (no explicit choice), so the derived primary is the
        // lowest-SortOrder image: the first-uploaded, "a.jpg".
        var primaryId = await service.GetPrimaryImageIdAsync(ResourceOwnerType.Monster, monster.Id, CancellationToken.None);
        Assert.Equal(images[0].Id, primaryId);

        await context.ResourceImages.Where(i => i.Id == images[0].Id).ExecuteDeleteAsync();

        var nextPrimaryId = await service.GetPrimaryImageIdAsync(ResourceOwnerType.Monster, monster.Id, CancellationToken.None);
        Assert.Equal(images[1].Id, nextPrimaryId);
    }
}
