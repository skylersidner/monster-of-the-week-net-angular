using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MonsterOfTheWeek.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddHunterPlaybooks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "basic_moves",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    description_text = table.Column<string>(type: "text", nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_basic_moves", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "playbooks",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    tagline = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    description = table.Column<string>(type: "text", nullable: true),
                    luck_box_count = table.Column<int>(type: "integer", nullable: false),
                    luck_special_text = table.Column<string>(type: "text", nullable: true),
                    harm_unstable_threshold = table.Column<int>(type: "integer", nullable: false),
                    harm_box_count = table.Column<int>(type: "integer", nullable: false),
                    experience_box_count = table.Column<int>(type: "integer", nullable: false),
                    move_grant_count = table.Column<int>(type: "integer", nullable: false),
                    getting_started_text = table.Column<string>(type: "text", nullable: true),
                    introductions_text = table.Column<string>(type: "text", nullable: true),
                    leveling_up_text = table.Column<string>(type: "text", nullable: true),
                    history_prompts_text = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_playbooks", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "playbook_gear_categories",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    playbook_id = table.Column<Guid>(type: "uuid", nullable: false),
                    label = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    pick_count = table.Column<int>(type: "integer", nullable: true),
                    is_optional = table.Column<bool>(type: "boolean", nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_playbook_gear_categories", x => x.id);
                    table.ForeignKey(
                        name: "FK_playbook_gear_categories_playbooks_playbook_id",
                        column: x => x.playbook_id,
                        principalTable: "playbooks",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "playbook_improvements",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    playbook_id = table.Column<Guid>(type: "uuid", nullable: false),
                    text = table.Column<string>(type: "text", nullable: false),
                    is_advanced = table.Column<bool>(type: "boolean", nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_playbook_improvements", x => x.id);
                    table.ForeignKey(
                        name: "FK_playbook_improvements_playbooks_playbook_id",
                        column: x => x.playbook_id,
                        principalTable: "playbooks",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "playbook_look_categories",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    playbook_id = table.Column<Guid>(type: "uuid", nullable: false),
                    allows_freeform = table.Column<bool>(type: "boolean", nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_playbook_look_categories", x => x.id);
                    table.ForeignKey(
                        name: "FK_playbook_look_categories_playbooks_playbook_id",
                        column: x => x.playbook_id,
                        principalTable: "playbooks",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "playbook_moves",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    playbook_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    description_text = table.Column<string>(type: "text", nullable: true),
                    required = table.Column<bool>(type: "boolean", nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_playbook_moves", x => x.id);
                    table.ForeignKey(
                        name: "FK_playbook_moves_playbooks_playbook_id",
                        column: x => x.playbook_id,
                        principalTable: "playbooks",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "playbook_stat_array_options",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    playbook_id = table.Column<Guid>(type: "uuid", nullable: false),
                    charm = table.Column<int>(type: "integer", nullable: false),
                    cool = table.Column<int>(type: "integer", nullable: false),
                    sharp = table.Column<int>(type: "integer", nullable: false),
                    tough = table.Column<int>(type: "integer", nullable: false),
                    weird = table.Column<int>(type: "integer", nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_playbook_stat_array_options", x => x.id);
                    table.ForeignKey(
                        name: "FK_playbook_stat_array_options_playbooks_playbook_id",
                        column: x => x.playbook_id,
                        principalTable: "playbooks",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "playbook_gear_options",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    category_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    mechanical_text = table.Column<string>(type: "text", nullable: true),
                    sort_order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_playbook_gear_options", x => x.id);
                    table.ForeignKey(
                        name: "FK_playbook_gear_options_playbook_gear_categories_category_id",
                        column: x => x.category_id,
                        principalTable: "playbook_gear_categories",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "playbook_look_options",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    category_id = table.Column<Guid>(type: "uuid", nullable: false),
                    text = table.Column<string>(type: "text", nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_playbook_look_options", x => x.id);
                    table.ForeignKey(
                        name: "FK_playbook_look_options_playbook_look_categories_category_id",
                        column: x => x.category_id,
                        principalTable: "playbook_look_categories",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "idx_playbook_gear_categories_playbook_id",
                table: "playbook_gear_categories",
                column: "playbook_id");

            migrationBuilder.CreateIndex(
                name: "idx_playbook_gear_options_category_id",
                table: "playbook_gear_options",
                column: "category_id");

            migrationBuilder.CreateIndex(
                name: "idx_playbook_improvements_playbook_id",
                table: "playbook_improvements",
                column: "playbook_id");

            migrationBuilder.CreateIndex(
                name: "idx_playbook_look_categories_playbook_id",
                table: "playbook_look_categories",
                column: "playbook_id");

            migrationBuilder.CreateIndex(
                name: "idx_playbook_look_options_category_id",
                table: "playbook_look_options",
                column: "category_id");

            migrationBuilder.CreateIndex(
                name: "idx_playbook_moves_playbook_id",
                table: "playbook_moves",
                column: "playbook_id");

            migrationBuilder.CreateIndex(
                name: "idx_playbook_stat_array_options_playbook_id",
                table: "playbook_stat_array_options",
                column: "playbook_id");

            migrationBuilder.CreateIndex(
                name: "idx_playbooks_name",
                table: "playbooks",
                column: "name",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "basic_moves");

            migrationBuilder.DropTable(
                name: "playbook_gear_options");

            migrationBuilder.DropTable(
                name: "playbook_improvements");

            migrationBuilder.DropTable(
                name: "playbook_look_options");

            migrationBuilder.DropTable(
                name: "playbook_moves");

            migrationBuilder.DropTable(
                name: "playbook_stat_array_options");

            migrationBuilder.DropTable(
                name: "playbook_gear_categories");

            migrationBuilder.DropTable(
                name: "playbook_look_categories");

            migrationBuilder.DropTable(
                name: "playbooks");
        }
    }
}
