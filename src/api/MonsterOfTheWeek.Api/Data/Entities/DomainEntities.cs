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
// (.HasConversion<string>() in MotwDbContext.cs), which is a new pattern for this codebase —
// no other entity uses HasConversion today. Chosen over a plain int for readable raw SQL and
// no magic numbers, not because it matches an existing precedent.
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
