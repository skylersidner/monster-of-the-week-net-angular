using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace MonsterOfTheWeek.Api.Data;

public sealed class MotwDbContextFactory : IDesignTimeDbContextFactory<MotwDbContext>
{
    public MotwDbContext CreateDbContext(string[] args)
    {
        var environmentName = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Development";
        var basePath = Directory.GetCurrentDirectory();

        var configuration = new ConfigurationBuilder()
            .SetBasePath(basePath)
            .AddJsonFile("appsettings.json", optional: false)
            .AddJsonFile($"appsettings.{environmentName}.json", optional: true)
            .AddEnvironmentVariables()
            .Build();

        var connectionString = configuration.GetConnectionString("Postgres")
            ?? throw new InvalidOperationException("ConnectionStrings:Postgres must be configured.");

        var optionsBuilder = new DbContextOptionsBuilder<MotwDbContext>();
        optionsBuilder.UseNpgsql(connectionString);

        return new MotwDbContext(optionsBuilder.Options);
    }
}
