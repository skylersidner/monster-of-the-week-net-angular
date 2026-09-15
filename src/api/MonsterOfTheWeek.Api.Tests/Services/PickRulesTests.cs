using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Data.Entities;
using MonsterOfTheWeek.Api.Data.Seed;
using MonsterOfTheWeek.Api.Services;
using T = MonsterOfTheWeek.Api.Tests.Services.PickRuleTable;

namespace MonsterOfTheWeek.Api.Tests.Services;

/// <summary>
/// <see cref="PickRules"/> on its own, with no database: the three rules from
/// hunter-creation-wizard.md 12.9, and every row of its build tables.
///
/// <para>
/// Each playbook comes from the committed seed but carries the rule written out in
/// <see cref="PickRuleTable"/>, so these cases test the evaluator against the design's own data
/// table. The report half goes through <see cref="HunterCompleteness.Evaluate"/>, which is the
/// public way in. What <c>HunterService.Validate</c> adds on top (the stored caps checked first,
/// the order the checks run in) is covered through the real seed in <c>HunterPickRuleSeedTests</c>.
/// </para>
/// </summary>
public sealed class PickRulesTests
{
    private const string NaturalAttacksLine = "Natural Attacks: Pick a Base and add an extra to it, or two Bases.";
    private const string CombatMagicLine = "Combat Magic: Pick three (with at least one base).";
    private const string OldLabel = "Old-fashioned weapons (pick either two or three, as above)";
    private const string ModernLabel = "Modern weapons (pick either one or two, as above)";

    // -----------------------------------------------------------------------------------
    // The Initiate: effective ranges (12.9 step 1)
    // -----------------------------------------------------------------------------------

    public static TheoryData<string, int, int, int, int> InitiateRanges => new()
    {
        // No trigger at all: an unanswered Sect, and one answered without any of the four (S1).
        { "", 2, 2, 1, 1 },
        { "Knowledgable,AncientLore,Poor", 2, 2, 1, 1 },
        // Each trigger on its own.
        { "FightingArts", 3, 3, 1, 1 },
        { "ObsoleteGear", 3, 3, 1, 1 },
        { "Modernised", 2, 2, 1, 2 },
        { "NiftyGadgets", 2, 2, 1, 2 },
        // Both triggers of one group.
        { "FightingArts,ObsoleteGear", 3, 3, 1, 1 },
        { "Modernised,NiftyGadgets", 2, 2, 1, 2 },
        // Both groups: each list is adjusted by its own traditions, independently (Q12).
        { "FightingArts,Modernised,Poor", 3, 3, 1, 2 },
        { "NiftyGadgets,Knowledgable,ObsoleteGear", 3, 3, 1, 2 },
    };

    [Theory]
    [MemberData(nameof(InitiateRanges))]
    public void The_Initiates_weapons_lists_resolve_their_range_from_the_Sect(string sect, int oldMin, int oldMax, int modernMin, int modernMax)
    {
        var playbook = Initiate();
        var evaluation = PickRules.Evaluate(playbook, [], T.Traditions(sect));
        var counts = playbook.PickRules.Single().Alternatives.Single().Counts;

        Assert.Equal((oldMin, oldMax), evaluation.EffectiveRange(counts.Single(c => c.GearCategoryId == T.OldFashioned)));
        Assert.Equal((modernMin, modernMax), evaluation.EffectiveRange(counts.Single(c => c.GearCategoryId == T.Modern)));
    }

    // -----------------------------------------------------------------------------------
    // The Initiate: the build table
    // -----------------------------------------------------------------------------------

    public static TheoryData<string, int, int, string> InitiateBuilds => new()
    {
        // None of the four, answered or not: 2; 1.
        { "", 2, 1, "finished" },
        { "Knowledgable,AncientLore,Poor", 2, 1, "finished" },
        { "", 1, 1, "reported" },
        { "Knowledgable,AncientLore,Poor", 2, 0, "reported" },
        { "", 3, 1, "refused" },
        { "Knowledgable,AncientLore,Poor", 2, 2, "refused" },
        // Fighting arts or Obsolete gear only: 3; 1.
        { "FightingArts,Knowledgable,Poor", 3, 1, "finished" },
        { "Knowledgable,AncientLore,ObsoleteGear", 2, 1, "reported" },
        { "FightingArts,Knowledgable,Poor", 3, 0, "reported" },
        { "Knowledgable,AncientLore,ObsoleteGear", 3, 2, "refused" },
        // Modernised or Nifty gadgets only: 2; 1-2.
        { "Modernised,Knowledgable,Poor", 2, 1, "finished" },
        { "NiftyGadgets,AncientLore,DubiousMotives", 2, 2, "finished" },
        { "Modernised,Knowledgable,Poor", 1, 2, "reported" },
        { "NiftyGadgets,AncientLore,DubiousMotives", 2, 0, "reported" },
        { "Modernised,Knowledgable,Poor", 3, 1, "refused" },
        // Traditions from both groups: 3; 1-2. Nothing within the category caps is refused.
        { "FightingArts,Modernised,Poor", 3, 1, "finished" },
        { "NiftyGadgets,Knowledgable,ObsoleteGear", 3, 2, "finished" },
        { "FightingArts,Modernised,Poor", 2, 2, "reported" },
        { "NiftyGadgets,Knowledgable,ObsoleteGear", 3, 0, "reported" },
    };

