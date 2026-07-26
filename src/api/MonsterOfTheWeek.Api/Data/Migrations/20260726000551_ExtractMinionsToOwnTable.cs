using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MonsterOfTheWeek.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class ExtractMinionsToOwnTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_monsters_minion_types_minion_type_id",
                table: "monsters");

            migrationBuilder.DropForeignKey(
                name: "FK_monsters_monster_types_monster_type_id",
                table: "monsters");

            migrationBuilder.DropIndex(
                name: "IX_monsters_minion_type_id",
                table: "monsters");

            // Create minions table BEFORE dropping minion_type_id so data migration can run
            migrationBuilder.CreateTable(
                name: "minions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    monster_id = table.Column<Guid>(type: "uuid", nullable: false),
                    minion_type_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    description = table.Column<string>(type: "text", nullable: true),
                    harm_capacity = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_minions", x => x.id);
                    table.ForeignKey(
                        name: "FK_minions_minion_types_minion_type_id",
                        column: x => x.minion_type_id,
                        principalTable: "minion_types",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_minions_monsters_monster_id",
                        column: x => x.monster_id,
                        principalTable: "monsters",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            // Data migration: copy existing minion rows from monsters → minions,
            // linking each minion to the non-minion monster in the same mystery.
            migrationBuilder.Sql(@"
INSERT INTO minions (id, monster_id, minion_type_id, name, description, harm_capacity, created_at, updated_at)
SELECT
    m.id,
    parent.monster_id,
    m.minion_type_id,
    m.name,
    m.description,
    m.harm_capacity,
    COALESCE(m.created_at, now()),
    COALESCE(m.updated_at, now())
FROM monsters m
JOIN (
    SELECT DISTINCT mm_minion.monster_id AS minion_monster_id,
           (
               SELECT mm_parent.monster_id
               FROM mystery_monsters mm_parent
               JOIN monsters parent_m ON parent_m.id = mm_parent.monster_id
               WHERE mm_parent.mystery_id = mm_minion.mystery_id
                 AND parent_m.minion_type_id IS NULL
               LIMIT 1
           ) AS monster_id
    FROM mystery_monsters mm_minion
    JOIN monsters minion_m ON minion_m.id = mm_minion.monster_id
    WHERE minion_m.minion_type_id IS NOT NULL
) parent ON parent.minion_monster_id = m.id
WHERE m.minion_type_id IS NOT NULL
  AND parent.monster_id IS NOT NULL;
");

            // Remove minion rows from the bridge table and from monsters
            migrationBuilder.Sql(@"
DELETE FROM mystery_monsters
WHERE monster_id IN (SELECT id FROM monsters WHERE minion_type_id IS NOT NULL);
");
            migrationBuilder.Sql(@"
DELETE FROM monsters WHERE minion_type_id IS NOT NULL;
");

            migrationBuilder.DropColumn(
                name: "minion_type_id",
                table: "monsters");

            migrationBuilder.AlterColumn<Guid>(
                name: "monster_type_id",
                table: "monsters",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.CreateTable(
                name: "minion_armors",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    minion_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    description = table.Column<string>(type: "text", nullable: true),
                    harm_soak = table.Column<int>(type: "integer", nullable: false),
                    is_special = table.Column<bool>(type: "boolean", nullable: false),
                    special_description = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_minion_armors", x => x.id);
                    table.ForeignKey(
                        name: "FK_minion_armors_minions_minion_id",
                        column: x => x.minion_id,
                        principalTable: "minions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "minion_attacks",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    minion_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    description = table.Column<string>(type: "text", nullable: true),
                    harm = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_minion_attacks", x => x.id);
                    table.ForeignKey(
                        name: "FK_minion_attacks_minions_minion_id",
                        column: x => x.minion_id,
                        principalTable: "minions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "minion_custom_moves",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    minion_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    description = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_minion_custom_moves", x => x.id);
                    table.ForeignKey(
                        name: "FK_minion_custom_moves_minions_minion_id",
                        column: x => x.minion_id,
                        principalTable: "minions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "minion_powers",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    minion_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    description = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_minion_powers", x => x.id);
                    table.ForeignKey(
                        name: "FK_minion_powers_minions_minion_id",
                        column: x => x.minion_id,
                        principalTable: "minions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "minion_weaknesses",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    minion_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    description = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_minion_weaknesses", x => x.id);
                    table.ForeignKey(
                        name: "FK_minion_weaknesses_minions_minion_id",
                        column: x => x.minion_id,
                        principalTable: "minions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "minion_attack_weapon_tags",
                columns: table => new
                {
                    minion_attack_id = table.Column<Guid>(type: "uuid", nullable: false),
                    weapon_tag_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_minion_attack_weapon_tags", x => new { x.minion_attack_id, x.weapon_tag_id });
                    table.ForeignKey(
                        name: "FK_minion_attack_weapon_tags_minion_attacks_minion_attack_id",
                        column: x => x.minion_attack_id,
                        principalTable: "minion_attacks",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_minion_attack_weapon_tags_weapon_tags_weapon_tag_id",
                        column: x => x.weapon_tag_id,
                        principalTable: "weapon_tags",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_minion_armors_minion_id",
                table: "minion_armors",
                column: "minion_id");

            migrationBuilder.CreateIndex(
                name: "IX_minion_attack_weapon_tags_weapon_tag_id",
                table: "minion_attack_weapon_tags",
                column: "weapon_tag_id");

            migrationBuilder.CreateIndex(
                name: "IX_minion_attacks_minion_id",
                table: "minion_attacks",
                column: "minion_id");

            migrationBuilder.CreateIndex(
                name: "IX_minion_custom_moves_minion_id",
                table: "minion_custom_moves",
                column: "minion_id");

            migrationBuilder.CreateIndex(
                name: "IX_minion_powers_minion_id",
                table: "minion_powers",
                column: "minion_id");

            migrationBuilder.CreateIndex(
                name: "IX_minion_weaknesses_minion_id",
                table: "minion_weaknesses",
                column: "minion_id");

            migrationBuilder.CreateIndex(
                name: "idx_minions_minion_type_id",
                table: "minions",
                column: "minion_type_id");

            migrationBuilder.CreateIndex(
                name: "idx_minions_monster_id",
                table: "minions",
                column: "monster_id");

            migrationBuilder.AddForeignKey(
                name: "FK_monsters_monster_types_monster_type_id",
                table: "monsters",
                column: "monster_type_id",
                principalTable: "monster_types",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_monsters_monster_types_monster_type_id",
                table: "monsters");

            migrationBuilder.DropTable(
                name: "minion_armors");

            migrationBuilder.DropTable(
                name: "minion_attack_weapon_tags");

            migrationBuilder.DropTable(
                name: "minion_custom_moves");

            migrationBuilder.DropTable(
                name: "minion_powers");

            migrationBuilder.DropTable(
                name: "minion_weaknesses");

            migrationBuilder.DropTable(
                name: "minion_attacks");

            migrationBuilder.DropTable(
                name: "minions");

            migrationBuilder.AlterColumn<Guid>(
                name: "monster_type_id",
                table: "monsters",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<Guid>(
                name: "minion_type_id",
                table: "monsters",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_monsters_minion_type_id",
                table: "monsters",
                column: "minion_type_id");

            migrationBuilder.AddForeignKey(
                name: "FK_monsters_minion_types_minion_type_id",
                table: "monsters",
                column: "minion_type_id",
                principalTable: "minion_types",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_monsters_monster_types_monster_type_id",
                table: "monsters",
                column: "monster_type_id",
                principalTable: "monster_types",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }
    }
}
