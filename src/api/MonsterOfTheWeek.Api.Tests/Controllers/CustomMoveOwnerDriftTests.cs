using System.Reflection;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc.Routing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using MonsterOfTheWeek.Api.Controllers;
using MonsterOfTheWeek.Api.Data;
using MonsterOfTheWeek.Api.Data.Entities;
using MonsterOfTheWeek.Api.Services.CustomMoves;

namespace MonsterOfTheWeek.Api.Tests.Controllers;

/// <summary>
/// The owner set is written down in <b>three</b> places — the route regex, the controller's
/// segment dictionary, and <c>CustomMoveService.OwnerExistsAsync</c>'s <c>switch</c> — and
/// nothing in the type system relates them (<c>docs/domain-custom-moves/architecture.md</c> B12,
/// §23 item 3). These three tests are what does.
///
/// <para>
/// <b>Why three and not one.</b> The version in §7 R7 proposes "every enum member has a reachable
/// route", which catches one of the three pairs. A member added to the enum and to the dictionary
/// but not to the regex 404s while the code reads complete; a member added everywhere but to the
/// service's <c>switch</c> reaches the throwing <c>_ =&gt;</c> arm and surfaces as a 500 from a
/// route that compiles — and a route test cannot see that one at all.
/// </para>
///
/// <para>
/// <b>The throwing arm is not self-protecting, which is why it needs guarding rather than
/// trusting.</b> MVC's model binder rejects an out-of-range enum value, but the same cast
/// succeeds in a minimal-API host on .NET 10 — <c>7</c> binds to a five-member enum and yields
/// <c>(Owner)7</c> (§17.1 probe C). The arm is unreachable today because of which binder is in
/// play, not because the type prevents it.
/// </para>
/// </summary>
public sealed class CustomMoveOwnerDriftTests
{
    /// <summary>
    /// The alternation, parsed back out of the one <c>const string</c> the four actions share.
    ///
    /// <para>
    /// Read off the attribute rather than off the constant, so this also fails if an action is
    /// ever given its own literal template — which is the drift that would make the constant stop
    /// being the single source of truth without changing it.
    /// </para>
    /// </summary>
    private static IReadOnlyList<string> SegmentsInTheRouteTemplate()
    {
        var templates = typeof(CustomMovesController)
            .GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
            .SelectMany(method => method.GetCustomAttributes<HttpMethodAttribute>())
            .Select(attribute => attribute.Template)
            .Where(template => template is not null)
            .Select(template => template!)
            .ToList();

        Assert.Equal(4, templates.Count);

        // Every action's template starts with the same owner segment, and the anchors are part of
        // what is read back — an unanchored regex would not match this pattern.
        var match = Assert.Single(templates
            .Select(template => Regex.Match(template, @"\{owner:regex\(\^\(([a-z|]+)\)\$\)\}"))
            .Where(m => m.Success)
            .Select(m => m.Groups[1].Value)
            .Distinct()
            .ToList());

        return match.Split('|');
    }

    /// <summary>
    /// The controller's segment dictionary, read by reflection.
    ///
    /// <para>
    /// <b>By reflection rather than by widening the field to <c>internal</c> or <c>public</c>.</b>
    /// There is no <c>InternalsVisibleTo</c> anywhere in this solution, so adding one would be a
    /// new project-wide pattern for the benefit of one test, and a <c>public</c> dictionary on a
    /// controller is production surface that exists only for a test. A renamed field fails here
    /// loudly, with a message naming the field, which is the right failure.
    /// </para>
    /// </summary>
    private static IReadOnlyDictionary<string, DomainOwnerType> OwnerDictionary()
    {
        var field = typeof(CustomMovesController)
            .GetField("Owners", BindingFlags.NonPublic | BindingFlags.Static);

        Assert.True(field is not null, "CustomMovesController.Owners is gone or was renamed; this guard reads it by name.");
        return (IReadOnlyDictionary<string, DomainOwnerType>)field!.GetValue(null)!;
    }

    [Fact]
    public void EveryOwnerTypeHasASegment_AndTheDictionaryInventsNone()
    {
        // Catches: a member added to the enum and not to the dictionary (which would throw from
        // the controller's indexer), and a dictionary entry for a type that does not exist.
        Assert.Equal(
            Enum.GetValues<DomainOwnerType>().Order().ToList(),
            OwnerDictionary().Values.Order().ToList());
    }

    [Fact]
    public void TheDictionarysKeysAreExactlyTheSegmentsInTheRouteTemplate()
    {
        // Catches the drift that is invisible in review: a segment added to the dictionary and
        // not to the regex 404s at routing while every line of C# looks complete, and a segment
        // added to the regex and not to the dictionary throws from the indexer as a 500.
        Assert.Equal(
            SegmentsInTheRouteTemplate().Order().ToList(),
            OwnerDictionary().Keys.Order(StringComparer.Ordinal).ToList());
    }

    [Theory]
    [InlineData(DomainOwnerType.Mystery)]
    [InlineData(DomainOwnerType.Monster)]
    [InlineData(DomainOwnerType.Minion)]
    [InlineData(DomainOwnerType.Location)]
    [InlineData(DomainOwnerType.Bystander)]
    public async Task EveryOwnerTypeHasAnArmInTheServicesSwitch(DomainOwnerType ownerType)
    {
        // The half a route test cannot see. An empty context is enough — the assertion is that
        // the owner check runs at all rather than hitting `_ => throw`, and no seeding is needed
        // to find that out. ListAsync, not ListForProjectionAsync, because ListAsync is the one
        // that calls OwnerExistsAsync.
        await using var connection = new SqliteConnection("DataSource=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<MotwDbContext>().UseSqlite(connection).Options;
        await using var context = new MotwDbContext(options);
        await context.Database.EnsureCreatedAsync();

        var service = new CustomMoveService(context);

        var result = await service.ListAsync(ownerType, Guid.NewGuid(), CancellationToken.None);

        // NotFound, not a throw: the arm exists and answered.
        Assert.False(result.IsSuccess);
        Assert.Empty(await service.ListForProjectionAsync(ownerType, Guid.NewGuid(), CancellationToken.None));
    }
}