    [Theory]
    [MemberData(nameof(InitiateBuilds))]
    public void The_Initiates_build_table(string sect, int oldFashioned, int modern, string outcome)
    {
        var (refusal, gearItems) = EvaluateInitiate(sect, oldFashioned, modern);

        switch (outcome)
        {
            case "refused":
                Assert.NotNull(refusal);
                break;
            case "finished":
                Assert.Null(refusal);
                Assert.Empty(gearItems);
                break;
            default:
                Assert.Null(refusal);
                Assert.Single(gearItems);
                break;
        }
    }

    [Fact]
    public void Within_the_category_caps_a_Sect_with_both_groups_refuses_nothing()
    {
        for (var old = 0; old <= 3; old++)
        {
            for (var modern = 0; modern <= 2; modern++)
            {
                Assert.Null(EvaluateInitiate("FightingArts,Modernised,Poor", old, modern).Refusal);
            }
        }
    }

    [Theory]
    [InlineData("", 3, 1, $"\"{OldLabel}\" allows 2 picks, but 3 were made. Fighting arts or Obsolete gear (Sect) allow 3.")]
    [InlineData("", 2, 2, $"\"{ModernLabel}\" allows 1 pick, but 2 were made. Modernised or Nifty gadgets (Sect) allow 2.")]
    [InlineData("FightingArts,Knowledgable,Poor", 3, 2, $"\"{ModernLabel}\" allows 1 pick, but 2 were made. Modernised or Nifty gadgets (Sect) allow 2.")]
    [InlineData("Modernised,Knowledgable,Poor", 3, 1, $"\"{OldLabel}\" allows 2 picks, but 3 were made. Fighting arts or Obsolete gear (Sect) allow 3.")]
    public void An_Initiate_refusal_names_the_effective_maximum_and_the_traditions_that_would_allow_more(string sect, int old, int modern, string expected)
    {
        Assert.Equal(expected, EvaluateInitiate(sect, old, modern).Refusal);
    }

    [Fact]
    public void An_unanswered_Sect_adds_that_the_lists_depend_on_it()
    {
        var (_, items) = EvaluateInitiate("", 0, 0);

        Assert.Equal(
            [
                new HunterOutstandingItem("gear", null, T.OldFashioned, $"Gear — {OldLabel}: 0 of 2 picked. This depends on your Sect picks."),
                new HunterOutstandingItem("gear", null, T.Modern, $"Gear — {ModernLabel}: 0 of 1 picked. This depends on your Sect picks."),
            ],
            items);
    }

    [Fact]
    public void A_partly_answered_Sect_does_not_add_it_Y16()
    {
        // One Good tradition that triggers nothing: the Sect is still short, but it has picks, which
        // is the condition the client's hint uses too (L25).
        var (_, items) = EvaluateInitiate("Knowledgable", 0, 0);

        Assert.Equal(
            [
                new HunterOutstandingItem("gear", null, T.OldFashioned, $"Gear — {OldLabel}: 0 of 2 picked."),
                new HunterOutstandingItem("gear", null, T.Modern, $"Gear — {ModernLabel}: 0 of 1 picked."),
            ],
            items);
    }

    [Fact]
    public void A_fired_adjustment_reports_against_its_adjusted_minimum()
    {
        var (_, items) = EvaluateInitiate("FightingArts,Knowledgable,Poor", 1, 0);

        Assert.Equal(
            [
                new HunterOutstandingItem("gear", null, T.OldFashioned, $"Gear — {OldLabel}: 1 of 3 picked."),
                new HunterOutstandingItem("gear", null, T.Modern, $"Gear — {ModernLabel}: 0 of 1 picked."),
            ],
            items);
    }

