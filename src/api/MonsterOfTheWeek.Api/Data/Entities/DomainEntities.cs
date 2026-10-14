namespace MonsterOfTheWeek.Api.Data.Entities;

public interface ITimestamped
{
    DateTimeOffset CreatedAt { get; set; }
    DateTimeOffset UpdatedAt { get; set; }
}

public sealed class AdventureType
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public required string Name { get; set; }
    public required string Description { get; set; }

    public ICollection<Mystery> Mysteries { get; set; } = [];
}

public sealed class MonsterArchetype
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public required string Name { get; set; }
    public required string Description { get; set; }

    public ICollection<Monster> Monsters { get; set; } = [];
}

public sealed class Mystery : ITimestamped
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid AdventureTypeId { get; set; }
    public required string Name { get; set; }
    public string? Concept { get; set; }
    public string? Hook { get; set; }
    public string? Overview { get; set; }
    public string? Notes { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public AdventureType AdventureType { get; set; } = null!;
    public Countdown? Countdown { get; set; }
    public ICollection<MysteryMonster> MysteryMonsters { get; set; } = [];
    public ICollection<MysteryLocation> MysteryLocations { get; set; } = [];
    public ICollection<MysteryBystander> MysteryBystanders { get; set; } = [];
}

public sealed class Countdown
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid MysteryId { get; set; }
    public string? Day { get; set; }
    public string? Shadows { get; set; }
    public string? Sunset { get; set; }
    public string? Dusk { get; set; }
    public string? Nightfall { get; set; }
    public string? Midnight { get; set; }

    public Mystery Mystery { get; set; } = null!;
}

public sealed class MonsterType
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public required string Name { get; set; }
    public required string Motivation { get; set; }

    public ICollection<Monster> Monsters { get; set; } = [];
}

public sealed class MinionType
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public required string Name { get; set; }
    public required string Motivation { get; set; }

    public ICollection<Minion> Minions { get; set; } = [];
}

public sealed class Monster : ITimestamped
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid MonsterTypeId { get; set; }
    public Guid MonsterArchetypeId { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }
    public int HarmCapacity { get; set; }
    public Guid? PrimaryImageId { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public MonsterType MonsterType { get; set; } = null!;
    public MonsterArchetype MonsterArchetype { get; set; } = null!;
    public ICollection<MysteryMonster> Mysteries { get; set; } = [];
    public ICollection<MonsterAttack> Attacks { get; set; } = [];
    public ICollection<MonsterPower> Powers { get; set; } = [];
    public ICollection<MonsterArmor> Armors { get; set; } = [];
    public ICollection<MonsterWeakness> Weaknesses { get; set; } = [];
    public ICollection<Minion> Minions { get; set; } = [];
}

public sealed class MonsterAttack
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid MonsterId { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }
    public int Harm { get; set; }

    public Monster Monster { get; set; } = null!;
    public ICollection<MonsterAttackWeaponTag> MonsterAttackWeaponTags { get; set; } = [];
}

public sealed class MonsterAttackWeaponTag
{
    public Guid MonsterAttackId { get; set; }
    public Guid WeaponTagId { get; set; }

    public MonsterAttack MonsterAttack { get; set; } = null!;
    public WeaponTag WeaponTag { get; set; } = null!;
}

public sealed class WeaponTag
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public required string Name { get; set; }
    public string? Description { get; set; }

    public ICollection<MonsterAttackWeaponTag> MonsterAttackWeaponTags { get; set; } = [];
    public ICollection<MinionAttackWeaponTag> MinionAttackWeaponTags { get; set; } = [];
}

public sealed class MonsterPower
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid MonsterId { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }

    public Monster Monster { get; set; } = null!;
}

public sealed class MonsterArmor
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid MonsterId { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }
    public int HarmSoak { get; set; }
    public bool IsSpecial { get; set; }
    public string? SpecialDescription { get; set; }

    public Monster Monster { get; set; } = null!;
}

