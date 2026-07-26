using Microsoft.EntityFrameworkCore;
using MonsterOfTheWeek.Api.Data.Entities;

namespace MonsterOfTheWeek.Api.Data;

public sealed class MotwDbContext(DbContextOptions<MotwDbContext> options) : DbContext(options)
{
    public DbSet<Mystery> Mysteries => Set<Mystery>();
    public DbSet<Countdown> Countdowns => Set<Countdown>();
    public DbSet<Monster> Monsters => Set<Monster>();
    public DbSet<MonsterType> MonsterTypes => Set<MonsterType>();
    public DbSet<MinionType> MinionTypes => Set<MinionType>();
    public DbSet<MonsterPower> MonsterPowers => Set<MonsterPower>();
    public DbSet<MonsterAttack> MonsterAttacks => Set<MonsterAttack>();
    public DbSet<MonsterAttackWeaponTag> MonsterAttackWeaponTags => Set<MonsterAttackWeaponTag>();
    public DbSet<MonsterArmor> MonsterArmors => Set<MonsterArmor>();
    public DbSet<MonsterWeakness> MonsterWeaknesses => Set<MonsterWeakness>();
    public DbSet<MonsterCustomMove> MonsterCustomMoves => Set<MonsterCustomMove>();
    public DbSet<WeaponTag> WeaponTags => Set<WeaponTag>();
    public DbSet<Location> Locations => Set<Location>();
    public DbSet<LocationType> LocationTypes => Set<LocationType>();
    public DbSet<LocationCustomMove> LocationCustomMoves => Set<LocationCustomMove>();
    public DbSet<Bystander> Bystanders => Set<Bystander>();
    public DbSet<BystanderType> BystanderTypes => Set<BystanderType>();
    public DbSet<BystanderCustomMove> BystanderCustomMoves => Set<BystanderCustomMove>();
    public DbSet<MysteryCustomMove> MysteryCustomMoves => Set<MysteryCustomMove>();
    public DbSet<MysteryMonster> MysteryMonsters => Set<MysteryMonster>();
    public DbSet<MysteryLocation> MysteryLocations => Set<MysteryLocation>();
    public DbSet<MysteryBystander> MysteryBystanders => Set<MysteryBystander>();
    public DbSet<Minion> Minions => Set<Minion>();
    public DbSet<MinionAttack> MinionAttacks => Set<MinionAttack>();
    public DbSet<MinionAttackWeaponTag> MinionAttackWeaponTags => Set<MinionAttackWeaponTag>();
    public DbSet<MinionPower> MinionPowers => Set<MinionPower>();
    public DbSet<MinionArmor> MinionArmors => Set<MinionArmor>();
    public DbSet<MinionWeakness> MinionWeaknesses => Set<MinionWeakness>();
    public DbSet<MinionCustomMove> MinionCustomMoves => Set<MinionCustomMove>();

    public override int SaveChanges()
    {
        ApplyTimestamps();
        return base.SaveChanges();
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        ApplyTimestamps();
        return base.SaveChangesAsync(cancellationToken);
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Mystery>(entity =>
        {
            entity.ToTable("mysteries");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(255).IsRequired();
            entity.Property(e => e.Concept).HasColumnName("concept").HasMaxLength(500);
            entity.Property(e => e.Hook).HasColumnName("hook");
            entity.Property(e => e.Overview).HasColumnName("overview");
            entity.Property(e => e.Notes).HasColumnName("notes");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
        });

        modelBuilder.Entity<Countdown>(entity =>
        {
            entity.ToTable("countdowns");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.MysteryId).HasColumnName("mystery_id");
            entity.Property(e => e.Day).HasColumnName("day");
            entity.Property(e => e.Shadows).HasColumnName("shadows");
            entity.Property(e => e.Sunset).HasColumnName("sunset");
            entity.Property(e => e.Dusk).HasColumnName("dusk");
            entity.Property(e => e.Nightfall).HasColumnName("nightfall");
            entity.Property(e => e.Midnight).HasColumnName("midnight");
            entity.HasIndex(e => e.MysteryId).IsUnique();
            entity.HasOne(e => e.Mystery).WithOne(e => e.Countdown).HasForeignKey<Countdown>(e => e.MysteryId);
        });

