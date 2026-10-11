using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MonsterOfTheWeek.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class DropPerDomainCustomMoves : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "bystander_custom_moves");

            migrationBuilder.DropTable(
                name: "location_custom_moves");

            migrationBuilder.DropTable(
                name: "minion_custom_moves");

            migrationBuilder.DropTable(
                name: "monster_custom_moves");

            migrationBuilder.DropTable(
                name: "mystery_custom_moves");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "bystander_custom_moves",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    bystander_id = table.Column<Guid>(type: "uuid", nullable: false),
                    description = table.Column<string>(type: "text", nullable: true),
                    name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false)
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
                    description = table.Column<string>(type: "text", nullable: true),
                    name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false)
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
                name: "minion_custom_moves",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    minion_id = table.Column<Guid>(type: "uuid", nullable: false),
                    description = table.Column<string>(type: "text", nullable: true),
                    name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false)
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
                name: "monster_custom_moves",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    monster_id = table.Column<Guid>(type: "uuid", nullable: false),
                    description = table.Column<string>(type: "text", nullable: true),
                    name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false)
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
                name: "mystery_custom_moves",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    mystery_id = table.Column<Guid>(type: "uuid", nullable: false),
                    description = table.Column<string>(type: "text", nullable: true),
                    name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false)
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

            migrationBuilder.CreateIndex(
                name: "IX_bystander_custom_moves_bystander_id",
                table: "bystander_custom_moves",
                column: "bystander_id");

            migrationBuilder.CreateIndex(
                name: "IX_location_custom_moves_location_id",
                table: "location_custom_moves",
                column: "location_id");

            migrationBuilder.CreateIndex(
                name: "IX_minion_custom_moves_minion_id",
                table: "minion_custom_moves",
                column: "minion_id");

            migrationBuilder.CreateIndex(
                name: "IX_monster_custom_moves_monster_id",
                table: "monster_custom_moves",
                column: "monster_id");

            migrationBuilder.CreateIndex(
                name: "IX_mystery_custom_moves_mystery_id",
                table: "mystery_custom_moves",
                column: "mystery_id");
        }
    }
}