    [Fact]
    public void Removing_a_trigger_strands_a_pick_and_adding_one_never_refuses()
    {
        // Stranded: the picks were legal with the tradition, and are not without it (S5).
        Assert.Null(EvaluateInitiate("Modernised,Knowledgable,Poor", 2, 2).Refusal);
        Assert.NotNull(EvaluateInitiate("AncientLore,Knowledgable,Poor", 2, 2).Refusal);
        Assert.Null(EvaluateInitiate("FightingArts,Knowledgable,Poor", 3, 1).Refusal);
        Assert.NotNull(EvaluateInitiate("AncientLore,Knowledgable,Poor", 3, 1).Refusal);

        // Adding any trigger to any Sect only widens a range: nothing accepted becomes refused.
        string[] triggers = ["FightingArts", "ObsoleteGear", "Modernised", "NiftyGadgets"];
        for (var mask = 0; mask < 1 << triggers.Length; mask++)
        {
            var sect = string.Join(",", triggers.Where((_, i) => (mask & (1 << i)) != 0));
            for (var added = 0; added < triggers.Length; added++)
            {
                if ((mask & (1 << added)) != 0)
                {
                    continue;
                }

                var wider = string.Join(",", new[] { sect, triggers[added] }.Where(s => s.Length > 0));
                for (var old = 0; old <= 3; old++)
                {
                    for (var modern = 0; modern <= 2; modern++)
                    {
                        if (EvaluateInitiate(sect, old, modern).Refusal is null)
                        {
                            Assert.Null(EvaluateInitiate(wider, old, modern).Refusal);
                        }
                    }
                }
            }
        }
    }

    // -----------------------------------------------------------------------------------
    // Natural Attacks and Combat Magic: the build tables
    // -----------------------------------------------------------------------------------

    public static TheoryData<int, int, bool, string> NaturalAttacksBuilds => new()
    {
        { 1, 1, false, "finished" },
        { 2, 0, false, "finished" },
        // Either Base may be write-your-own: those slots count like any other option.
        { 2, 0, true, "finished" },
        { 1, 1, true, "finished" },
        { 1, 0, false, "reported" },
        { 0, 1, false, "reported" },
        { 0, 0, false, "reported" },
        { 2, 1, false, "refused" },
        // Also over the stored category caps, which Validate checks first.
        { 3, 0, false, "refused" },
        { 0, 2, false, "refused" },
    };

    [Theory]
    [MemberData(nameof(NaturalAttacksBuilds))]
    public void Natural_Attacks_build_table(int bases, int extras, bool writeYourOwn, string outcome)
    {
        var playbook = Monstrous();
        var seed = T.SeedPlaybook(T.Monstrous);
        var picks = T.Children(seed, T.NaturalAttacks, T.Base, bases, skip: writeYourOwn ? 4 : 0)
            .Concat(T.Children(seed, T.NaturalAttacks, T.Extra, extras))
            .ToList();

        AssertBespokeOutcome(playbook, T.NaturalAttacks, picks, outcome, NaturalAttacksLine);
    }

    public static TheoryData<int, int, string> CombatMagicBuilds => new()
    {
        { 3, 0, "finished" },
        { 2, 1, "finished" },
        { 1, 2, "finished" },
        // Only two spells, which the stored counts used to call finished.
        { 1, 1, "reported" },
        { 2, 0, "reported" },
        { 1, 0, "reported" },
        { 0, 2, "reported" },
        { 0, 1, "reported" },
        { 0, 3, "refused" },
        { 3, 1, "refused" },
        { 2, 2, "refused" },
        { 1, 3, "refused" },
        { 3, 3, "refused" },
    };

    [Theory]
    [MemberData(nameof(CombatMagicBuilds))]
    public void Combat_Magic_build_table(int bases, int effects, string outcome)
    {
        var playbook = SpellSlinger();
        var seed = T.SeedPlaybook(T.SpellSlinger);
        var picks = T.Children(seed, T.CombatMagic, T.Bases, bases)
            .Concat(T.Children(seed, T.CombatMagic, T.Effects, effects))
            .ToList();

        AssertBespokeOutcome(playbook, T.CombatMagic, picks, outcome, CombatMagicLine);
    }

    [Fact]
    public void A_several_alternative_refusal_quotes_the_rule_and_counts_each_target()
    {
        var monstrous = T.SeedPlaybook(T.Monstrous);
        var naturalAttacks = PickRules.Evaluate(
            Monstrous(),
            [],
            T.Children(monstrous, T.NaturalAttacks, T.Base, 2).Concat(T.Children(monstrous, T.NaturalAttacks, T.Extra, 1)));
        Assert.Equal(
            "\"Natural Attacks\" allows: Pick a Base and add an extra to it, or two Bases. 2 Base and 1 Extra were picked.",
            naturalAttacks.BespokeRefusal());

        var slinger = T.SeedPlaybook(T.SpellSlinger);
        var combatMagic = PickRules.Evaluate(
            SpellSlinger(),
            [],
            T.Children(slinger, T.CombatMagic, T.Bases, 3).Concat(T.Children(slinger, T.CombatMagic, T.Effects, 1)));
        Assert.Equal(
            "\"Combat Magic\" allows: Pick three (with at least one base). 3 Bases and 1 Effects were picked.",
            combatMagic.BespokeRefusal());
    }

