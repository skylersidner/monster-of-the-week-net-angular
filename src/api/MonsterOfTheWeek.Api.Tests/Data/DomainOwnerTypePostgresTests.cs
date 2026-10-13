using Microsoft.EntityFrameworkCore;
using MonsterOfTheWeek.Api.Data;
using MonsterOfTheWeek.Api.Data.Entities;

namespace MonsterOfTheWeek.Api.Tests.Data;

/// <summary>
/// <b>U0's data-contract gate</b> — <c>docs/resource-images/endpoint-unification.md</c> §2.6.5.
///
/// <para>
/// Merging <c>ResourceOwnerType</c> and <c>CustomMoveOwnerType</c> into one
/// <see cref="DomainOwnerType"/> is not a migration, for one reason and one reason only: both
/// columns are <c>.HasConversion&lt;string&gt;()</c>, so <b>the five member identifiers are
/// literally the bytes in <c>custom_moves.owner_type</c> and <c>resource_images.owner_type</c></b>.
/// Member <i>order</i> is free — the ordinals were never stored, which is what made two enums with
/// different orders cost nothing to reconcile — but a member <i>rename</i> silently invalidates
/// every existing row in both tables, and the failure does not surface until something tries to
/// materialise one.
/// </para>
///
/// <para>
/// So this asserts the thing the merge is conditional on, against the real provider: every member
/// of the merged enum writes and reads back as its own name, through both tables. <b>Gated on
/// Postgres rather than run on SQLite deliberately</b> — the claim is about what the Npgsql
/// provider puts in a <c>character varying(16)</c> column, and a SQLite round trip would prove it
/// about the wrong database. The column widths are checked too, because <c>HasMaxLength(16)</c> is
/// the other half of "a member name is storable": the longest member today is <c>Bystander</c>, at
/// nine.
/// </para>
///
/// <para>
/// <see cref="PostgresCollection"/> for the same reason every other Postgres-gated class carries
/// it: each one drops and recreates whatever <c>MOTW_TEST_POSTGRES</c> names, and xunit runs
/// classes in parallel. Skipped when the variable is unset, so a plain <c>dotnet test</c> reports
/// it as <c>Skipped</c> and never as a false pass. Never point it at the dev <c>motw</c> database.
/// </para>
/// </summary>
[Collection(PostgresCollection.Name)]
public sealed class DomainOwnerTypePostgresTests
{
    private static string ConnectionString =>
        Environment.GetEnvironmentVariable(PostgresFactAttribute.ConnectionStringEnvironmentVariable)!;

    /// <summary>
    /// The five strings, written out. <b>Transcribed on purpose, and it is the only transcription
    /// in this file</b> — every other assertion here derives from <c>Enum.GetNames</c>, which is
    /// exactly why none of them can see a rename: rename a member and both sides of a derived
    /// comparison move together. A pinned list is the whole mechanism. Sorted, so member order
    /// stays free (§2.6.5: the ordinals were never persisted).
    /// </summary>
    private static readonly string[] StoredMemberNames =
        ["Bystander", "Location", "Minion", "Monster", "Mystery"];

