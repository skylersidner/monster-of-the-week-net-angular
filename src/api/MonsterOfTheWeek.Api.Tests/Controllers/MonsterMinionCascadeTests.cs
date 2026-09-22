using System.Net;
using Microsoft.EntityFrameworkCore;
using MonsterOfTheWeek.Api.Data.Entities;

namespace MonsterOfTheWeek.Api.Tests.Controllers;

/// <summary>
/// The server-truth halves of Peach's <c>5b-M2</c>, <c>5b-M3</c> and <c>5b-M4</c>.
///
/// <para>
/// The wizard's whole minion story rests on one database fact and its complement: <b>Delete</b>
/// cascades a monster's minions and <b>Detach</b> does not touch them. Every frontend assertion
/// about them is written against those two — <c>5b-M3</c>'s "exactly one <c>DELETE</c>, and none for
/// the cascaded children" is only correct <i>because</i> the cascade happens, and <c>5b-M4</c>'s
/// "under detach the minions still exist" is only correct because unlinking a bridge row cannot
/// reach a 1:N child. A ledger cannot see either. Neither can a fake repository, for the reason the
/// Phase 1 audit recorded: it would be asserting the implementation against itself.
/// </para>
///
/// <para>
/// <b>These two facts are load-bearing and were asserted nowhere.</b> The design cites the Phase 7
/// cascade contract, and <c>MysteryLinkRepositoryTests.DeletingAMystery_CascadesItsBridgeRows</c>
/// covers the <i>bridge</i> cascade — a different edge, in the opposite direction, on a table with
/// no children. If the monster→minion FK were ever configured <c>Restrict</c>, the wizard's Delete
/// would answer a 500 for a monster with minions and the modal would have promised a cascade that
/// the database refuses; if it were ever <c>SetNull</c> it could not be, because
/// <c>Minion.MonsterId</c> is non-nullable — which is itself asserted here so that making it
/// nullable fails loudly rather than quietly turning orphan minions into a legal state.
/// </para>
///
/// <para>
/// Reuses <see cref="MysteryLinkApiHarness"/> unchanged: real Kestrel, in-memory SQLite with foreign
/// keys enforced. Minions are seeded and read <b>through the context</b> rather than through minion
/// routes, because the harness registers only the three membership services and the claims here are
/// about rows, not about a projection.
/// </para>
/// </summary>
public sealed class MonsterMinionCascadeTests
{
    /// <summary>
    /// Puts one minion, with one attack of its own, under the harness's seeded monster.
    ///
    /// <para>
    /// The attack matters: a cascade that took the minion and left its sub-resources would leave
    /// rows pointing at nothing, and "the minions are gone" passes either way.
    /// </para>
    /// </summary>
    private static async Task<(Guid MinionId, Guid AttackId)> SeedMinionAsync(MysteryLinkApiHarness harness)
    {
        await using var context = harness.NewContext();

        var minionTypeId = Guid.NewGuid();
        context.MinionTypes.Add(new MinionType { Id = minionTypeId, Name = "Thrall", Motivation = "To serve." });
        await context.SaveChangesAsync();

        var minionId = Guid.NewGuid();
        context.Minions.Add(new Minion
        {
            Id = minionId,
            MonsterId = harness.MonsterId,
            MinionTypeId = minionTypeId,
            Name = "Grave-Wight",
            HarmCapacity = 2,
        });
        await context.SaveChangesAsync();

        var attackId = Guid.NewGuid();
        context.MinionAttacks.Add(new MinionAttack { Id = attackId, MinionId = minionId, Name = "Bite", Harm = 1 });
        await context.SaveChangesAsync();

        return (minionId, attackId);
    }

    private static async Task<HttpStatusCode> StatusOfAsync(Task<HttpResponseMessage> call)
    {
        using var response = await call;
        return response.StatusCode;
    }

