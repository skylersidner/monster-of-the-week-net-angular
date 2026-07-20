using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MonsterOfTheWeek.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class RenameArmorIsMagicalToIsSpecial : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "is_magical",
                table: "monster_armors",
                newName: "is_special");

            migrationBuilder.AddColumn<string>(
                name: "special_description",
                table: "monster_armors",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "special_description",
                table: "monster_armors");

            migrationBuilder.RenameColumn(
                name: "is_special",
                table: "monster_armors",
                newName: "is_magical");
        }
    }
}
