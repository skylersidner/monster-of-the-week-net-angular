using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Data.Seed;

namespace MonsterOfTheWeek.Api.Tests.Services;

/// <summary>
/// The three pick rules exactly as hunter-creation-wizard.md 12.9's data tables state them, with
/// the fixed rule and alternative ids the <c>AddPickRules</c> migration inserts, plus the seed ids
/// the build tables need.
///
/// <para>
/// <b>Written out by hand from the doc, on purpose.</b> <c>PickRulesTests</c> evaluates these,
/// not whatever the seed file holds, so the evaluator is checked against the design's own tables;
/// <c>PlaybookSeedTests</c> then checks the committed seed carries exactly these rules, so the
/// seed and the migration are checked against the same rows.
/// </para>
/// </summary>
internal static class PickRuleTable
{
    // The Initiate (gear on p33, Sect on p34).
    public static readonly Guid Initiate = Guid.Parse("a0c2b1dd-75e9-4c62-913a-e652e5f23df2");
    public static readonly Guid Armour = Guid.Parse("b804a4e6-07b1-43cb-8c8a-a42c5aa3d6f7");
    public static readonly Guid OldFashioned = Guid.Parse("4740273a-f878-4719-8c0e-2626cac2566f");
    public static readonly Guid Modern = Guid.Parse("524d08ca-da76-4d4e-8353-2317ab30419a");
    public static readonly Guid Sect = Guid.Parse("4807e089-a934-4e6c-8054-0ff246ac99d9");
    public static readonly Guid GoodTraditions = Guid.Parse("3390c186-80b6-42eb-946d-15e8ed243628");
    public static readonly Guid BadTraditions = Guid.Parse("f03ceb1e-ce50-4367-bb24-513044fc2fb8");
    public static readonly Guid FightingArts = Guid.Parse("ceecaf7f-c871-422b-afa1-68ce91229274");
    public static readonly Guid Modernised = Guid.Parse("ad188960-40d2-48f3-8782-3a8caded1ae2");
    public static readonly Guid NiftyGadgets = Guid.Parse("9e5b2d72-c55b-45d0-9e91-2f89ce29e798");
    public static readonly Guid ObsoleteGear = Guid.Parse("86965ce9-cbb5-479b-985a-5a7bda562de2");
    public static readonly Guid Knowledgable = Guid.Parse("a15427cf-9396-4c2f-a497-d12bdcd291db");
    public static readonly Guid AncientLore = Guid.Parse("a59676c2-d946-4469-818d-189a231f3f4b");
    public static readonly Guid DubiousMotives = Guid.Parse("8cc66eb3-1acb-47d6-af3d-0b66ecdefe67");
    public static readonly Guid Poor = Guid.Parse("672ba83f-66d1-4273-943e-12ffc8a0cc54");

    // The Monstrous (Natural Attacks, p37).
    public static readonly Guid Monstrous = Guid.Parse("2a1efd73-1c2d-4472-9ace-3c30d9ec9300");
    public static readonly Guid NaturalAttacks = Guid.Parse("ad9481a1-da22-4b26-bae2-0722dbef31bf");
    public static readonly Guid Base = Guid.Parse("a6f63a15-cd9d-405d-a0a5-c25dab5ff742");
    public static readonly Guid Extra = Guid.Parse("acbda577-8524-4905-8f0b-f53d74034cb8");

    // The Spell-Slinger (Combat Magic, p49).
    public static readonly Guid SpellSlinger = Guid.Parse("6bd4946f-05aa-4c5b-a8d9-a634f95a1033");
    public static readonly Guid CombatMagic = Guid.Parse("2ced7a94-a54b-42ae-bbb6-986dc379ccbd");
    public static readonly Guid Bases = Guid.Parse("37b4d08c-d079-4c71-a4d1-3e84eebad8b1");
    public static readonly Guid Effects = Guid.Parse("22e7c964-efe0-4f2b-af92-986fb1184aed");

    /// <summary>One rule, one alternative, no labels. Old-fashioned 2–2 (3–3); modern 1–1 (1–2).</summary>
    public static PlaybookPickRuleResponse InitiateRule { get; } = new(
        Guid.Parse("c7e553b8-71fe-48ce-87ee-7ec38b129171"),
        null,
        0,
        [
            new PlaybookPickRuleAlternativeResponse(
                Guid.Parse("d633b0d9-4b82-4101-b6d5-e201c38ee923"),
                null,
                0,
                [
                    new PlaybookPickRuleCountResponse(OldFashioned, null, 2, 2, new PlaybookPickRuleAdjustmentResponse([FightingArts, ObsoleteGear], 3, 3)),
                    new PlaybookPickRuleCountResponse(Modern, null, 1, 1, new PlaybookPickRuleAdjustmentResponse([Modernised, NiftyGadgets], 1, 2)),
                ]),
        ]);