    [Fact]
    public void A_governed_categorys_own_minimum_is_suppressed_along_with_the_sections()
    {
        // The seed's Base minimum is 1, which can't be short once Base is engaged, so this raises it
        // to 2 to prove the category line would otherwise appear. One Base picked, no Extra: without
        // the rule this reports "Natural Attacks: 1 of 2 picked." and "Natural Attacks: Base — 1 of 2
        // picked."; with it, only the rule's own line.
        var playbook = Monstrous();
        playbook.BespokeSections.Single(s => s.Id == T.NaturalAttacks).Options.Single(o => o.Id == T.Base).MinSelect = 2;
        var picks = T.Children(T.SeedPlaybook(T.Monstrous), T.NaturalAttacks, T.Base, 1);

        var items = HunterCompleteness.Evaluate(Hunter(playbook, [], picks.Select(id => (T.NaturalAttacks, id))), playbook)
            .Where(i => i.SectionId == T.NaturalAttacks);

        Assert.Equal([new HunterOutstandingItem("rules", T.NaturalAttacks, null, NaturalAttacksLine)], items);
    }

    [Fact]
    public void Zero_picks_fit_every_rule()
    {
        Assert.Null(PickRules.Evaluate(Initiate(), [], []).GearRefusal());
        Assert.Null(PickRules.Evaluate(Monstrous(), [], []).BespokeRefusal());
        Assert.Null(PickRules.Evaluate(SpellSlinger(), [], []).BespokeRefusal());
    }

    // -----------------------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------------------

    private static void AssertBespokeOutcome(Playbook playbook, Guid sectionId, IReadOnlyList<Guid> picks, string outcome, string reportedLine)
    {
        var refusal = PickRules.Evaluate(playbook, [], picks).BespokeRefusal();
        var items = HunterCompleteness.Evaluate(Hunter(playbook, [], picks.Select(id => (sectionId, id))), playbook)
            .Where(i => i.SectionId == sectionId)
            .ToList();

        switch (outcome)
        {
            case "refused":
                Assert.NotNull(refusal);
                break;
            case "finished":
                Assert.Null(refusal);
                Assert.Empty(items);
                break;
            default:
                Assert.Null(refusal);
                Assert.Equal([new HunterOutstandingItem("rules", sectionId, null, reportedLine)], items);
                break;
        }
    }

    private static (string? Refusal, List<HunterOutstandingItem> GearItems) EvaluateInitiate(string sect, int oldFashioned, int modern)
    {
        var playbook = Initiate();
        var seed = T.SeedPlaybook(T.Initiate);
        var gear = T.GearOptions(seed, T.OldFashioned, oldFashioned).Concat(T.GearOptions(seed, T.Modern, modern)).ToList();
        var traditions = T.Traditions(sect);

        var refusal = PickRules.Evaluate(playbook, gear, traditions).GearRefusal();
        var items = HunterCompleteness.Evaluate(Hunter(playbook, gear, traditions.Select(id => (T.Sect, id))), playbook)
            .Where(i => i.Area == "gear")
            .ToList();
        return (refusal, items);
    }

    private static Playbook Initiate() => WithRule(T.Initiate, T.InitiateRule);

    private static Playbook Monstrous() => WithRule(T.Monstrous, T.NaturalAttacksRule);

    private static Playbook SpellSlinger() => WithRule(T.SpellSlinger, T.CombatMagicRule);

    private static Playbook WithRule(Guid playbookId, PlaybookPickRuleResponse rule) =>
        PlaybookSeed.ToEntity(T.SeedPlaybook(playbookId) with { PickRules = [rule] });

    private static Hunter Hunter(Playbook playbook, IEnumerable<Guid> gear, IEnumerable<(Guid Section, Guid Option)> bespoke) => new()
    {
        Name = "Pick Rule Hunter",
        PlaybookId = playbook.Id,
        GearSelections = [.. gear.Select(id => new HunterGearSelection { PlaybookGearOptionId = id })],
        BespokeSelections = [.. bespoke.Select(b => new HunterBespokeSelection { SectionId = b.Section, BespokeOptionId = b.Option })],
    };
}
