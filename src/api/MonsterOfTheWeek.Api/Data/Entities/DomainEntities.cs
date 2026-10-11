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
    public ICollection<MysteryCustomMove> CustomMoves { get; set; } = [];
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
    public ICollection<MonsterCustomMove> CustomMoves { get; set; } = [];
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

public sealed class MonsterCustomMove
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
    public ICollection<LocationCustomMove> CustomMoves { get; set; } = [];
}

public sealed class LocationCustomMove
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid LocationId { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }

    public Location Location { get; set; } = null!;
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
    public ICollection<BystanderCustomMove> CustomMoves { get; set; } = [];
}

public sealed class BystanderCustomMove
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid BystanderId { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }

    public Bystander Bystander { get; set; } = null!;
}

public sealed class MysteryCustomMove
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid MysteryId { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }

    public Mystery Mystery { get; set; } = null!;
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
    public ICollection<MinionCustomMove> CustomMoves { get; set; } = [];
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

public sealed class MinionCustomMove
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid MinionId { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }

    public Minion Minion { get; set; } = null!;
}

// Resource images — docs/resource-images/design.md and phases.md Phase 1.
//
// The discriminator for ResourceImage.OwnerType. Stored as a string-backed column
// (.HasConversion<string>() in MotwDbContext.cs), which was a new pattern for this codebase
// when it landed — no other entity used HasConversion then. Chosen over a plain int for
// readable raw SQL and no magic numbers, not because it matched an existing precedent.
// CustomMoveOwnerType below is the second such column (domain-custom-moves/architecture.md
// §22), so this is now a convention with two members rather than a deliberate first.
public enum ResourceOwnerType
{
    Monster,
    Minion,
    Bystander,
    Location,
}

// One row per uploaded image file, owned by exactly one Monster, Minion, Bystander, or
// Location via the (OwnerType, OwnerId) discriminator pair rather than a real FK — a
// discriminator + id pair can't reference four different tables, so ownership (the owner
// exists, and is the type it claims to be) is validated at the service layer, not the schema.
// Accepted tradeoff of design.md §1.3's single-table decision, not an oversight.
//
// Deliberately does NOT implement ITimestamped: an image row is immutable once stored (replace
// = delete + re-upload), so there is no UpdatedAt to carry. That also means
// MotwDbContext.ApplyTimestamps() — which only iterates ITimestamped entries — never touches
// CreatedAt here; IResourceImageService (Phase 2) must set it explicitly when constructing a row.
public sealed class ResourceImage
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public ResourceOwnerType OwnerType { get; set; }
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
// The discriminator for CustomMove.OwnerType, and deliberately a SECOND owner-type enum rather
// than a fifth member on ResourceOwnerType above (architecture.md §2.8, §22). ResourceOwnerType
// has exactly four members because nothing can own an image but a Monster, Minion, Bystander or
// Location; a Mystery can own a custom move. Adding Mystery to ResourceOwnerType would make
// three throwing `_ =>` arms in ResourceImageService reachable from a compiling route, so the
// second enum is the cheaper mistake. The two are not interchangeable and neither converts to
// the other — if you find yourself wanting a cast, you want the wrong one.
//
// Member order matches architecture.md §3.1. Values are persisted as strings
// (.HasConversion<string>() in MotwDbContext.cs), so renaming a member is a data migration, not
// a refactor; reordering is free.
public enum CustomMoveOwnerType
{
    Mystery,
    Monster,
    Minion,
    Location,
    Bystander,
}

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
    public CustomMoveOwnerType OwnerType { get; set; }
    public Guid OwnerId { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }
}
