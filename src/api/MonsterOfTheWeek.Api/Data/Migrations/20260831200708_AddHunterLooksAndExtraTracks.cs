using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MonsterOfTheWeek.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddHunterLooksAndExtraTracks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "hunter_extra_track_values",
                columns: table => new
                {
                    hunter_id = table.Column<Guid>(type: "uuid", nullable: false),
                    extra_track_id = table.Column<Guid>(type: "uuid", nullable: false),
                    current_value = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_hunter_extra_track_values", x => new { x.hunter_id, x.extra_track_id });
                    table.ForeignKey(
                        name: "FK_hunter_extra_track_values_hunters_hunter_id",
                        column: x => x.hunter_id,
                        principalTable: "hunters",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_hunter_extra_track_values_playbook_extra_tracks_extra_track~",
                        column: x => x.extra_track_id,
                        principalTable: "playbook_extra_tracks",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "hunter_look_selections",
                columns: table => new
                {
                    hunter_id = table.Column<Guid>(type: "uuid", nullable: false),
                    look_category_id = table.Column<Guid>(type: "uuid", nullable: false),
                    look_option_id = table.Column<Guid>(type: "uuid", nullable: true),
                    freeform_text = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_hunter_look_selections", x => new { x.hunter_id, x.look_category_id });
                    table.ForeignKey(
                        name: "FK_hunter_look_selections_hunters_hunter_id",
                        column: x => x.hunter_id,
                        principalTable: "hunters",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_hunter_look_selections_playbook_look_categories_look_catego~",
                        column: x => x.look_category_id,
                        principalTable: "playbook_look_categories",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_hunter_look_selections_playbook_look_options_look_option_id",
                        column: x => x.look_option_id,
                        principalTable: "playbook_look_options",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "idx_hunter_extra_track_values_track_id",
                table: "hunter_extra_track_values",
                column: "extra_track_id");

            migrationBuilder.CreateIndex(
                name: "idx_hunter_look_selections_category_id",
                table: "hunter_look_selections",
                column: "look_category_id");

            migrationBuilder.CreateIndex(
                name: "idx_hunter_look_selections_option_id",
                table: "hunter_look_selections",
                column: "look_option_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "hunter_extra_track_values");

            migrationBuilder.DropTable(
                name: "hunter_look_selections");
        }
    }
}
