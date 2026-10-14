using System.Reflection;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc.Routing;
using MonsterOfTheWeek.Api.Controllers;
using MonsterOfTheWeek.Api.Data.Entities;
using MonsterOfTheWeek.Api.Services.ResourceImages;

namespace MonsterOfTheWeek.Api.Tests.Controllers;

/// <summary>
/// <b>U3's drift guard</b> — <c>docs/resource-images/endpoint-unification.md</c> §4.
///
/// <para>
/// The image-owner set is written down in <b>three independent places</b>: the route alternation
/// inside <c>ResourceImagesController</c>'s <c>const string OwnerSegment</c>, that controller's
/// private <c>Owners</c> dictionary, and <see cref="IResourceImageService.ImageOwnerTypes"/>.
/// Nothing in the type system relates them. These tests are what does.
/// </para>
///
/// <para>
/// <b>All three are transcribed, deliberately, and that is the whole reason this file can fail.</b>
/// The dictionary could have been built from <c>ImageOwnerTypes</c> and the regex generated from
/// the dictionary — and then this guard would compare one declaration with two reflections of
/// itself and pass forever. That is the vacuity that made §4's Postgres assertion worthless at U0
/// (§13 item 4) and that U1's matrix was shaped to avoid (§14 item 4). Three hand-written
/// statements plus one derived rule is the arrangement that makes a disagreement observable.
/// </para>
///
/// <para>
/// <b>§4 states the claim as one chain</b> — <i>"the alternation equals the controller dictionary's
/// key set equals <c>ImageOwnerTypes</c> mapped through the segment convention."</i> It is asserted
/// here as <b>three</b> tests rather than one, because a chain that fails as a single blob says
/// something drifted and not which link: the three links fail independently and each names its own
/// pair. Same reasoning that made U1's matrix a <c>[Theory]</c> over the owner rather than one fact.
/// </para>
///
/// <para>
/// <b>The fourth link — the enum against the service's three <c>switch</c> expressions — is not
/// here, and that is not an omission.</b> U0 landed it alongside
/// <see cref="IResourceImageService.ImageOwnerTypes"/> itself, in
/// <c>ResourceImageOwnerTypeTests</c>, so the transcribed constant would not sit unguarded for
/// three commits (§13 item 2). It is already asserted in <b>both</b> directions there — every
/// member of the set reaches a live arm of all three switches, and every member outside it reaches
/// the throwing arm of all three. <b>Both directions are only expressible because U0 merged the two
/// owner enums</b> (§2.6): under the old four-member <c>ResourceOwnerType</c> there was no
/// <c>Mystery</c> to assert about, so "and nothing else gets an arm" could not be written down.
/// Re-asserting it here would duplicate, not strengthen.
/// </para>
/// </summary>
public sealed class ResourceImageOwnerDriftTests
{
    /// <summary>
    /// How a <see cref="DomainOwnerType"/> becomes a URL segment. <b>The one derived side of this
    /// file</b>: a rule, not a list, so it cannot drift out of step with itself the way a fourth
    /// transcribed copy would. Everything it is compared against is hand-written.
    ///
    /// <para>
    /// <b>The <c>-y → -ies</c> branch is not decoration, and it was added because a control caught
    /// its absence.</b> The naive <c>+ "s"</c> gives <c>Mystery → "mysterys"</c>, which is wrong —
    /// the shipped segment is <c>mysteries</c>, in both this app's route tables and its client
    /// segment maps. It happens never to bite on the four image owners, all of which end in a
    /// consonant, so the broken rule passed every assertion in this file. <b>A rule that is only
    /// correct on the inputs it currently receives is a transcription wearing a rule's clothes</b>,
    /// and it would have fired a false failure the first time a <c>-y</c> domain got images.
    /// Pinned below against the one member that distinguishes the two rules.
    /// </para>
    /// </summary>
    private static string SegmentFor(DomainOwnerType ownerType)
    {
        var name = ownerType.ToString().ToLowerInvariant();
        return name.EndsWith('y') ? name[..^1] + "ies" : name + "s";
    }

    /// <summary>
    /// The guard on the rule itself. <see cref="SegmentFor"/> is the only derived side of this
    /// file, so nothing else here can tell a correct rule from one that merely agrees with the four
    /// inputs it is given — and the member that separates them is precisely the one the image
    /// feature excludes, so no other assertion will ever evaluate it.
    /// </summary>
    [Theory]
    [InlineData(DomainOwnerType.Mystery, "mysteries")]
    [InlineData(DomainOwnerType.Monster, "monsters")]
    [InlineData(DomainOwnerType.Minion, "minions")]
    [InlineData(DomainOwnerType.Location, "locations")]
    [InlineData(DomainOwnerType.Bystander, "bystanders")]
    public void TheSegmentConvention_IsTheOneTheAppActuallyUses(DomainOwnerType ownerType, string expected)
    {
        Assert.Equal(expected, SegmentFor(ownerType));
    }

