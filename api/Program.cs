using Azure.Core;
using Azure.Identity;
using MagnaReadAcross.Api.Data;
using MagnaReadAcross.Api.Models;
using MagnaReadAcross.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Identity.Web;

var builder = WebApplication.CreateBuilder(args);

// ── Configuration ─────────────────────────────────────────────────────────
const string CorsPolicy = "MagnaWebCors";

var corsOrigins = (builder.Configuration["Cors:AllowedOrigins"] ?? "http://localhost:4200")
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

builder.Services.AddCors(options =>
{
    options.AddPolicy(CorsPolicy, policy => policy
        .WithOrigins(corsOrigins)
        .AllowAnyHeader()
        .AllowAnyMethod());
});

builder.Services.AddControllers().AddJsonOptions(o =>
{
    o.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.Configure<AccessControlOptions>(builder.Configuration.GetSection(AccessControlOptions.SectionName));
builder.Services.Configure<BlobDatasetOptions>(builder.Configuration.GetSection(BlobDatasetOptions.SectionName));

var accessOptions = builder.Configuration.GetSection(AccessControlOptions.SectionName).Get<AccessControlOptions>()
                    ?? new AccessControlOptions();

if (!builder.Environment.IsDevelopment() || !accessOptions.BypassAuthInDevelopment)
{
    builder.Services
        .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddMicrosoftIdentityWebApi(builder.Configuration.GetSection("AzureAd"));
    builder.Services.AddAuthorization();
}

// ── SQL Server with Azure AD / Managed Identity ───────────────────────────
//
// The connection string in appsettings does NOT contain a password. In Azure,
// `DefaultAzureCredential` resolves via System-Assigned or User-Assigned MI
// (and falls back through env-vars / Visual Studio / Azure CLI / VS Code
// locally). The token is injected per-connection via SqlAuthenticationProvider.
//
// Prereq: the AAD identity must be added as a contained DB user, e.g.:
//   CREATE USER [<app-name>] FROM EXTERNAL PROVIDER;
//   ALTER ROLE db_datareader ADD MEMBER [<app-name>];
//   ALTER ROLE db_datawriter ADD MEMBER [<app-name>];
// ──────────────────────────────────────────────────────────────────────────
var connectionString = builder.Configuration.GetConnectionString("AzureSqlDb")
    ?? throw new InvalidOperationException("Missing connection string 'AzureSqlDb'.");
var credential = new DefaultAzureCredential();

builder.Services.AddDbContext<MagnaDbContext>(options =>
{
    var sqlConnection = new SqlConnection(connectionString);

    // Only attach an AAD token when no user/password was provided in the
    // connection string. Local devs running against SQL LocalDB / a Docker
    // image with SQL auth get to skip the token dance.
    var connBuilder = new SqlConnectionStringBuilder(connectionString);
    var hasSqlAuth = !string.IsNullOrEmpty(connBuilder.UserID)
                     || connBuilder.IntegratedSecurity
                     || connectionString.Contains("Authentication", StringComparison.OrdinalIgnoreCase);

    if (!hasSqlAuth)
    {
        var tokenContext = new TokenRequestContext(new[] { "https://database.windows.net/.default" });
        var token = credential.GetToken(tokenContext, default);
        sqlConnection.AccessToken = token.Token;
    }

    options.UseSqlServer(sqlConnection, sql =>
    {
        sql.EnableRetryOnFailure(maxRetryCount: 5, maxRetryDelay: TimeSpan.FromSeconds(5), errorNumbersToAdd: null);
        sql.MigrationsHistoryTable("__EFMigrationsHistory", "readacross");
    });
});

builder.Services.Configure<DashboardConfigOptions>(builder.Configuration.GetSection(DashboardConfigOptions.SectionName));

builder.Services.AddScoped<IInitiativeService, InitiativeService>();
builder.Services.AddScoped<IAggregatesService, AggregatesService>();
builder.Services.AddScoped<IInsightsService, InsightsService>();
builder.Services.AddScoped<IDashboardConfigService, DashboardConfigService>();
builder.Services.AddScoped<IAccessPolicyService, AccessPolicyService>();
builder.Services.AddScoped<IBlobDatasetService, BlobDatasetService>();
// Singleton: pnl-benchmarks blob is read-only, ~160 KB, parsed once at boot.
builder.Services.AddSingleton<IPnlBenchmarkService, PnlBenchmarkService>();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors(CorsPolicy);
app.UseHttpsRedirection();
if (!app.Environment.IsDevelopment() || !accessOptions.BypassAuthInDevelopment)
{
    app.UseAuthentication();
    app.UseAuthorization();
}
app.MapControllers();

app.MapGet("/healthz", () => Results.Ok(new { status = "ok", utc = DateTime.UtcNow }));

app.Run();
