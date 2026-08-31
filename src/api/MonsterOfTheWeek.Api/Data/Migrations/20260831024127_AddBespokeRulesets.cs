using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MonsterOfTheWeek.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddBespokeRulesets : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "bespoke_journals",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    playbook_id = table.Column<Guid>(type: "uuid", nullable: false),
                    title = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    description = table.Column<string>(type: "text", nullable: true),
                    effect_text = table.Column<string>(type: "text", nullable: true),
                    sort_order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bespoke_journals", x => x.id);
                    table.ForeignKey(
                        name: "FK_bespoke_journals_playbooks_playbook_id",
                        column: x => x.playbook_id,
                        principalTable: "playbooks",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "bespoke_sections",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    playbook_id = table.Column<Guid>(type: "uuid", nullable: false),
                    title = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    description = table.Column<string>(type: "text", nullable: true),
                    effect_text = table.Column<string>(type: "text", nullable: true),
                    free_text_label = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    min_select = table.Column<int>(type: "integer", nullable: true),
                    max_select = table.Column<int>(type: "integer", nullable: true),
                    min_instances = table.Column<int>(type: "integer", nullable: true),
                    max_instances = table.Column<int>(type: "integer", nullable: true),
                    sort_order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bespoke_sections", x => x.id);
                    table.ForeignKey(
                        name: "FK_bespoke_sections_playbooks_playbook_id",
                        column: x => x.playbook_id,
                        principalTable: "playbooks",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "playbook_extra_tracks",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    playbook_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    description = table.Column<string>(type: "text", nullable: false),
                    effect_text = table.Column<string>(type: "text", nullable: true),
                    box_count = table.Column<int>(type: "integer", nullable: false),
                    start_label = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    end_label = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_playbook_extra_tracks", x => x.id);
                    table.ForeignKey(
                        name: "FK_playbook_extra_tracks_playbooks_playbook_id",
                        column: x => x.playbook_id,
                        principalTable: "playbooks",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "bespoke_journal_fields",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    journal_id = table.Column<Guid>(type: "uuid", nullable: false),
                    label = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bespoke_journal_fields", x => x.id);
                    table.ForeignKey(
                        name: "FK_bespoke_journal_fields_bespoke_journals_journal_id",
                        column: x => x.journal_id,
                        principalTable: "bespoke_journals",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "bespoke_options",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    section_id = table.Column<Guid>(type: "uuid", nullable: false),
                    parent_option_id = table.Column<Guid>(type: "uuid", nullable: true),
                    title = table.Column<string>(type: "text", nullable: true),
                    description_text = table.Column<string>(type: "text", nullable: true),
                    min_select = table.Column<int>(type: "integer", nullable: true),
                    max_select = table.Column<int>(type: "integer", nullable: true),
                    numeric_min = table.Column<int>(type: "integer", nullable: true),
                    numeric_max = table.Column<int>(type: "integer", nullable: true),
                    sort_order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bespoke_options", x => x.id);
                    table.ForeignKey(
                        name: "FK_bespoke_options_bespoke_options_parent_option_id",
                        column: x => x.parent_option_id,
                        principalTable: "bespoke_options",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "FK_bespoke_options_bespoke_sections_section_id",
                        column: x => x.section_id,
                        principalTable: "bespoke_sections",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "idx_bespoke_journal_fields_journal_id",
                table: "bespoke_journal_fields",
                column: "journal_id");

            migrationBuilder.CreateIndex(
                name: "idx_bespoke_journals_playbook_id",
                table: "bespoke_journals",
                column: "playbook_id");

            migrationBuilder.CreateIndex(
                name: "idx_bespoke_options_parent_option_id",
                table: "bespoke_options",
                column: "parent_option_id");

            migrationBuilder.CreateIndex(
                name: "idx_bespoke_options_section_id",
                table: "bespoke_options",
                column: "section_id");

            migrationBuilder.CreateIndex(
                name: "idx_bespoke_sections_playbook_id",
                table: "bespoke_sections",
                column: "playbook_id");

            migrationBuilder.CreateIndex(
                name: "idx_playbook_extra_tracks_playbook_id",
                table: "playbook_extra_tracks",
                column: "playbook_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "bespoke_journal_fields");

            migrationBuilder.DropTable(
                name: "bespoke_options");

            migrationBuilder.DropTable(
                name: "playbook_extra_tracks");

            migrationBuilder.DropTable(
                name: "bespoke_journals");

            migrationBuilder.DropTable(
                name: "bespoke_sections");
        }
    }
}
