namespace MagnaReadAcross.Api.Models;

public sealed class AccessControlOptions
{
    public const string SectionName = "AccessControl";

    public string AdminGroupObjectId { get; set; } = string.Empty;

    /// <summary>
    /// Local development defaults to an admin profile so the SPA can run before
    /// Azure AD app registrations and group claims are configured.
    /// </summary>
    public bool BypassAuthInDevelopment { get; set; } = true;
}