public sealed class MonsterWeakness
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid MonsterId { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }

    public Monster Monster { get; set; } = null!;
}

public sealed class LocationType
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public required string Name { get; set; }
    public required string Motivation { get; set; }

    public ICollection<Location> Locations { get; set; } = [];
}

public sealed class Location : ITimestamped
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid LocationTypeId { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }
    public Guid? PrimaryImageId { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public LocationType LocationType { get; set; } = null!;
    public ICollection<MysteryLocation> Mysteries { get; set; } = [];
}

public sealed class BystanderType
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public required string Name { get; set; }
    public required string Motivation { get; set; }

    public ICollection<Bystander> Bystanders { get; set; } = [];
}

public sealed class Bystander : ITimestamped
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid BystanderTypeId { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }
    public Guid? PrimaryImageId { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public BystanderType BystanderType { get; set; } = null!;
    public ICollection<MysteryBystander> Mysteries { get; set; } = [];
}

public sealed class MysteryMonster
{
    public Guid MysteryId { get; set; }
    public Guid MonsterId { get; set; }

    public Mystery Mystery { get; set; } = null!;
    public Monster Monster { get; set; } = null!;
}

public sealed class MysteryLocation
{
    public Guid MysteryId { get; set; }
    public Guid LocationId { get; set; }

    public Mystery Mystery { get; set; } = null!;
    public Location Location { get; set; } = null!;
}

public sealed class MysteryBystander
{
    public Guid MysteryId { get; set; }
    public Guid BystanderId { get; set; }

    public Mystery Mystery { get; set; } = null!;
    public Bystander Bystander { get; set; } = null!;
}

public sealed class Minion : ITimestamped
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid MonsterId { get; set; }
    public Guid MinionTypeId { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }
    public int HarmCapacity { get; set; }
    public Guid? PrimaryImageId { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public Monster Monster { get; set; } = null!;
    public MinionType MinionType { get; set; } = null!;
    public ICollection<MinionAttack> Attacks { get; set; } = [];
    public ICollection<MinionPower> Powers { get; set; } = [];
    public ICollection<MinionArmor> Armors { get; set; } = [];
    public ICollection<MinionWeakness> Weaknesses { get; set; } = [];
}

public sealed class MinionAttack
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid MinionId { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }
    public int Harm { get; set; }

    public Minion Minion { get; set; } = null!;
    public ICollection<MinionAttackWeaponTag> MinionAttackWeaponTags { get; set; } = [];
}

public sealed class MinionAttackWeaponTag
{
    public Guid MinionAttackId { get; set; }
    public Guid WeaponTagId { get; set; }

    public MinionAttack MinionAttack { get; set; } = null!;
    public WeaponTag WeaponTag { get; set; } = null!;
}

public sealed class MinionPower
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid MinionId { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }

    public Minion Minion { get; set; } = null!;
}

public sealed class MinionArmor
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid MinionId { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }
    public int HarmSoak { get; set; }
    public bool IsSpecial { get; set; }
    public string? SpecialDescription { get; set; }

    public Minion Minion { get; set; } = null!;
}

public sealed class MinionWeakness
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid MinionId { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }

    public Minion Minion { get; set; } = null!;
}

