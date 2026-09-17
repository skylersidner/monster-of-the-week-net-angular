using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MonsterOfTheWeek.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPickRules : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "playbook_pick_rules",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    playbook_id = table.Column<Guid>(type: "uuid", nullable: false),
                    label = table.Column<string>(type: "text", nullable: true),
                    sort_order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_playbook_pick_rules", x => x.id);
                    table.ForeignKey(
                        name: "FK_playbook_pick_rules_playbooks_playbook_id",
                        column: x => x.playbook_id,
                        principalTable: "playbooks",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "playbook_pick_rule_alternatives",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    rule_id = table.Column<Guid>(type: "uuid", nullable: false),
                    label = table.Column<string>(type: "text", nullable: true),
                    sort_order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_playbook_pick_rule_alternatives", x => x.id);
                    table.ForeignKey(
                        name: "FK_playbook_pick_rule_alternatives_playbook_pick_rules_rule_id",
                        column: x => x.rule_id,
                        principalTable: "playbook_pick_rules",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "playbook_pick_rule_counts",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    alternative_id = table.Column<Guid>(type: "uuid", nullable: false),
                    gear_category_id = table.Column<Guid>(type: "uuid", nullable: true),
                    bespoke_option_id = table.Column<Guid>(type: "uuid", nullable: true),
                    min_count = table.Column<int>(type: "integer", nullable: false),
                    max_count = table.Column<int>(type: "integer", nullable: false),
                    adjusted_min_count = table.Column<int>(type: "integer", nullable: true),
                    adjusted_max_count = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_playbook_pick_rule_counts", x => x.id);
                    table.CheckConstraint("ck_playbook_pick_rule_counts_adjustment_pair", "(\"adjusted_min_count\" IS NULL) = (\"adjusted_max_count\" IS NULL)");
                    table.CheckConstraint("ck_playbook_pick_rule_counts_one_target", "(\"gear_category_id\" IS NULL) <> (\"bespoke_option_id\" IS NULL)");
                    table.CheckConstraint("ck_playbook_pick_rule_counts_range", "\"min_count\" <= \"max_count\"");
                    table.ForeignKey(
                        name: "FK_playbook_pick_rule_counts_bespoke_options_bespoke_option_id",
                        column: x => x.bespoke_option_id,
                        principalTable: "bespoke_options",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_playbook_pick_rule_counts_playbook_gear_categories_gear_cat~",
                        column: x => x.gear_category_id,
                        principalTable: "playbook_gear_categories",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_playbook_pick_rule_counts_playbook_pick_rule_alternatives_a~",
                        column: x => x.alternative_id,
                        principalTable: "playbook_pick_rule_alternatives",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "playbook_pick_rule_count_triggers",
                columns: table => new
                {
                    count_id = table.Column<Guid>(type: "uuid", nullable: false),
                    bespoke_option_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_playbook_pick_rule_count_triggers", x => new { x.count_id, x.bespoke_option_id });
                    table.ForeignKey(
                        name: "FK_playbook_pick_rule_count_triggers_bespoke_options_bespoke_o~",
                        column: x => x.bespoke_option_id,
                        principalTable: "bespoke_options",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_playbook_pick_rule_count_triggers_playbook_pick_rule_counts~",
                        column: x => x.count_id,
                        principalTable: "playbook_pick_rule_counts",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "idx_playbook_pick_rule_alternatives_rule_id",
                table: "playbook_pick_rule_alternatives",
                column: "rule_id");

            migrationBuilder.CreateIndex(
                name: "idx_playbook_pick_rule_count_triggers_bespoke_option_id",
                table: "playbook_pick_rule_count_triggers",
                column: "bespoke_option_id");

            migrationBuilder.CreateIndex(
                name: "idx_playbook_pick_rule_counts_alternative_bespoke_option",
                table: "playbook_pick_rule_counts",
                columns: new[] { "alternative_id", "bespoke_option_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_playbook_pick_rule_counts_alternative_gear_category",
                table: "playbook_pick_rule_counts",
                columns: new[] { "alternative_id", "gear_category_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_playbook_pick_rule_counts_bespoke_option_id",
                table: "playbook_pick_rule_counts",
                column: "bespoke_option_id");

            migrationBuilder.CreateIndex(
                name: "idx_playbook_pick_rule_counts_gear_category_id",
                table: "playbook_pick_rule_counts",
                column: "gear_category_id");

            migrationBuilder.CreateIndex(
                name: "idx_playbook_pick_rules_playbook_id",
                table: "playbook_pick_rules",
                column: "playbook_id");

            /*
             * Data: the three canonical pick rules (hunter-creation-wizard.md 12.9, Q3, Q5, Q12),
             * for databases that already hold the seeded playbooks.
             *
             * Postgres-only SQL, and no automated test runs it: the test suite builds SQLite
             * schemas with EnsureCreatedAsync and never runs migrations. It was checked by hand on
             * Postgres against a database with all three playbooks, one with a playbook removed,
             * and a fresh one.
             *
             * One guard per playbook. A rule is inserted only when its playbook has no rule yet
             * and every row it points at still exists with a shape the rule fits: the same things
             * PlaybookService checks before it keeps a rule. A playbook edited or deleted through
             * the admin screen skips its own rule and leaves the other two alone, rather than
             * failing the deploy. The release notes carry a query that shows any skip.
             *
             * Each child insert is guarded on its parent row, so a skipped rule inserts nothing
             * below it. Rule and alternative ids are fixed and shared with hunter-playbooks.json;
             * count ids are storage-only. On a fresh database the playbooks table is still empty
             * here, every guard skips, and PlaybookSeed then inserts the same rules from the seed.
             *
             * No stored number changes (S8), and the Initiate's gear paragraph isn't touched (Q11).
             */

            // The Initiate: weapons follow the Sect's traditions. One rule, one alternative, no labels.
            migrationBuilder.Sql(@"
INSERT INTO playbook_pick_rules (id, playbook_id, label, sort_order)
SELECT 'c7e553b8-71fe-48ce-87ee-7ec38b129171'::uuid, p.id, NULL, 0
FROM playbooks p
WHERE p.id = 'a0c2b1dd-75e9-4c62-913a-e652e5f23df2'::uuid
  AND NOT EXISTS (SELECT 1 FROM playbook_pick_rules r WHERE r.playbook_id = p.id)
  -- Old-fashioned and Modern weapons: picked, non-optional lists with room for 3 and 2.
  AND EXISTS (SELECT 1 FROM playbook_gear_categories c
              WHERE c.id = '4740273a-f878-4719-8c0e-2626cac2566f'::uuid AND c.playbook_id = p.id
                AND c.pick_count >= 3 AND NOT c.is_optional)
  AND EXISTS (SELECT 1 FROM playbook_gear_categories c
              WHERE c.id = '524d08ca-da76-4d4e-8353-2317ab30419a'::uuid AND c.playbook_id = p.id
                AND c.pick_count >= 2 AND NOT c.is_optional)
  -- Fighting arts, Obsolete gear, Modernised, Nifty gadgets: leaf options of a playbook-level
  -- section of this playbook that is answered once.
  AND (SELECT count(*) FROM bespoke_options o
       JOIN bespoke_sections s ON s.id = o.section_id
       WHERE o.id IN ('ceecaf7f-c871-422b-afa1-68ce91229274'::uuid, '86965ce9-cbb5-479b-985a-5a7bda562de2'::uuid,
                      'ad188960-40d2-48f3-8782-3a8caded1ae2'::uuid, '9e5b2d72-c55b-45d0-9e91-2f89ce29e798'::uuid)
         AND s.playbook_id = p.id AND s.playbook_move_id IS NULL
         AND s.min_instances IS NULL AND s.max_instances IS NULL
         AND NOT EXISTS (SELECT 1 FROM bespoke_options child WHERE child.parent_option_id = o.id)) = 4;

INSERT INTO playbook_pick_rule_alternatives (id, rule_id, label, sort_order)
SELECT 'd633b0d9-4b82-4101-b6d5-e201c38ee923'::uuid, r.id, NULL, 0
FROM playbook_pick_rules r
WHERE r.id = 'c7e553b8-71fe-48ce-87ee-7ec38b129171'::uuid;

-- Old-fashioned 2, or 3 with Fighting arts or Obsolete gear. Modern 1, or 1-2 with Modernised or Nifty gadgets.
INSERT INTO playbook_pick_rule_counts
    (id, alternative_id, gear_category_id, bespoke_option_id, min_count, max_count, adjusted_min_count, adjusted_max_count)
SELECT v.id, v.alternative_id, v.gear_category_id, NULL, v.min_count, v.max_count, v.adjusted_min_count, v.adjusted_max_count
FROM (VALUES
    ('0c8a5847-6b77-4018-aaf7-9505bb56fbd1'::uuid, 'd633b0d9-4b82-4101-b6d5-e201c38ee923'::uuid,
     '4740273a-f878-4719-8c0e-2626cac2566f'::uuid, 2, 2, 3, 3),
    ('dfa3f4fe-5e4a-4238-9c73-5e606a7873b6'::uuid, 'd633b0d9-4b82-4101-b6d5-e201c38ee923'::uuid,
     '524d08ca-da76-4d4e-8353-2317ab30419a'::uuid, 1, 1, 1, 2)
) AS v(id, alternative_id, gear_category_id, min_count, max_count, adjusted_min_count, adjusted_max_count)
WHERE EXISTS (SELECT 1 FROM playbook_pick_rule_alternatives a WHERE a.id = v.alternative_id);

INSERT INTO playbook_pick_rule_count_triggers (count_id, bespoke_option_id)
SELECT v.count_id, v.bespoke_option_id
FROM (VALUES
    ('0c8a5847-6b77-4018-aaf7-9505bb56fbd1'::uuid, 'ceecaf7f-c871-422b-afa1-68ce91229274'::uuid),
    ('0c8a5847-6b77-4018-aaf7-9505bb56fbd1'::uuid, '86965ce9-cbb5-479b-985a-5a7bda562de2'::uuid),
    ('dfa3f4fe-5e4a-4238-9c73-5e606a7873b6'::uuid, 'ad188960-40d2-48f3-8782-3a8caded1ae2'::uuid),
    ('dfa3f4fe-5e4a-4238-9c73-5e606a7873b6'::uuid, '9e5b2d72-c55b-45d0-9e91-2f89ce29e798'::uuid)
) AS v(count_id, bespoke_option_id)
WHERE EXISTS (SELECT 1 FROM playbook_pick_rule_counts c WHERE c.id = v.count_id);
");

            // The Monstrous: Natural Attacks, "Pick a Base and add an extra to it, or two Bases."
            migrationBuilder.Sql(@"
INSERT INTO playbook_pick_rules (id, playbook_id, label, sort_order)
SELECT '7922cc30-48c5-4bb9-a427-52e70f51b022'::uuid, p.id, 'Pick a Base and add an extra to it, or two Bases.', 0
FROM playbooks p
WHERE p.id = '2a1efd73-1c2d-4472-9ace-3c30d9ec9300'::uuid
  AND NOT EXISTS (SELECT 1 FROM playbook_pick_rules r WHERE r.playbook_id = p.id)
  -- Natural Attacks: a playbook-level section of this playbook, answered once...
  AND EXISTS (SELECT 1 FROM bespoke_sections s
              WHERE s.id = 'ad9481a1-da22-4b26-bae2-0722dbef31bf'::uuid AND s.playbook_id = p.id
                AND s.playbook_move_id IS NULL AND s.min_instances IS NULL AND s.max_instances IS NULL)
  -- ...whose top-level options are exactly Base and Extra, categories with room for 2 and 1.
  AND (SELECT count(*) FROM bespoke_options o
       WHERE o.section_id = 'ad9481a1-da22-4b26-bae2-0722dbef31bf'::uuid AND o.parent_option_id IS NULL) = 2
  AND EXISTS (SELECT 1 FROM bespoke_options o
              WHERE o.id = 'a6f63a15-cd9d-405d-a0a5-c25dab5ff742'::uuid
                AND o.section_id = 'ad9481a1-da22-4b26-bae2-0722dbef31bf'::uuid AND o.parent_option_id IS NULL
                AND (o.max_select IS NULL OR o.max_select >= 2)
                AND EXISTS (SELECT 1 FROM bespoke_options child WHERE child.parent_option_id = o.id))
  AND EXISTS (SELECT 1 FROM bespoke_options o
              WHERE o.id = 'acbda577-8524-4905-8f0b-f53d74034cb8'::uuid
                AND o.section_id = 'ad9481a1-da22-4b26-bae2-0722dbef31bf'::uuid AND o.parent_option_id IS NULL
                AND (o.max_select IS NULL OR o.max_select >= 1)
                AND EXISTS (SELECT 1 FROM bespoke_options child WHERE child.parent_option_id = o.id));

INSERT INTO playbook_pick_rule_alternatives (id, rule_id, label, sort_order)
SELECT v.id, r.id, NULL, v.sort_order
FROM playbook_pick_rules r
CROSS JOIN (VALUES
    ('268a7083-87ed-4199-aa1b-1667a6dcca55'::uuid, 0),
    ('39042040-31a4-4bb4-96f0-871ff9fc1317'::uuid, 1)
) AS v(id, sort_order)
WHERE r.id = '7922cc30-48c5-4bb9-a427-52e70f51b022'::uuid;

-- Alternative 1: 1 Base and 1 Extra. Alternative 2: 2 Base and 0 Extra.
INSERT INTO playbook_pick_rule_counts
    (id, alternative_id, gear_category_id, bespoke_option_id, min_count, max_count, adjusted_min_count, adjusted_max_count)
SELECT v.id, v.alternative_id, NULL, v.bespoke_option_id, v.n, v.n, NULL, NULL
FROM (VALUES
    ('b0902539-48d0-41cb-808d-ab418e419fe1'::uuid, '268a7083-87ed-4199-aa1b-1667a6dcca55'::uuid, 'a6f63a15-cd9d-405d-a0a5-c25dab5ff742'::uuid, 1),
    ('08309586-ae31-4ab9-9f79-4c04b8d934f3'::uuid, '268a7083-87ed-4199-aa1b-1667a6dcca55'::uuid, 'acbda577-8524-4905-8f0b-f53d74034cb8'::uuid, 1),
    ('02bdf6e8-15a9-415d-821e-934a8cdb1883'::uuid, '39042040-31a4-4bb4-96f0-871ff9fc1317'::uuid, 'a6f63a15-cd9d-405d-a0a5-c25dab5ff742'::uuid, 2),
    ('0f15edaa-1509-4718-a34e-d2d4d4e8751f'::uuid, '39042040-31a4-4bb4-96f0-871ff9fc1317'::uuid, 'acbda577-8524-4905-8f0b-f53d74034cb8'::uuid, 0)
) AS v(id, alternative_id, bespoke_option_id, n)
WHERE EXISTS (SELECT 1 FROM playbook_pick_rule_alternatives a WHERE a.id = v.alternative_id);
");

            // The Spell-Slinger: Combat Magic, "Pick three (with at least one base)."
            migrationBuilder.Sql(@"
INSERT INTO playbook_pick_rules (id, playbook_id, label, sort_order)
SELECT '4a2b3fe5-4232-4b5f-ad85-ba7f3f5d833e'::uuid, p.id, 'Pick three (with at least one base).', 0
FROM playbooks p
WHERE p.id = '6bd4946f-05aa-4c5b-a8d9-a634f95a1033'::uuid
  AND NOT EXISTS (SELECT 1 FROM playbook_pick_rules r WHERE r.playbook_id = p.id)
  -- Combat Magic: a playbook-level section of this playbook, answered once...
  AND EXISTS (SELECT 1 FROM bespoke_sections s
              WHERE s.id = '2ced7a94-a54b-42ae-bbb6-986dc379ccbd'::uuid AND s.playbook_id = p.id
                AND s.playbook_move_id IS NULL AND s.min_instances IS NULL AND s.max_instances IS NULL)
  -- ...whose top-level options are exactly Bases and Effects, categories with room for 3 and 2.
  AND (SELECT count(*) FROM bespoke_options o
       WHERE o.section_id = '2ced7a94-a54b-42ae-bbb6-986dc379ccbd'::uuid AND o.parent_option_id IS NULL) = 2
  AND EXISTS (SELECT 1 FROM bespoke_options o
              WHERE o.id = '37b4d08c-d079-4c71-a4d1-3e84eebad8b1'::uuid
                AND o.section_id = '2ced7a94-a54b-42ae-bbb6-986dc379ccbd'::uuid AND o.parent_option_id IS NULL
                AND (o.max_select IS NULL OR o.max_select >= 3)
                AND EXISTS (SELECT 1 FROM bespoke_options child WHERE child.parent_option_id = o.id))
  AND EXISTS (SELECT 1 FROM bespoke_options o
              WHERE o.id = '22e7c964-efe0-4f2b-af92-986fb1184aed'::uuid
                AND o.section_id = '2ced7a94-a54b-42ae-bbb6-986dc379ccbd'::uuid AND o.parent_option_id IS NULL
                AND (o.max_select IS NULL OR o.max_select >= 2)
                AND EXISTS (SELECT 1 FROM bespoke_options child WHERE child.parent_option_id = o.id));

INSERT INTO playbook_pick_rule_alternatives (id, rule_id, label, sort_order)
SELECT v.id, r.id, NULL, v.sort_order
FROM playbook_pick_rules r
CROSS JOIN (VALUES
    ('443699a9-8052-408d-a501-4d9adfa98728'::uuid, 0),
    ('49db7cf4-9ef9-414a-b365-170fdf700f74'::uuid, 1),
    ('a2df5d97-2f1c-4cc7-bafc-67adf911bf71'::uuid, 2)
) AS v(id, sort_order)
WHERE r.id = '4a2b3fe5-4232-4b5f-ad85-ba7f3f5d833e'::uuid;

-- Alternatives: 3 Bases and 0 Effects; 2 and 1; 1 and 2.
INSERT INTO playbook_pick_rule_counts
    (id, alternative_id, gear_category_id, bespoke_option_id, min_count, max_count, adjusted_min_count, adjusted_max_count)
SELECT v.id, v.alternative_id, NULL, v.bespoke_option_id, v.n, v.n, NULL, NULL
FROM (VALUES
    ('c47eb11e-ca05-4953-97cd-b95780c8ffb7'::uuid, '443699a9-8052-408d-a501-4d9adfa98728'::uuid, '37b4d08c-d079-4c71-a4d1-3e84eebad8b1'::uuid, 3),
    ('7db3a85b-db20-485c-99ad-7f75584fc556'::uuid, '443699a9-8052-408d-a501-4d9adfa98728'::uuid, '22e7c964-efe0-4f2b-af92-986fb1184aed'::uuid, 0),
    ('1732e029-bff5-4f01-b7dd-ee53d81c76a9'::uuid, '49db7cf4-9ef9-414a-b365-170fdf700f74'::uuid, '37b4d08c-d079-4c71-a4d1-3e84eebad8b1'::uuid, 2),
    ('8d2e449b-ce6a-4c69-a4fe-48dbe0501d62'::uuid, '49db7cf4-9ef9-414a-b365-170fdf700f74'::uuid, '22e7c964-efe0-4f2b-af92-986fb1184aed'::uuid, 1),
    ('10148d7c-f4ff-4ca7-b372-012d61da9f6a'::uuid, 'a2df5d97-2f1c-4cc7-bafc-67adf911bf71'::uuid, '37b4d08c-d079-4c71-a4d1-3e84eebad8b1'::uuid, 1),
    ('7ce745f6-28a6-409f-aa10-be9fbbabf6fb'::uuid, 'a2df5d97-2f1c-4cc7-bafc-67adf911bf71'::uuid, '22e7c964-efe0-4f2b-af92-986fb1184aed'::uuid, 2)
) AS v(id, alternative_id, bespoke_option_id, n)
WHERE EXISTS (SELECT 1 FROM playbook_pick_rule_alternatives a WHERE a.id = v.alternative_id);
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "playbook_pick_rule_count_triggers");

            migrationBuilder.DropTable(
                name: "playbook_pick_rule_counts");

            migrationBuilder.DropTable(
                name: "playbook_pick_rule_alternatives");

            migrationBuilder.DropTable(
                name: "playbook_pick_rules");
        }
    }
}