        modelBuilder.Entity<MonsterType>(entity =>
        {
            entity.ToTable("monster_types");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(255).IsRequired();
            entity.Property(e => e.Motivation).HasColumnName("motivation").IsRequired();
        });

        modelBuilder.Entity<MinionType>(entity =>
        {
            entity.ToTable("minion_types");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(255).IsRequired();
            entity.Property(e => e.Motivation).HasColumnName("motivation").IsRequired();
        });

        modelBuilder.Entity<Monster>(entity =>
        {
            entity.ToTable("monsters");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.MonsterTypeId).HasColumnName("monster_type_id").IsRequired();
            entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(255).IsRequired();
            entity.Property(e => e.Description).HasColumnName("description");
            entity.Property(e => e.HarmCapacity).HasColumnName("harm_capacity");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");

            entity.HasOne(e => e.MonsterType).WithMany(e => e.Monsters).HasForeignKey(e => e.MonsterTypeId);
        });

        modelBuilder.Entity<MonsterAttack>(entity =>
        {
            entity.ToTable("monster_attacks");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.MonsterId).HasColumnName("monster_id");
            entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(255).IsRequired();
            entity.Property(e => e.Description).HasColumnName("description");
            entity.Property(e => e.Harm).HasColumnName("harm");
            entity.HasOne(e => e.Monster).WithMany(e => e.Attacks).HasForeignKey(e => e.MonsterId);
        });

        modelBuilder.Entity<MonsterAttackWeaponTag>(entity =>
        {
            entity.ToTable("monster_attack_weapon_tags");
            entity.HasKey(e => new { e.MonsterAttackId, e.WeaponTagId });
            entity.Property(e => e.MonsterAttackId).HasColumnName("monster_attack_id");
            entity.Property(e => e.WeaponTagId).HasColumnName("weapon_tag_id");
            entity.HasOne(e => e.MonsterAttack).WithMany(e => e.MonsterAttackWeaponTags)
                .HasForeignKey(e => e.MonsterAttackId);
            entity.HasOne(e => e.WeaponTag).WithMany(e => e.MonsterAttackWeaponTags)
                .HasForeignKey(e => e.WeaponTagId);
        });

        modelBuilder.Entity<WeaponTag>(entity =>
        {
            entity.ToTable("weapon_tags");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(255).IsRequired();
            entity.Property(e => e.Description).HasColumnName("description");
        });

        modelBuilder.Entity<MonsterPower>(entity =>
        {
            entity.ToTable("monster_powers");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.MonsterId).HasColumnName("monster_id");
            entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(255).IsRequired();
            entity.Property(e => e.Description).HasColumnName("description");
            entity.HasOne(e => e.Monster).WithMany(e => e.Powers).HasForeignKey(e => e.MonsterId);
        });

        modelBuilder.Entity<MonsterArmor>(entity =>
        {
            entity.ToTable("monster_armors");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.MonsterId).HasColumnName("monster_id");
            entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(255).IsRequired();
            entity.Property(e => e.Description).HasColumnName("description");
            entity.Property(e => e.HarmSoak).HasColumnName("harm_soak");
            entity.Property(e => e.IsSpecial).HasColumnName("is_special");
            entity.Property(e => e.SpecialDescription).HasColumnName("special_description");
            entity.HasOne(e => e.Monster).WithMany(e => e.Armors).HasForeignKey(e => e.MonsterId);
        });

        modelBuilder.Entity<MonsterWeakness>(entity =>
        {
            entity.ToTable("monster_weaknesses");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.MonsterId).HasColumnName("monster_id");
            entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(255).IsRequired();
            entity.Property(e => e.Description).HasColumnName("description");
            entity.HasOne(e => e.Monster).WithMany(e => e.Weaknesses).HasForeignKey(e => e.MonsterId);
        });

        modelBuilder.Entity<MonsterCustomMove>(entity =>
        {
            entity.ToTable("monster_custom_moves");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.MonsterId).HasColumnName("monster_id");
            entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(255).IsRequired();
            entity.Property(e => e.Description).HasColumnName("description");
            entity.HasOne(e => e.Monster).WithMany(e => e.CustomMoves).HasForeignKey(e => e.MonsterId);
        });

        modelBuilder.Entity<LocationType>(entity =>
        {
            entity.ToTable("location_types");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(255).IsRequired();
            entity.Property(e => e.Motivation).HasColumnName("motivation").IsRequired();
        });

        modelBuilder.Entity<Location>(entity =>
        {
            entity.ToTable("locations");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.LocationTypeId).HasColumnName("location_type_id");
            entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(255).IsRequired();
            entity.Property(e => e.Description).HasColumnName("description");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");

            entity.HasOne(e => e.LocationType).WithMany(e => e.Locations).HasForeignKey(e => e.LocationTypeId);
        });

        modelBuilder.Entity<LocationCustomMove>(entity =>
        {
            entity.ToTable("location_custom_moves");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.LocationId).HasColumnName("location_id");
            entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(255).IsRequired();
            entity.Property(e => e.Description).HasColumnName("description");
            entity.HasOne(e => e.Location).WithMany(e => e.CustomMoves).HasForeignKey(e => e.LocationId);
        });

        modelBuilder.Entity<BystanderType>(entity =>
        {
            entity.ToTable("bystander_types");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(255).IsRequired();
            entity.Property(e => e.Motivation).HasColumnName("motivation").IsRequired();
        });

        modelBuilder.Entity<Bystander>(entity =>
        {
            entity.ToTable("bystanders");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.BystanderTypeId).HasColumnName("bystander_type_id");
            entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(255).IsRequired();
            entity.Property(e => e.Description).HasColumnName("description");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");

            entity.HasOne(e => e.BystanderType).WithMany(e => e.Bystanders).HasForeignKey(e => e.BystanderTypeId);
        });

        modelBuilder.Entity<BystanderCustomMove>(entity =>
        {
            entity.ToTable("bystander_custom_moves");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.BystanderId).HasColumnName("bystander_id");
            entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(255).IsRequired();
            entity.Property(e => e.Description).HasColumnName("description");
            entity.HasOne(e => e.Bystander).WithMany(e => e.CustomMoves).HasForeignKey(e => e.BystanderId);
        });

        modelBuilder.Entity<MysteryCustomMove>(entity =>
        {
            entity.ToTable("mystery_custom_moves");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.MysteryId).HasColumnName("mystery_id");
            entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(255).IsRequired();
            entity.Property(e => e.Description).HasColumnName("description");
            entity.HasOne(e => e.Mystery).WithMany(e => e.CustomMoves).HasForeignKey(e => e.MysteryId);
        });

        modelBuilder.Entity<MysteryMonster>(entity =>
        {
            entity.ToTable("mystery_monsters");
            entity.HasKey(e => new { e.MysteryId, e.MonsterId });
            entity.Property(e => e.MysteryId).HasColumnName("mystery_id");
            entity.Property(e => e.MonsterId).HasColumnName("monster_id");
            entity.HasOne(e => e.Mystery).WithMany(e => e.MysteryMonsters).HasForeignKey(e => e.MysteryId);
            entity.HasOne(e => e.Monster).WithMany(e => e.Mysteries).HasForeignKey(e => e.MonsterId);
        });

        modelBuilder.Entity<MysteryLocation>(entity =>
        {
            entity.ToTable("mystery_locations");
            entity.HasKey(e => new { e.MysteryId, e.LocationId });
            entity.Property(e => e.MysteryId).HasColumnName("mystery_id");
            entity.Property(e => e.LocationId).HasColumnName("location_id");
            entity.HasOne(e => e.Mystery).WithMany(e => e.MysteryLocations).HasForeignKey(e => e.MysteryId);
            entity.HasOne(e => e.Location).WithMany(e => e.Mysteries).HasForeignKey(e => e.LocationId);
        });

        modelBuilder.Entity<MysteryBystander>(entity =>
        {
            entity.ToTable("mystery_bystanders");
            entity.HasKey(e => new { e.MysteryId, e.BystanderId });
            entity.Property(e => e.MysteryId).HasColumnName("mystery_id");
            entity.Property(e => e.BystanderId).HasColumnName("bystander_id");
            entity.HasOne(e => e.Mystery).WithMany(e => e.MysteryBystanders).HasForeignKey(e => e.MysteryId);
            entity.HasOne(e => e.Bystander).WithMany(e => e.Mysteries).HasForeignKey(e => e.BystanderId);
        });

        modelBuilder.Entity<Minion>(entity =>
        {
            entity.ToTable("minions");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.MonsterId).HasColumnName("monster_id").IsRequired();
            entity.Property(e => e.MinionTypeId).HasColumnName("minion_type_id").IsRequired();
            entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(255).IsRequired();
            entity.Property(e => e.Description).HasColumnName("description");
            entity.Property(e => e.HarmCapacity).HasColumnName("harm_capacity");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");

            entity.HasOne(e => e.Monster).WithMany(e => e.Minions).HasForeignKey(e => e.MonsterId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.MinionType).WithMany(e => e.Minions).HasForeignKey(e => e.MinionTypeId);
            entity.HasIndex(e => e.MonsterId).HasDatabaseName("idx_minions_monster_id");
            entity.HasIndex(e => e.MinionTypeId).HasDatabaseName("idx_minions_minion_type_id");
        });

        modelBuilder.Entity<MinionAttack>(entity =>
        {
            entity.ToTable("minion_attacks");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.MinionId).HasColumnName("minion_id");
            entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(255).IsRequired();
            entity.Property(e => e.Description).HasColumnName("description");
            entity.Property(e => e.Harm).HasColumnName("harm");
            entity.HasOne(e => e.Minion).WithMany(e => e.Attacks).HasForeignKey(e => e.MinionId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<MinionAttackWeaponTag>(entity =>
        {
            entity.ToTable("minion_attack_weapon_tags");
            entity.HasKey(e => new { e.MinionAttackId, e.WeaponTagId });
            entity.Property(e => e.MinionAttackId).HasColumnName("minion_attack_id");
            entity.Property(e => e.WeaponTagId).HasColumnName("weapon_tag_id");
            entity.HasOne(e => e.MinionAttack).WithMany(e => e.MinionAttackWeaponTags)
                .HasForeignKey(e => e.MinionAttackId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.WeaponTag).WithMany(e => e.MinionAttackWeaponTags)
                .HasForeignKey(e => e.WeaponTagId);
        });

        modelBuilder.Entity<MinionPower>(entity =>
        {
            entity.ToTable("minion_powers");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.MinionId).HasColumnName("minion_id");
            entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(255).IsRequired();
            entity.Property(e => e.Description).HasColumnName("description");
            entity.HasOne(e => e.Minion).WithMany(e => e.Powers).HasForeignKey(e => e.MinionId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<MinionArmor>(entity =>
        {
            entity.ToTable("minion_armors");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.MinionId).HasColumnName("minion_id");
            entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(255).IsRequired();
            entity.Property(e => e.Description).HasColumnName("description");
            entity.Property(e => e.HarmSoak).HasColumnName("harm_soak");
            entity.Property(e => e.IsSpecial).HasColumnName("is_special");
            entity.Property(e => e.SpecialDescription).HasColumnName("special_description");
            entity.HasOne(e => e.Minion).WithMany(e => e.Armors).HasForeignKey(e => e.MinionId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<MinionWeakness>(entity =>
        {
            entity.ToTable("minion_weaknesses");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.MinionId).HasColumnName("minion_id");
            entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(255).IsRequired();
            entity.Property(e => e.Description).HasColumnName("description");
            entity.HasOne(e => e.Minion).WithMany(e => e.Weaknesses).HasForeignKey(e => e.MinionId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<MinionCustomMove>(entity =>
        {
            entity.ToTable("minion_custom_moves");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.MinionId).HasColumnName("minion_id");
            entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(255).IsRequired();
            entity.Property(e => e.Description).HasColumnName("description");
            entity.HasOne(e => e.Minion).WithMany(e => e.CustomMoves).HasForeignKey(e => e.MinionId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }

    private void ApplyTimestamps()
    {
        var now = DateTimeOffset.UtcNow;

        foreach (var entry in ChangeTracker.Entries<ITimestamped>())
        {
            if (entry.State == EntityState.Added)
            {
                if (entry.Entity.CreatedAt == default)
                {
                    entry.Entity.CreatedAt = now;
                }

                entry.Entity.UpdatedAt = now;
            }
            else if (entry.State == EntityState.Modified)
            {
                entry.Entity.UpdatedAt = now;
            }
        }
    }
}