    /// <summary>Base + Extra: 1 + 1, or 2 + 0.</summary>
    public static PlaybookPickRuleResponse NaturalAttacksRule { get; } = new(
        Guid.Parse("7922cc30-48c5-4bb9-a427-52e70f51b022"),
        "Pick a Base and add an extra to it, or two Bases.",
        0,
        [
            Alternative("268a7083-87ed-4199-aa1b-1667a6dcca55", 0, (Base, 1), (Extra, 1)),
            Alternative("39042040-31a4-4bb4-96f0-871ff9fc1317", 1, (Base, 2), (Extra, 0)),
        ]);

    /// <summary>Bases + Effects: 3 + 0, 2 + 1, or 1 + 2.</summary>
    public static PlaybookPickRuleResponse CombatMagicRule { get; } = new(
        Guid.Parse("4a2b3fe5-4232-4b5f-ad85-ba7f3f5d833e"),
        "Pick three (with at least one base).",
        0,
        [
            Alternative("443699a9-8052-408d-a501-4d9adfa98728", 0, (Bases, 3), (Effects, 0)),
            Alternative("49db7cf4-9ef9-414a-b365-170fdf700f74", 1, (Bases, 2), (Effects, 1)),
            Alternative("a2df5d97-2f1c-4cc7-bafc-67adf911bf71", 2, (Bases, 1), (Effects, 2)),
        ]);

    private static PlaybookPickRuleAlternativeResponse Alternative(string id, int sortOrder, params (Guid Divider, int Count)[] counts) =>
        new(Guid.Parse(id), null, sortOrder, [.. counts.Select(c => new PlaybookPickRuleCountResponse(null, c.Divider, c.Count, c.Count, null))]);

    /// <summary>Trigger traditions and plain ones, by the names the build tables use.</summary>
    private static readonly Dictionary<string, (Guid Option, bool Good)> TraditionIds = new()
    {
        ["FightingArts"] = (FightingArts, true),
        ["Modernised"] = (Modernised, true),
        ["NiftyGadgets"] = (NiftyGadgets, true),
        ["Knowledgable"] = (Knowledgable, true),
        ["AncientLore"] = (AncientLore, true),
        ["ObsoleteGear"] = (ObsoleteGear, false),
        ["DubiousMotives"] = (DubiousMotives, false),
        ["Poor"] = (Poor, false),
    };

    /// <summary>"FightingArts,Poor" as Sect option ids; "" is an unanswered Sect.</summary>
    public static IReadOnlyList<Guid> Traditions(string names) =>
        [.. names.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Select(n => TraditionIds[n].Option)];

    // -----------------------------------------------------------------------------------
    // The committed seed
    // -----------------------------------------------------------------------------------

    private static readonly Lazy<IReadOnlyList<PlaybookDetailResponse>> SeedFile = new(() =>
        PlaybookSeed.Deserialize(File.ReadAllText(Path.Combine(ApiProjectRoot(), PlaybookSeed.RelativePath))));

    public static PlaybookDetailResponse SeedPlaybook(Guid id) => SeedFile.Value.Single(p => p.Id == id);

    /// <summary>The first <paramref name="count"/> options of a gear category, in sheet order.</summary>
    public static IReadOnlyList<Guid> GearOptions(PlaybookDetailResponse playbook, Guid categoryId, int count) =>
        [.. playbook.GearCategories.Single(c => c.Id == categoryId).Options.OrderBy(o => o.SortOrder).Take(count).Select(o => o.Id)];

    /// <summary>
    /// <paramref name="count"/> children of a top-level category, in sheet order after skipping
    /// <paramref name="skip"/>. The Monstrous's write-your-own Base slots are its last two.
    /// </summary>
    public static IReadOnlyList<Guid> Children(PlaybookDetailResponse playbook, Guid sectionId, Guid dividerId, int count, int skip = 0) =>
    [
        .. playbook.BespokeSections.Single(s => s.Id == sectionId).Options.Single(o => o.Id == dividerId)
            .Children.OrderBy(o => o.SortOrder).Skip(skip).Take(count).Select(o => o.Id),
    ];

    /// <summary>Walks up from the test binary to the API project directory.</summary>
    public static string ApiProjectRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "MonsterOfTheWeek.slnx")))
        {
            directory = directory.Parent;
        }

        Assert.NotNull(directory);
        return Path.Combine(directory!.FullName, "src", "api", "MonsterOfTheWeek.Api");
    }
}
