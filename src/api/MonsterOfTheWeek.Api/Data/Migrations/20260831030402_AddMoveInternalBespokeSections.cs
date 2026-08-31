using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MonsterOfTheWeek.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddMoveInternalBespokeSections : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "playbook_move_id",
                table: "bespoke_sections",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "idx_bespoke_sections_playbook_move_id",
                table: "bespoke_sections",
                column: "playbook_move_id");

            migrationBuilder.AddForeignKey(
                name: "FK_bespoke_sections_playbook_moves_playbook_move_id",
                table: "bespoke_sections",
                column: "playbook_move_id",
                principalTable: "playbook_moves",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_bespoke_sections_playbook_moves_playbook_move_id",
                table: "bespoke_sections");

            migrationBuilder.DropIndex(
                name: "idx_bespoke_sections_playbook_move_id",
                table: "bespoke_sections");

            migrationBuilder.DropColumn(
                name: "playbook_move_id",
                table: "bespoke_sections");
        }
    }
}