// The one owner-type discriminator for the whole domain — docs/resource-images/design.md,
// docs/domain-custom-moves/architecture.md §3.1, and docs/resource-images/endpoint-unification.md
// §2.6, which is the decision that merged it.
//
// **This was two enums until U0.** `ResourceOwnerType` (four members, for ResourceImage.OwnerType)
// and `CustomMoveOwnerType` (five, for CustomMove.OwnerType) are now one five-member type. Skyler
// chose one domain vocabulary over two feature-scoped ones (endpoint-unification.md §11 Q3),
// superseding architecture.md §2.8. The thing §2.8 was protecting is real and did not go away: a
// Mystery can own a custom move but cannot own an image, so three `switch` arms in
// ResourceImageService that were dead by exhaustion under the four-member enum are now reachable.
// They throw, deliberately — see IResourceImageService.ImageOwnerTypes, which is where the
// image-legal subset is now *declared* rather than derived from the enum, and
// ResourceImageOwnerTypeTests, which pins the throws.
//
// **The member names are a data contract, not a style choice.** Both columns are stored as strings
// (.HasConversion<string>() in MotwDbContext.cs) for readable raw SQL and no magic numbers, so
// these five identifiers are literally what sits in custom_moves.owner_type and
// resource_images.owner_type today. Rename a member and every existing row in both tables fails to
// materialise — DomainOwnerTypePostgresTests asserts the stored strings against the member names so
// that failure lands in a test rather than at runtime. Member ORDER is free: the ordinals were
// never persisted, which is why merging two enums with different member orders cost nothing.
public enum DomainOwnerType
{
    Mystery,
    Monster,
    Minion,
    Location,
    Bystander,
}

// One row per uploaded image file, owned by exactly one Monster, Minion, Bystander, or
// Location via the (OwnerType, OwnerId) discriminator pair rather than a real FK — a
// discriminator + id pair can't reference four different tables, so ownership (the owner
// exists, and is the type it claims to be) is validated at the service layer, not the schema.
// Accepted tradeoff of design.md §1.3's single-table decision, not an oversight.
//
// OwnerType is DomainOwnerType, which has five members, but only four of them are legal here.
// Nothing in the type system says so any more (endpoint-unification.md §2.6): the image-legal
// subset is declared by IResourceImageService.ImageOwnerTypes and enforced by the service, which
// throws on a Mystery rather than writing a row it could never serve.
//
// Deliberately does NOT implement ITimestamped: an image row is immutable once stored (replace
// = delete + re-upload), so there is no UpdatedAt to carry. That also means
// MotwDbContext.ApplyTimestamps() — which only iterates ITimestamped entries — never touches
// CreatedAt here; IResourceImageService (Phase 2) must set it explicitly when constructing a row.
public sealed class ResourceImage
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public DomainOwnerType OwnerType { get; set; }
    public Guid OwnerId { get; set; }
    public required string FileName { get; set; }
    public required string ContentType { get; set; }
    public int SizeBytes { get; set; }
    public int Width { get; set; }
    public int Height { get; set; }
    public required byte[] ImageBytes { get; set; }
    public byte[]? ThumbnailBytes { get; set; }
    public int SortOrder { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

// Domain custom moves — docs/domain-custom-moves/architecture.md §3.1, Phase 1.
//
// CustomMove.OwnerType uses the single DomainOwnerType declared above. It had its own
// CustomMoveOwnerType enum until endpoint-unification.md §2.6 (U0) merged the two; the rationale
// for the merge, and for what replaced the exhaustiveness the split used to buy, is recorded at
// that declaration rather than repeated here.
//
// One custom move, owned by exactly one Mystery, Monster, Minion, Location or Bystander via the
// (OwnerType, OwnerId) discriminator pair rather than a real FK — the same single-table shape
// ResourceImage above uses, and for the same reason: a discriminator + id pair can't reference
// five different tables, so ownership (the owner exists, and is the type it claims to be) is
// validated at the service layer, not the schema. architecture.md §2.3's accepted tradeoff, not
// an oversight. It is also why owner deletion has to delete these rows in application code
// (architecture.md §2.4/§19) instead of relying on a database cascade.
//
// No navigation property in either direction (architecture.md §2.6): the five detail
// projections load their moves through ICustomMoveService.ListForProjectionAsync rather than an
// .Include, so there is nothing for a nav to serve and five fewer collection joins on the
// detail queries.
//
// No ITimestamped and no CreatedAt, matching all five of the per-domain tables this replaces —
// so, unlike ResourceImage, there is nothing for a caller to remember to set. Stated explicitly
// so nobody adds CreatedAt later by analogy with images; it would be a contract change
// (architecture.md §18).
public sealed class CustomMove
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public DomainOwnerType OwnerType { get; set; }
    public Guid OwnerId { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }
}
