using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MonsterOfTheWeek.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "bystander_types",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    motivation = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bystander_types", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "location_types",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    motivation = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_location_types", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "minion_types",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    motivation = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_minion_types", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "monster_types",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    motivation = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_monster_types", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "mysteries",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    concept = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    hook = table.Column<string>(type: "text", nullable: true),
                    overview = table.Column<string>(type: "text", nullable: true),
                    notes = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_mysteries", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "weapon_tags",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    description = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_weapon_tags", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "bystanders",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    mystery_id = table.Column<Guid>(type: "uuid", nullable: false),
                    bystander_type_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    description = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bystanders", x => x.id);
                    table.ForeignKey(
                        name: "FK_bystanders_bystander_types_bystander_type_id",
                        column: x => x.bystander_type_id,
                        principalTable: "bystander_types",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_bystanders_mysteries_mystery_id",
                        column: x => x.mystery_id,
                        principalTable: "mysteries",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "countdowns",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    mystery_id = table.Column<Guid>(type: "uuid", nullable: false),
                    day = table.Column<string>(type: "text", nullable: true),
                    shadows = table.Column<string>(type: "text", nullable: true),
                    sunset = table.Column<string>(type: "text", nullable: true),
                    dusk = table.Column<string>(type: "text", nullable: true),
                    nightfall = table.Column<string>(type: "text", nullable: true),
                    midnight = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_countdowns", x => x.id);
                    table.ForeignKey(
                        name: "FK_countdowns_mysteries_mystery_id",
                        column: x => x.mystery_id,
                        principalTable: "mysteries",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "locations",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    mystery_id = table.Column<Guid>(type: "uuid", nullable: false),
                    location_type_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    description = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_locations", x => x.id);
                    table.ForeignKey(
                        name: "FK_locations_location_types_location_type_id",
                        column: x => x.location_type_id,
                        principalTable: "location_types",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_locations_mysteries_mystery_id",
                        column: x => x.mystery_id,
                        principalTable: "mysteries",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "monsters",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    mystery_id = table.Column<Guid>(type: "uuid", nullable: false),
                    monster_type_id = table.Column<Guid>(type: "uuid", nullable: true),
                    minion_type_id = table.Column<Guid>(type: "uuid", nullable: true),
                    name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    description = table.Column<string>(type: "text", nullable: true),
                    harm_capacity = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_monsters", x => x.id);
                    table.ForeignKey(
                        name: "FK_monsters_minion_types_minion_type_id",
                        column: x => x.minion_type_id,
                        principalTable: "minion_types",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_monsters_monster_types_monster_type_id",
                        column: x => x.monster_type_id,
                        principalTable: "monster_types",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_monsters_mysteries_mystery_id",
                        column: x => x.mystery_id,
                        principalTable: "mysteries",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "mystery_custom_moves",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    mystery_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    description = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_mystery_custom_moves", x => x.id);
                    table.ForeignKey(
                        name: "FK_mystery_custom_moves_mysteries_mystery_id",
                        column: x => x.mystery_id,
                        principalTable: "mysteries",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "bystander_custom_moves",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    bystander_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    description = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bystander_custom_moves", x => x.id);
                    table.ForeignKey(
                        name: "FK_bystander_custom_moves_bystanders_bystander_id",
                        column: x => x.bystander_id,
                        principalTable: "bystanders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "location_custom_moves",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    location_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    description = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_location_custom_moves", x => x.id);
                    table.ForeignKey(
                        name: "FK_location_custom_moves_locations_location_id",
                        column: x => x.location_id,
                        principalTable: "locations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "monster_armors",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    monster_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    description = table.Column<string>(type: "text", nullable: true),
                    harm_soak = table.Column<int>(type: "integer", nullable: false),
                    is_magical = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_monster_armors", x => x.id);
                    table.ForeignKey(
                        name: "FK_monster_armors_monsters_monster_id",
                        column: x => x.monster_id,
                        principalTable: "monsters",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "monster_attacks",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    monster_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    description = table.Column<string>(type: "text", nullable: true),
                    harm = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_monster_attacks", x => x.id);
                    table.ForeignKey(
                        name: "FK_monster_attacks_monsters_monster_id",
                        column: x => x.monster_id,
                        principalTable: "monsters",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "monster_custom_moves",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    monster_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    description = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_monster_custom_moves", x => x.id);
                    table.ForeignKey(
                        name: "FK_monster_custom_moves_monsters_monster_id",
                        column: x => x.monster_id,
                        principalTable: "monsters",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "monster_powers",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    monster_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    description = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_monster_powers", x => x.id);
                    table.ForeignKey(
                        name: "FK_monster_powers_monsters_monster_id",
                        column: x => x.monster_id,
                        principalTable: "monsters",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "monster_weaknesses",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    monster_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    description = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_monster_weaknesses", x => x.id);
                    table.ForeignKey(
                        name: "FK_monster_weaknesses_monsters_monster_id",
                        column: x => x.monster_id,
                        principalTable: "monsters",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "monster_attack_weapon_tags",
                columns: table => new
                {
                    monster_attack_id = table.Column<Guid>(type: "uuid", nullable: false),
                    weapon_tag_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_monster_attack_weapon_tags", x => new { x.monster_attack_id, x.weapon_tag_id });
                    table.ForeignKey(
                        name: "FK_monster_attack_weapon_tags_monster_attacks_monster_attack_id",
                        column: x => x.monster_attack_id,
                        principalTable: "monster_attacks",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_monster_attack_weapon_tags_weapon_tags_weapon_tag_id",
                        column: x => x.weapon_tag_id,
                        principalTable: "weapon_tags",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_bystander_custom_moves_bystander_id",
                table: "bystander_custom_moves",
                column: "bystander_id");

            migrationBuilder.CreateIndex(
                name: "IX_bystanders_bystander_type_id",
                table: "bystanders",
                column: "bystander_type_id");

            migrationBuilder.CreateIndex(
                name: "IX_bystanders_mystery_id",
                table: "bystanders",
                column: "mystery_id");

            migrationBuilder.CreateIndex(
                name: "IX_countdowns_mystery_id",
                table: "countdowns",
                column: "mystery_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_location_custom_moves_location_id",
                table: "location_custom_moves",
                column: "location_id");

            migrationBuilder.CreateIndex(
                name: "IX_locations_location_type_id",
                table: "locations",
                column: "location_type_id");

            migrationBuilder.CreateIndex(
                name: "IX_locations_mystery_id",
                table: "locations",
                column: "mystery_id");

            migrationBuilder.CreateIndex(
                name: "IX_monster_armors_monster_id",
                table: "monster_armors",
                column: "monster_id");

            migrationBuilder.CreateIndex(
                name: "IX_monster_attack_weapon_tags_weapon_tag_id",
                table: "monster_attack_weapon_tags",
                column: "weapon_tag_id");

            migrationBuilder.CreateIndex(
                name: "IX_monster_attacks_monster_id",
                table: "monster_attacks",
                column: "monster_id");

            migrationBuilder.CreateIndex(
                name: "IX_monster_custom_moves_monster_id",
                table: "monster_custom_moves",
                column: "monster_id");

            migrationBuilder.CreateIndex(
                name: "IX_monster_powers_monster_id",
                table: "monster_powers",
                column: "monster_id");

            migrationBuilder.CreateIndex(
                name: "IX_monster_weaknesses_monster_id",
                table: "monster_weaknesses",
                column: "monster_id");

            migrationBuilder.CreateIndex(
                name: "IX_monsters_minion_type_id",
                table: "monsters",
                column: "minion_type_id");

            migrationBuilder.CreateIndex(
                name: "IX_monsters_monster_type_id",
                table: "monsters",
                column: "monster_type_id");

            migrationBuilder.CreateIndex(
                name: "IX_monsters_mystery_id",
                table: "monsters",
                column: "mystery_id");

            migrationBuilder.CreateIndex(
                name: "IX_mystery_custom_moves_mystery_id",
                table: "mystery_custom_moves",
                column: "mystery_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "bystander_custom_moves");

            migrationBuilder.DropTable(
                name: "countdowns");

            migrationBuilder.DropTable(
                name: "location_custom_moves");

            migrationBuilder.DropTable(
                name: "monster_armors");

            migrationBuilder.DropTable(
                name: "monster_attack_weapon_tags");

            migrationBuilder.DropTable(
                name: "monster_custom_moves");

            migrationBuilder.DropTable(
                name: "monster_powers");

            migrationBuilder.DropTable(
                name: "monster_weaknesses");

            migrationBuilder.DropTable(
                name: "mystery_custom_moves");

            migrationBuilder.DropTable(
                name: "bystanders");

            migrationBuilder.DropTable(
                name: "locations");

            migrationBuilder.DropTable(
                name: "monster_attacks");

            migrationBuilder.DropTable(
                name: "weapon_tags");

            migrationBuilder.DropTable(
                name: "bystander_types");

            migrationBuilder.DropTable(
                name: "location_types");

            migrationBuilder.DropTable(
                name: "monsters");

            migrationBuilder.DropTable(
                name: "minion_types");

            migrationBuilder.DropTable(
                name: "monster_types");

            migrationBuilder.DropTable(
                name: "mysteries");
        }
    }
}
