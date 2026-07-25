namespace MonsterOfTheWeek.Api.Data.Entities;

public interface ITimestamped
{
    DateTimeOffset CreatedAt { get; set; }
    DateTimeOffset UpdatedAt { get; set; }
}

public sealed class Mystery : ITimestamped
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public required string Name { get; set; }
    public string? Concept { get; set; }
    public string? Hook { get; set; }
    public string? Overview { get; set; }
    public string? Notes { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

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

    public ICollection<Monster> Monsters { get; set; } = [];
}

public sealed class Monster : ITimestamped
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid? MonsterTypeId { get; set; }
    public Guid? MinionTypeId { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }
    public int HarmCapacity { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public MonsterType? MonsterType { get; set; }
    public MinionType? MinionType { get; set; }
    public ICollection<MysteryMonster> Mysteries { get; set; } = [];
    public ICollection<MonsterAttack> Attacks { get; set; } = [];
    public ICollection<MonsterPower> Powers { get; set; } = [];
    public ICollection<MonsterArmor> Armors { get; set; } = [];
    public ICollection<MonsterWeakness> Weaknesses { get; set; } = [];
    public ICollection<MonsterCustomMove> CustomMoves { get; set; } = [];
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

public sealed class Location
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid LocationTypeId { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }

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

public sealed class Bystander
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid BystanderTypeId { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }

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
