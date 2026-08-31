using Microsoft.AspNetCore.DataProtection.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using MonsterOfTheWeek.Api.Data.Entities;

namespace MonsterOfTheWeek.Api.Data;

public sealed class MotwDbContext(DbContextOptions<MotwDbContext> options)
    : DbContext(options), IDataProtectionKeyContext
{
    public DbSet<Mystery> Mysteries => Set<Mystery>();
    public DbSet<AdventureType> AdventureTypes => Set<AdventureType>();
    public DbSet<MonsterArchetype> MonsterArchetypes => Set<MonsterArchetype>();
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

    public DbSet<Playbook> Playbooks => Set<Playbook>();
    public DbSet<PlaybookStatArrayOption> PlaybookStatArrayOptions => Set<PlaybookStatArrayOption>();
    public DbSet<PlaybookMove> PlaybookMoves => Set<PlaybookMove>();
    public DbSet<PlaybookGearCategory> PlaybookGearCategories => Set<PlaybookGearCategory>();
    public DbSet<PlaybookGearOption> PlaybookGearOptions => Set<PlaybookGearOption>();
    public DbSet<PlaybookLookCategory> PlaybookLookCategories => Set<PlaybookLookCategory>();
    public DbSet<PlaybookLookOption> PlaybookLookOptions => Set<PlaybookLookOption>();
    public DbSet<PlaybookImprovement> PlaybookImprovements => Set<PlaybookImprovement>();
    public DbSet<BasicMove> BasicMoves => Set<BasicMove>();
    public DbSet<BespokeSection> BespokeSections => Set<BespokeSection>();
    public DbSet<BespokeOption> BespokeOptions => Set<BespokeOption>();
    public DbSet<BespokeJournal> BespokeJournals => Set<BespokeJournal>();
    public DbSet<BespokeJournalField> BespokeJournalFields => Set<BespokeJournalField>();
    public DbSet<PlaybookExtraTrack> PlaybookExtraTracks => Set<PlaybookExtraTrack>();

    // Named AppUsers, not Users: IdentityUserContext<TUser, ...> already declares a
    // DbSet<TUser> Users, so Users here would collide if this context ever derives from it.
    public DbSet<AppUser> AppUsers => Set<AppUser>();
    public DbSet<DataProtectionKey> DataProtectionKeys => Set<DataProtectionKey>();

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
        modelBuilder.Entity<AdventureType>(entity =>
        {
            entity.ToTable("adventure_types");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(255).IsRequired();
            entity.Property(e => e.Description).HasColumnName("description").IsRequired();
        });

        modelBuilder.Entity<Mystery>(entity =>
        {
            entity.ToTable("mysteries");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.AdventureTypeId).HasColumnName("adventure_type_id").IsRequired();
            entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(255).IsRequired();
            entity.Property(e => e.Concept).HasColumnName("concept").HasMaxLength(500);
            entity.Property(e => e.Hook).HasColumnName("hook");
            entity.Property(e => e.Overview).HasColumnName("overview");
            entity.Property(e => e.Notes).HasColumnName("notes");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");

            entity.HasOne(e => e.AdventureType).WithMany(e => e.Mysteries).HasForeignKey(e => e.AdventureTypeId);
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

        modelBuilder.Entity<MonsterArchetype>(entity =>
        {
            entity.ToTable("monster_archetypes");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(255).IsRequired();
            entity.Property(e => e.Description).HasColumnName("description").IsRequired();
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
            entity.Property(e => e.MonsterArchetypeId).HasColumnName("monster_archetype_id").IsRequired();
            entity.HasOne(e => e.MonsterArchetype).WithMany(e => e.Monsters).HasForeignKey(e => e.MonsterArchetypeId);
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

        modelBuilder.Entity<AppUser>(entity =>
        {
            entity.ToTable("app_users");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Email).HasColumnName("email").IsRequired();
            entity.Property(e => e.Password).HasColumnName("password").IsRequired();
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(e => e.Email).IsUnique().HasDatabaseName("idx_app_users_email");
        });

        modelBuilder.Entity<DataProtectionKey>(entity =>
        {
            entity.ToTable("data_protection_keys");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.FriendlyName).HasColumnName("friendly_name");
            entity.Property(e => e.Xml).HasColumnName("xml");
        });

        ConfigurePlaybooks(modelBuilder);
    }

    /*
     * Hunter Playbook template data — docs/hunter-playbooks/ Phase 2.
     *
     * Split into its own method rather than extending the already-long OnModelCreating
     * inline: this domain adds nine entities now and four more when Phase 5 lands.
     *
     * Cascade delete throughout, matching the Minion child tables: a Playbook's stat
     * arrays, moves, gear, looks and improvements have no meaning without it. Hunter
     * instances are a separate concern — they live-link to these rows by FK (Phase 9/10),
     * and guarding against deleting a row a Hunter still references is deferred to that
     * point, since no Hunter table exists yet. See architecture.md Section 3,
     * "Persistence semantics for the upsert-the-graph endpoint."
     *
     * ValueGeneratedNever() on every key here, unlike the entities above, and it is
     * load-bearing rather than cosmetic. These entities populate Id inline
     * (= Guid.NewGuid()), so a brand-new child already carries a non-default key. Under
     * EF's default ValueGeneratedOnAdd for Guid keys, a non-default key on an entity
     * discovered through a tracked parent's navigation is read as "this row already
     * exists", so the new child is classified Modified and saved as an UPDATE that matches
     * zero rows — surfacing as DbUpdateConcurrencyException at the end of an otherwise
     * valid PUT. Declaring the keys app-generated (which is the truth) makes EF decide
     * Added vs. Modified from whether the entity is tracked, which is what the Id-based
     * diff in PlaybookService needs. The entities above never hit this because none of
     * them add children to an already-tracked graph — they go through Add() on the root,
     * which marks the whole graph Added regardless of key values.
     *
     * Model-side metadata only: it changes no column definition, so it produces no DDL.
     */
    private static void ConfigurePlaybooks(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Playbook>(entity =>
        {
            entity.ToTable("playbooks");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(255).IsRequired();
            entity.Property(e => e.Description).HasColumnName("description");
            entity.Property(e => e.LuckBoxCount).HasColumnName("luck_box_count");
            entity.Property(e => e.LuckSpecialText).HasColumnName("luck_special_text");
            entity.Property(e => e.HarmUnstableThreshold).HasColumnName("harm_unstable_threshold");
            entity.Property(e => e.HarmBoxCount).HasColumnName("harm_box_count");
            entity.Property(e => e.ExperienceBoxCount).HasColumnName("experience_box_count");
            entity.Property(e => e.MoveGrantCount).HasColumnName("move_grant_count");
            entity.Property(e => e.GettingStartedText).HasColumnName("getting_started_text");
            entity.Property(e => e.IntroductionsText).HasColumnName("introductions_text");
            entity.Property(e => e.LevelingUpText).HasColumnName("leveling_up_text");
            entity.Property(e => e.HistoryPromptsText).HasColumnName("history_prompts_text");
            entity.HasIndex(e => e.Name).IsUnique().HasDatabaseName("idx_playbooks_name");
        });

        modelBuilder.Entity<PlaybookStatArrayOption>(entity =>
        {
            entity.ToTable("playbook_stat_array_options");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(e => e.PlaybookId).HasColumnName("playbook_id");
            entity.Property(e => e.Charm).HasColumnName("charm");
            entity.Property(e => e.Cool).HasColumnName("cool");
            entity.Property(e => e.Sharp).HasColumnName("sharp");
            entity.Property(e => e.Tough).HasColumnName("tough");
            entity.Property(e => e.Weird).HasColumnName("weird");
            entity.Property(e => e.SortOrder).HasColumnName("sort_order");
            entity.HasOne(e => e.Playbook).WithMany(e => e.StatArrayOptions).HasForeignKey(e => e.PlaybookId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => e.PlaybookId).HasDatabaseName("idx_playbook_stat_array_options_playbook_id");
        });

        modelBuilder.Entity<PlaybookMove>(entity =>
        {
            entity.ToTable("playbook_moves");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(e => e.PlaybookId).HasColumnName("playbook_id");
            entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(255).IsRequired();
            entity.Property(e => e.DescriptionText).HasColumnName("description_text");
            entity.Property(e => e.Required).HasColumnName("required");
            entity.Property(e => e.SortOrder).HasColumnName("sort_order");
            entity.HasOne(e => e.Playbook).WithMany(e => e.Moves).HasForeignKey(e => e.PlaybookId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => e.PlaybookId).HasDatabaseName("idx_playbook_moves_playbook_id");
        });

        modelBuilder.Entity<PlaybookGearCategory>(entity =>
        {
            entity.ToTable("playbook_gear_categories");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(e => e.PlaybookId).HasColumnName("playbook_id");
            entity.Property(e => e.Label).HasColumnName("label").HasMaxLength(255).IsRequired();
            entity.Property(e => e.PickCount).HasColumnName("pick_count");
            entity.Property(e => e.IsOptional).HasColumnName("is_optional");
            entity.Property(e => e.SortOrder).HasColumnName("sort_order");
            entity.HasOne(e => e.Playbook).WithMany(e => e.GearCategories).HasForeignKey(e => e.PlaybookId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => e.PlaybookId).HasDatabaseName("idx_playbook_gear_categories_playbook_id");
        });

        modelBuilder.Entity<PlaybookGearOption>(entity =>
        {
            entity.ToTable("playbook_gear_options");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(e => e.CategoryId).HasColumnName("category_id");
            entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(255).IsRequired();
            entity.Property(e => e.MechanicalText).HasColumnName("mechanical_text");
            entity.Property(e => e.SortOrder).HasColumnName("sort_order");
            entity.HasOne(e => e.Category).WithMany(e => e.Options).HasForeignKey(e => e.CategoryId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => e.CategoryId).HasDatabaseName("idx_playbook_gear_options_category_id");
        });

        modelBuilder.Entity<PlaybookLookCategory>(entity =>
        {
            entity.ToTable("playbook_look_categories");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(e => e.PlaybookId).HasColumnName("playbook_id");
            entity.Property(e => e.AllowsFreeform).HasColumnName("allows_freeform");
            entity.Property(e => e.SortOrder).HasColumnName("sort_order");
            entity.HasOne(e => e.Playbook).WithMany(e => e.LookCategories).HasForeignKey(e => e.PlaybookId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => e.PlaybookId).HasDatabaseName("idx_playbook_look_categories_playbook_id");
        });

        modelBuilder.Entity<PlaybookLookOption>(entity =>
        {
            entity.ToTable("playbook_look_options");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(e => e.CategoryId).HasColumnName("category_id");
            entity.Property(e => e.Text).HasColumnName("text").IsRequired();
            entity.Property(e => e.SortOrder).HasColumnName("sort_order");
            entity.HasOne(e => e.Category).WithMany(e => e.Options).HasForeignKey(e => e.CategoryId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => e.CategoryId).HasDatabaseName("idx_playbook_look_options_category_id");
        });

        modelBuilder.Entity<PlaybookImprovement>(entity =>
        {
            entity.ToTable("playbook_improvements");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(e => e.PlaybookId).HasColumnName("playbook_id");
            entity.Property(e => e.Text).HasColumnName("text").IsRequired();
            entity.Property(e => e.IsAdvanced).HasColumnName("is_advanced");
            entity.Property(e => e.SortOrder).HasColumnName("sort_order");
            entity.HasOne(e => e.Playbook).WithMany(e => e.Improvements).HasForeignKey(e => e.PlaybookId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => e.PlaybookId).HasDatabaseName("idx_playbook_improvements_playbook_id");
        });

        modelBuilder.Entity<BasicMove>(entity =>
        {
            entity.ToTable("basic_moves");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(255).IsRequired();
            entity.Property(e => e.DescriptionText).HasColumnName("description_text").IsRequired();
            entity.Property(e => e.SortOrder).HasColumnName("sort_order");
        });

        ConfigureBespokeRulesets(modelBuilder);
    }

    /*
     * Phase 5 — bespoke rulesets. architecture.md Section 6 is the authoritative spec.
     *
     * Same ValueGeneratedNever() rule as ConfigurePlaybooks above, for the same
     * load-bearing reason: these rows are added to an already-tracked Playbook graph by the
     * upsert endpoint, and a pre-populated Guid key would otherwise be read as "already
     * exists" and saved as a zero-row UPDATE.
     */
    private static void ConfigureBespokeRulesets(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<BespokeSection>(entity =>
        {
            entity.ToTable("bespoke_sections");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(e => e.PlaybookId).HasColumnName("playbook_id");
            entity.Property(e => e.Title).HasColumnName("title").HasMaxLength(255).IsRequired();
            entity.Property(e => e.Description).HasColumnName("description");
            entity.Property(e => e.EffectText).HasColumnName("effect_text");
            entity.Property(e => e.FreeTextLabel).HasColumnName("free_text_label").HasMaxLength(255);
            entity.Property(e => e.MinSelect).HasColumnName("min_select");
            entity.Property(e => e.MaxSelect).HasColumnName("max_select");
            entity.Property(e => e.MinInstances).HasColumnName("min_instances");
            entity.Property(e => e.MaxInstances).HasColumnName("max_instances");
            entity.Property(e => e.SortOrder).HasColumnName("sort_order");
            entity.HasOne(e => e.Playbook).WithMany(e => e.BespokeSections).HasForeignKey(e => e.PlaybookId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => e.PlaybookId).HasDatabaseName("idx_bespoke_sections_playbook_id");
        });

        modelBuilder.Entity<BespokeOption>(entity =>
        {
            entity.ToTable("bespoke_options");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(e => e.SectionId).HasColumnName("section_id");
            entity.Property(e => e.ParentOptionId).HasColumnName("parent_option_id");
            entity.Property(e => e.Title).HasColumnName("title");
            entity.Property(e => e.DescriptionText).HasColumnName("description_text");
            entity.Property(e => e.MinSelect).HasColumnName("min_select");
            entity.Property(e => e.MaxSelect).HasColumnName("max_select");
            entity.Property(e => e.NumericMin).HasColumnName("numeric_min");
            entity.Property(e => e.NumericMax).HasColumnName("numeric_max");
            entity.Property(e => e.SortOrder).HasColumnName("sort_order");

            entity.HasOne(e => e.Section).WithMany(e => e.Options).HasForeignKey(e => e.SectionId)
                .OnDelete(DeleteBehavior.Cascade);

            /*
             * The self-reference is NoAction, deliberately, and it is not a weaker choice
             * than Cascade. Every option already carries SectionId, so deleting a Section
             * cascades to the whole tree in one step regardless of depth — the parent link
             * has no work to do there. Declaring it Cascade as well would give Postgres two
             * cascade paths to the same rows for no benefit. Deleting a subtree without
             * deleting its Section is handled explicitly in PlaybookService, which walks
             * descendants before removing a parent, so orphan rows are impossible.
             */
            entity.HasOne(e => e.ParentOption).WithMany(e => e.ChildOptions)
                .HasForeignKey(e => e.ParentOptionId)
                .OnDelete(DeleteBehavior.NoAction);

            entity.HasIndex(e => e.SectionId).HasDatabaseName("idx_bespoke_options_section_id");
            entity.HasIndex(e => e.ParentOptionId).HasDatabaseName("idx_bespoke_options_parent_option_id");
        });

        modelBuilder.Entity<BespokeJournal>(entity =>
        {
            entity.ToTable("bespoke_journals");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(e => e.PlaybookId).HasColumnName("playbook_id");
            entity.Property(e => e.Title).HasColumnName("title").HasMaxLength(255).IsRequired();
            entity.Property(e => e.Description).HasColumnName("description");
            entity.Property(e => e.EffectText).HasColumnName("effect_text");
            entity.Property(e => e.SortOrder).HasColumnName("sort_order");
            entity.HasOne(e => e.Playbook).WithMany(e => e.BespokeJournals).HasForeignKey(e => e.PlaybookId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => e.PlaybookId).HasDatabaseName("idx_bespoke_journals_playbook_id");
        });

        modelBuilder.Entity<BespokeJournalField>(entity =>
        {
            entity.ToTable("bespoke_journal_fields");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(e => e.JournalId).HasColumnName("journal_id");
            entity.Property(e => e.Label).HasColumnName("label").HasMaxLength(255).IsRequired();
            entity.Property(e => e.SortOrder).HasColumnName("sort_order");
            entity.HasOne(e => e.Journal).WithMany(e => e.Fields).HasForeignKey(e => e.JournalId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => e.JournalId).HasDatabaseName("idx_bespoke_journal_fields_journal_id");
        });

        modelBuilder.Entity<PlaybookExtraTrack>(entity =>
        {
            entity.ToTable("playbook_extra_tracks");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(e => e.PlaybookId).HasColumnName("playbook_id");
            entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(255).IsRequired();
            entity.Property(e => e.Description).HasColumnName("description").IsRequired();
            entity.Property(e => e.EffectText).HasColumnName("effect_text");
            entity.Property(e => e.BoxCount).HasColumnName("box_count");
            entity.Property(e => e.StartLabel).HasColumnName("start_label").HasMaxLength(255);
            entity.Property(e => e.EndLabel).HasColumnName("end_label").HasMaxLength(255).IsRequired();
            entity.Property(e => e.SortOrder).HasColumnName("sort_order");
            entity.HasOne(e => e.Playbook).WithMany(e => e.ExtraTracks).HasForeignKey(e => e.PlaybookId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => e.PlaybookId).HasDatabaseName("idx_playbook_extra_tracks_playbook_id");
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
