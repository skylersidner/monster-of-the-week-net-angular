using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MonsterOfTheWeek.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddHunterSheetAndPicks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "background",
                table: "hunters",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "experience",
                table: "hunters",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "harm",
                table: "hunters",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "luck",
                table: "hunters",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<Guid>(
                name: "playbook_stat_array_option_id",
                table: "hunters",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "pronouns",
                table: "hunters",
                type: "character varying(255)",
                maxLength: 255,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "hunter_gear_selections",
                columns: table => new
                {
                    hunter_id = table.Column<Guid>(type: "uuid", nullable: false),
                    playbook_gear_option_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_hunter_gear_selections", x => new { x.hunter_id, x.playbook_gear_option_id });
                    table.ForeignKey(
                        name: "FK_hunter_gear_selections_hunters_hunter_id",
                        column: x => x.hunter_id,
                        principalTable: "hunters",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_hunter_gear_selections_playbook_gear_options_playbook_gear_~",
                        column: x => x.playbook_gear_option_id,
                        principalTable: "playbook_gear_options",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "hunter_moves",
                columns: table => new
                {
                    hunter_id = table.Column<Guid>(type: "uuid", nullable: false),
                    playbook_move_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_hunter_moves", x => new { x.hunter_id, x.playbook_move_id });
                    table.ForeignKey(
                        name: "FK_hunter_moves_hunters_hunter_id",
                        column: x => x.hunter_id,
                        principalTable: "hunters",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_hunter_moves_playbook_moves_playbook_move_id",
                        column: x => x.playbook_move_id,
                        principalTable: "playbook_moves",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "idx_hunters_stat_array_option_id",
                table: "hunters",
                column: "playbook_stat_array_option_id");

            migrationBuilder.CreateIndex(
                name: "idx_hunter_gear_selections_option_id",
                table: "hunter_gear_selections",
                column: "playbook_gear_option_id");

            migrationBuilder.CreateIndex(
                name: "idx_hunter_moves_playbook_move_id",
                table: "hunter_moves",
                column: "playbook_move_id");

            migrationBuilder.AddForeignKey(
                name: "FK_hunters_playbook_stat_array_options_playbook_stat_array_opt~",
                table: "hunters",
                column: "playbook_stat_array_option_id",
                principalTable: "playbook_stat_array_options",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_hunters_playbook_stat_array_options_playbook_stat_array_opt~",
                table: "hunters");

            migrationBuilder.DropTable(
                name: "hunter_gear_selections");

            migrationBuilder.DropTable(
                name: "hunter_moves");

            migrationBuilder.DropIndex(
                name: "idx_hunters_stat_array_option_id",
                table: "hunters");

            migrationBuilder.DropColumn(
                name: "background",
                table: "hunters");

            migrationBuilder.DropColumn(
                name: "experience",
                table: "hunters");

            migrationBuilder.DropColumn(
                name: "harm",
                table: "hunters");

            migrationBuilder.DropColumn(
                name: "luck",
                table: "hunters");

            migrationBuilder.DropColumn(
                name: "playbook_stat_array_option_id",
                table: "hunters");

            migrationBuilder.DropColumn(
                name: "pronouns",
                table: "hunters");
        }
    }
}
