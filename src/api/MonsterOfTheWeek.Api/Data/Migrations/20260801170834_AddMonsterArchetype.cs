using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MonsterOfTheWeek.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddMonsterArchetype : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "monster_archetypes",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    description = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_monster_archetypes", x => x.id);
                });

            migrationBuilder.InsertData(
                table: "monster_archetypes",
                columns: ["id", "name", "description"],
                values: new object[,]
                {
                    { new Guid("f47ac10b-58cc-4372-a567-0e02b2c3d401"), "Heavy Hitter", "It is the threat" },
                    { new Guid("f47ac10b-58cc-4372-a567-0e02b2c3d402"), "Racer", "Trying to achieve something" },
                    { new Guid("f47ac10b-58cc-4372-a567-0e02b2c3d403"), "Chaser", "Pursuing the hunters" },
                    { new Guid("f47ac10b-58cc-4372-a567-0e02b2c3d404"), "Shadow", "Up to something behind the scenes" }
                });

            migrationBuilder.AddColumn<Guid>(
                name: "monster_archetype_id",
                table: "monsters",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("f47ac10b-58cc-4372-a567-0e02b2c3d401"));

            migrationBuilder.CreateIndex(
                name: "IX_monsters_monster_archetype_id",
                table: "monsters",
                column: "monster_archetype_id");

            migrationBuilder.AddForeignKey(
                name: "FK_monsters_monster_archetypes_monster_archetype_id",
                table: "monsters",
                column: "monster_archetype_id",
                principalTable: "monster_archetypes",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_monsters_monster_archetypes_monster_archetype_id",
                table: "monsters");

            migrationBuilder.DropIndex(
                name: "IX_monsters_monster_archetype_id",
                table: "monsters");

            migrationBuilder.DropColumn(
                name: "monster_archetype_id",
                table: "monsters");

            migrationBuilder.DropTable(
                name: "monster_archetypes");
        }
    }
}