    /// <summary>
    /// The alternation, parsed back out of the <c>[Http*]</c> attributes.
    ///
    /// <para>
    /// <b>Off the attributes, not off the constant</b>, so an action given its own literal template
    /// fails too — the drift that would stop the constant being the single source of truth without
    /// changing one character of it. The <c>^</c> and <c>$</c> are part of the pattern being matched
    /// rather than stripped first, so an <b>unanchored</b> regex does not parse and this fails:
    /// those two characters are the difference between <c>xmonstersx</c> 404ing at routing and
    /// reaching the controller's indexer as a 500.
    /// </para>
    /// </summary>
    private static IReadOnlyList<string> SegmentsInTheRouteTemplate()
    {
        var templates = typeof(ResourceImagesController)
            .GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
            .SelectMany(method => method.GetCustomAttributes<HttpMethodAttribute>())
            .Select(attribute => attribute.Template)
            .Where(template => template is not null)
            .Select(template => template!)
            .ToList();

        // Six actions behind five path templates (§1.1). Pinned so that an action losing its
        // attribute — and with it its route — cannot leave the rest of this file agreeing happily.
        Assert.Equal(6, templates.Count);

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
    /// <b>By reflection rather than by widening the field.</b> There is no <c>InternalsVisibleTo</c>
    /// anywhere in this solution, so adding one would be a new project-wide pattern for one test,
    /// and a <c>public</c> dictionary on a controller is production surface existing only for a
    /// test. A renamed field fails here loudly, with a message naming the field.
    /// </para>
    /// </summary>
    private static IReadOnlyDictionary<string, DomainOwnerType> OwnerDictionary()
    {
        var field = typeof(ResourceImagesController)
            .GetField("Owners", BindingFlags.NonPublic | BindingFlags.Static);

        Assert.True(field is not null, "ResourceImagesController.Owners is gone or was renamed; this guard reads it by name.");
        return (IReadOnlyDictionary<string, DomainOwnerType>)field!.GetValue(null)!;
    }

    /// <summary>
    /// <b>Link 1: the route alternation against the controller's dictionary keys.</b>
    ///
    /// <para>
    /// Catches the drift that is invisible in review and invisible to U1's matrix, which only ever
    /// requests the four correct segments. A segment in the dictionary but not the regex 404s at
    /// routing while every line of C# reads complete; a segment in the regex but not the dictionary
    /// throws out of the indexer as a 500 from a URL that looks legal.
    /// </para>
    /// </summary>
    [Fact]
    public void TheRouteAlternation_IsExactlyTheDictionarysKeys()
    {
        Assert.Equal(
            SegmentsInTheRouteTemplate().Order(StringComparer.Ordinal).ToList(),
            OwnerDictionary().Keys.Order(StringComparer.Ordinal).ToList());
    }

    /// <summary>
    /// <b>Link 2: the controller's dictionary values against the declared image-owner set.</b>
    ///
    /// <para>
    /// This is the assertion that exists <i>because</i> U0 merged the enums. Under two enums the
    /// set was <c>Enum.GetValues&lt;ResourceOwnerType&gt;()</c> and this comparison was tautological
    /// — the dictionary could not name a type that was not in the set, because no such type existed
    /// (§2.6.3). Under one five-member enum the dictionary <i>can</i> name <c>Mystery</c>, and
    /// <see cref="IResourceImageService.ImageOwnerTypes"/> is the only thing that says it must not.
    /// </para>
    ///
    /// <para>
    /// The count is pinned as well as the contents. Without it, dropping a domain from the regex,
    /// the dictionary and the set together leaves all three links agreeing on a smaller world and
    /// every assertion in this file green — the same silent-shrinkage hole U1's matrix needed a
    /// transcribed count to close (§14 item 4).
    /// </para>
    /// </summary>
    [Fact]
    public void TheDictionarysValues_AreExactlyTheDeclaredImageOwnerTypes()
    {
        Assert.Equal(4, IResourceImageService.ImageOwnerTypes.Count);

        Assert.Equal(
            IResourceImageService.ImageOwnerTypes.Order().ToList(),
            OwnerDictionary().Values.Order().ToList());

        // And the member the whole four-not-five decision is about, named rather than implied:
        // a Mystery reaching this controller is the hazard §2.6.3 chose the route constraint to
        // prevent, and it would otherwise show up only as a 500 from a URL nobody constructs.
        Assert.DoesNotContain(DomainOwnerType.Mystery, OwnerDictionary().Values);
    }

    /// <summary>
    /// <b>Link 3: each key is its own value's segment, not merely some value's segment.</b>
    ///
    /// <para>
    /// <b>Links 1 and 2 both pass on a cross-wired dictionary.</b> Swap two entries so that
    /// <c>["monsters"] = DomainOwnerType.Minion</c> and <c>["minions"] = DomainOwnerType.Monster</c>
    /// and the key set is unchanged, the value set is unchanged, and every segment still resolves
    /// to a legal owner type — while <c>/api/monsters/…</c> quietly reads and writes the minion
    /// image space. Set equality cannot see a permutation; only the pairing can.
    /// </para>
    /// </summary>
    [Fact]
    public void EveryKey_IsTheSegmentOfItsOwnValue()
    {
        Assert.All(OwnerDictionary(), entry =>
            Assert.Equal(SegmentFor(entry.Value), entry.Key.ToLowerInvariant()));
    }
}
