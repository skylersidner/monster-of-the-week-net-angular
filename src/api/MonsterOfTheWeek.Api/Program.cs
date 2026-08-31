using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using MonsterOfTheWeek.Api.Data;
using MonsterOfTheWeek.Api.Data.Seed;
using MonsterOfTheWeek.Api.Repositories;
using MonsterOfTheWeek.Api.Services;
using MonsterOfTheWeek.Api.Services.Search;

var builder = WebApplication.CreateBuilder(args);

// Both ConnectionStrings and Cors now live in appsettings.Development.json only, so these
// guards actually fire on a production deploy that forgets ConnectionStrings__Postgres,
// instead of silently resolving a committed local placeholder and dying later inside
// MigrateAsync() with a socket error. architecture.md section 4.2 item 6.
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
builder.Services.AddScoped<IPlaybookRepository, PlaybookRepository>();
builder.Services.AddScoped<IPlaybookService, PlaybookService>();
builder.Services.AddScoped<IHunterRepository, HunterRepository>();
builder.Services.AddScoped<IHunterService, HunterService>();

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

// CORS is Development-only: production is single-origin and needs no cross-origin policy at all.
// Note this half uses builder.Environment (before Build()); the UseCors half below uses
// app.Environment. Guarding only one of the two leaves UseCors pointing at a policy that does not
// exist, which throws on the first request. architecture.md section 2.4.
if (builder.Environment.IsDevelopment())
{
    var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
        ?? throw new InvalidOperationException("Cors:AllowedOrigins must be configured.");

    builder.Services.AddCors(options =>
    {
        options.AddPolicy("FrontendDev", policy =>
        {
            policy.WithOrigins(allowedOrigins)
                .AllowAnyHeader()
                .AllowAnyMethod();
        });
    });
}

var app = builder.Build();

// Must come before anything that reads the scheme or the client address.
// KnownNetworks/KnownProxies default to loopback only, and the middleware discards the ENTIRE
// forwarded entry — X-Forwarded-Proto included — at the first hop that is not a known proxy.
// Railway terminates TLS at a non-loopback edge, so without these two Clear() calls this block
// does nothing, SecurePolicy.Always then refuses to emit motw.session, and it presents as
// "login succeeds but no cookie appears." Clearing both is exactly what the framework's own
// ASPNETCORE_FORWARDEDHEADERS_ENABLED shortcut does. architecture.md section 4.2 item 5.
//
// Residual, stated rather than hidden: a client reaching the app directly, bypassing the proxy,
// could assert its own X-Forwarded-Proto. Closed by the deployment requirement that the app is
// only reachable through its proxy; tighten to a real KnownProxies entry once the host is fixed.
if (!app.Environment.IsDevelopment())
{
    var forwardedHeadersOptions = new ForwardedHeadersOptions
    {
        ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
    };
    // The design (and the Phase 3 checklist) says "KnownNetworks.Clear()". That property is
    // [Obsolete] as of .NET 10 in favour of KnownIPNetworks, and the two are the SAME underlying
    // list — verified: clearing either leaves both at Count 0 — so this is the same fix under the
    // current name, not a weaker one.
    forwardedHeadersOptions.KnownIPNetworks.Clear();
    forwardedHeadersOptions.KnownProxies.Clear();
    app.UseForwardedHeaders(forwardedHeadersOptions);
}

app.UseExceptionHandler();

if (app.Environment.IsDevelopment())
{
    app.UseCors("FrontendDev");

    // Development-only. Railway's edge is HTTPS-only and already 301s plain HTTP itself, and always
    // sets X-Forwarded-Proto: https, so this has no job in Production. Inside the container it is
    // inert anyway (Kestrel binds HTTP only, so no port is resolvable) — but only until someone sets
    // HttpsPort/ASPNETCORE_HTTPS_PORT while debugging TLS, at which point it would start redirecting
    // Railway's deploy-time healthcheck, which requires a literal 200. architecture.md 4.2 item 5a.
    app.UseHttpsRedirection();
}

// Static files are served by MIDDLEWARE, which short-circuits before UseAuthorization ever runs —
// that is what makes the SPA's JS/CSS/ico anonymous with no configuration. They must stay above
// UseAuthentication for that to hold. architecture.md section 2.3.
app.UseDefaultFiles();
app.UseStaticFiles();

// Explicit, and load-bearing. With no UseRouting() call, WebApplicationBuilder inserts routing at
// the very FRONT of the pipeline, ahead of everything above — after which UseDefaultFiles() is dead
// code (both static-file middlewares no-op once an endpoint is matched, and MapFallbackToFile's
// {*path:nonfile} matches "/"), and section 2.3's diagnostic for a missing AllowAnonymous on the
// fallback — "/ keeps working while every deep link 401s" — becomes false because "/" would 401 too.
app.UseRouting();

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

// Developer command, not a server mode: rewrites Data/Seed/hunter-playbooks.json from the
// connected database and exits without ever listening. It runs here, after the host is built,
// specifically so it uses the same configuration, connection string and DI wiring the app
// does — a standalone script would have to duplicate all three and could drift from them.
if (args.Contains(PlaybookSeedExporter.CommandName))
{
    using var exportScope = app.Services.CreateScope();
    var exportDbContext = exportScope.ServiceProvider.GetRequiredService<MotwDbContext>();
    Console.WriteLine(await PlaybookSeedExporter.ExportAsync(exportDbContext, app.Environment.ContentRootPath));
    return;
}

using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<MotwDbContext>();
    await MotwDbInitializer.InitializeAsync(dbContext, app.Environment.ContentRootPath);
}

// AllowAnonymous is required now that the fallback policy is active — without it the health
// endpoint is gated too, which breaks the SPA's availability probe and any container/proxy
// liveness check. architecture.md section 2.2.
app.MapHealthChecks("/health/live").AllowAnonymous();
app.MapControllers();

// Unknown /api paths must NOT fall through to the SPA fallback. MapFallbackToFile registers at
// Order = int.MaxValue with a {*path:nonfile} pattern, so a misspelled API path — no file
// extension, matching no controller route — would otherwise be answered with index.html and a 200.
// Deliberately NOT AllowAnonymous: an anonymous caller gets 401, an authenticated one gets 404.
// Literal controller routes outrank a {**rest} catch-all, and a default-order endpoint beats the
// int.MaxValue fallback, so this sits precisely between the two. architecture.md section 2.3.
//
// Side effect worth knowing rather than filing as a bug later: app.Map maps every HTTP method, so
// an unsupported method on a real route (DELETE /api/mysteries) now lands here as 404/401 rather
// than 405.
app.Map("/api/{**rest}", () => Results.NotFound());

// THE most important line in this phase. The SPA fallback is an ENDPOINT, so the fallback policy
// applies to it; without AllowAnonymous every deep link — /login included — returns 401 before any
// HTML is served, the browser never loads the app that would let you log in, and the failure is
// unrecoverable from the browser. architecture.md section 2.3.
app.MapFallbackToFile("index.html").AllowAnonymous();

app.Run();
