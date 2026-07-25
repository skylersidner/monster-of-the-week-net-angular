using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MonsterOfTheWeek.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class RemoveMysteryFKAddBridgeTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_bystanders_mysteries_mystery_id",
                table: "bystanders");

            migrationBuilder.DropForeignKey(
                name: "FK_locations_mysteries_mystery_id",
                table: "locations");

            migrationBuilder.DropForeignKey(
                name: "FK_monsters_mysteries_mystery_id",
                table: "monsters");

            migrationBuilder.DropIndex(
                name: "IX_monsters_mystery_id",
                table: "monsters");

            migrationBuilder.DropIndex(
                name: "IX_locations_mystery_id",
                table: "locations");

            migrationBuilder.DropIndex(
                name: "IX_bystanders_mystery_id",
                table: "bystanders");

            migrationBuilder.DropColumn(
                name: "mystery_id",
                table: "monsters");

            migrationBuilder.DropColumn(
                name: "mystery_id",
                table: "locations");

            migrationBuilder.DropColumn(
                name: "mystery_id",
                table: "bystanders");

            migrationBuilder.CreateTable(
                name: "mystery_bystanders",
                columns: table => new
                {
                    mystery_id = table.Column<Guid>(type: "uuid", nullable: false),
                    bystander_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_mystery_bystanders", x => new { x.mystery_id, x.bystander_id });
                    table.ForeignKey(
                        name: "FK_mystery_bystanders_bystanders_bystander_id",
                        column: x => x.bystander_id,
                        principalTable: "bystanders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_mystery_bystanders_mysteries_mystery_id",
                        column: x => x.mystery_id,
                        principalTable: "mysteries",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "mystery_locations",
                columns: table => new
                {
                    mystery_id = table.Column<Guid>(type: "uuid", nullable: false),
                    location_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_mystery_locations", x => new { x.mystery_id, x.location_id });
                    table.ForeignKey(
                        name: "FK_mystery_locations_locations_location_id",
                        column: x => x.location_id,
                        principalTable: "locations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_mystery_locations_mysteries_mystery_id",
                        column: x => x.mystery_id,
                        principalTable: "mysteries",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "mystery_monsters",
                columns: table => new
                {
                    mystery_id = table.Column<Guid>(type: "uuid", nullable: false),
                    monster_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_mystery_monsters", x => new { x.mystery_id, x.monster_id });
                    table.ForeignKey(
                        name: "FK_mystery_monsters_monsters_monster_id",
                        column: x => x.monster_id,
                        principalTable: "monsters",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_mystery_monsters_mysteries_mystery_id",
                        column: x => x.mystery_id,
                        principalTable: "mysteries",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_mystery_bystanders_bystander_id",
                table: "mystery_bystanders",
                column: "bystander_id");

            migrationBuilder.CreateIndex(
                name: "IX_mystery_locations_location_id",
                table: "mystery_locations",
                column: "location_id");

            migrationBuilder.CreateIndex(
                name: "IX_mystery_monsters_monster_id",
                table: "mystery_monsters",
                column: "monster_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "mystery_bystanders");

            migrationBuilder.DropTable(
                name: "mystery_locations");

            migrationBuilder.DropTable(
                name: "mystery_monsters");

            migrationBuilder.AddColumn<Guid>(
                name: "mystery_id",
                table: "monsters",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "mystery_id",
                table: "locations",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "mystery_id",
                table: "bystanders",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.CreateIndex(
                name: "IX_monsters_mystery_id",
                table: "monsters",
                column: "mystery_id");

            migrationBuilder.CreateIndex(
                name: "IX_locations_mystery_id",
                table: "locations",
                column: "mystery_id");

            migrationBuilder.CreateIndex(
                name: "IX_bystanders_mystery_id",
                table: "bystanders",
                column: "mystery_id");

            migrationBuilder.AddForeignKey(
                name: "FK_bystanders_mysteries_mystery_id",
                table: "bystanders",
                column: "mystery_id",
                principalTable: "mysteries",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_locations_mysteries_mystery_id",
                table: "locations",
                column: "mystery_id",
                principalTable: "mysteries",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_monsters_mysteries_mystery_id",
                table: "monsters",
                column: "mystery_id",
                principalTable: "mysteries",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
