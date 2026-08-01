using Microsoft.EntityFrameworkCore;
using MonsterOfTheWeek.Api.Data;
using MonsterOfTheWeek.Api.Repositories;
using MonsterOfTheWeek.Api.Services;
using MonsterOfTheWeek.Api.Services.Search;

var builder = WebApplication.CreateBuilder(args);

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? throw new InvalidOperationException("Cors:AllowedOrigins must be configured.");
var connectionString = builder.Configuration.GetConnectionString("Postgres")
    ?? throw new InvalidOperationException("ConnectionStrings:Postgres must be configured.");

builder.Services.AddHealthChecks();
builder.Services.AddProblemDetails();
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddDbContext<MotwDbContext>(options => options.UseNpgsql(connectionString));
builder.Services.AddScoped<IMysteryRepository, MysteryRepository>();
builder.Services.AddScoped<IMonsterRepository, MonsterRepository>();
builder.Services.AddScoped<ILocationRepository, LocationRepository>();
builder.Services.AddScoped<IBystanderRepository, BystanderRepository>();
builder.Services.AddScoped<IReferenceRepository, ReferenceRepository>();
builder.Services.AddScoped<IMysteryService, MysteryService>();
builder.Services.AddScoped<IMonsterService, MonsterService>();
builder.Services.AddScoped<IMinionRepository, MinionRepository>();
builder.Services.AddScoped<IMinionService, MinionService>();
builder.Services.AddScoped<ILocationService, LocationService>();
builder.Services.AddScoped<IBystanderService, BystanderService>();
builder.Services.AddScoped<IReferenceService, ReferenceService>();
builder.Services.AddScoped<ISearchProvider, MysterySearchProvider>();
builder.Services.AddScoped<ISearchProvider, MonsterSearchProvider>();
builder.Services.AddScoped<ISearchProvider, MinionSearchProvider>();
builder.Services.AddScoped<ISearchProvider, LocationSearchProvider>();
builder.Services.AddScoped<ISearchProvider, BystanderSearchProvider>();
builder.Services.AddScoped<ISearchService, SearchService>();
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
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<MotwDbContext>();
    await MotwDbInitializer.InitializeAsync(dbContext);
}

app.MapHealthChecks("/health/live");
app.MapControllers();

app.Run();
