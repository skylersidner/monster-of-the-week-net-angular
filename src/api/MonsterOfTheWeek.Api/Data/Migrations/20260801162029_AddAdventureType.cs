using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MonsterOfTheWeek.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddAdventureType : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "adventure_types",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    description = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_adventure_types", x => x.id);
                });

            migrationBuilder.InsertData(
                table: "adventure_types",
                columns: ["id", "name", "description"],
                values: new object[,]
                {
                    { new Guid("a1b2c3d4-5e6f-4a7b-8c9d-ef0123456789"), "Thwart",   "Hunters versus the Bad Guy." },
                    { new Guid("b2c3d4e5-6f7a-4b8c-9d0e-f01234567890"), "Collect",  "Hunters must get something important." },
                    { new Guid("c3d4e5f6-7a8b-4c9d-aef0-123456789012"), "Deliver",  "Hunters must transfer something important." },
                    { new Guid("d4e5f6a7-8b9c-4d0e-bf12-3456789abcde"), "Discover", "Hunters must find something important." }
                });

            migrationBuilder.AddColumn<Guid>(
                name: "adventure_type_id",
                table: "mysteries",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("a1b2c3d4-5e6f-4a7b-8c9d-ef0123456789"));

            migrationBuilder.CreateIndex(
                name: "IX_mysteries_adventure_type_id",
                table: "mysteries",
                column: "adventure_type_id");

            migrationBuilder.AddForeignKey(
                name: "FK_mysteries_adventure_types_adventure_type_id",
                table: "mysteries",
                column: "adventure_type_id",
                principalTable: "adventure_types",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_mysteries_adventure_types_adventure_type_id",
                table: "mysteries");

            migrationBuilder.DropIndex(
                name: "IX_mysteries_adventure_type_id",
                table: "mysteries");

            migrationBuilder.DropColumn(
                name: "adventure_type_id",
                table: "mysteries");

            migrationBuilder.DropTable(
                name: "adventure_types");
        }
    }
}
