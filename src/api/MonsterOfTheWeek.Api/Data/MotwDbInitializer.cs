using Microsoft.EntityFrameworkCore;
using MonsterOfTheWeek.Api.Data.Entities;

namespace MonsterOfTheWeek.Api.Data;

public static class MotwDbInitializer
{
    public static async Task InitializeAsync(MotwDbContext dbContext, CancellationToken cancellationToken = default)
    {
        await dbContext.Database.MigrateAsync(cancellationToken);
        await SeedLookupTablesAsync(dbContext, cancellationToken);
    }

    private static async Task SeedLookupTablesAsync(MotwDbContext dbContext, CancellationToken cancellationToken)
    {
        if (!await dbContext.MonsterTypes.AnyAsync(cancellationToken))
        {
            dbContext.MonsterTypes.AddRange(
                new MonsterType { Id = Guid.Parse("72d4064f-d7e8-407d-ae87-7394c8ff0cc1"), Name = "Devourer", Motivation = "To consume people and resources." },
                new MonsterType { Id = Guid.Parse("9f97e451-a6c3-4ea1-b35f-d6125a38411e"), Name = "Torturer", Motivation = "To hurt, terrify, and torment victims." },
                new MonsterType { Id = Guid.Parse("de5e2cc7-f033-4db2-9c09-a8faec4fefe1"), Name = "Executioner", Motivation = "To punish and enforce brutal rules." },
                new MonsterType { Id = Guid.Parse("d3ef4a79-a748-40df-97cc-0a89d2f5d2de"), Name = "Collector", Motivation = "To gather souls, things, or people." });
        }

        if (!await dbContext.MinionTypes.AnyAsync(cancellationToken))
        {
            dbContext.MinionTypes.AddRange(
                new MinionType { Id = Guid.Parse("3e7bf8f5-0a82-40ca-9f90-f06939d07259"), Name = "Brute", Motivation = "To intimidate and use force." },
                new MinionType { Id = Guid.Parse("d70f5d8a-2e0d-43fd-a6af-8c8fbe95d7cc"), Name = "Cultist", Motivation = "To serve and empower the dark plan." },
                new MinionType { Id = Guid.Parse("fcb4f694-b15f-4e53-b58c-f30666f4f2f5"), Name = "Hive", Motivation = "To swarm and overwhelm by numbers." },
                new MinionType { Id = Guid.Parse("fd605fa1-882c-4cb9-8b17-1cb24af325f5"), Name = "Plague", Motivation = "To spread disease, fear, or corruption." });
        }

        if (!await dbContext.LocationTypes.AnyAsync(cancellationToken))
        {
            dbContext.LocationTypes.AddRange(
                new LocationType { Id = Guid.Parse("85be622b-8f89-46ad-84f6-df2d6d678f27"), Name = "Crossroads", Motivation = "To offer choices and temptations." },
                new LocationType { Id = Guid.Parse("ad80e013-634d-4b4a-aa95-4874e8d8a5fc"), Name = "Deathtrap", Motivation = "To trap and destroy intruders." },
                new LocationType { Id = Guid.Parse("9e63f793-92d1-40de-bf95-d0fda500659f"), Name = "Den", Motivation = "To shelter monsters and danger." },
                new LocationType { Id = Guid.Parse("c97a7826-f5e8-446e-833d-66e58d772137"), Name = "Fortress", Motivation = "To defend and project power." });
        }

        if (!await dbContext.BystanderTypes.AnyAsync(cancellationToken))
        {
            dbContext.BystanderTypes.AddRange(
                new BystanderType { Id = Guid.Parse("4f36b2af-68d5-4fc6-bdd1-46f5bd54fe2a"), Name = "Victim", Motivation = "To survive and escape danger." },
                new BystanderType { Id = Guid.Parse("a48db98f-3a7c-4721-9d31-1d8204cd8f72"), Name = "Innocent", Motivation = "To do the right thing at great risk." },
                new BystanderType { Id = Guid.Parse("f6f43616-f0bc-4f58-b43e-65f64de5ec95"), Name = "Busybody", Motivation = "To interfere and uncover secrets." },
                new BystanderType { Id = Guid.Parse("9f2924a1-a914-413e-9859-c6a0e7262f4e"), Name = "Official", Motivation = "To maintain order and authority." });
        }

        if (!await dbContext.WeaponTags.AnyAsync(cancellationToken))
        {
            dbContext.WeaponTags.AddRange(
                new WeaponTag { Id = Guid.Parse("d44a0845-cf5c-4b4b-80c4-73a16f1edf6c"), Name = "+1harm", Description = "Deals +1 harm." },
                new WeaponTag { Id = Guid.Parse("e286f1d6-b8a4-4179-ac37-d2cd29f6f9a0"), Name = "area", Description = "Affects everyone in an area." },
                new WeaponTag { Id = Guid.Parse("8d8f5663-c9a2-425d-a7be-146db5df4dcf"), Name = "close", Description = "Useful at arm's reach range." },
                new WeaponTag { Id = Guid.Parse("89f4e3fb-d62f-4ed6-8ac1-1e12b5d50f60"), Name = "hand", Description = "Requires intimate hand-to-hand range." });
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }
}
