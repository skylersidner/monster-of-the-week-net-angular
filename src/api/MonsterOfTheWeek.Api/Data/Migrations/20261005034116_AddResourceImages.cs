using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MonsterOfTheWeek.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddResourceImages : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "primary_image_id",
                table: "monsters",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "primary_image_id",
                table: "minions",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "primary_image_id",
                table: "locations",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "primary_image_id",
                table: "bystanders",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "resource_images",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    owner_type = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    owner_id = table.Column<Guid>(type: "uuid", nullable: false),
                    file_name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    content_type = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    size_bytes = table.Column<int>(type: "integer", nullable: false),
                    width = table.Column<int>(type: "integer", nullable: false),
                    height = table.Column<int>(type: "integer", nullable: false),
                    image_bytes = table.Column<byte[]>(type: "bytea", nullable: false),
                    thumbnail_bytes = table.Column<byte[]>(type: "bytea", nullable: true),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_resource_images", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "idx_monsters_primary_image_id",
                table: "monsters",
                column: "primary_image_id");

            migrationBuilder.CreateIndex(
                name: "idx_minions_primary_image_id",
                table: "minions",
                column: "primary_image_id");

            migrationBuilder.CreateIndex(
                name: "idx_locations_primary_image_id",
                table: "locations",
                column: "primary_image_id");

            migrationBuilder.CreateIndex(
                name: "idx_bystanders_primary_image_id",
                table: "bystanders",
                column: "primary_image_id");

            migrationBuilder.CreateIndex(
                name: "idx_resource_images_owner_sort",
                table: "resource_images",
                columns: new[] { "owner_type", "owner_id", "sort_order" });

            migrationBuilder.AddForeignKey(
                name: "FK_bystanders_resource_images_primary_image_id",
                table: "bystanders",
                column: "primary_image_id",
                principalTable: "resource_images",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_locations_resource_images_primary_image_id",
                table: "locations",
                column: "primary_image_id",
                principalTable: "resource_images",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_minions_resource_images_primary_image_id",
                table: "minions",
                column: "primary_image_id",
                principalTable: "resource_images",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_monsters_resource_images_primary_image_id",
                table: "monsters",
                column: "primary_image_id",
                principalTable: "resource_images",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_bystanders_resource_images_primary_image_id",
                table: "bystanders");

            migrationBuilder.DropForeignKey(
                name: "FK_locations_resource_images_primary_image_id",
                table: "locations");

            migrationBuilder.DropForeignKey(
                name: "FK_minions_resource_images_primary_image_id",
                table: "minions");

            migrationBuilder.DropForeignKey(
                name: "FK_monsters_resource_images_primary_image_id",
                table: "monsters");

            migrationBuilder.DropTable(
                name: "resource_images");

            migrationBuilder.DropIndex(
                name: "idx_monsters_primary_image_id",
                table: "monsters");

            migrationBuilder.DropIndex(
                name: "idx_minions_primary_image_id",
                table: "minions");

            migrationBuilder.DropIndex(
                name: "idx_locations_primary_image_id",
                table: "locations");

            migrationBuilder.DropIndex(
                name: "idx_bystanders_primary_image_id",
                table: "bystanders");

            migrationBuilder.DropColumn(
                name: "primary_image_id",
                table: "monsters");

            migrationBuilder.DropColumn(
                name: "primary_image_id",
                table: "minions");

            migrationBuilder.DropColumn(
                name: "primary_image_id",
                table: "locations");

            migrationBuilder.DropColumn(
                name: "primary_image_id",
                table: "bystanders");
        }
    }
}
