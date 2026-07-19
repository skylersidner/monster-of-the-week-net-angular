using Microsoft.EntityFrameworkCore;
using MonsterOfTheWeek.Api.Data;

var builder = WebApplication.CreateBuilder(args);

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? throw new InvalidOperationException("Cors:AllowedOrigins must be configured.");
var connectionString = builder.Configuration.GetConnectionString("Postgres")
    ?? throw new InvalidOperationException("ConnectionStrings:Postgres must be configured.");

builder.Services.AddHealthChecks();
builder.Services.AddProblemDetails();
builder.Services.AddDbContext<MotwDbContext>(options => options.UseNpgsql(connectionString));
builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendDev", policy =>
    {
        policy.WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();

app.UseExceptionHandler();
app.UseCors("FrontendDev");
app.UseHttpsRedirection();

using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<MotwDbContext>();
    await MotwDbInitializer.InitializeAsync(dbContext);
}

app.MapHealthChecks("/health/live");

app.Run();