    [PostgresFact]
    [Trait("Category", "Postgres")]
    public async Task Every_DomainOwnerType_member_is_stored_as_its_own_name_in_both_owner_type_columns()
    {
        var options = new DbContextOptionsBuilder<MotwDbContext>().UseNpgsql(ConnectionString).Options;

        await using var context = new MotwDbContext(options);
        await context.Database.EnsureDeletedAsync();
        await context.Database.MigrateAsync();

        var members = Enum.GetValues<DomainOwnerType>();

        // Half one: the names have not moved. Nothing below can assert this, because everything
        // below reads the member names out of the enum and so agrees with any rename.
        Assert.Equal(StoredMemberNames, Enum.GetNames<DomainOwnerType>().Order());

        // Written straight through the context, not through the services: resource_images would
        // never accept a Mystery through IResourceImageService, and the question here is what the
        // converter writes, not what the feature allows. Owner ids are arbitrary — neither column
        // has an FK (the discriminator pair cannot reference five tables), which is what makes
        // seeding all five members against both tables possible at all.
        foreach (var member in members)
        {
            context.CustomMoves.Add(new CustomMove
            {
                OwnerType = member,
                OwnerId = Guid.NewGuid(),
                Name = $"Move for {member}",
                Description = null,
            });

            context.ResourceImages.Add(new ResourceImage
            {
                OwnerType = member,
                OwnerId = Guid.NewGuid(),
                FileName = $"{member}.jpg",
                ContentType = "image/jpeg",
                SizeBytes = 4,
                Width = 1,
                Height = 1,
                ImageBytes = [1, 2, 3, 4],
                SortOrder = 1,
                CreatedAt = DateTimeOffset.UtcNow,
            });
        }

        await context.SaveChangesAsync();

        // Read back as raw text, not through the model. Round-tripping an enum through EF would
        // pass even if the converter stored ordinals, because the same converter would read them
        // back — the whole point is to see the characters sitting in the column.
        var connection = context.Database.GetDbConnection();
        await connection.OpenAsync();

        foreach (var table in new[] { "custom_moves", "resource_images" })
        {
            await using var command = connection.CreateCommand();
            command.CommandText = $"SELECT DISTINCT owner_type FROM {table} ORDER BY owner_type";

            var stored = new List<string>();
            await using (var reader = await command.ExecuteReaderAsync())
            {
                while (await reader.ReadAsync())
                {
                    stored.Add(reader.GetString(0));
                }
            }

            Assert.Equal(members.Select(m => m.ToString()).Order(), stored);
        }

        // The column is still wide enough for the names it now has to hold, and is still the
        // varchar the string converter needs rather than an integer the merge might have moved it
        // to. Checked for both columns, since only one of them was ever part of this decision.
        await using var widthCommand = connection.CreateCommand();
        widthCommand.CommandText = """
            SELECT table_name, data_type, character_maximum_length
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND column_name = 'owner_type'
              AND table_name IN ('custom_moves', 'resource_images')
            ORDER BY table_name
            """;

        var columns = new List<(string Table, string DataType, int Length)>();
        await using (var reader = await widthCommand.ExecuteReaderAsync())
        {
            while (await reader.ReadAsync())
            {
                columns.Add((reader.GetString(0), reader.GetString(1), reader.GetInt32(2)));
            }
        }

        Assert.Equal(2, columns.Count);
        Assert.All(columns, column =>
        {
            Assert.Equal("character varying", column.DataType);
            Assert.True(
                column.Length >= members.Max(m => m.ToString().Length),
                $"{column.Table}.owner_type holds {column.Length} characters, shorter than the longest member name");
        });

        // Half three, and the one that models the actual failure: an EXISTING row, written before
        // whatever change is being reviewed, still materialises. Inserted as raw SQL with the
        // pinned literals rather than through EF, because a row EF wrote is a row EF can read back
        // by construction — it would agree with a rename on both ends and prove nothing. The string
        // converter parses on read, so a member renamed out from under these rows throws here
        // instead of in production.
        await using (var seedCommand = connection.CreateCommand())
        {
            seedCommand.CommandText = string.Join("\n", StoredMemberNames.Select(name => $"""
                INSERT INTO custom_moves (id, owner_type, owner_id, name)
                VALUES (gen_random_uuid(), '{name}', gen_random_uuid(), 'Pre-existing {name} move');
                """));
            await seedCommand.ExecuteNonQueryAsync();
        }

        await using var verifyContext = new MotwDbContext(options);
        var materialised = await verifyContext.CustomMoves
            .AsNoTracking()
            .Where(x => x.Name.StartsWith("Pre-existing "))
            .ToListAsync();

        Assert.Equal(StoredMemberNames.Length, materialised.Count);
        Assert.Equal(StoredMemberNames, materialised.Select(x => x.OwnerType.ToString()).Order());
    }
}
