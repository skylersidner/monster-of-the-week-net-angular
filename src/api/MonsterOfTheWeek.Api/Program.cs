using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
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
builder.Services.AddDataProtection()
    .PersistKeysToDbContext<MotwDbContext>()
    .SetApplicationName("MonsterOfTheWeek");
builder.Services.AddScoped<IMysteryRepository, MysteryRepository>();
builder.Services.AddScoped<IMonsterRepository, MonsterRepository>();
builder.Services.AddScoped<ILocationRepository, LocationRepository>();
builder.Services.AddScoped<IBystanderRepository, BystanderRepository>();
builder.Services.AddScoped<IReferenceRepository, ReferenceRepository>();
builder.Services.AddScoped<IUserRepository, UserRepository>();
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
builder.Services.AddScoped<IAuthService, AuthService>();

builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = "motw.session";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
            ? CookieSecurePolicy.SameAsRequest
            : CookieSecurePolicy.Always;
        options.ExpireTimeSpan = TimeSpan.FromHours(24);
        options.SlidingExpiration = true;

        // Mutate the existing Events object; never assign a new CookieAuthenticationEvents.
        // Assignment works today because nothing is pre-registered, but AddIdentityCookies()
        // installs OnValidatePrincipal = SecurityStampValidator.ValidatePrincipalAsync, and
        // replacing the object would discard it — after which sessions are never revalidated
        // and nothing errors. architecture.md section 1.5.
        //
        // These two overrides are mandatory, not cosmetic: the default handler answers an
        // unauthenticated API call with a 302 to /Account/Login, which is wrong for an API.
        options.Events.OnRedirectToLogin = context =>
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return Task.CompletedTask;
        };
        options.Events.OnRedirectToAccessDenied = context =>
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return Task.CompletedTask;
        };
    });

// Fails closed across every endpoint with no authorization metadata of its own — all 107
// existing controller actions — without editing a single controller. Opting out is per-endpoint
// via [AllowAnonymous]. architecture.md section 2.1.
builder.Services.AddAuthorizationBuilder()
    .SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build());

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
// UseAuthentication must precede UseAuthorization: without it the principal is unpopulated when
// the fallback policy runs and every request is anonymous, which fails closed and therefore looks
// like "the cookie isn't working."
app.UseAuthentication();
app.UseAuthorization();
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

// AllowAnonymous is required now that the fallback policy is active — without it the health
// endpoint is gated too, which breaks the SPA's availability probe and any container/proxy
// liveness check. architecture.md section 2.2.
app.MapHealthChecks("/health/live").AllowAnonymous();
app.MapControllers();

app.Run();
