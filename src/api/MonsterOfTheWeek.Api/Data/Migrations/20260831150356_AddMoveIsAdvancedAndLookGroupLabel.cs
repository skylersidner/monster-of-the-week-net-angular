using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MonsterOfTheWeek.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddMoveIsAdvancedAndLookGroupLabel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "is_advanced",
                table: "playbook_moves",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "group_label",
                table: "playbook_look_categories",
                type: "character varying(255)",
                maxLength: 255,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "is_advanced",
                table: "playbook_moves");

            migrationBuilder.DropColumn(
                name: "group_label",
                table: "playbook_look_categories");
        }
    }
}
