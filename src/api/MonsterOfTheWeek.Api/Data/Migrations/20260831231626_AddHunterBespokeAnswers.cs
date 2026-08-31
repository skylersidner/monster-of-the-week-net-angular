using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MonsterOfTheWeek.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddHunterBespokeAnswers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "hunter_bespoke_section_instances",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    hunter_id = table.Column<Guid>(type: "uuid", nullable: false),
                    section_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    sort_order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_hunter_bespoke_section_instances", x => x.id);
                    table.ForeignKey(
                        name: "FK_hunter_bespoke_section_instances_bespoke_sections_section_id",
                        column: x => x.section_id,
                        principalTable: "bespoke_sections",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_hunter_bespoke_section_instances_hunters_hunter_id",
                        column: x => x.hunter_id,
                        principalTable: "hunters",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "hunter_journal_entries",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    hunter_id = table.Column<Guid>(type: "uuid", nullable: false),
                    journal_id = table.Column<Guid>(type: "uuid", nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_hunter_journal_entries", x => x.id);
                    table.ForeignKey(
                        name: "FK_hunter_journal_entries_bespoke_journals_journal_id",
                        column: x => x.journal_id,
                        principalTable: "bespoke_journals",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_hunter_journal_entries_hunters_hunter_id",
                        column: x => x.hunter_id,
                        principalTable: "hunters",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "hunter_bespoke_selections",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    hunter_id = table.Column<Guid>(type: "uuid", nullable: false),
                    section_id = table.Column<Guid>(type: "uuid", nullable: false),
                    bespoke_option_id = table.Column<Guid>(type: "uuid", nullable: true),
                    freeform_text = table.Column<string>(type: "text", nullable: true),
                    freeform_title = table.Column<string>(type: "text", nullable: true),
                    numeric_value = table.Column<int>(type: "integer", nullable: true),
                    section_instance_id = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_hunter_bespoke_selections", x => x.id);
                    table.ForeignKey(
                        name: "FK_hunter_bespoke_selections_bespoke_options_bespoke_option_id",
                        column: x => x.bespoke_option_id,
                        principalTable: "bespoke_options",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_hunter_bespoke_selections_bespoke_sections_section_id",
                        column: x => x.section_id,
                        principalTable: "bespoke_sections",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_hunter_bespoke_selections_hunter_bespoke_section_instances_~",
                        column: x => x.section_instance_id,
                        principalTable: "hunter_bespoke_section_instances",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "FK_hunter_bespoke_selections_hunters_hunter_id",
                        column: x => x.hunter_id,
                        principalTable: "hunters",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "hunter_journal_entry_field_values",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    entry_id = table.Column<Guid>(type: "uuid", nullable: false),
                    journal_field_id = table.Column<Guid>(type: "uuid", nullable: false),
                    text = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_hunter_journal_entry_field_values", x => x.id);
                    table.ForeignKey(
                        name: "FK_hunter_journal_entry_field_values_bespoke_journal_fields_jo~",
                        column: x => x.journal_field_id,
                        principalTable: "bespoke_journal_fields",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_hunter_journal_entry_field_values_hunter_journal_entries_en~",
                        column: x => x.entry_id,
                        principalTable: "hunter_journal_entries",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "idx_hunter_bespoke_instances_hunter_id",
                table: "hunter_bespoke_section_instances",
                column: "hunter_id");

            migrationBuilder.CreateIndex(
                name: "idx_hunter_bespoke_instances_section_id",
                table: "hunter_bespoke_section_instances",
                column: "section_id");

            migrationBuilder.CreateIndex(
                name: "idx_hunter_bespoke_selections_hunter_id",
                table: "hunter_bespoke_selections",
                column: "hunter_id");

            migrationBuilder.CreateIndex(
                name: "idx_hunter_bespoke_selections_instance_id",
                table: "hunter_bespoke_selections",
                column: "section_instance_id");

            migrationBuilder.CreateIndex(
                name: "idx_hunter_bespoke_selections_option_id",
                table: "hunter_bespoke_selections",
                column: "bespoke_option_id");

            migrationBuilder.CreateIndex(
                name: "idx_hunter_bespoke_selections_section_id",
                table: "hunter_bespoke_selections",
                column: "section_id");

            migrationBuilder.CreateIndex(
                name: "idx_hunter_journal_entries_hunter_id",
                table: "hunter_journal_entries",
                column: "hunter_id");

            migrationBuilder.CreateIndex(
                name: "idx_hunter_journal_entries_journal_id",
                table: "hunter_journal_entries",
                column: "journal_id");

            migrationBuilder.CreateIndex(
                name: "idx_hunter_journal_field_values_entry_id",
                table: "hunter_journal_entry_field_values",
                column: "entry_id");

            migrationBuilder.CreateIndex(
                name: "idx_hunter_journal_field_values_field_id",
                table: "hunter_journal_entry_field_values",
                column: "journal_field_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "hunter_bespoke_selections");

            migrationBuilder.DropTable(
                name: "hunter_journal_entry_field_values");

            migrationBuilder.DropTable(
                name: "hunter_bespoke_section_instances");

            migrationBuilder.DropTable(
                name: "hunter_journal_entries");
        }
    }
}