    /// <summary>
    /// <b>5b-M3 / 5b-M4 (delete).</b> One <c>DELETE /api/monsters/{id}</c> takes the monster, its
    /// minions and their sub-resources. This is the premise the wizard's "exactly one DELETE" ledger
    /// assertion is correct <i>because of</i>; without it that criterion is asserting the absence of
    /// requests that were needed.
    /// </summary>
    [Fact]
    public async Task DeletingAMonster_CascadesItsMinionsAndTheirSubResources()
    {
        await using var harness = await MysteryLinkApiHarness.StartAsync();
        var (minionId, attackId) = await SeedMinionAsync(harness);

        // **The premise, asserted.** Three `Assert.False`es on an empty table pass whether the
        // cascade worked or the seed silently never landed, and the seed goes through a context that
        // is not the one the API uses.
        await using (var before = harness.NewContext())
        {
            Assert.True(await before.Minions.AnyAsync(minion => minion.Id == minionId));
            Assert.True(await before.MinionAttacks.AnyAsync(attack => attack.Id == attackId));
        }

        Assert.Equal(
            HttpStatusCode.NoContent,
            await StatusOfAsync(harness.Client.DeleteAsync($"/api/monsters/{harness.MonsterId}")));

        await using var context = harness.NewContext();
        Assert.False(await context.Monsters.AnyAsync(monster => monster.Id == harness.MonsterId));
        Assert.False(await context.Minions.AnyAsync(minion => minion.Id == minionId));
        Assert.False(await context.MinionAttacks.AnyAsync(attack => attack.Id == attackId));
    }

    /// <summary>
    /// <b>5b-M2 / 5b-M4 (detach).</b> Unlinking the monster from one mystery leaves the minion
    /// existing <b>and still belonging to that monster</b> — Rosalina's assertion in full, and the
    /// thing the removal modal promises in as many words.
    ///
    /// <para>
    /// Verified from the <i>other</i> mystery as well, because that is where the difference between
    /// the two buttons is visible and it is the half the wizard cannot reach.
    /// </para>
    /// </summary>
    [Fact]
    public async Task DetachingAMonsterFromOneMystery_LeavesItsMinionsAloneEverywhere()
    {
        await using var harness = await MysteryLinkApiHarness.StartAsync();
        var (minionId, attackId) = await SeedMinionAsync(harness);

        Assert.Equal(
            HttpStatusCode.NoContent,
            await StatusOfAsync(harness.PutAsync($"/api/mysteries/{harness.MysteryId}/monsters/{harness.MonsterId}")));
        Assert.Equal(
            HttpStatusCode.NoContent,
            await StatusOfAsync(harness.PutAsync($"/api/mysteries/{harness.OtherMysteryId}/monsters/{harness.MonsterId}")));

        Assert.Equal(
            HttpStatusCode.NoContent,
            await StatusOfAsync(harness.DeleteAsync($"/api/mysteries/{harness.MysteryId}/monsters/{harness.MonsterId}")));

        await using var context = harness.NewContext();
        var minion = await context.Minions.SingleAsync(row => row.Id == minionId);
        // Existing, and belonging to the same monster: a detach that re-parented or orphaned it
        // would satisfy "the minion still exists" and break the promise all the same.
        Assert.Equal(harness.MonsterId, minion.MonsterId);
        Assert.True(await context.MinionAttacks.AnyAsync(attack => attack.Id == attackId));
        Assert.True(await context.Monsters.AnyAsync(monster => monster.Id == harness.MonsterId));

        // The membership the user removed is the only thing that went.
        Assert.Equal(
            [harness.OtherMysteryId],
            await context.MysteryMonsters
                .Where(row => row.MonsterId == harness.MonsterId)
                .Select(row => row.MysteryId)
                .ToListAsync());
    }

    /// <summary>
    /// <b>The rule both of the above rest on, stated so a schema change cannot quietly remove it.</b>
    /// <c>Minion.MonsterId</c> is required and non-nullable (§6.4), which is why a minion cannot
    /// outlive its monster and why the minion composer cannot save without a parent. A
    /// <c>Guid?</c> here would make "a minion belonging to nothing" a legal row and turn the cascade
    /// above into a silent orphaning.
    /// </summary>
    [Fact]
    public void MinionMonsterId_IsNonNullable_SoAMinionCannotOutliveItsMonster()
    {
        var property = typeof(Minion).GetProperty(nameof(Minion.MonsterId));

        Assert.NotNull(property);
        Assert.Equal(typeof(Guid), property!.PropertyType);
    }
}
